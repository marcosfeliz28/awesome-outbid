import { randomBytes, randomInt } from "node:crypto";
import { Body, Controller, Get, Header, HttpException, Inject, Injectable, Param, Post, Req, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { hash } from "bcryptjs";
import { permissions, z } from "@fitstore/shared";
import { audit, Database, parse, Permit, Public, SUPPORT_EMAIL, type ActorRequest } from "./common";
import { authorizePlatform } from "./platform";
import { clientIp, RequestRateLimitService } from "./rate-limit";
import { forEachActiveTenant, tenantScope, tenantUnique } from "./tenant-context";

const supportEmail = SUPPORT_EMAIL;

@Controller("support-access")
export class SupportAccessController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get() @Permit("authenticated")
  async status(@Req() req: ActorRequest) {
    if (!req.actor.permissions.includes("*") && req.actor.role !== "support")
      return { enabled: false, expiresAt: null };
    const user = await this.db.user.findUnique({ where: tenantUnique("email", supportEmail) });
    return {
      enabled: !!user?.active && !!user.supportExpiresAt && user.supportExpiresAt > new Date(),
      expiresAt: user?.active ? user.supportExpiresAt : null,
    };
  }

  @Post("enable") @Permit("*") @Header("Cache-Control", "no-store")
  async enable(@Body() body: unknown, @Req() req: ActorRequest) {
    const { duration } = z.object({ duration: z.enum(["24h", "7d"]) }).strict().parse(body);
    const expiresAt = new Date(Date.now() + (duration === "24h" ? 1 : 7) * 86400000);
    const password = randomBytes(24).toString("base64url") + "Aa1!";
    const [passwordHash, pinHash] = await Promise.all([
      hash(password, 12), hash(String(randomInt(100000, 1000000)), 12),
    ]);
    await this.db.$transaction(async (tx) => {
      // Un rol editable jamás otorga escrituras a soporte: AuthGuard también
      // fija sus tres permisos de lectura independientemente de esta fila.
      const role = await tx.role.upsert({
        where: tenantUnique("name", "support"),
        create: { name: "support", permissions: permissions.support },
        update: { permissions: permissions.support },
      });
      const user = await tx.user.upsert({
        where: tenantUnique("email", supportEmail),
        create: {
          name: "Soporte de Nexora", username: "soporte-nexora", usernameKey: "soporte-nexora",
          email: supportEmail, passwordHash, pinHash, roleId: role.id,
          branchId: req.actor.branchId, active: true, supportExpiresAt: expiresAt,
          emailVerifiedAt: new Date(),
        },
        update: {
          passwordHash, pinHash, roleId: role.id, branchId: req.actor.branchId,
          active: true, mustChangePassword: false, supportExpiresAt: expiresAt,
          authVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await audit(tx, req.actor, "support.enable", "user", user.id, undefined, { expiresAt });
    });
    // Sólo esta respuesta contiene la clave. No se escribe en bitácora ni log.
    return { enabled: true, expiresAt, username: "soporte-nexora", password };
  }

  @Post("disable") @Permit("*")
  async disable(@Req() req: ActorRequest) {
    await this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: tenantUnique("email", supportEmail) });
      if (!user) return;
      await tx.user.update({ where: { id: user.id }, data: {
        active: false, supportExpiresAt: null, authVersion: { increment: 1 },
      } });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await audit(tx, req.actor, "support.disable", "user", user.id);
    });
    return { enabled: false, expiresAt: null };
  }
}

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
// SOP-04: la credencial de plataforma es compartida; quien abre se identifica y dice por qué.
const openInput = z.object({
  operadora: z.string().trim().min(2).max(80),
  motivo: z.string().trim().min(8).max(200),
}).strict();

/**
 * Lado del operador (token Platform). Solo ve y abre accesos que el
 * administrador de la empresa ya activó y que no vencieron. La sesión es la
 * del usuario «support»: el AuthGuard la deja en solo lectura y cada GET queda
 * en la bitácora de la empresa. Token de 15 min sin refresh.
 */
@Controller("platform")
export class PlatformSupportController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService,
  ) {}

  private activeSupport() {
    return this.db.user.findUnique({ where: tenantUnique("email", supportEmail) })
      .then((user) => user?.active && user.supportExpiresAt && user.supportExpiresAt > new Date() ? user : null);
  }

  @Public() @Get("support-grants") @Header("Cache-Control", "no-store")
  async grants(@Req() req: Request) {
    authorizePlatform(req, this.limits);
    const grants = [];
    // Empresa por empresa bajo su propio contexto (RLS), como el barrido de vencimiento.
    for (const tenantId of await this.db.loginTenantIds()) {
      const grant = await tenantScope.run({ tenantId }, async () => {
        const user = await this.activeSupport();
        if (!user) return null;
        const [tenant] = await this.db.$queryRaw<{ slug: string; name: string }[]>`SELECT slug, name FROM "Tenant" WHERE id = ${tenantId}::uuid`;
        return tenant && { ...tenant, expiresAt: user.supportExpiresAt };
      });
      if (grant) grants.push(grant);
    }
    return grants;
  }

  @Public() @Post("tenants/:slug/support-session") @Header("Cache-Control", "no-store")
  async open(@Param("slug") tenantSlug: string, @Body() body: unknown, @Req() req: Request) {
    authorizePlatform(req, this.limits);
    const why = parse(openInput, body);
    const tenantId = await this.db.resolveTenantSlug(parse(slug, tenantSlug));
    if (!tenantId) throw new HttpException("Empresa no encontrada.", 404);
    return tenantScope.run({ tenantId }, () => this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: tenantUnique("email", supportEmail), include: { role: true } });
      if (!user?.active || user.role.name !== "support" || !user.supportExpiresAt || user.supportExpiresAt <= new Date())
        throw new HttpException("La empresa no ha activado el acceso de soporte o ya venció.", 403);
      const session = await tx.authSession.create({ data: { userId: user.id } });
      await audit(tx, { id: user.id, name: user.name, email: user.email, role: "support", permissions: [],
        branchId: user.branchId, tenantId, ip: clientIp(req) }, "support.platform_session", "user", user.id, undefined,
      { sessionId: session.id, expiresAt: user.supportExpiresAt, ...why });
      const accessToken = this.jwt.sign(
        { sub: user.id, type: "access", version: user.authVersion, sid: session.id, tenantId },
        { expiresIn: "15m" },
      );
      return { accessToken, tokenType: "Bearer", expiresIn: 900, readOnly: true, supportExpiresAt: user.supportExpiresAt };
    }));
  }
}

@Injectable()
export class SupportAccessWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private first?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  constructor(@Inject(Database) private readonly db: Database) {}

  onApplicationBootstrap() {
    this.first = setTimeout(() => void this.run(), 5000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }
  async run(now?: Date): Promise<void> {
    // Si ya hay un barrido, el siguiente debe revisar de nuevo: el plazo
    // pudo vencer mientras el primero consultaba la base.
    if (this.running) {
      await this.running;
      return this.run(now);
    }
    const task = this.expire(now ?? new Date());
    this.running = task;
    try { await task; }
    finally { if (this.running === task) this.running = undefined; }
  }
  private async expire(now: Date) {
    try {
      // Incluye empresas suspendidas: sus sesiones de soporte también vencen.
      await forEachActiveTenant({ activeTenantIds: () => this.db.loginTenantIds() }, async () => {
        const expired = await this.db.user.findMany({
          where: { active: true, OR: [{ role: { name: "support" } }, { email: supportEmail }], supportExpiresAt: { lte: now } },
          select: { id: true, name: true, email: true, branchId: true, tenantId: true },
        });
        for (const user of expired) await this.db.$transaction(async (tx) => {
          const changed = await tx.user.updateMany({
            where: { id: user.id, active: true, supportExpiresAt: { lte: now } },
            data: { active: false, supportExpiresAt: null, authVersion: { increment: 1 } },
          });
          if (!changed.count) return;
          await tx.authSession.deleteMany({ where: { userId: user.id } });
          await tx.refreshToken.deleteMany({ where: { userId: user.id } });
          await audit(tx, { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, branchId: user.branchId, role: "support", permissions: [] },
            "support.expired", "user", user.id);
        });
      });
    } catch (error: any) {
      console.warn("[support-access] " + String(error?.message ?? error).slice(0, 160));
    }
  }
}

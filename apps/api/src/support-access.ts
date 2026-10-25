import { randomBytes, randomInt } from "node:crypto";
import { Body, Controller, Get, Header, Inject, Injectable, Post, Req, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { hash } from "bcryptjs";
import { permissions, z } from "@fitstore/shared";
import { audit, Database, Permit, type ActorRequest } from "./common";
import { forEachActiveTenant, tenantUnique } from "./tenant-context";

const supportEmail = "soporte-nexora@nexora.local";

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
          where: { active: true, role: { name: "support" }, supportExpiresAt: { lte: now } },
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

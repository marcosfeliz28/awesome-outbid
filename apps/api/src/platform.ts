import { Body, Controller, Get, HttpException, Inject, Param, Post, Req } from "@nestjs/common";
import { hash } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { z } from "@fitstore/shared";
import { BILLING_PLANS } from "./billing-plans";
import { Public, parse } from "./common";
import { clientIp, RequestRateLimitService } from "./rate-limit";
import { createTenantWithOwner, invitationDigest, RegistrationService } from "./registration";
import { effectiveTenantStatus, tenantDueAt } from "./tenant-lifecycle";

const DAY = 86400000;
const plans = Object.keys(BILLING_PLANS) as [keyof typeof BILLING_PLANS, ...(keyof typeof BILLING_PLANS)[]];
const slugParam = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
const invitedTenant = z.object({
  businessName: z.string().trim().min(2).max(120),
  companyCode: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  businessType: z.enum(["general", "retail", "beauty", "fitness", "services"]),
  plan: z.enum(plans),
  trialDays: z.number().int().min(1).max(365).default(30),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254),
}).strict();

const sha256Hex = (value: string | undefined) => {
  const hex = value?.trim().toLowerCase();
  return hex && /^[a-f0-9]{64}$/.test(hex) ? hex : null;
};

/**
 * Sin PLATFORM_ADMIN_TOKEN_SHA256 válido, las rutas del operador no existen (404).
 * PLA-01: PLATFORM_ADMIN_TOKEN_SHA256_NEXT (opcional) también vale, para rotar
 * la credencial sin corte: se publica la nueva, se cambia el cliente y luego
 * se mueve a la principal y se borra la vieja.
 */
export function authorizePlatform(req: Request, limits: RequestRateLimitService) {
  const expected = sha256Hex(process.env.PLATFORM_ADMIN_TOKEN_SHA256);
  if (process.env.PRODUCT_TENANCY !== "required" || !expected)
    throw new HttpException("No disponible.", 404);
  const accepted = [expected, sha256Hex(process.env.PLATFORM_ADMIN_TOKEN_SHA256_NEXT)].filter((hex): hex is string => !!hex);
  const ip = clientIp(req);
  if (limits.limited("platform-auth-fail", [ip], 5)) throw new HttpException("Demasiados intentos. Espera un minuto.", 429);
  const token = /^Platform (\S{64,512})$/.exec(req.headers.authorization ?? "")?.[1];
  const given = createHash("sha256").update(token ?? "").digest();
  // Compara contra todas, sin cortar en la primera, para no delatar cuál coincide.
  const matches = accepted.map(hex => timingSafeEqual(given, Buffer.from(hex, "hex")));
  if (!token || !matches.includes(true)) {
    limits.assert("platform-auth-fail", [ip], 5);
    throw new HttpException("No autorizado.", 401);
  }
}

/** Enlace de invitación; el token va en el fragmento: no llega a logs HTTP ni Referer. */
function invitationLink(req: Request, token: string) {
  const base = process.env.APP_PUBLIC_URL?.trim() || process.env.WEB_ORIGIN?.trim().split(",")[0]
    || `${req.protocol}://${req.get("host")}`;
  const url = new URL("/aceptar-invitacion", base);
  url.hash = `token=${token}`;
  return url.toString();
}

@Controller("platform")
export class PlatformController {
  constructor(
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService,
  ) {}

  private authorize(req: Request) { authorizePlatform(req, this.limits); }

  @Public() @Get("tenants")
  async list(@Req() req: Request) {
    this.authorize(req);
    const rows = await this.registration.db.tenant.findMany({
      select: { id: true, slug: true, name: true, plan: true, status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    // Estado de cobro calculado con el reloj, aunque el trabajador no haya corrido.
    return rows.map(({ pastDueAt, paidThroughAt, ...row }) => ({
      ...row, paidUntil: paidThroughAt, status: effectiveTenantStatus({ ...row, paidThroughAt, pastDueAt }),
    }));
  }

  @Public() @Post("tenants")
  async create(@Body() body: unknown, @Req() req: Request) {
    this.authorize(req);
    const input = parse(invitedTenant, body);
    const email = input.adminEmail.toLowerCase();
    const token = randomBytes(32).toString("hex");
    // Clave y PIN aleatorios descartados: nadie los conoce hasta aceptar la invitación.
    const unusable = await hash(randomBytes(32).toString("hex"), 12);
    try {
      // Piloto con acuerdo en papel: sin consentimiento web (términos nulos).
      const tenant = await this.registration.db.$transaction(tx => createTenantWithOwner(tx, {
        slug: input.companyCode, name: input.businessName, businessType: input.businessType,
        plan: input.plan, status: "trial", trialEndsAt: new Date(Date.now() + input.trialDays * DAY),
      }, {
        name: input.adminName, email, passwordHash: unusable, pinHash: unusable,
        verificationHash: invitationDigest(token), verificationExpiresAt: new Date(Date.now() + 7 * DAY),
      }));
      // Bitácora del operador, sin el token.
      console.log(`[plataforma] empresa piloto creada: ${tenant.slug} (${tenant.plan})`);
      return { id: tenant.id, slug: tenant.slug, plan: tenant.plan, status: tenant.status, trialEndsAt: tenant.trialEndsAt, invitationUrl: invitationLink(req, token) };
    } catch (error: any) {
      if (error?.code === "P2002") throw new HttpException("Este código de empresa ya está ocupado.", 409);
      throw error;
    }
  }

  /** Solo conteos y montos: ningún dato de negocio de las empresas. */
  @Public() @Get("summary")
  async summary(@Req() req: Request) {
    this.authorize(req);
    const now = new Date();
    const rows = await this.registration.db.tenant.findMany({
      select: { status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true },
    });
    const out = { total: rows.length, alDia: 0, enPrueba: 0, porVencer: 0, atrasados: 0, suspendidos: 0 };
    for (const tenant of rows) {
      const status = effectiveTenantStatus(tenant, now);
      if (status === "suspended") out.suspendidos++;
      else if (status === "past_due") out.atrasados++;
      else if ((tenantDueAt(tenant)?.getTime() ?? Infinity) - now.getTime() <= 7 * DAY) out.porVencer++;
      else if (status === "trial") out.enPrueba++;
      else out.alDia++;
    }
    // Mes calendario de la operadora (República Dominicana, UTC-4 sin horario de verano).
    const [income] = await this.registration.db.$queryRaw<{ month: string; amount: string }[]>`
      SELECT to_char(now() AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM') AS month,
        coalesce(sum(amount), 0)::text AS amount FROM "PlatformPayment"
      WHERE "createdAt" >= (date_trunc('month', now() AT TIME ZONE 'America/Santo_Domingo')
        AT TIME ZONE 'America/Santo_Domingo' AT TIME ZONE 'UTC')`;
    return { ...out, month: income.month, monthIncome: Number(income.amount) };
  }

  @Public() @Get("tenants/:slug")
  async detail(@Param("slug") rawSlug: string, @Req() req: Request) {
    this.authorize(req);
    const tenant = await this.registration.db.tenant.findUnique({
      where: { slug: parse(slugParam, rawSlug) },
      select: { id: true, slug: true, name: true, plan: true, status: true, businessType: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, createdAt: true },
    });
    if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
    // Dueña de la empresa: la primera cuenta admin (la del alta), para contacto de soporte.
    const owner = await this.registration.db.user.findFirst({
      where: { tenantId: tenant.id, role: { name: "admin" } }, orderBy: { createdAt: "asc" },
      select: { name: true, email: true, emailVerifiedAt: true, emailVerificationHash: true, emailVerificationExpiresAt: true },
    });
    const pending = !!owner && !owner.emailVerifiedAt && !!owner.emailVerificationHash?.startsWith("invite:");
    const { pastDueAt, paidThroughAt, ...row } = tenant;
    return {
      ...row, paidUntil: paidThroughAt, status: effectiveTenantStatus({ ...row, paidThroughAt, pastDueAt }),
      admin: owner && { name: owner.name, email: owner.email, invitationPending: pending, invitationExpiresAt: pending ? owner.emailVerificationExpiresAt : null },
    };
  }

  /** Enlace nuevo: el anterior deja de servir. Solo mientras la invitación no se haya aceptado. */
  @Public() @Post("tenants/:slug/reinvite")
  async reinvite(@Param("slug") rawSlug: string, @Req() req: Request) {
    this.authorize(req);
    const code = parse(slugParam, rawSlug);
    const tenant = await this.registration.db.tenant.findUnique({ where: { slug: code }, select: { id: true } });
    if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * DAY);
    // Condicional: si se acepta a la vez, solo uno de los dos gana.
    const result = await this.registration.db.user.updateMany({
      where: { tenantId: tenant.id, emailVerifiedAt: null, emailVerificationHash: { startsWith: "invite:" } },
      data: { emailVerificationHash: invitationDigest(token), emailVerificationExpiresAt: expiresAt },
    });
    if (result.count !== 1) throw new HttpException("La invitación ya se aceptó: la empresa entra con su propia clave.", 409);
    console.log(`[plataforma] invitación reenviada: ${code}`);
    return { slug: code, invitationUrl: invitationLink(req, token), expiresAt };
  }
}

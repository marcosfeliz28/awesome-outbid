import { Body, Controller, Get, HttpException, Inject, Post, Req } from "@nestjs/common";
import { hash } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { z } from "@fitstore/shared";
import { BILLING_PLANS } from "./billing-plans";
import { Public, parse } from "./common";
import { clientIp, RequestRateLimitService } from "./rate-limit";
import { createTenantWithOwner, invitationDigest, RegistrationService } from "./registration";

const DAY = 86400000;
const plans = Object.keys(BILLING_PLANS) as [keyof typeof BILLING_PLANS, ...(keyof typeof BILLING_PLANS)[]];
const invitedTenant = z.object({
  businessName: z.string().trim().min(2).max(120),
  companyCode: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  businessType: z.enum(["general", "retail", "beauty", "fitness", "services"]),
  plan: z.enum(plans),
  trialDays: z.number().int().min(1).max(365).default(30),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254),
}).strict();

/**
 * Operador de la plataforma (no es un usuario de ninguna empresa). Sin
 * PLATFORM_ADMIN_TOKEN_SHA256 válido, las rutas no existen (404).
 */
export function authorizePlatform(limits: RequestRateLimitService, req: Request) {
  const expected = process.env.PLATFORM_ADMIN_TOKEN_SHA256?.trim().toLowerCase();
  if (process.env.PRODUCT_TENANCY !== "required" || !expected || !/^[a-f0-9]{64}$/.test(expected))
    throw new HttpException("No disponible.", 404);
  const ip = clientIp(req);
  if (limits.limited("platform-auth-fail", [ip], 5)) throw new HttpException("Demasiados intentos. Espera un minuto.", 429);
  const token = /^Platform (\S{64,512})$/.exec(req.headers.authorization ?? "")?.[1];
  const given = createHash("sha256").update(token ?? "").digest();
  if (!token || !timingSafeEqual(given, Buffer.from(expected, "hex"))) {
    limits.assert("platform-auth-fail", [ip], 5);
    throw new HttpException("No autorizado.", 401);
  }
}

@Controller("platform")
export class PlatformController {
  constructor(
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService,
  ) {}

  private authorize(req: Request) {
    authorizePlatform(this.limits, req);
  }

  @Public() @Get("tenants")
  async list(@Req() req: Request) {
    this.authorize(req);
    return this.registration.db.tenant.findMany({
      select: { id: true, slug: true, name: true, plan: true, status: true, trialEndsAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
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
      const base = process.env.APP_PUBLIC_URL?.trim() || process.env.WEB_ORIGIN?.trim().split(",")[0]
        || `${req.protocol}://${req.get("host")}`;
      const url = new URL("/aceptar-invitacion", base);
      // Fragmento: el token no llega a logs HTTP ni Referer.
      url.hash = `token=${token}`;
      // Bitácora del operador, sin el token.
      console.log(`[plataforma] empresa piloto creada: ${tenant.slug} (${tenant.plan})`);
      return { id: tenant.id, slug: tenant.slug, plan: tenant.plan, status: tenant.status, trialEndsAt: tenant.trialEndsAt, invitationUrl: url.toString() };
    } catch (error: any) {
      if (error?.code === "P2002") throw new HttpException("Este código de empresa ya está ocupado.", 409);
      throw error;
    }
  }
}

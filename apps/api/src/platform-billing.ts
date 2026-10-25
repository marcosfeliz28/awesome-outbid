import { Body, Controller, Get, HttpException, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "@fitstore/shared";
import { Public, parse } from "./common";
import { authorizePlatform } from "./platform";
import { RequestRateLimitService } from "./rate-limit";
import { RegistrationService } from "./registration";

// PC-23: cobro manual. Sólo el operador de la plataforma; ninguna empresa
// puede marcar pagos. Sin pasarela ni datos de tarjeta: el dinero se cobra
// fuera del sistema y aquí se anota.
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
const paymentInput = z.object({
  amount: z.number().positive().max(10_000_000).multipleOf(0.01),
  method: z.enum(["transfer", "cash", "card_in_store", "courier"]),
  reference: z.string().trim().min(1).max(120),
  months: z.number().int().min(1).max(12).optional(),
  year: z.literal(true).optional(),
}).strict().refine(v => (v.months === undefined) !== (v.year === undefined), "Indica los meses (1 a 12) o el año, no ambos.");

/** Suma meses en UTC; un 31 pasa al último día del mes corto (31-ene + 1 = 28/29-feb). */
export function addMonths(from: Date, months: number) {
  const day = from.getUTCDate();
  const out = new Date(from);
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

type TenantRow = { id: string; status: string; trialEndsAt: Date | null; paidThroughAt: Date | null };
const paymentSelect = {
  id: true, amount: true, method: true, reference: true, months: true,
  operator: true, paidFrom: true, paidUntil: true, createdAt: true,
} as const;

@Controller("platform")
export class PlatformBillingController {
  constructor(
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService,
  ) {}

  @Public() @Post("tenants/:slug/payments")
  async register(@Param("slug") rawSlug: string, @Body() body: unknown, @Req() req: Request) {
    authorizePlatform(req, this.limits);
    const code = parse(slug, rawSlug);
    const input = parse(paymentInput, body);
    const months = input.year ? 12 : input.months!;
    const operator = process.env.PLATFORM_OPERATOR_LABEL?.trim().slice(0, 100) || "operador-plataforma";
    const result = await this.registration.db.$transaction(async tx => {
      // FOR UPDATE: dos pagos simultáneos se suman, no se pisan.
      const [tenant] = await tx.$queryRaw<TenantRow[]>`
        SELECT id, status, "trialEndsAt", "paidThroughAt" FROM "Tenant" WHERE slug=${code} FOR UPDATE`;
      if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
      const now = new Date();
      // Se extiende desde lo que quede pagado (o de prueba); si ya venció, desde hoy.
      const candidates = [now, tenant.paidThroughAt, tenant.status === "trial" ? tenant.trialEndsAt : null];
      const paidFrom = new Date(Math.max(...candidates.map(d => d?.getTime() ?? 0)));
      const paidUntil = addMonths(paidFrom, months);
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: "active", paidThroughAt: paidUntil, pastDueAt: null, suspendedAt: null },
      });
      const payment = await tx.platformPayment.create({
        data: { tenantId: tenant.id, amount: input.amount.toFixed(2), method: input.method, reference: input.reference, months, operator, paidFrom, paidUntil },
        select: paymentSelect,
      });
      return { payment, tenant: { slug: code, status: "active", paidUntil } };
    });
    console.log(`[plataforma] pago registrado: ${code} (${months} mes/es, hasta ${result.tenant.paidUntil.toISOString()})`);
    return result;
  }

  @Public() @Get("tenants/:slug/payments")
  async list(@Param("slug") rawSlug: string, @Req() req: Request) {
    authorizePlatform(req, this.limits);
    const tenant = await this.registration.db.tenant.findUnique({ where: { slug: parse(slug, rawSlug) }, select: { id: true } });
    if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
    return this.registration.db.platformPayment.findMany({
      where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, select: paymentSelect,
    });
  }
}

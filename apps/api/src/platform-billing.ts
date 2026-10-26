import { Body, Controller, Get, HttpException, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "@fitstore/shared";
import { BILLING_PLANS } from "./billing-plans";
import { Public, parse } from "./common";
import { authorizePlatform } from "./platform";
import { notifyOperator } from "./platform-notify";
import { RequestRateLimitService } from "./rate-limit";
import { RegistrationService } from "./registration";

// PC-23: cobro manual. Sólo el operador de la plataforma; ninguna empresa
// puede marcar pagos. Sin pasarela ni datos de tarjeta: el dinero se cobra
// fuera del sistema y aquí se anota.
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
const paymentInput = z.object({
  // PLA-02: la misma operación reenviada (doble clic, respuesta perdida) no se cobra dos veces.
  operationId: z.string().uuid(),
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

/** PLA-03: el servidor fija el monto: mensualidad × meses; el año vale 10 meses. */
export function expectedPayment(plan: string, months: number, year: boolean) {
  if (!Object.prototype.hasOwnProperty.call(BILLING_PLANS, plan)) return null;
  return BILLING_PLANS[plan as keyof typeof BILLING_PLANS].monthlyDop * (year ? 10 : months);
}
/** Referencia comparable: sin espacios y sin distinguir mayúsculas. */
export const normalizeReference = (value: string) => value.replace(/\s+/g, "").toLowerCase();

type TenantRow = { id: string; status: string; plan: string; trialEndsAt: Date | null; paidThroughAt: Date | null };
const paymentSelect = {
  id: true, operationId: true, plan: true, amount: true, method: true, reference: true, months: true,
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
        SELECT id, status, plan, "trialEndsAt", "paidThroughAt" FROM "Tenant" WHERE slug=${code} FOR UPDATE`;
      if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
      const previous = await tx.platformPayment.findUnique({ where: { operationId: input.operationId }, select: { ...paymentSelect, tenantId: true } });
      if (previous) {
        const { tenantId: previousTenant, ...payment } = previous;
        if (previousTenant !== tenant.id || Number(payment.amount) !== input.amount || payment.method !== input.method ||
          payment.months !== months || normalizeReference(payment.reference) !== normalizeReference(input.reference))
          throw new HttpException("Esa operación ya se registró con otros datos.", 409);
        return { tenantId: tenant.id, payment, tenant: { slug: code, status: "active", paidUntil: payment.paidUntil }, replayed: true };
      }
      const expected = expectedPayment(tenant.plan, months, !!input.year);
      if (expected === null) throw new HttpException("La empresa no tiene un plan con precio.", 409);
      if (input.amount !== expected)
        throw new HttpException(`El monto debe ser RD$${expected.toFixed(2)} (plan ${tenant.plan}, ${input.year ? "un año" : `${months} mes/es`}).`, 400);
      if (input.method === "transfer") {
        const [dup] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "PlatformPayment" WHERE "tenantId"=${tenant.id}::uuid AND method='transfer'
            AND lower(regexp_replace(reference, '[[:space:]]+', '', 'g'))=${normalizeReference(input.reference)} LIMIT 1`;
        if (dup) throw new HttpException("Esa referencia de transferencia ya se registró para esta empresa.", 409);
      }
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
        data: { tenantId: tenant.id, operationId: input.operationId, plan: tenant.plan, amount: input.amount.toFixed(2), method: input.method, reference: input.reference, months, operator, paidFrom, paidUntil },
        select: paymentSelect,
      });
      return { tenantId: tenant.id, payment, tenant: { slug: code, status: "active", paidUntil }, replayed: false };
    });
    if (result.replayed) {
      const { tenantId: _tenantId, replayed: _replayed, ...response } = result;
      return response;
    }
    console.log(`[plataforma] pago registrado: ${code} (${months} mes/es, hasta ${result.tenant.paidUntil.toISOString()})`);
    const { tenantId, replayed: _replayed, ...response } = result;
    // paidUntil crece con cada pago: sirve de clave única del aviso.
    await notifyOperator(this.registration.db, {
      tenantId, event: "op_payment", key: result.tenant.paidUntil, amount: input.amount,
      detail: `${months} mes/es, pagado hasta ${result.tenant.paidUntil.toISOString().slice(0, 10)}`,
    });
    return response;
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

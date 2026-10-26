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
  voidsPaymentId: true, voidReason: true,
} as const;
const voidInput = z.object({ reason: z.string().trim().min(3).max(300) }).strict();
type PaymentRow = { id: string; months: number; paidFrom: Date; createdAt: Date; voidsPaymentId: string | null };

/** Pagado hasta, rehecho con los pagos vigentes en orden: cada uno extiende
 * desde lo ya pagado o, si había vencido, desde el día en que se registró.
 * Sin pagos vigentes vuelve a la fecha de antes del primer pago. */
export function paidUntilFrom(rows: PaymentRow[]) {
  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const voided = new Set(ordered.map(r => r.voidsPaymentId).filter(Boolean));
  const kept = ordered.filter(r => !r.voidsPaymentId && !voided.has(r.id));
  if (!ordered.length) return null;
  // Base: lo pagado o de prueba antes del primer pago (su paidFrom).
  let cursor = ordered[0].paidFrom;
  for (const p of kept)
    cursor = addMonths(new Date(Math.max(cursor.getTime(), p.createdAt.getTime())), p.months);
  return cursor;
}

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
      // La misma transferencia anotada dos veces regalaba meses: una referencia
      // vigente (no anulada) no se repite en la misma empresa.
      const [same] = await tx.$queryRaw<{ createdAt: Date; amount: string }[]>`
        SELECT p."createdAt", p.amount::text FROM "PlatformPayment" p
        WHERE p."tenantId"=${tenant.id}::uuid AND p."voidsPaymentId" IS NULL
          AND lower(regexp_replace(p.reference, '[[:space:]]+', '', 'g')) = ${normalizeReference(input.reference)}
          AND NOT EXISTS (SELECT 1 FROM "PlatformPayment" v WHERE v."voidsPaymentId" = p.id)
        LIMIT 1`;
      if (same)
        throw new HttpException(
          `Ya hay un pago con la referencia «${input.reference}» (RD$${Number(same.amount).toFixed(2)}, ` +
          `${same.createdAt.toISOString().slice(0, 10)}). Si es otro pago, usa su propia referencia.`, 409);
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

  /** Anular un pago anotado por error: fila de anulación con motivo (nunca se
   * edita ni borra el pago) y «pagado hasta» rehecho sin ese pago. */
  @Public() @Post("tenants/:slug/payments/:id/void")
  async void(@Param("slug") rawSlug: string, @Param("id") rawId: string, @Body() body: unknown, @Req() req: Request) {
    authorizePlatform(req, this.limits);
    const code = parse(slug, rawSlug);
    const id = parse(z.string().uuid(), rawId);
    const { reason } = parse(voidInput, body);
    const operator = process.env.PLATFORM_OPERATOR_LABEL?.trim().slice(0, 100) || "operador-plataforma";
    const result = await this.registration.db.$transaction(async tx => {
      const [tenant] = await tx.$queryRaw<TenantRow[]>`
        SELECT id, status, plan, "trialEndsAt", "paidThroughAt" FROM "Tenant" WHERE slug=${code} FOR UPDATE`;
      if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
      const rows = await tx.platformPayment.findMany({ where: { tenantId: tenant.id } });
      const original = rows.find(r => r.id === id && !r.voidsPaymentId);
      if (!original) throw new HttpException("Pago no encontrado.", 404);
      if (rows.some(r => r.voidsPaymentId === id)) throw new HttpException("Ese pago ya está anulado.", 409);
      const reversal = await tx.platformPayment.create({
        data: {
          tenantId: tenant.id, amount: original.amount, method: original.method, reference: original.reference,
          months: original.months, operator, paidFrom: original.paidFrom, paidUntil: original.paidUntil,
          voidsPaymentId: original.id, voidReason: reason,
        },
        select: paymentSelect,
      });
      const paidUntil = paidUntilFrom([...rows, { ...reversal, voidsPaymentId: original.id }]);
      await tx.tenant.update({ where: { id: tenant.id }, data: { paidThroughAt: paidUntil } });
      return { payment: reversal, tenant: { slug: code, paidUntil } };
    });
    console.log(`[plataforma] pago anulado: ${code} (${id}) por ${operator}`);
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

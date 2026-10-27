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
/** Aspecto de tarjeta: la referencia entera son 13 a 19 dígitos seguidos que pasan Luhn.
 * No se unen dígitos separados por espacio, guion o texto (fechas, recibos). */
export function hasCardLikeDigits(text: string) {
  const digits = text.trim();
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
const paymentInput = z.object({
  // PLA-02: la misma operación reenviada (doble clic, respuesta perdida) no se cobra dos veces.
  operationId: z.string().uuid(),
  amount: z.number().positive().max(10_000_000).multipleOf(0.01),
  method: z.enum(["transfer", "cash", "card_in_store", "courier"]),
  reference: z.string().trim().min(1).max(120)
    .refine(v => !hasCardLikeDigits(v), "La referencia parece un número de tarjeta; anota solo el número de operación o recibo."),
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
/** Referencia comparable: sin espacios y sin distinguir mayúsculas. \s de JavaScript incluye
 * el espacio duro (U+00A0) y U+FEFF; SQL_SPACE es esa misma lista para la base (igual que en
 * el trigger, migración 202611030001), sin depender de la configuración regional. */
export const normalizeReference = (value: string) => value.replace(/\s+/g, "").toLowerCase();
const SQL_SPACE = "[\\t\\n\\v\\f\\r " + String.fromCharCode(160, 5760, 8192) + "-" +
  String.fromCharCode(8202, 8232, 8233, 8239, 8287, 12288, 65279) + "]+";
/** 23505 del trigger de referencia única cuando la comprobación previa no lo vio: duplicado, no 500. */
const isUniqueViolation = (e: any) => e?.code === "P2002" || e?.meta?.code === "23505" || /\b23505\b/.test(String(e?.message ?? ""));

type TenantRow = {
  id: string; status: string; plan: string; trialEndsAt: Date | null;
  paidThroughAt: Date | null; pastDueAt: Date | null; suspendedAt: Date | null;
};
const paymentSelect = {
  id: true, operationId: true, plan: true, amount: true, method: true, reference: true, months: true,
  operator: true, paidFrom: true, paidUntil: true, createdAt: true,
  voidsPaymentId: true, voidReason: true,
} as const;
const voidInput = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

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
        SELECT id, status, plan, "trialEndsAt", "paidThroughAt", "pastDueAt", "suspendedAt" FROM "Tenant" WHERE slug=${code} FOR UPDATE`;
      if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
      const previous = await tx.platformPayment.findUnique({ where: { operationId: input.operationId }, select: { ...paymentSelect, tenantId: true } });
      if (previous) {
        const { tenantId: previousTenant, ...payment } = previous;
        if (previousTenant !== tenant.id || Number(payment.amount) !== input.amount || payment.method !== input.method ||
          payment.months !== months || normalizeReference(payment.reference) !== normalizeReference(input.reference))
          throw new HttpException("Esa operación ya se registró con otros datos.", 409);
        // Un pago anulado ya no es un cobro: repetirlo no debe parecer un éxito.
        if (await tx.platformPayment.findFirst({ where: { voidsPaymentId: payment.id }, select: { id: true } }))
          throw new HttpException("Esa operación corresponde a un pago ya anulado; registra el cobro con otra operación.", 409);
        return { tenantId: tenant.id, payment, tenant: { slug: code, status: tenant.status, paidUntil: payment.paidUntil }, replayed: true };
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
          AND lower(regexp_replace(p.reference, ${SQL_SPACE}, '', 'g')) = ${normalizeReference(input.reference)}
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
        data: { tenantId: tenant.id, operationId: input.operationId, plan: tenant.plan, amount: input.amount.toFixed(2), method: input.method, reference: input.reference, months, operator, paidFrom, paidUntil,
          prevStatus: tenant.status, prevPaidThroughAt: tenant.paidThroughAt, prevPastDueAt: tenant.pastDueAt, prevSuspendedAt: tenant.suspendedAt },
        select: paymentSelect,
      });
      await tx.auditLog.create({ data: {
        tenantId: tenant.id, userId: "plataforma", action: "platform_payment", entity: "platform_payment", entityId: payment.id,
        after: { amount: payment.amount.toString(), method: input.method, months, plan: tenant.plan, paidUntil: paidUntil.toISOString() },
      } });
      return { tenantId: tenant.id, payment, tenant: { slug: code, status: "active", paidUntil }, replayed: false };
    }).catch(e => {
      if (isUniqueViolation(e)) throw new HttpException("Ya hay un pago vigente con esa referencia. Si es otro pago, usa su propia referencia.", 409);
      throw e;
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
   * edita ni borra el pago) y «pagado hasta» devuelto a la fecha de antes. */
  @Public() @Post("tenants/:slug/payments/:id/void")
  async void(@Param("slug") rawSlug: string, @Param("id") rawId: string, @Body() body: unknown, @Req() req: Request) {
    authorizePlatform(req, this.limits);
    const code = parse(slug, rawSlug);
    const id = parse(z.string().uuid(), rawId);
    const { reason } = parse(voidInput, body);
    const operator = process.env.PLATFORM_OPERATOR_LABEL?.trim().slice(0, 100) || "operador-plataforma";
    const result = await this.registration.db.$transaction(async tx => {
      const [tenant] = await tx.$queryRaw<TenantRow[]>`
        SELECT id, status, plan, "trialEndsAt", "paidThroughAt", "pastDueAt", "suspendedAt" FROM "Tenant" WHERE slug=${code} FOR UPDATE`;
      if (!tenant) throw new HttpException("Empresa no encontrada.", 404);
      const rows = await tx.platformPayment.findMany({ where: { tenantId: tenant.id } });
      const original = rows.find(r => r.id === id && !r.voidsPaymentId);
      if (!original) throw new HttpException("Pago no encontrado.", 404);
      if (rows.some(r => r.voidsPaymentId === id)) throw new HttpException("Ese pago ya está anulado.", 409);
      // Solo el último pago vigente (mayor vencimiento; el id desempata) y solo si
      // el vencimiento sigue siendo el que ese pago dejó: así se devuelve la fecha
      // exacta de antes (paidFrom) sin pisar un ajuste hecho por otra vía.
      const voided = new Set(rows.map(r => r.voidsPaymentId));
      const [last] = rows.filter(r => !r.voidsPaymentId && !voided.has(r.id))
        .sort((a, b) => b.paidUntil.getTime() - a.paidUntil.getTime() || (a.id < b.id ? 1 : -1));
      if (last.id !== original.id)
        throw new HttpException("Solo se puede anular el último pago vigente; anula antes los posteriores.", 409);
      if (tenant.paidThroughAt?.getTime() !== original.paidUntil.getTime())
        throw new HttpException("El vencimiento cambió después de este pago; corrígelo a mano antes de anularlo.", 409);
      const reversal = await tx.platformPayment.create({
        data: {
          tenantId: tenant.id, amount: original.amount, method: original.method, reference: original.reference,
          months: original.months, operator, paidFrom: original.paidFrom, paidUntil: original.paidUntil,
          voidsPaymentId: original.id, voidReason: reason,
        },
        select: paymentSelect,
      });
      // Se devuelve el estado y los vencimientos de justo antes del pago: una empresa que ya
      // estaba vencida o suspendida no gana gracia nueva. Pagos sin ese dato (anteriores a
      // 202611040001): la prueba vuelve a «prueba»; lo ya vencido queda suspendido.
      const from = original.paidFrom;
      const data = original.prevStatus
        ? { status: original.prevStatus, paidThroughAt: original.prevPaidThroughAt, pastDueAt: original.prevPastDueAt, suspendedAt: original.prevSuspendedAt }
        : tenant.trialEndsAt && from.getTime() === tenant.trialEndsAt.getTime()
          ? { status: "trial", paidThroughAt: null, pastDueAt: null }
          : from > new Date()
            ? { paidThroughAt: from }
            : { status: "suspended", paidThroughAt: from, pastDueAt: from, suspendedAt: new Date() };
      await tx.auditLog.create({ data: {
        tenantId: tenant.id, userId: "plataforma", action: "platform_payment_void", entity: "platform_payment", entityId: reversal.id,
        after: { voids: original.id, amount: original.amount.toString() },
      } });
      const updated = await tx.tenant.update({ where: { id: tenant.id }, data, select: { status: true, paidThroughAt: true } });
      return { payment: reversal, tenant: { slug: code, status: updated.status, paidUntil: updated.paidThroughAt } };
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

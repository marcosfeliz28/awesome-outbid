import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import {
  expired,
  BUSINESS_TIME_ZONE,
  SaleInput,
  saleSchema,
  lineTotals,
  paymentTotals,
  paymentReceiptLine,
  money,
  formatMoney,
  formatAmount,
  d,
  can,
  z,
  stockQty,
  derivedStockQty,
  returnShares,
  allocationCost,
  returnedAt,
  replayReturns,
  moneyAmount,
  quantity,
  receivableNeedsApproval,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  parse,
  uuid,
  reason,
  audit,
  safe,
  bad,
  conflict,
  denied,
  json,
  safeErrorMessage,
  fieldLabel,
  imageType,
  lockActiveCustomer,
  canViewCustomerPii,
  customerForActor,
  maskTail,
} from "./common";
import { lockVariant, takeStock, stockChange } from "./inventory";

// Foto de evidencia de un cobro: hasta 2 MB.
const PROOF_MAX_BYTES = 2 * 1024 * 1024;
const paymentSummary = (payment: any) => {
  const { proofUrl, ...summary } = payment;
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(proofUrl ?? "");
  return {
    ...summary,
    hasProof: !!proofUrl,
    proofContentType: match?.[1] ?? null,
    proofBytes: match?.[2]
      ? Math.floor((match[2].length * 3) / 4) -
        (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0)
      : 0,
  };
};

// `/sales` alimenta el historial operativo, no es una representación directa
// de Prisma. Mantener una lista blanca evita que una columna nueva de costos o
// un objeto JSON sensible aparezca automáticamente en la respuesta.
export function saleHistoryDto(sale: any, actor: Actor) {
  const showProfit = can(actor.permissions, "profit:read");
  const item = (row: any) => ({
    id: row.id,
    variantId: row.variantId,
    lotId: row.lotId,
    qty: row.qty,
    returnedQty: row.returnedQty,
    unitPrice: row.unitPrice,
    discount: row.discount,
    tax: row.tax,
    lineTotal: row.lineTotal,
    promotionName: row.promotionName ?? null,
    ...(showProfit ? { unitCost: row.unitCost } : {}),
    variant: row.variant
      ? {
          id: row.variant.id,
          productId: row.variant.productId,
          sku: row.variant.sku,
          barcode: row.variant.barcode,
          attributes: row.variant.attributes,
          product: row.variant.product
            ? { id: row.variant.product.id, name: row.variant.product.name }
            : null,
        }
      : null,
  });
  const payment = (row: any) => {
    const summary = paymentSummary(row);
    return {
      id: summary.id,
      createdAt: summary.createdAt,
      method: summary.method,
      amount: summary.amount,
      tendered: summary.tendered,
      change: summary.change,
      bank: summary.bank,
      reference: summary.reference,
      cardBrand: summary.cardBrand,
      cardLast4: summary.cardLast4,
      approvalCode: summary.approvalCode,
      cardType: summary.cardType,
      status: summary.status,
      entryType: summary.entryType,
      hasProof: summary.hasProof,
      proofContentType: summary.proofContentType,
      proofBytes: summary.proofBytes,
      ...(showProfit ? { feeAmount: summary.feeAmount } : {}),
    };
  };
  const returned = (row: any) => ({
    id: row.id,
    number: row.number,
    reason: row.reason,
    total: row.total,
    taxTotal: row.taxTotal,
    refundAmount: row.refundAmount,
    refundMethod: row.refundMethod,
    createdAt: row.createdAt,
    ...(showProfit
      ? {
          costTotal: row.costTotal,
          wasteQty: row.wasteQty,
          wasteCostTotal: row.wasteCostTotal,
          items: row.items,
        }
      : {}),
  });
  return {
    id: sale.id,
    number: sale.number,
    status: sale.status,
    customerId: sale.customerId,
    sellerId: sale.sellerId,
    cashSessionId: sale.cashSessionId,
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    discountReason: sale.discountReason,
    discountRule: sale.discountRule,
    discountApprovedBy: sale.discountApprovedBy,
    discountApprovedName: sale.discountApprovedName,
    discountApprovedRole: sale.discountApprovedRole,
    taxTotal: sale.taxTotal,
    total: sale.total,
    creditBalance: sale.creditBalance,
    creditDueDate: sale.creditDueDate,
    ncf: sale.ncf,
    ncfType: sale.ncfType,
    // SEC-05: el historial de la caja no vuelve a mostrar el RNC del
    // receptor fiscal; gerencia lo ve completo para emitir el comprobante.
    recipientLegalId: canViewCustomerPii(actor)
      ? sale.recipientLegalId
      : maskTail(sale.recipientLegalId),
    fiscalStatus: sale.fiscalStatus,
    notes: sale.notes,
    voidedReason: sale.voidedReason,
    voidedBy: sale.voidedBy,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    items: (sale.items ?? []).map(item),
    payments: (sale.payments ?? []).map(payment),
    returns: (sale.returns ?? []).map(returned),
    ...(showProfit ? { costTotal: sale.costTotal } : {}),
  };
}
import PDFDocument from "pdfkit";
import type { Response } from "express";

export function normalizeLegacyOfflineDiscount(
  input: SaleInput,
  offline: boolean,
  requestsDiscount: boolean,
  cutoff = Date.parse("2026-10-09T04:00:00.000Z"),
) {
  const capturedAt = input.capturedAt ? Date.parse(input.capturedAt) : NaN;
  if (
    !requestsDiscount ||
    input.discountReason ||
    !offline ||
    !Number.isFinite(capturedAt) ||
    capturedAt > cutoff
  )
    return input;
  return {
    ...input,
    discountReason: "Venta offline heredada (sin motivo registrado)",
  };
}

// M-3: la alerta de una transferencia sin verificar se cierra al verificarla
// o rechazarla.
async function resolveTransferAlert(tx: any, paymentId: string) {
  await tx.alert.updateMany({
    where: { key: "transfer:" + paymentId, status: { not: "resolved" } },
    data: { status: "resolved" },
  });
}

// Deuda abierta de un cliente en la sucursal: saldo por cobrar de sus ventas
// completadas (crédito, contraentrega o transferencia rechazada).
export async function customerOpenDebt(
  db: any,
  branchId: string,
  customerId: string,
) {
  const debt = await db.sale.aggregate({
    where: {
      customerId,
      branchId,
      status: "completed",
      creditBalance: { gt: 0 },
    },
    _sum: { creditBalance: true },
  });
  return money(debt._sum.creditBalance ?? 0);
}

// Una venta pendiente se mantiene como una sola cuenta por cobrar hasta que
// un administrador confirma todos sus abonos.
async function refreshReceivableAlert(
  tx: any,
  saleId: string,
  branchId: string,
) {
  const sale = await tx.sale.findFirst({
    where: { id: saleId, branchId },
    select: {
      id: true,
      number: true,
      status: true,
      customerId: true,
      creditBalance: true,
    },
  });
  if (!sale) return;
  const key = "receivable:" + sale.id;
  const balance = Number(sale.creditBalance);
  if (sale.status !== "completed" || balance <= 0) {
    await tx.alert.updateMany({
      where: { key, status: { not: "resolved" } },
      data: { status: "resolved" },
    });
    return;
  }
  const customer = sale.customerId
    ? await tx.customer.findUnique({
        where: { id: sale.customerId },
        select: { name: true },
      })
    : null;
  const message =
    `Crédito / contraentrega ${sale.number} · ` +
    `${customer?.name ?? "cliente sin identificar"} · ` +
    `saldo pendiente RD$ ${balance.toFixed(2)}.`;
  await tx.alert.upsert({
    where: { key },
    create: {
      key,
      type: "receivable",
      severity: "high",
      entityId: sale.id,
      message,
      branchId,
    },
    update: { message, severity: "high", status: "new" },
  });
}

// Una caja abierta pertenece a un usuario y a un equipo. El dinero (ventas,
// abonos, movimientos) sólo se registra desde el equipo donde está la caja;
// cerrar y arquear se permite desde cualquier equipo del dueño, y un gerente
// puede actuar sobre la caja de otro usuario desde su propio equipo.
// Efectivo neto cobrado al vender (los abonos van aparte).
function cashCollected(
  payments: { method: string; entryType: string; amount: unknown }[],
) {
  return money(
    payments
      .filter((p) => p.method === "cash" && p.entryType !== "installment")
      .reduce((sum, p) => sum.plus(p.amount as any), d(0)),
  );
}
export async function cashLock(
  tx: any,
  actor: Actor,
  id: string,
  manager = false,
  capturedAt?: Date,
  options: { closing?: boolean } = {},
) {
  await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id = ${id}::uuid FOR UPDATE`;
  const session = await tx.cashSession.findFirstOrThrow({
    where: {
      id,
      branchId: actor.branchId,
      ...(capturedAt ? {} : { closedAt: null }),
    },
  });
  const own = session.userId === actor.id;
  if (!own && !(manager && can(actor.permissions, "sale:manage"))) denied();
  if (
    capturedAt &&
    (capturedAt < session.openedAt ||
      capturedAt > new Date() ||
      (session.closedAt && capturedAt > session.closedAt))
  )
    bad("La venta offline no corresponde al horario de esta caja.");
  // Las ventas offline se sincronizan desde la cola del equipo que las capturó.
  if (
    own &&
    !capturedAt &&
    !options.closing &&
    actor.terminalId &&
    session.registerId !== actor.terminalId
  ) {
    conflict(
      `Tu caja está abierta en el equipo «${await terminalName(tx, session.registerId)}». ` +
        "Ciérrala en ese equipo o trasládala a este desde Caja.",
    );
  }
  return session;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Las cajas anteriores a los equipos guardan un nombre libre en registerId.
export async function terminalName(tx: any, registerId: string) {
  if (!UUID.test(registerId)) return registerId;
  const terminal = await tx.terminal.findUnique({ where: { id: registerId } });
  return terminal?.name ?? "otro equipo";
}
// Lo mismo que terminalName para muchas cajas, con una sola consulta.
export async function terminalNames(tx: any, registerIds: string[]) {
  const ids = [...new Set(registerIds.filter((id) => UUID.test(id)))];
  const terminals: { id: string; name: string }[] = ids.length
    ? await tx.terminal.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(terminals.map((t) => [t.id, t.name]));
  return (registerId: string) =>
    UUID.test(registerId)
      ? (names.get(registerId) ?? "otro equipo")
      : registerId;
}
function promotionDiscount(promo: any, variant: any, qty: number) {
  const scope = promo.scope as any;
  if (scope.variantId && scope.variantId !== variant.id) return 0;
  if (scope.productId && scope.productId !== variant.productId) return 0;
  if (scope.categoryId && scope.categoryId !== variant.product.categoryId)
    return 0;
  if (scope.brand && scope.brand !== variant.product.brand) return 0;
  if (scope.lotId) return 0; // Las ofertas por lote sólo se autorizan después de asignar FEFO.
  if (promo.type === "percent") return Number(promo.value);
  if (promo.type === "amount")
    return Math.min(100, (Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "special_price")
    return Math.max(0, (1 - Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "nxm") {
    const buy = scope.buy || 2,
      pay = scope.pay || 1;
    return ((Math.floor(qty / buy) * (buy - pay)) / qty) * 100;
  }
  if (promo.type === "second_half")
    return ((Math.floor(qty / 2) * 0.5) / qty) * 100;
  return 0;
}

import { cashExpected, refreshClosedCash } from "./cash";
import { unusualDiscountAlerts } from "./alerts";
import { notify } from "./notifications";
import { verifyPinAttempt } from "./security";
import { recordSaleIncentives, reverseIncentives } from "./incentives";

// Plazo de las transacciones que mueven dinero (venta y devolución). Con el
// valor por defecto de Prisma (5 s) una devolución bajo carga fallaba con
// P2028 mientras la venta, con 20 s, terminaba (prueba de carga R5).
export const MONEY_TRANSACTION = { timeout: 20000 };
@Controller()
export class SalesController {
  constructor(@Inject(Database) private db: Database) {}
  private async approve(actor: Actor, input: SaleInput) {
    const setting = await this.db.settings.findUnique({
      where: { id: actor.branchId },
    });
    const limit = Number((setting?.data as any)?.sellerDiscountLimit ?? 10);

    const variants = await this.db.variant.findMany({
      where: {
        id: { in: input.items.map((i) => i.variantId) },
        branchId: actor.branchId,
      },
      select: { id: true, price: true },
    });
    const exceeds = input.items.some(
      (i) =>
        100 -
          ((100 -
            Math.max(
              i.discountPercent,
              ((i.discountAmount ?? 0) /
                Math.max(
                  0.01,
                  i.qty *
                    Number(
                      variants.find((v) => v.id === i.variantId)?.price ?? 0,
                    ),
                )) *
                100,
            )) *
            (100 - input.globalDiscount)) /
            100 >
        limit,
    );
    // Crédito y contraentrega (D-01): la misma regla que aplica la caja. La
    // contraentrega de quien no gestiona ventas pide PIN sobre el umbral, o
    // siempre si las ventas a crédito no están habilitadas; un límite de
    // cliente 0 no la exime (ver receivableNeedsApproval). M-2: para quien no
    // gestiona ventas cuenta además la deuda abierta del cliente.
    const manages = can(actor.permissions, "sale:manage");
    const receivable = input.payments.some(
      (p) => p.method === "credit" || p.method === "cod",
    );
    const openDebt =
      receivable && !manages && input.customerId
        ? await customerOpenDebt(this.db, actor.branchId, input.customerId)
        : 0;
    const needsCreditApproval = receivableNeedsApproval(
      input.payments,
      setting?.data as any,
      manages,
      openDebt,
    );
    const becauseOfDebt =
      needsCreditApproval &&
      !receivableNeedsApproval(input.payments, setting?.data as any, manages);
    const needsNoteApproval = input.payments.some(
      (p) => p.method === "credit_note" && !p.creditNoteCode,
    );
    if (
      (!exceeds || can(actor.permissions, "sale:manage")) &&
      !needsCreditApproval &&
      !needsNoteApproval
    )
      return null;
    if (!input.managerPin)
      bad(
        becauseOfDebt
          ? `La deuda pendiente de este cliente más esta venta supera ${formatMoney(Number((setting?.data as any)?.creditApprovalThreshold ?? 1000))}: esta operación requiere el PIN de un gerente.`
          : "Esta operación requiere el PIN de un gerente.",
      );
    const managers = await this.db.user.findMany({
      where: { active: true, branchId: actor.branchId },
      include: { role: true },
    });
    return verifyPinAttempt(
      this.db,
      "approval:" + actor.id,
      async () => {
        for (const manager of managers.filter((m) =>
          can(m.role.permissions, "sale:manage"),
        ))
          if (await compare(input.managerPin!, manager.pinHash))
            return manager.id;
        return null;
      },
      { pin: input.managerPin, actor },
    );
  }
  async complete(actor: Actor, input: SaleInput, offline = false) {
    const requestsDiscount =
      input.globalDiscount > 0 ||
      input.items.some(
        (item) => item.discountPercent > 0 || (item.discountAmount ?? 0) > 0,
      );
    const { managerPin: ignored, ...fingerprint } = input;
    void ignored;
    const originalRequestHash = createHash("sha256")
      .update(JSON.stringify(fingerprint))
      .digest("hex");
    const normalizedInput = normalizeLegacyOfflineDiscount(
      input,
      offline,
      requestsDiscount,
    );
    const { managerPin: normalizedPin, ...normalizedFingerprint } =
      normalizedInput;
    void normalizedPin;
    const requestHash = createHash("sha256")
      .update(JSON.stringify(normalizedFingerprint))
      .digest("hex");
    const completed = await this.db.sale.findUnique({
      where: { offlineUuid: input.offlineUuid },
      include: { items: true, payments: true },
    });
    if (completed) {
      if (
        completed.sellerId !== actor.id ||
        completed.branchId !== actor.branchId
      )
        denied();
      // Una venta heredada pudo quedar en IndexedDB antes de que el motivo
      // fuese obligatorio. Su UUID sigue siendo la autoridad idempotente.
      if (
        completed.requestHash &&
        completed.requestHash !== originalRequestHash &&
        completed.requestHash !== requestHash
      )
        bad("El UUID ya corresponde a otra venta.");
      return safe(completed, actor);
    }
    if (requestsDiscount && !normalizedInput.discountReason)
      bad("Indica el motivo del descuento.");
    input = normalizedInput;
    if (offline) {
      const settings = await this.db.settings.findUnique({
        where: { id: actor.branchId },
        select: { data: true },
      });
      if ((settings?.data as any)?.allowOfflineSales !== true)
        bad(
          "Las ventas sin conexión están desactivadas para esta tienda. Pide a un administrador que revise el conflicto.",
        );
    }
    const approvedBy = await this.approve(actor, input);
    const result = await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.offlineUuid}))::text AS locked`;
        const existing = await tx.sale.findUnique({
          where: { offlineUuid: input.offlineUuid },
          include: { items: true, payments: true },
        });
        if (existing) {
          if (
            existing.sellerId !== actor.id ||
            existing.branchId !== actor.branchId
          )
            denied();
          if (existing.requestHash && existing.requestHash !== requestHash)
            bad("El UUID ya corresponde a otra venta.");
          return existing;
        }
        if (offline) {
          const settings = await tx.settings.findUnique({
            where: { id: actor.branchId },
            select: { data: true },
          });
          if ((settings?.data as any)?.allowOfflineSales !== true)
            bad(
              "Las ventas sin conexión están desactivadas para esta tienda. Pide a un administrador que revise el conflicto.",
            );
        }
        const capturedAt =
          offline && input.capturedAt ? new Date(input.capturedAt) : undefined;
        if (capturedAt && Date.now() - capturedAt.getTime() > 48 * 3600000)
          bad("La venta offline supera el plazo máximo de 48 horas.");
        const cashSession = await cashLock(
          tx,
          actor,
          input.cashSessionId,
          false,
          capturedAt,
        );
        const customer = input.customerId
          ? await lockActiveCustomer(tx, actor, input.customerId)
          : null;
        const settings = await tx.settings.findUnique({
          where: { id: actor.branchId },
        });
        const config = settings?.data as any;
        if (!customer) bad("Selecciona o crea un cliente antes de vender.");
        const components = await tx.kitComponent.findMany({
          where: { kitVariantId: { in: input.items.map((i) => i.variantId) } },
        });
        const ids = [
          ...new Set([
            ...input.items.map((i) => i.variantId),
            ...components.map((c) => c.componentVariantId),
          ]),
        ].sort();
        const variants = new Map<string, any>();
        for (const id of ids)
          variants.set(id, await lockVariant(tx, id, actor));
        const promos = await tx.promotion.findMany({
          where: {
            branchId: actor.branchId,
            active: true,
            startsAt: { lte: new Date() },
            endsAt: { gte: new Date() },
          },
        });
        const lines = input.items.map((item) => {
          const variant = variants.get(item.variantId)!;
          const gross = Number(variant.price) * item.qty;
          if ((item.discountAmount ?? 0) > gross)
            bad("El descuento por monto supera el importe de la línea.");
          const lineDiscount = Math.max(
            item.discountPercent,
            gross ? ((item.discountAmount ?? 0) / gross) * 100 : 0,
          );
          const manual =
            100 - ((100 - lineDiscount) * (100 - input.globalDiscount)) / 100;
          let promo = 0,
            promotionName: string | null = null;
          for (const p of promos) {
            const off = promotionDiscount(p, variant, item.qty);
            if (off > promo) [promo, promotionName] = [off, p.name];
          }
          // G15: se nombra sólo si la promoción es lo que se aplicó (supera
          // al descuento manual de la línea).
          if (!(promo > manual)) promotionName = null;
          const totals = lineTotals(
            item.qty,
            Number(variant.price),
            Math.max(manual, promo),
            Number(variant.product.taxRate),
            config?.taxIncluded !== false,
          );
          const kit = components.filter((c) => c.kitVariantId === variant.id);
          // Combos (R6-01): se venden por unidades enteras y cada consumo
          // derivado debe ser exacto antes de cobrar; nunca se redondea.
          if (kit.length && !Number.isInteger(item.qty))
            bad(
              "Los combos se venden por unidades enteras: " +
                variant.product.name +
                ".",
            );
          const consumption = kit.map((c) => {
            const qty = derivedStockQty(c.qty, item.qty);
            if (qty === null)
              bad(
                "El consumo de un componente de " +
                  variant.product.name +
                  " no es una cantidad válida (mínimo 0.001 y 3 decimales).",
              );
            return { component: c, qty };
          });
          const cost = kit.length
            ? kit.reduce(
                (a, c) =>
                  a.plus(
                    d(variants.get(c.componentVariantId)!.costAvg).times(c.qty),
                  ),
                d(0),
              )
            : d(variant.costAvg);
          return {
            item,
            variant,
            totals,
            kit,
            consumption,
            cost,
            promotionName,
          };
        });
        const total = money(
          lines.reduce((a, l) => a.plus(l.totals.total), d(0)),
        );
        if (
          input.expectedTotal !== undefined &&
          Math.abs(input.expectedTotal - total) > 0.01
        )
          bad(
            "Los precios o promociones cambiaron. Revisa el total antes de cobrar.",
          );
        // No hay regla de cortesías: una venta sin cobro (descuento del 100 %
        // o precio 0) sacaba mercancía y daba «cambio» de la caja.
        if (!(total > 0))
          bad(
            "El total de la venta es RD$ 0. Revisa los precios y descuentos: no se registran ventas sin cobro.",
          );
        let payment: ReturnType<typeof paymentTotals>;
        try {
          payment = paymentTotals(total, input.payments);
        } catch (e: any) {
          bad(e.message);
        }
        if (payment.pending > 0) bad("Falta completar el pago de la factura.");
        for (const p of input.payments) {
          if (p.creditNoteId && p.method !== "credit_note")
            bad("La nota de crédito sólo se usa con su método de pago.");
          if (p.method === "card" && (!p.approvalCode || !p.cardLast4))
            bad("Indica los últimos 4 dígitos y la aprobación de tarjeta.");
          if (p.method === "transfer" && (!p.reference || !p.bank))
            bad("Indica banco y referencia de transferencia.");
        }
        const credit = money(
          input.payments
            .filter((p) => p.method === "credit")
            .reduce((sum, p) => sum + p.amount, 0),
        );
        // Crédito y contraentrega son una misma cuenta por cobrar: la
        // mercancía sale ahora y la administración registra los abonos.
        const cod = money(
          input.payments
            .filter((p) => p.method === "cod")
            .reduce((sum, p) => sum + p.amount, 0),
        );
        if ((credit || cod) && !customer)
          bad("El crédito / contraentrega requiere seleccionar un cliente.");
        if ((credit || cod) && customer) {
          // Toda mercancía despachada pendiente de cobro cuenta en la deuda
          // (también una transferencia rechazada que pasó a cobrar, M-3).
          const debt = await customerOpenDebt(tx, actor.branchId, customer.id);
          // Límite 0 = sin límite para el crédito (regla existente). La
          // contraentrega no queda abierta por eso: su aprobación por umbral
          // se aplica siempre en approve() (D-01).
          if (
            Number(customer.creditLimit) > 0 &&
            d(debt).plus(credit).plus(cod).gt(customer.creditLimit)
          )
            bad("La venta supera el límite de crédito del cliente.");
          // M-2: approve() miró la deuda antes de bloquear al cliente; con el
          // bloqueo se vuelve a mirar para que dos ventas simultáneas no
          // pasen ambas por debajo del umbral sin PIN.
          if (
            !approvedBy &&
            receivableNeedsApproval(
              input.payments,
              config,
              can(actor.permissions, "sale:manage"),
              debt,
            )
          )
            bad(
              "La deuda pendiente de este cliente cambió: esta operación requiere el PIN de un gerente.",
            );
        }
        if (credit && config?.allowCreditSales !== true)
          bad("Las ventas a crédito están desactivadas en Ajustes.");
        if (credit && (!input.customerId || !input.creditDueDate))
          bad("La venta a crédito requiere cliente y fecha de vencimiento.");
        if (input.creditDueDate && expired(input.creditDueDate))
          bad("La fecha del crédito no puede estar en el pasado.");
        if (input.ncfType && config?.ncfMode !== "prepared")
          bad("Activa la preparación de NCF en Ajustes.");
        if (
          ["B01", "E31"].includes(input.ncfType ?? "") &&
          !input.recipientLegalId
        )
          bad("Indica el RNC o cédula del cliente.");
        for (const p of input.payments
          .filter((p) => p.method === "credit_note")
          .sort((a, b) =>
            (a.creditNoteId ?? "").localeCompare(b.creditNoteId ?? ""),
          )) {
          if (!p.creditNoteId) bad("Selecciona una nota de crédito.");
          await tx.$queryRaw`SELECT id FROM "CreditNote" WHERE id=${p.creditNoteId}::uuid FOR UPDATE`;
          const note = await tx.creditNote.findUnique({
            where: { id: p.creditNoteId },
          });
          const returned =
            note &&
            (await tx.saleReturn.findFirst({
              where: { id: note.returnId, branchId: actor.branchId },
            }));
          if (
            !note ||
            !returned ||
            (note.customerId && note.customerId !== input.customerId)
          )
            bad("La nota de crédito no corresponde a este cliente o sucursal.");
          const codeMatches =
            !!p.creditNoteCode && p.creditNoteCode === note.redemptionCode;
          if (!note.customerId && !codeMatches)
            bad("Las notas sin cliente requieren su código impreso.");
          if (p.creditNoteCode && !codeMatches)
            bad("Código de nota de crédito incorrecto.");
          if (!codeMatches && !approvedBy)
            bad(
              "La nota de crédito requiere su código o aprobación de gerente.",
            );
          if (d(note.balance).lt(p.amount))
            bad("Saldo insuficiente en la nota de crédito.");
          await tx.creditNote.update({
            where: { id: note.id },
            data: { balance: { decrement: p.amount } },
          });
        }
        const counter = await tx.counter.upsert({
          where: { key: "sale:" + actor.branchId },
          create: { key: "sale:" + actor.branchId, value: 1 },
          update: { value: { increment: 1 } },
        });
        const discountAuthorizer =
          requestsDiscount && approvedBy
            ? await tx.user.findUnique({
                where: { id: approvedBy },
                include: { role: true },
              })
            : null;
        const discountRule = approvedBy
          ? "manager_pin"
          : can(actor.permissions, "sale:manage")
            ? "administrator"
            : "cashier_limit";
        const sale = await tx.sale.create({
          data: {
            number: "FS-" + String(counter.value).padStart(7, "0"),
            offlineUuid: input.offlineUuid,
            requestHash,
            customerId: input.customerId,
            sellerId: actor.id,
            cashSessionId: input.cashSessionId,
            subtotal: money(
              lines.reduce((a, l) => a.plus(l.totals.subtotal), d(0)),
            ),
            discountTotal: money(
              lines.reduce((a, l) => a.plus(l.totals.discount), d(0)),
            ),
            discountReason: requestsDiscount ? input.discountReason : null,
            discountRule: requestsDiscount ? discountRule : null,
            discountApprovedBy: requestsDiscount
              ? (approvedBy ?? actor.id)
              : null,
            discountApprovedName: requestsDiscount
              ? (discountAuthorizer?.name ?? actor.name)
              : null,
            discountApprovedRole: requestsDiscount
              ? (discountAuthorizer?.role.name ?? actor.role)
              : null,
            taxTotal: money(lines.reduce((a, l) => a.plus(l.totals.tax), d(0))),
            taxIncluded: config?.taxIncluded !== false,
            total,
            creditBalance: money(d(credit).plus(cod)),
            creditDueDate:
              credit && input.creditDueDate
                ? new Date(input.creditDueDate)
                : null,
            ncfType: input.ncfType,
            recipientLegalId: input.recipientLegalId,
            costTotal: money(
              lines.reduce((a, l) => a.plus(l.cost.times(l.item.qty)), d(0)),
            ),
            notes: input.notes || "",
            wholesale: input.wholesale === true,
            ...(capturedAt ? { createdAt: capturedAt } : {}),
            branchId: actor.branchId,
          },
        });
        // Costo registrado = suma del costo redondeado de cada línea guardada
        // (lotes y combos incluidos): así cada devolución, que redondea por
        // línea, deja el costo de la venta exactamente en cero.
        let booked = d(0);
        for (const {
          item,
          variant,
          totals,
          kit,
          consumption,
          cost,
          promotionName,
        } of lines) {
          if (kit.length) {
            const allocations: any[] = [];
            for (const { component, qty } of consumption) {
              const v = variants.get(component.componentVariantId);
              const parts = await takeStock(tx, actor, v, qty, "sale", sale.id);
              allocations.push(
                ...parts.map((p) => ({
                  ...p,
                  variantId: v.id,
                  unitCost: Number(v.costAvg),
                  // Cantidad exacta (ronda 7): su valor es el costo real.
                  exact: true,
                })),
              );
            }
            await tx.saleItem.create({
              data: {
                saleId: sale.id,
                variantId: variant.id,
                qty: item.qty,
                unitPrice: variant.price,
                unitCost: money(cost),
                discount: totals.discount,
                tax: totals.tax,
                lineTotal: totals.total,
                stockAllocations: allocations,
                promotionName,
              },
            });
            booked = booked.plus(
              money(
                allocationCost({
                  qty: item.qty,
                  unitCost: money(cost),
                  variantId: variant.id,
                  stockAllocations: allocations,
                }),
              ),
            );
          } else {
            const parts = await takeStock(
              tx,
              actor,
              variant,
              item.qty,
              "sale",
              sale.id,
            );
            let allocatedDiscount = d(0),
              allocatedTax = d(0),
              allocatedTotal = d(0);
            for (const [index, part] of parts.entries()) {
              const last = index === parts.length - 1;
              const fraction = d(part.qty).div(item.qty);
              const discount = last
                ? money(d(totals.discount).minus(allocatedDiscount))
                : money(d(totals.discount).times(fraction));
              const tax = last
                ? money(d(totals.tax).minus(allocatedTax))
                : money(d(totals.tax).times(fraction));
              const lineTotal = last
                ? money(d(totals.total).minus(allocatedTotal))
                : money(d(totals.total).times(fraction));
              allocatedDiscount = allocatedDiscount.plus(discount);
              allocatedTax = allocatedTax.plus(tax);
              allocatedTotal = allocatedTotal.plus(lineTotal);
              await tx.saleItem.create({
                data: {
                  saleId: sale.id,
                  variantId: variant.id,
                  lotId: part.lotId,
                  qty: part.qty,
                  unitPrice: variant.price,
                  unitCost: variant.costAvg,
                  discount,
                  tax,
                  lineTotal,
                  promotionName,
                  stockAllocations: json([
                    {
                      ...part,
                      variantId: variant.id,
                      unitCost: Number(variant.costAvg),
                    },
                  ]),
                },
              });
              booked = booked.plus(money(d(variant.costAvg).times(part.qty)));
            }
          }
        }
        if (!booked.eq(sale.costTotal))
          await tx.sale.update({
            where: { id: sale.id },
            data: { costTotal: money(booked) },
          });
        if (capturedAt && capturedAt < new Date())
          await audit(
            tx,
            actor,
            "offline_backdated",
            "sale",
            sale.id,
            undefined,
            {
              capturedAt: capturedAt.toISOString(),
              receivedAt: new Date().toISOString(),
              cashSessionId: cashSession.id,
            },
          );
        if ((credit || cod) && approvedBy)
          await audit(
            tx,
            actor,
            "credit_approved",
            "sale",
            sale.id,
            undefined,
            { approvedBy, amount: credit, cod },
          );
        let change = d(payment.change);
        for (const p of input.payments) {
          const paymentChange =
            p.method === "cash"
              ? money(d(p.amount).lt(change) ? p.amount : change)
              : 0;
          change = change.minus(paymentChange);
          const { creditNoteCode: ignoredCode, ...paymentData } = p;
          void ignoredCode;
          if (p.method === "credit_note")
            await audit(
              tx,
              actor,
              "credit_note_used",
              "credit_note",
              p.creditNoteId!,
              undefined,
              {
                saleId: sale.id,
                amount: p.amount,
                approvedBy,
                authorization: p.creditNoteCode ? "code" : "manager",
              },
            );
          const createdPayment = await tx.payment.create({
            data: {
              ...paymentData,
              saleId: sale.id,
              cashSessionId: cashSession.id,
              tendered: p.amount,
              amount: money(d(p.amount).minus(paymentChange)),
              change: paymentChange,
              feeAmount:
                p.method === "card"
                  ? money(
                      d(p.amount)
                        .times(config?.cardFeePercent ?? 2.5)
                        .div(100),
                    )
                  : 0,
              status:
                p.method === "transfer"
                  ? "pending_verification"
                  : p.method === "credit" || p.method === "cod"
                    ? "pending"
                    : "ok",
            },
          });
          // M-3 (auditoría 01): la mercancía sale contra una transferencia que
          // nadie comprobó. Alerta alta hasta que la administración la
          // verifique o la rechace (sólo esos flujos la resuelven).
          if (p.method === "transfer")
            await tx.alert.upsert({
              where: { key: "transfer:" + createdPayment.id },
              create: {
                key: "transfer:" + createdPayment.id,
                type: "transfer_pending",
                severity: "high",
                entityId: sale.id,
                branchId: actor.branchId,
                message:
                  `Transferencia de ${sale.number} por RD$ ${formatAmount(Number(createdPayment.amount))} sin verificar · ` +
                  `${p.bank ?? ""} · ref. ${p.reference ?? ""}`,
              },
              update: {},
            });
        }
        if (cashSession.closedAt) {
          const differences = await refreshClosedCash(tx, cashSession);
          await audit(
            tx,
            actor,
            "offline_after_close",
            "cash",
            cashSession.id,
            cashSession,
            { saleId: sale.id, ...differences },
          );
        }
        await recordSaleIncentives(tx, actor, sale.id);
        await audit(tx, actor, "complete", "sale", sale.id, undefined, {
          number: sale.number,
          total,
          approvedBy,
        });
        if (credit || cod)
          await refreshReceivableAlert(tx, sale.id, actor.branchId);
        if (Number(sale.discountTotal) > 0) {
          await unusualDiscountAlerts(tx, sale);
          await audit(
            tx,
            actor,
            "discount_approved",
            "sale",
            sale.id,
            undefined,
            {
              actor: { id: actor.id, name: actor.name, role: actor.role },
              rule: discountRule,
              authorizer: discountAuthorizer
                ? {
                    id: discountAuthorizer.id,
                    name: discountAuthorizer.name,
                    role: discountAuthorizer.role.name,
                  }
                : { id: actor.id, name: actor.name, role: actor.role },
              reason: input.discountReason,
              discount: sale.discountTotal,
            },
          );
        }
        return tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          include: { items: true, payments: true },
        });
      },
      { timeout: MONEY_TRANSACTION.timeout },
    );
    notify(this.db, "sale", result.id);
    return safe(result, actor);
  }
  @Post("sales") @Permit("sale:write") @RequireTerminal() sale(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    return this.complete(actor, parse(saleSchema, body));
  }
  @Post("sales/sync")
  @RequireTerminal()
  @Permit("sale:write")
  async sync(@Body() body: unknown, @CurrentUser() actor: Actor) {
    // Cada venta se valida por separado: una con datos inválidos queda como
    // conflicto, con su alerta, y no impide sincronizar las demás ventas que
    // la caja ya entregó (R9-dinero-5-pos).
    const input = parse(
      z.object({
        sales: z.array(z.object({ offlineUuid: uuid }).passthrough()).max(100),
      }),
      body,
    );
    const results = [];
    for (const sale of input.sales)
      try {
        const valid = saleSchema.safeParse(sale);
        if (!valid.success)
          bad(
            "Revisa los campos: " +
              valid.error.issues
                .slice(0, 5)
                .map((i) => fieldLabel(i.path) + " " + i.message)
                .join("; ") +
              ".",
          );
        const completed = await this.complete(actor, valid.data, true);
        await this.db.alert.updateMany({
          where: {
            key: "offline:" + sale.offlineUuid,
            status: { not: "resolved" },
          },
          data: { status: "resolved" },
        });
        results.push({
          offlineUuid: sale.offlineUuid,
          status: "synced",
          sale: completed,
        });
      } catch (e: any) {
        const message = safeErrorMessage(e);
        results.push({
          offlineUuid: sale.offlineUuid,
          status: "conflict",
          message,
        });
        await this.db.$transaction(async (tx) => {
          await tx.alert.upsert({
            where: { key: "offline:" + sale.offlineUuid },
            create: {
              key: "offline:" + sale.offlineUuid,
              type: "offline_conflict",
              severity: "high",
              entityId: sale.offlineUuid,
              message: "Venta offline pendiente: " + message,
              branchId: actor.branchId,
            },
            update: {
              message: "Venta offline pendiente: " + message,
              status: "new",
            },
          });
          const ownership = await tx.auditLog.findFirst({
            where: {
              action: "offline_sale_conflict",
              entity: "offline_sale",
              entityId: sale.offlineUuid,
              userId: actor.id,
              branchId: actor.branchId,
            },
          });
          if (!ownership) {
            const attempted = sale as any;
            const paymentTotal = money(
              (Array.isArray(attempted.payments)
                ? attempted.payments
                : []
              ).reduce(
                (sum: number, payment: any) =>
                  sum +
                  (Number.isFinite(Number(payment?.amount))
                    ? Number(payment.amount)
                    : 0),
                0,
              ),
            );
            const attemptedExpectedTotal = Number.isFinite(
              Number(attempted.expectedTotal),
            )
              ? money(Number(attempted.expectedTotal))
              : paymentTotal;
            await audit(
              tx,
              actor,
              "offline_sale_conflict",
              "offline_sale",
              sale.offlineUuid,
              undefined,
              {
                paymentTotal,
                attemptedExpectedTotal,
                cashSessionId: attempted.cashSessionId ?? null,
              },
            );
          }
        });
      }
    return { results };
  }
  @Get("sales")
  @Permit("sale:write")
  async list(
    @CurrentUser() actor: Actor,
    @Query() query: Record<string, string>,
  ) {
    const filters = parse(
      z.object({
        q: z.string().trim().max(80).optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
      query,
    );
    let createdAt: { gte: Date; lte: Date } | undefined;
    if (filters.date) {
      // República Dominicana no cambia de horario: estos límites representan
      // exactamente el día que el administrador eligió en la tienda.
      const gte = new Date(filters.date + "T00:00:00-04:00");
      const lte = new Date(filters.date + "T23:59:59.999-04:00");
      if (
        !Number.isFinite(+gte) ||
        !Number.isFinite(+lte) ||
        gte.toLocaleDateString("en-CA", {
          timeZone: BUSINESS_TIME_ZONE,
        }) !== filters.date
      )
        bad("Fecha inválida.");
      createdAt = { gte, lte };
    }
    const rows = await this.db.sale.findMany({
      where: {
        branchId: actor.branchId,
        ...(can(actor.permissions, "sale:manage")
          ? {}
          : { sellerId: actor.id }),
        ...(filters.q
          ? { number: { contains: filters.q, mode: "insensitive" as const } }
          : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        returns: true,
      },
      orderBy: { createdAt: "desc" },
      // La búsqueda por número o fecha alcanza todo el historial sin enviar
      // cada artículo de todas las ventas en una sola respuesta.
      take: filters.q || filters.date ? 500 : 100,
    });
    return rows.map((sale) => saleHistoryDto(sale, actor));
  }
  @Post("sales/:id/void")
  // D-11 (auditoría 01): como la devolución, desde un equipo registrado: la
  // anulación puede sacar efectivo de la caja abierta de quien anula (D-02).
  @RequireTerminal()
  @Permit("*")
  async voidSale(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    // La anulación es una decisión administrativa y puede hacerse sobre una
    // factura de cualquier día. No depende de que la caja original siga
    // abierta; el motivo, el usuario y cada movimiento quedan auditados.
    // Si esa caja ya cerró y la venta se cobró en efectivo, el reembolso sale
    // de la caja abierta de quien anula (D-02, docs/DECISIONES.md, punto 9).
    const data = parse(z.object({ reason }), body);
    const voided = await this.db.$transaction(async (tx) => {
      const saleRef = await tx.sale.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
        select: { cashSessionId: true, payments: true },
      });
      let originalCash: any = null;
      if (saleRef.cashSessionId) {
        await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id=${saleRef.cashSessionId}::uuid FOR UPDATE`;
        originalCash = await tx.cashSession.findUnique({
          where: { id: saleRef.cashSessionId },
        });
      }
      // D-02: si la caja de la venta ya cerró, el efectivo del reembolso sale
      // de la caja abierta de quien anula. Se bloquea antes que la venta, en el
      // mismo orden que una devolución (caja que reembolsa y luego venta).
      let refundCash: any = null;
      if (originalCash?.closedAt && cashCollected(saleRef.payments) > 0) {
        const own = await tx.cashSession.findFirst({
          where: {
            branchId: actor.branchId,
            userId: actor.id,
            closedAt: null,
          },
          select: { id: true },
        });
        if (!own)
          bad(
            "La caja de esta venta ya cerró. Abre tu caja para entregar el reembolso en efectivo y vuelve a anular.",
          );
        refundCash = await cashLock(tx, actor, own!.id);
      }
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${parse(uuid, id)}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirstOrThrow({
        where: { id, branchId: actor.branchId },
        include: { items: true, payments: true, returns: true },
      });
      if (sale.status !== "completed" || sale.returns.length)
        bad("La venta ya está anulada o tiene devoluciones.");
      const refundAmount = refundCash ? cashCollected(sale.payments) : 0;
      if (
        refundCash &&
        d(refundAmount).gt((await cashExpected(tx, refundCash)).cash)
      )
        bad("No hay suficiente efectivo en tu caja para este reembolso.");
      if (
        sale.payments.some(
          (p) => p.entryType === "installment" && p.status !== "rejected",
        )
      )
        bad("La venta tiene abonos. Usa una devolución.");
      if (
        sale.items.some(
          (item) =>
            !Array.isArray(item.stockAllocations) ||
            item.stockAllocations.length === 0,
        )
      )
        bad(
          "Esta venta antigua no conserva el detalle necesario para reponer el inventario automáticamente. Usa una devolución o revisión manual.",
        );
      const allocations = sale.items.flatMap(
        (i) => i.stockAllocations as any[],
      );
      const variants = new Map<string, any>();
      for (const variantId of [
        ...new Set(allocations.map((a) => a.variantId as string)),
      ].sort())
        variants.set(variantId, await lockVariant(tx, variantId, actor));
      // D-M1 (auditoría 06): las notas de crédito se bloquean DESPUÉS de las
      // variantes y en orden de id, como en la venta. Antes la anulación
      // tomaba la nota y luego las variantes, la venta al revés, y una venta
      // pagada con la misma nota interbloqueaba con la anulación (HTTP 500).
      const noteIds = [
        ...new Set(
          sale.payments.flatMap((p) =>
            p.creditNoteId ? [p.creditNoteId] : [],
          ),
        ),
      ].sort();
      for (const noteId of noteIds) {
        await tx.$queryRaw`SELECT id FROM "CreditNote" WHERE id=${noteId}::uuid FOR UPDATE`;
        const restored = sale.payments
          .filter((p) => p.creditNoteId === noteId)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        await tx.creditNote.updateMany({
          where: { id: noteId },
          data: { balance: { increment: restored } },
        });
      }
      for (const allocation of allocations) {
        const variant = variants.get(allocation.variantId);
        if (allocation.lotId)
          await tx.lot.update({
            where: { id: allocation.lotId },
            data: { qty: { increment: allocation.qty } },
          });
        // Lo anulado vuelve a su costo, igual que en una devolución: si entre
        // la venta y la anulación se recibió mercancía a otro costo, el
        // promedio debe ponderar ambas (R9-dinero-4).
        const newCost = weightedReturn(
          variant,
          allocation.qty,
          allocation.unitCost,
        );
        await tx.variant.update({
          where: { id: variant.id },
          data: { costAvg: newCost },
        });
        variant.costAvg = newCost;
        await stockChange(
          tx,
          actor,
          variant,
          allocation.qty,
          "void",
          data.reason,
          id,
          allocation.lotId,
          allocation.unitCost,
        );
      }
      await tx.sale.update({
        where: { id },
        data: {
          status: "voided",
          creditBalance: 0,
          voidedReason: data.reason,
          voidedBy: actor.id,
        },
      });
      await refreshReceivableAlert(tx, id, actor.branchId);
      await reverseIncentives(tx, actor, "void", id, id);
      let cashDifferences: Record<string, number> | undefined;
      if (refundCash && refundAmount > 0) {
        // D-02: el cierre aprobado no se reescribe. La caja cerrada recibió ese
        // efectivo y lo entregó: la entrada compensa la venta que ya no cuenta
        // y su esperado sigue igual. La caja abierta registra la salida del
        // reembolso. Ambos movimientos nombran la venta original.
        await tx.cashMovement.create({
          data: {
            sessionId: originalCash.id,
            type: "in",
            amount: refundAmount,
            reason: `Venta ${sale.number} anulada después del cierre: su efectivo entró en este turno y se reembolsó desde otra caja.`,
            userId: actor.id,
          },
        });
        await tx.cashMovement.create({
          data: {
            sessionId: refundCash.id,
            type: "out",
            amount: refundAmount,
            reason: `Reembolso de la venta ${sale.number} anulada (su caja ya cerró).`,
            userId: actor.id,
          },
        });
      }
      if (originalCash?.closedAt) {
        cashDifferences = await refreshClosedCash(tx, originalCash);
        await audit(
          tx,
          actor,
          "void_after_close",
          "cash",
          originalCash.id,
          originalCash,
          {
            saleId: id,
            ...cashDifferences,
            ...(refundCash
              ? { refundCashSessionId: refundCash.id, refundAmount }
              : {}),
          },
        );
      }
      await audit(tx, actor, "void", "sale", id, sale, {
        status: "voided",
        reason: data.reason,
        cashSessionId: sale.cashSessionId,
        afterCashClose: Boolean(originalCash?.closedAt),
        ...(cashDifferences ? { cashDifferences } : {}),
      });
      return { ok: true };
      // D-M2 (auditoría 06): la anulación repone inventario y toca cajas y
      // notas como una venta; con 5 s expiraba bajo carga.
    }, MONEY_TRANSACTION);
    notify(this.db, "sale_voided", id);
    return voided;
  }
  @Post("payments/:id/verify")
  @RequireTerminal()
  @Permit("*")
  async verify(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.db.$transaction(async (tx) => {
      const found = await tx.payment.findFirstOrThrow({
        where: {
          id: parse(uuid, id),
          sale: { branchId: actor.branchId },
          method: "transfer",
        },
      });
      if (found.cashSessionId)
        await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id=${found.cashSessionId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${found.saleId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${id}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (payment.status === "ok") return { ok: true };
      if (payment.status === "rejected")
        bad("La transferencia fue rechazada; registra un abono nuevo.");
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: payment.saleId },
      });
      if (sale.status !== "completed") bad("La venta ya no está completada.");
      if (payment.entryType === "installment") {
        if (d(sale.creditBalance).lt(payment.amount))
          bad("El abono requiere revisión: supera la deuda pendiente.");
        await tx.sale.update({
          where: { id: sale.id },
          data: { creditBalance: { decrement: payment.amount } },
        });
        await refreshReceivableAlert(tx, sale.id, actor.branchId);
      }
      await tx.payment.update({ where: { id }, data: { status: "ok" } });
      await resolveTransferAlert(tx, id);
      if (payment.cashSessionId) {
        const cash = await tx.cashSession.findUnique({
          where: { id: payment.cashSessionId },
        });
        if (cash?.closedAt) {
          const differences = await refreshClosedCash(tx, cash);
          await audit(
            tx,
            actor,
            "verified_after_close",
            "cash",
            cash.id,
            cash,
            { paymentId: id, ...differences },
          );
        }
      }
      await audit(tx, actor, "verify", "payment", id, payment, {
        status: "ok",
      });
      return { ok: true };
    });
  }
  // Un abono por transferencia que nunca llegó se rechaza: no descuenta la
  // deuda ni entra a la caja, y deja de bloquear devoluciones y abonos de la
  // venta (R9-dinero-3).
  // M-3 (auditoría 01): también la transferencia con la que se pagó una
  // venta. La mercancía ya salió: ese importe pasa a cuenta por cobrar del
  // cliente (saldo de la venta y alerta «receivable») y deja de contar en el
  // esperado de la caja; si la caja ya cerró, su cuadre se recalcula.
  @Post("payments/:id/reject")
  @RequireTerminal()
  @Permit("*")
  async reject(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(z.object({ reason }), body);
    return this.db.$transaction(async (tx) => {
      const found = await tx.payment.findFirstOrThrow({
        where: {
          id: parse(uuid, id),
          sale: { branchId: actor.branchId },
          method: "transfer",
          entryType: { in: ["installment", "sale"] },
        },
      });
      // Mismo orden que verify(): caja, venta, pago.
      if (found.entryType === "sale" && found.cashSessionId)
        await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id=${found.cashSessionId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${found.saleId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${id}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (payment.status === "rejected") return { ok: true };
      if (payment.status !== "pending_verification")
        bad("Sólo se rechaza una transferencia pendiente de verificar.");
      let saleDebt: number | undefined;
      if (payment.entryType === "sale") {
        const sale = await tx.sale.findUniqueOrThrow({
          where: { id: payment.saleId },
        });
        if (sale.status !== "completed") bad("La venta ya no está completada.");
        // N-3 (defensa en profundidad): la deuda nunca pasa de lo que el
        // cliente conserva sin pagar (venta menos devoluciones, menos la deuda
        // que ya tiene). Una devolución anterior a esta corrección pudo sacar
        // efectivo por esta transferencia: ese faltante se avisa, no se cobra.
        const returned = await tx.saleReturn.aggregate({
          where: { saleId: sale.id },
          _sum: { total: true },
        });
        const keptRaw = d(sale.total)
          .minus(returned._sum.total ?? 0)
          .minus(sale.creditBalance);
        const kept = keptRaw.gt(0) ? keptRaw : d(0);
        const owed = d(payment.amount).lt(kept) ? d(payment.amount) : kept;
        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: { creditBalance: { increment: money(owed) } },
        });
        saleDebt = Number(updated.creditBalance);
        const lost = d(payment.amount).minus(owed);
        if (lost.gt(0))
          await tx.alert.upsert({
            where: { key: "transfer-lost:" + payment.id },
            create: {
              key: "transfer-lost:" + payment.id,
              type: "transfer_rejected_loss",
              severity: "high",
              entityId: sale.id,
              branchId: actor.branchId,
              message: `Se rechazó la transferencia de ${sale.number}, pero RD$ ${formatAmount(Number(money(lost)))} ya se habían devuelto al cliente: no queda deuda que cobrar.`,
            },
            update: {},
          });
      }
      await tx.payment.update({
        where: { id },
        data: { status: "rejected" },
      });
      await resolveTransferAlert(tx, id);
      if (payment.entryType === "sale") {
        await refreshReceivableAlert(tx, payment.saleId, actor.branchId);
        const cash = payment.cashSessionId
          ? await tx.cashSession.findUnique({
              where: { id: payment.cashSessionId },
            })
          : null;
        if (cash?.closedAt) {
          const differences = await refreshClosedCash(tx, cash);
          await audit(
            tx,
            actor,
            "rejected_after_close",
            "cash",
            cash.id,
            cash,
            { paymentId: id, ...differences },
          );
        }
      }
      await audit(tx, actor, "reject", "payment", id, payment, {
        status: "rejected",
        reason: data.reason,
        ...(saleDebt === undefined ? {} : { saleCreditBalance: saleDebt }),
      });
      return { ok: true };
    });
  }
  @Post("returns")
  @RequireTerminal()
  @Permit("sale:manage")
  async returnSale(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        // Clave que la interfaz genera una vez por formulario: con ella un
        // reintento no duplica la devolución (R9-A01).
        operationId: uuid.optional(),
        saleId: uuid,
        cashSessionId: uuid,
        reason,
        refundMethod: z.enum(["cash", "card", "transfer", "credit_note"]),
        items: z
          .array(
            z.object({
              saleItemId: uuid,
              qty: stockQty(10000),
              restock: z.boolean(),
              opened: z.boolean().default(false),
              damaged: z.boolean().default(false),
            }),
          )
          .min(1),
      }),
      body,
    );
    if (new Set(data.items.map((i) => i.saleItemId)).size !== data.items.length)
      bad("No repitas artículos en la devolución.");
    const done = await this.db.$transaction(async (tx) => {
      // Dos envíos con la misma clave se atienden uno detrás del otro: el
      // segundo encuentra la devolución del primero y la devuelve tal cual.
      // Misma clave con otros datos es un error, no otra devolución.
      if (data.operationId) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.operationId}))::text AS locked`;
        const prior = await tx.saleReturn.findUnique({
          where: { operationId: data.operationId },
        });
        if (prior) {
          if (prior.branchId !== actor.branchId) denied();
          if (!sameReturnRequest(prior, data))
            bad("El UUID ya corresponde a otra devolución.");
          return safe(prior, actor);
        }
      }
      const refundCash = await cashLock(tx, actor, data.cashSessionId, true);
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${data.saleId}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirstOrThrow({
        where: { id: data.saleId, branchId: actor.branchId },
        include: {
          items: {
            include: {
              variant: {
                include: { product: { include: { category: true } } },
              },
            },
          },
          returns: true,
        },
      });
      if (sale.status !== "completed")
        bad("Sólo se devuelven ventas completadas.");
      const settings = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      if (
        Date.now() - sale.createdAt.getTime() >
        Number((settings?.data as any)?.returnDays ?? 30) * 86400000
      )
        bad("La venta excede el plazo de devolución.");
      const lines = data.items.map((i) => {
        const line = sale.items.find((l) => l.id === i.saleItemId);
        if (!line || d(i.qty).plus(line.returnedQty).gt(line.qty))
          bad("Cantidad de devolución inválida.");
        // Un combo vendido se devuelve por unidades enteras (R6-01).
        const isKit = (line.stockAllocations as any[]).some(
          (a) => a.variantId !== line.variantId,
        );
        // Una venta anterior a la ronda 7 pudo vender una fracción de combo:
        // su saldo completo sí se puede devolver.
        const remaining = d(line.qty).minus(line.returnedQty);
        if (isKit && !Number.isInteger(i.qty) && !remaining.eq(i.qty))
          bad("Los combos se devuelven por unidades enteras.");
        if (
          i.restock &&
          (i.damaged || (i.opened && line.variant.product.category.requiresLot))
        )
          bad(
            "Un producto abierto o dañado no puede volver al stock vendible.",
          );
        return { ...i, line };
      });
      const ids = [
        ...new Set(
          lines.flatMap((i) =>
            (i.line.stockAllocations as any[]).map(
              (a) => a.variantId as string,
            ),
          ),
        ),
      ].sort();
      const variants = new Map<string, any>();
      for (const variantId of ids)
        variants.set(variantId, await lockVariant(tx, variantId, actor));
      let total = d(0),
        tax = d(0),
        cost = d(0),
        wasteQty = d(0),
        wasteCost = d(0);
      // Importes devueltos por línea: quedan en la devolución para que los
      // reportes usen exactamente lo registrado (R7-04).
      const parts: {
        cost: number;
        total: number;
        tax: number;
        wasteQty: number;
        wasteCost: number;
      }[] = [];
      // Lo que ya contabilizaron las devoluciones anteriores, línea por línea.
      const history = replayReturns(sale, sale.returns);
      for (const i of lines) {
        const before = d(i.line.returnedQty),
          after = before.plus(i.qty);
        const back = (value: ReturnType<typeof d>) =>
          returnedAt(value, i.line.qty, after).minus(
            returnedAt(value, i.line.qty, before),
          );
        // Total e ITBIS con redondeo acumulado, como el costo: devolver de a
        // una unidad suma exactamente lo cobrado (R9-dinero-2).
        const lineTotal = back(d(i.line.lineTotal)),
          lineTax = back(d(i.line.tax));
        total = total.plus(lineTotal);
        tax = tax.plus(lineTax);
        // Costo devuelto: valor de las asignaciones (exacto en combos), con
        // redondeo acumulado para que varias devoluciones sumen exactamente el
        // costo de la venta.
        let lineCost = d(0);
        if (i.restock) {
          lineCost = back(allocationCost(i.line));
          // La devolución que completa la línea cierra contra lo contabilizado
          // de verdad: el costo registrado de la línea en la venta, menos lo
          // que ya repusieron las devoluciones anteriores y lo que quedó como
          // pérdida. Con devoluciones o ventas antiguas (rondas 3 a 7) eso
          // difiere del redondeo acumulado; con datos nuevos es lo mismo
          // (R9-dinero-1, R9-dinero-7).
          const past = history.lines.get(i.line.id) ?? {
            returned: d(0),
            restocked: d(0),
            waste: d(0),
          };
          if (after.eq(i.line.qty) && past.returned.eq(before))
            lineCost = history.booked
              .get(i.line.id)!
              .minus(past.restocked)
              .minus(past.waste);
          cost = cost.plus(lineCost);
        }
        // Merma: lo que no vuelve al stock vendible queda contado y valorado
        // aparte; el costo contable de la devolución sigue en cero (R9-A05).
        const lineWasteQty = i.restock ? d(0) : d(i.qty),
          lineWasteCost = i.restock ? d(0) : back(allocationCost(i.line));
        wasteQty = wasteQty.plus(lineWasteQty);
        wasteCost = wasteCost.plus(lineWasteCost);
        parts.push({
          cost: lineCost.toNumber(),
          total: lineTotal.toNumber(),
          tax: lineTax.toNumber(),
          wasteQty: lineWasteQty.toNumber(),
          wasteCost: lineWasteCost.toNumber(),
        });
        await tx.saleItem.update({
          where: { id: i.line.id },
          data: { returnedQty: { increment: i.qty } },
        });
        for (const { allocation, qty } of returnShares(
          i.line.stockAllocations as any[],
          i.line.qty,
          i.line.returnedQty,
          i.qty,
        )) {
          const variant = variants.get(allocation.variantId);
          if (i.restock) {
            if (allocation.lotId) {
              const lot = await tx.lot.findUniqueOrThrow({
                where: { id: allocation.lotId },
              });
              if (expired(lot.expiryDate))
                bad("El lote ya venció. Registra la devolución como merma.");
              await tx.lot.update({
                where: { id: allocation.lotId },
                data: { qty: { increment: qty } },
              });
            }
            const newCost = weightedReturn(variant, qty, allocation.unitCost);
            await tx.variant.update({
              where: { id: variant.id },
              data: { costAvg: newCost },
            });
            variant.costAvg = newCost;
            await stockChange(
              tx,
              actor,
              variant,
              qty,
              "return",
              data.reason,
              sale.id,
              allocation.lotId,
            );
          } else
            await tx.inventoryMovement.create({
              data: {
                variantId: variant.id,
                lotId: allocation.lotId,
                // Cantidad física recibida como merma; el saldo vendible no
                // cambia (R9-A05).
                type: "return_waste",
                qty,
                unitCost: allocation.unitCost,
                balanceAfter: variant.stock,
                refId: sale.id,
                reason: data.reason + " (no vendible)",
                userId: actor.id,
                branchId: actor.branchId,
              },
            });
        }
      }
      const counter = await tx.counter.upsert({
        where: { key: "return:" + actor.branchId },
        create: { key: "return:" + actor.branchId, value: 1 },
        update: { value: { increment: 1 } },
      });
      const debtReduction = money(
        d(sale.creditBalance).lt(total) ? sale.creditBalance : total,
      );
      // Un abono por transferencia pendiente todavía no descontó la deuda. Si
      // la devolución la deja por debajo de ese abono, al verificarlo no
      // cabría y el cliente no recibiría su dinero: primero se verifica o se
      // rechaza (R9-dinero-3).
      const pending = await tx.payment.aggregate({
        where: {
          saleId: sale.id,
          entryType: "installment",
          status: "pending_verification",
        },
        _sum: { amount: true },
      });
      if (
        d(pending._sum.amount ?? 0).gt(0) &&
        d(sale.creditBalance)
          .minus(debtReduction)
          .lt(pending._sum.amount ?? 0)
      )
        bad(
          "Verifica o rechaza primero los abonos por transferencia pendientes de esta venta.",
        );
      const refundAmount = money(total.minus(debtReduction));
      // N-3 (auditoría 01 v2): mientras la transferencia de la propia venta no
      // se verifique, lo que se devuelve (en el medio que sea, también nota de
      // crédito) no puede pasar de lo realmente cobrado y no devuelto. Si no,
      // saldría efectivo que nunca llegó y, al rechazar la transferencia, el
      // cliente quedaría debiendo mercancía que ya devolvió.
      const pendingSaleTransfer = await tx.payment.aggregate({
        where: {
          saleId: sale.id,
          entryType: "sale",
          method: "transfer",
          status: "pending_verification",
        },
        _sum: { amount: true },
      });
      if (d(pendingSaleTransfer._sum.amount ?? 0).gt(0)) {
        const collected = await tx.payment.aggregate({
          where: { saleId: sale.id, status: "ok" },
          _sum: { amount: true },
        });
        const refunded = await tx.saleReturn.aggregate({
          where: { saleId: sale.id },
          _sum: { refundAmount: true },
        });
        const availableRaw = d(collected._sum.amount ?? 0).minus(
          refunded._sum.refundAmount ?? 0,
        );
        const available = availableRaw.gt(0) ? availableRaw : d(0);
        if (d(refundAmount).gt(available))
          bad(
            `La transferencia de esta venta aún no está verificada: sólo se pueden reembolsar RD$ ${formatAmount(Number(available))} de lo ya cobrado. Verifica o rechaza primero la transferencia.`,
          );
      }
      // D-06: el efectivo que se entrega tiene que estar en la caja que
      // reembolsa (la caja ya está bloqueada arriba). Sin este control, una
      // venta cobrada con tarjeta devuelta en efectivo dejaba el esperado en
      // negativo. Regla: devolver por el medio original (tarjeta,
      // transferencia) o como nota de crédito siempre procede; en efectivo,
      // sólo hasta el efectivo esperado de la caja. Cambiar el medio ya exige
      // sale:manage (gerente o administrador), que es quien registra
      // devoluciones.
      if (
        data.refundMethod === "cash" &&
        d(refundAmount).gt(0) &&
        d(refundAmount).gt((await cashExpected(tx, refundCash)).cash)
      )
        bad(
          "No hay suficiente efectivo en la caja para este reembolso. Reembolsa por el medio del pago original o como nota de crédito.",
        );
      if (debtReduction)
        await tx.sale.update({
          where: { id: sale.id },
          data: { creditBalance: { decrement: debtReduction } },
        });
      if (debtReduction)
        await refreshReceivableAlert(tx, sale.id, actor.branchId);
      const row = await tx.saleReturn.create({
        data: {
          saleId: sale.id,
          number: "NC-" + String(counter.value).padStart(6, "0"),
          reason: data.reason,
          total: money(total),
          taxTotal: money(tax),
          costTotal: money(cost),
          wasteQty: quantity(wasteQty),
          wasteCostTotal: money(wasteCost),
          refundMethod: data.refundMethod,
          refundAmount,
          cashSessionId: data.cashSessionId,
          userId: actor.id,
          items: json(data.items.map((it, k) => ({ ...it, ...parts[k] }))),
          branchId: actor.branchId,
          operationId: data.operationId ?? null,
        },
      });
      await tx.creditNote.create({
        data: {
          returnId: row.id,
          redemptionCode: randomBytes(16).toString("hex").toUpperCase(),
          customerId: sale.customerId,
          amount: refundAmount,
          balance: data.refundMethod === "credit_note" ? refundAmount : 0,
        },
      });
      await reverseIncentives(tx, actor, "return", sale.id, row.id, data.items);
      await audit(tx, actor, "return", "sale", sale.id, undefined, row);
      // B-6 (auditoría 01): reembolsar por un medio que la venta no usó (p. ej.
      // efectivo de una venta con tarjeta) convierte tarjeta en efectivo. Se
      // permite a quien gestiona ventas, pero queda una alerta para revisarlo.
      // La nota de crédito (saldo en tienda) nunca la genera.
      if (data.refundMethod !== "credit_note" && Number(refundAmount) > 0) {
        const paid = await tx.payment.findMany({
          where: { saleId: sale.id, status: { not: "rejected" } },
          select: { method: true },
        });
        if (!paid.some((p) => p.method === data.refundMethod)) {
          const label: Record<string, string> = {
            cash: "efectivo",
            card: "tarjeta",
            transfer: "transferencia",
          };
          await tx.alert.upsert({
            where: { key: "refund-method:" + row.id },
            create: {
              key: "refund-method:" + row.id,
              type: "refund_method_mismatch",
              severity: data.refundMethod === "cash" ? "high" : "medium",
              entityId: sale.id,
              branchId: actor.branchId,
              message: `Devolución ${row.number} de ${sale.number}: RD$ ${formatAmount(Number(refundAmount))} reembolsados en ${label[data.refundMethod]}, que no es un medio con el que se cobró la venta · ${actor.name}.`,
            },
            update: {},
          });
        }
      }
      return safe(row, actor);
    }, MONEY_TRANSACTION);
    if (done?.id) notify(this.db, "return", done.id);
    return done;
  }
  @Get("credit-notes")
  @Permit("sale:write")
  async creditNotes(
    @CurrentUser() actor: Actor,
    @Query("customerId") customerId?: string,
    @Query("code") code?: string,
  ) {
    const manager = can(actor.permissions, "sale:manage");
    const normalized = code?.trim().toUpperCase();
    if (normalized && !/^[0-9A-F]{32}$/.test(normalized)) return [];
    if (!manager && !customerId && !normalized) return [];
    if (customerId) parse(uuid, customerId);
    const returns = await this.db.saleReturn.findMany({
      where: { branchId: actor.branchId },
      select: { id: true, number: true },
    });
    const notes = await this.db.creditNote.findMany({
      where: {
        returnId: { in: returns.map((r) => r.id) },
        balance: { gt: 0 },
        ...(customerId ? { customerId } : {}),
        ...(normalized ? { redemptionCode: normalized } : {}),
        ...(!manager && !normalized ? { customerId: customerId! } : {}),
      },
    });
    return notes.map((n) => {
      const { redemptionCode, ...publicNote } = n;
      return {
        ...publicNote,
        ...(manager ? { redemptionCode } : {}),
        number: returns.find((r) => r.id === n.returnId)?.number,
      };
    });
  }
  @Get("returns/:id/credit-note.pdf")
  @Permit("sale:manage")
  async creditNotePdf(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const returned = await this.db.saleReturn.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    const [note, settings] = await Promise.all([
      this.db.creditNote.findUniqueOrThrow({
        where: { returnId: returned.id },
      }),
      this.db.settings.findUnique({ where: { id: actor.branchId } }),
    ]);
    const business = (settings?.data as any) ?? {};
    res.setHeader("Content-Type", "application/pdf");
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.pipe(res);
    doc.fontSize(22).text(business.name || "Nexora POS", { align: "center" });
    if (business.branchName)
      doc.fontSize(11).text(business.branchName, { align: "center" });
    if (business.address)
      doc.fontSize(10).text(business.address, { align: "center" });
    if (business.phone)
      doc.fontSize(10).text("Tel.: " + business.phone, { align: "center" });
    if (business.legalId)
      doc.fontSize(10).text("RNC: " + business.legalId, { align: "center" });
    doc
      .moveDown()
      .fontSize(16)
      .text("Nota de crédito · " + returned.number)
      .fontSize(12)
      .text("Nota interna de crédito · no fiscal")
      .text(
        "Fecha: " +
          note.createdAt.toLocaleString("es-DO", {
            timeZone: BUSINESS_TIME_ZONE,
            dateStyle: "short",
            timeStyle: "short",
          }),
      )
      .text("Importe: RD$ " + note.amount)
      .text("Saldo: RD$ " + note.balance)
      .text("Motivo de la devolución: " + returned.reason)
      .moveDown()
      .text("Código para presentar en caja:")
      .fontSize(14)
      .text(note.redemptionCode)
      .fontSize(10)
      .moveDown()
      .text("Condiciones de uso:")
      .text(
        "Presenta este código en caja. El saldo se aplica a compras en esta sucursal, se descuenta una sola vez por operación y está sujeto a verificación. No es efectivo ni comprobante fiscal.",
      );
    doc.end();
  }
  @Post("sales/:id/installments")
  @RequireTerminal()
  @Permit("*")
  async installment(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    return this.collect(actor, id, parse(installmentSchema, body), false);
  }
  // Cobro de una contraentrega cuando el mensajero trae el dinero: es un abono
  // de la venta (idempotente por offlineUuid) en la caja abierta de quien lo
  // recibe, en efectivo, con tarjeta (con la referencia del voucher) o por
  // transferencia (ésta, pendiente de verificar). La foto de la evidencia se
  // sube después con POST /payments/:id/proof.
  @Post("sales/:id/cod-collections")
  @RequireTerminal()
  @Permit("*")
  async codCollection(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    return this.collect(actor, id, parse(installmentSchema, body), true);
  }
  // Foto de la evidencia de un cobro (voucher, comprobante o el efectivo
  // recibido por WhatsApp): jpg, png o webp de hasta 2 MB, guardada como data
  // URL en el pago, igual que el logo. La sube quien registró el cobro en su
  // caja o quien gestiona ventas; se puede reemplazar.
  @Post("payments/:id/proof")
  @Permit("authenticated")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: PROOF_MAX_BYTES + 1, files: 1 },
    }),
  )
  async paymentProof(
    @Param("id") id: string,
    @UploadedFile() file: any,
    @CurrentUser() actor: Actor,
  ) {
    if (!file?.buffer?.length) bad("Adjunta la foto de la evidencia.");
    if (file.size > PROOF_MAX_BYTES)
      bad("La foto debe pesar como máximo 2 MB.");
    const type = imageType(file.buffer);
    if (!type || type === "gif")
      bad("La evidencia debe ser una imagen JPG, PNG o WebP.");
    const payment = await this.proofPayment(actor, id);
    const proofUrl = `data:image/${type};base64,${file.buffer.toString("base64")}`;
    return this.db.$transaction(async (tx) => {
      const row = await tx.payment.update({
        where: { id: payment.id },
        data: { proofUrl },
      });
      await audit(
        tx,
        actor,
        "payment_proof",
        "sale",
        payment.saleId,
        { paymentId: payment.id, proof: !!payment.proofUrl },
        {
          paymentId: payment.id,
          proof: `(imagen de ${Math.round(file.size / 1024)} KB)`,
        },
      );
      return paymentSummary(row);
    });
  }
  @Get("payments/:id/proof")
  @Permit("authenticated")
  async getPaymentProof(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const payment = await this.proofPayment(actor, id);
    if (!payment.proofUrl) bad("Este pago no tiene evidencia adjunta.");
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/s.exec(
      payment.proofUrl,
    );
    if (!match) bad("La evidencia guardada no tiene un formato válido.");
    res.setHeader("Cache-Control", "private, no-store");
    return res.type(match[1]).send(Buffer.from(match[2], "base64"));
  }
  private async proofPayment(actor: Actor, id: string) {
    const payment = await this.db.payment.findFirstOrThrow({
      where: {
        id: parse(uuid, id),
        entryType: "installment",
        sale: { branchId: actor.branchId },
      },
    });
    if (!can(actor.permissions, "sale:manage")) {
      const own = payment.cashSessionId
        ? await this.db.cashSession.findFirst({
            where: { id: payment.cashSessionId, userId: actor.id },
            select: { id: true },
          })
        : null;
      if (!own) denied();
    }
    return payment;
  }
  // Créditos y contraentregas pendientes: sólo la administración puede verlos
  // y registrar cómo entró el dinero.
  @Get("cod/pending")
  @Permit("*")
  async codPending(@CurrentUser() actor: Actor) {
    const sales = await this.db.sale.findMany({
      where: {
        branchId: actor.branchId,
        status: "completed",
        creditBalance: { gt: 0 },
        payments: {
          some: {
            method: { in: ["credit", "cod"] },
            entryType: "sale",
          },
        },
      },
      include: { payments: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    const [customers, sellers] = await Promise.all([
      this.db.customer.findMany({
        where: {
          id: {
            in: sales.flatMap((s) => (s.customerId ? [s.customerId] : [])),
          },
        },
        select: { id: true, name: true, phone: true },
      }),
      this.db.user.findMany({
        where: { id: { in: sales.map((s) => s.sellerId) } },
        select: { id: true, name: true },
      }),
    ]);
    const sum = (rows: { amount: unknown }[]) =>
      money(rows.reduce((a, p) => a.plus(p.amount as any), d(0)));
    return sales.flatMap((s) => {
      const collections = s.payments.filter(
        (p) => p.entryType === "installment",
      );
      const receivableAmount = sum(
        s.payments.filter(
          (p) => ["credit", "cod"].includes(p.method) && p.entryType === "sale",
        ),
      );
      const pending = Number(s.creditBalance);
      if (pending <= 0) return [];
      return [
        {
          saleId: s.id,
          number: s.number,
          createdAt: s.createdAt,
          cashSessionId: s.cashSessionId,
          total: Number(s.total),
          codAmount: receivableAmount,
          receivableAmount,
          pending,
          // Transferencias del mensajero registradas que falta verificar.
          pendingVerification: sum(
            collections.filter((p) => p.status === "pending_verification"),
          ),
          collections: collections.map((p) => ({
            ...paymentSummary(p),
            paymentId: p.id,
            amount: Number(p.amount),
          })),
          customer: customerForActor(
            customers.find((c) => c.id === s.customerId) ?? null,
            actor,
          ),
          seller: sellers.find((u) => u.id === s.sellerId) ?? null,
          notes: s.notes,
        },
      ];
    });
  }
  private async collect(
    actor: Actor,
    id: string,
    data: z.infer<typeof installmentSchema>,
    codOnly: boolean,
  ) {
    const row = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.offlineUuid}))::text AS locked`;
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: data.offlineUuid },
      });
      if (existing) {
        if (
          existing.saleId !== id ||
          Number(existing.amount) !== data.amount ||
          existing.method !== data.method ||
          existing.cashSessionId !== data.cashSessionId
        )
          bad("El UUID ya corresponde a otro abono.");
        const own = await tx.cashSession.findFirst({
          where: {
            id: existing.cashSessionId!,
            branchId: actor.branchId,
            userId: actor.id,
          },
        });
        if (!own) denied();
        return existing;
      }
      await cashLock(tx, actor, data.cashSessionId);
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${parse(uuid, id)}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirstOrThrow({
        where: { id, branchId: actor.branchId, status: "completed" },
      });
      const receivable = !!(await tx.payment.count({
        where: {
          saleId: id,
          method: { in: ["credit", "cod"] },
          entryType: "sale",
        },
      }));
      if (codOnly && !receivable)
        bad("Esta venta no tiene crédito / contraentrega pendiente.");
      const pending = await tx.payment.aggregate({
        where: {
          saleId: id,
          entryType: "installment",
          status: "pending_verification",
        },
        _sum: { amount: true },
      });
      if (
        d(sale.creditBalance)
          .minus(pending._sum.amount ?? 0)
          .lt(data.amount)
      )
        bad(
          receivable
            ? "El cobro supera el saldo pendiente."
            : "El abono supera el saldo pendiente.",
        );
      // El mensajero cobra con un terminal o enlace de pago: basta la
      // referencia del voucher.
      if (codOnly && data.method === "card" && !data.reference?.trim())
        bad("Indica la referencia del voucher de la tarjeta.");
      if (
        !codOnly &&
        data.method === "card" &&
        (!data.cardLast4 || !data.approvalCode)
      )
        bad("Indica los últimos 4 dígitos y la aprobación de tarjeta.");
      if (data.method === "transfer" && (!data.bank || !data.reference))
        bad("Indica banco y referencia de transferencia.");
      const settings = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      const { offlineUuid, ...payment } = data;
      const row = await tx.payment.create({
        data: {
          ...payment,
          saleId: id,
          idempotencyKey: offlineUuid,
          entryType: "installment",
          tendered: data.amount,
          feeAmount:
            data.method === "card"
              ? money(
                  d(data.amount)
                    .times(
                      Number((settings?.data as any)?.cardFeePercent ?? 2.5),
                    )
                    .div(100),
                )
              : 0,
          status: data.method === "transfer" ? "pending_verification" : "ok",
        },
      });
      if (data.method !== "transfer")
        await tx.sale.update({
          where: { id },
          data: { creditBalance: { decrement: data.amount } },
        });
      if (data.method !== "transfer")
        await refreshReceivableAlert(tx, id, actor.branchId);
      await audit(
        tx,
        actor,
        receivable ? "receivable_collected" : "installment",
        "sale",
        id,
        undefined,
        row,
      );
      return row;
    });
    notify(this.db, "collection", row.id);
    return row;
  }
  @Get("sales/:id/receipt.pdf")
  @Permit("sale:write")
  async receipt(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const sale = await this.db.sale.findFirstOrThrow({
      where: {
        id: parse(uuid, id),
        branchId: actor.branchId,
        ...(can(actor.permissions, "sale:manage")
          ? {}
          : { sellerId: actor.id }),
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
      },
    });
    const settings = await this.db.settings.findUnique({
      where: { id: actor.branchId },
    });
    // SEC-05: este recibo es interno y no fiscal; la vendedora lo descarga
    // con la cédula/RNC y el teléfono del cliente enmascarados.
    const [customer, seller] = await Promise.all([
      sale.customerId
        ? this.db.customer
            .findUnique({ where: { id: sale.customerId } })
            .then((c) => customerForActor(c, actor))
        : null,
      this.db.user.findUnique({ where: { id: sale.sellerId } }),
    ]);
    const business = (settings?.data as any) ?? {};
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${sale.number}.pdf"`,
    );
    doc.pipe(res);
    doc.fontSize(18).text(business.name || "Nexora POS", { align: "center" });
    if (business.branchName)
      doc.fontSize(10).text(business.branchName, { align: "center" });
    if (business.address)
      doc.fontSize(9).text(business.address, { align: "center" });
    if (business.phone)
      doc.fontSize(9).text("Tel.: " + business.phone, { align: "center" });
    if (business.legalId)
      doc.fontSize(9).text("RNC: " + business.legalId, { align: "center" });
    doc
      .fontSize(10)
      .text("DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL")
      .text(sale.number)
      .text(
        "Fecha y hora: " +
          sale.createdAt.toLocaleString("es-DO", {
            timeZone: BUSINESS_TIME_ZONE,
            dateStyle: "short",
            timeStyle: "short",
          }),
      )
      .moveDown();
    doc.text("Cajero: " + (seller?.name || ""));
    doc.text(
      "Vendido a: " +
        (customer?.name || "Consumidor final") +
        (customer?.legalId ? " · RNC/Cédula " + customer.legalId : "") +
        (customer?.phone ? " · Tel. " + customer.phone : ""),
    );
    doc.moveDown();
    if (sale.status === "voided") doc.text("ANULADA · " + sale.voidedReason);
    for (const item of sale.items) {
      doc.text(
        `${item.variant.product.name} / ${item.variant.sku}   ${item.qty} × RD$ ${item.unitPrice}   RD$ ${item.lineTotal}`,
      );
      if (item.promotionName) doc.text("   Promoción: " + item.promotionName);
    }
    doc
      .moveDown()
      .text(
        (sale.taxIncluded === false
          ? "ITBIS adicional: RD$ "
          : "ITBIS incluido: RD$ ") + sale.taxTotal,
      )
      .fontSize(18)
      .text("Total: RD$ " + sale.total);
    doc.fontSize(10);
    if (sale.ncfType)
      doc.text(
        "Solicitud NCF: " + sale.ncfType + " · pendiente de emisión fiscal",
      );
    if (Number(sale.creditBalance) > 0)
      doc.text("Crédito / contraentrega pendiente: RD$ " + sale.creditBalance);
    if (Number(sale.discountTotal) > 0)
      doc.text(
        `Descuento: RD$ ${sale.discountTotal} · ${sale.discountReason ?? "Sin motivo"} · Autorizó: ${sale.discountApprovedName ?? "No identificado"} (${sale.discountApprovedRole ?? sale.discountRule ?? "regla no identificada"})`,
      );
    for (const p of sale.payments) doc.text(paymentReceiptLine(p));
    doc.moveDown().text("Gracias por elegirnos.");
    doc.end();
  }
}
const installmentSchema = z.object({
  offlineUuid: uuid,
  cashSessionId: uuid,
  // Centavos exactos (R9-dinero-5): lo guardado en el pago es lo que
  // descuenta la deuda y lo que compara un reintento.
  amount: moneyAmount().transform((v) => money(v)),
  method: z.enum(["cash", "card", "transfer"]),
  bank: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
  cardLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  approvalCode: z.string().max(100).optional(),
});
function weightedReturn(variant: any, qty: number, cost: number) {
  if (Number(variant.stock) <= 0) return money(cost);
  return money(
    d(variant.stock)
      .times(variant.costAvg)
      .plus(d(qty).times(cost))
      .div(d(variant.stock).plus(qty)),
  );
}
// La devolución guardada con esa clave de operación, ¿pide lo mismo que este
// envío? Se compara lo que decide el resultado: venta, caja, método y cada
// línea; el motivo y los importes calculados ya quedaron en la fila (R9-A01).
function sameReturnRequest(prior: any, data: any) {
  const stored = (prior.items as any[]) ?? [];
  return (
    prior.saleId === data.saleId &&
    prior.cashSessionId === data.cashSessionId &&
    prior.refundMethod === data.refundMethod &&
    prior.reason === data.reason &&
    stored.length === data.items.length &&
    data.items.every(
      (item: any, k: number) =>
        stored[k].saleItemId === item.saleItemId &&
        Number(stored[k].qty) === Number(item.qty) &&
        !!stored[k].restock === !!item.restock &&
        !!stored[k].opened === !!item.opened &&
        !!stored[k].damaged === !!item.damaged,
    )
  );
}

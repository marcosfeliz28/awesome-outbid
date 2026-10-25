import { tenantUnique } from "./tenant-context";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { compare } from "bcryptjs";
import {
  d,
  money,
  can,
  z,
  cashCloseSchema,
  countDenominations,
  cashDifference,
  deliveredSplit,
  formatAmount,
  formatMoney,
  moneyAmount,
  businessDate,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  parse,
  uuid,
  amount,
  reason,
  audit,
  bad,
  denied,
  canViewCashExpected,
} from "./common";
import { cashLock, terminalName, terminalNames } from "./sales";
import { STORE_REPORTS, storeReport, sendStoreReport } from "./reports";
import { managerPinApproval, verifyPinAttempt } from "./security";
import { notify } from "./notifications";
import { cashDifferenceMessage } from "./alerts";
// Aparte del import anterior de ./sales para no chocar al fusionar ramas.
import { MONEY_TRANSACTION } from "./sales";
import { moneyDb } from "./database-errors";
import { enforcePlanQuota } from "./billing-plans";
import { parsePaymentObjectReference } from "./tenant-object-store";

export async function cashExpected(db: any, session: any) {
  // Sólo las columnas que se suman (D-M6): sin select, Prisma traía también
  // Payment.proofUrl, históricamente la foto base64 de cada abono
  // (26 MB con 20 fotos), dentro de transacciones que bloquean la caja.
  const payments = await db.payment.findMany({
    where: {
      cashSessionId: session.id,
      sale: { status: "completed" },
      // M-3: una transferencia de venta rechazada no entró (pasó a cobrar).
      status: { not: "rejected" },
      OR: [{ entryType: { not: "installment" } }, { status: "ok" }],
    },
    select: { method: true, amount: true },
  });
  const movements = await db.cashMovement.findMany({
    where: { sessionId: session.id },
  });
  const returns = await db.saleReturn.findMany({
    where: { cashSessionId: session.id },
    select: { refundMethod: true, refundAmount: true },
  });
  const expected = {
    cash: d(session.openingAmount),
    card: d(0),
    transfer: d(0),
  };
  for (const p of payments)
    if (p.method in expected)
      expected[p.method as keyof typeof expected] = expected[
        p.method as keyof typeof expected
      ].plus(p.amount);
  for (const m of movements)
    expected.cash = expected.cash.plus(
      m.type === "in" ? m.amount : d(m.amount).negated(),
    );
  for (const r of returns)
    if (r.refundMethod in expected)
      expected[r.refundMethod as keyof typeof expected] = expected[
        r.refundMethod as keyof typeof expected
      ].minus(r.refundAmount);
  return {
    cash: money(expected.cash),
    card: money(expected.card),
    transfer: money(expected.transfer),
    movements,
  };
}
// Esperado de varias cajas a la vez (GET /cash-sessions): una consulta
// agrupada por tabla en vez de tres por caja; con 100 cajas en paralelo el
// pool de Prisma se agotaba (P2024). Misma fórmula que cashExpected, que
// sigue siendo la del cierre y los movimientos; tests/perf-api.test.ts
// comprueba que ambas coinciden.
export async function cashExpectedMany(db: any, sessions: any[]) {
  const result = new Map<string, Awaited<ReturnType<typeof cashExpected>>>();
  const ids = sessions.map((s) => s.id);
  if (!ids.length) return result;
  const payments = await db.payment.groupBy({
    by: ["cashSessionId", "method"],
    where: {
      cashSessionId: { in: ids },
      sale: { status: "completed" },
      // M-3: igual que cashExpected, una transferencia de venta rechazada no
      // entró en la caja (pasó a cobrar) y no cuenta en la lista de cajas.
      status: { not: "rejected" },
      OR: [{ entryType: { not: "installment" } }, { status: "ok" }],
    },
    _sum: { amount: true },
  });
  const movements = await db.cashMovement.findMany({
    where: { sessionId: { in: ids } },
  });
  const returns = await db.saleReturn.groupBy({
    by: ["cashSessionId", "refundMethod"],
    where: { cashSessionId: { in: ids } },
    _sum: { refundAmount: true },
  });
  for (const session of sessions) {
    const expected = {
      cash: d(session.openingAmount),
      card: d(0),
      transfer: d(0),
    };
    for (const p of payments)
      if (p.cashSessionId === session.id && p.method in expected)
        expected[p.method as keyof typeof expected] = expected[
          p.method as keyof typeof expected
        ].plus(p._sum.amount ?? 0);
    const own = movements.filter((m: any) => m.sessionId === session.id);
    for (const m of own)
      expected.cash = expected.cash.plus(
        m.type === "in" ? m.amount : d(m.amount).negated(),
      );
    for (const r of returns)
      if (r.cashSessionId === session.id && r.refundMethod in expected)
        expected[r.refundMethod as keyof typeof expected] = expected[
          r.refundMethod as keyof typeof expected
        ].minus(r._sum.refundAmount ?? 0);
    result.set(session.id, {
      cash: money(expected.cash),
      card: money(expected.card),
      transfer: money(expected.transfer),
      movements: own,
    });
  }
  return result;
}
// Diferencias de una caja cerrada: contado (+ vales) contra lo esperado.
function closeDifferences(session: any, expected: any) {
  const vouchers = (session.closeDetails as any)?.vouchers ?? 0;
  return {
    cash: money(
      d(session.countedCash ?? 0)
        .plus(vouchers)
        .minus(expected.cash),
    ),
    card: money(d(session.countedCard ?? 0).minus(expected.card)),
    transfer: money(d(session.countedTransfer ?? 0).minus(expected.transfer)),
  };
}
export { canViewCashExpected } from "./common";

// El cierre de una cajera es realmente ciego: cualquier diferencia exige una
// explicación, sin comunicar si está cerca o lejos del monto esperado. Quien
// gestiona ventas conserva el umbral configurable para cierres supervisados.
export function cashCloseRequiresNote(
  actor: Actor,
  differences: { cash: unknown; card: unknown; transfer: unknown },
  differenceLimit: number,
) {
  const values = [
    Math.abs(Number(differences.cash)),
    Math.abs(Number(differences.card)),
    Math.abs(Number(differences.transfer)),
  ];
  return canViewCashExpected(actor)
    ? Math.max(...values) > differenceLimit
    : values.some((value) => value > 0);
}
// Recalcula lo esperado de una caja ya cerrada (venta offline sincronizada o
// transferencia verificada después del cierre) y guarda las diferencias.
export async function refreshClosedCash(tx: any, session: any) {
  const expected = await cashExpected(tx, session);
  const differences = closeDifferences(session, expected);
  await tx.cashSession.update({
    where: { id: session.id },
    data: {
      expectedCash: expected.cash,
      expectedCard: expected.card,
      expectedTransfer: expected.transfer,
      differenceCash: differences.cash,
      differenceCard: differences.card,
      differenceTransfer: differences.transfer,
      difference: money(
        d(differences.cash).plus(differences.card).plus(differences.transfer),
      ),
    },
  });
  return differences;
}
const sumOf = (rows: { amount: unknown }[]) =>
  money(rows.reduce((a, r) => a.plus(r.amount as any), d(0)));
// Datos del impreso «Cuadre de Caja» (docs/tienda/CUADRE_REPORTES_FACTURA.md).
export async function buildCuadre(db: any, actor: Actor, session: any) {
  const [settingsRow, terminal, cashier, sales, installments, movements] =
    await Promise.all([
      db.settings.findUnique({ where: { id: session.branchId } }),
      UUID_RE.test(session.registerId)
        ? db.terminal.findUnique({ where: { id: session.registerId } })
        : null,
      db.user.findUnique({ where: { id: session.userId } }),
      db.sale.findMany({
        where: { cashSessionId: session.id, branchId: session.branchId },
        include: { payments: true },
      }),
      db.payment.findMany({
        where: {
          cashSessionId: session.id,
          entryType: "installment",
          sale: { status: "completed" },
        },
        include: {
          sale: {
            include: {
              payments: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.cashMovement.findMany({ where: { sessionId: session.id } }),
    ]);
  const returns = await db.saleReturn.findMany({
    where: { cashSessionId: session.id },
  });
  // Las ventas devueltas en esta caja, aunque se vendieran en otra: el cuadre
  // nombra cada devolución con su venta original (R9-A02).
  const returnedSales = returns.length
    ? await db.sale.findMany({
        where: { id: { in: returns.map((r: any) => r.saleId) } },
        select: { id: true, number: true, cashSessionId: true },
      })
    : [];
  const settings = (settingsRow?.data ?? {}) as any;
  const details = (session.closeDetails ?? {}) as any;
  const completed = sales.filter((s: any) => s.status === "completed");
  const voided = sales.filter((s: any) => s.status === "voided");
  // Ventas por forma de pago (lo cobrado al vender, neto del cambio).
  const salesByMethod: Record<string, number> = {};
  for (const method of [
    "cash",
    "card",
    "transfer",
    "credit",
    "cod",
    "credit_note",
  ])
    salesByMethod[method] = sumOf(
      completed.flatMap((s: any) =>
        s.payments.filter(
          (p: any) =>
            p.entryType === "sale" &&
            p.method === method &&
            p.status !== "rejected",
        ),
      ),
    );
  // Lo que quedó a crédito al vender: método crédito, contraentrega marcada
  // «Crédito» en la caja (la caja vende ambas con `cod`) y transferencia
  // rechazada que pasó a deuda. Antes sólo contaba el método `credit`: 0.
  const creditSold = sumOf(
    completed.flatMap((s: any) =>
      s.payments.filter(
        (p: any) =>
          p.entryType === "sale" &&
          (p.method === "credit" ||
            (p.method === "cod" && s.receivableKind === "credit") ||
            (p.method === "transfer" && p.status === "rejected")),
      ),
    ),
  );
  // Abonos de la caja: recibos CxC y cobros de contraentrega van aparte. Un
  // crédito vendido con `cod` y etiqueta «Crédito» es recibo CxC.
  const isCod = (p: any) =>
    p.sale.receivableKind !== "credit" &&
    p.sale.payments.some(
      (x: any) => x.method === "cod" && x.entryType === "sale",
    );
  const byMethod = (rows: any[]) => {
    const ok = rows.filter((p) => p.status === "ok");
    const out = {
      cash: sumOf(ok.filter((p) => p.method === "cash")),
      card: sumOf(ok.filter((p) => p.method === "card")),
      transfer: sumOf(ok.filter((p) => p.method === "transfer")),
      total: sumOf(ok),
      pendingVerification: sumOf(
        rows.filter((p) => p.status === "pending_verification"),
      ),
    };
    return out;
  };
  const receiptRows = installments.filter((p: any) => !isCod(p));
  const codRows = installments.filter(isCod);
  const receipts = byMethod(receiptRows);
  const codCollected = byMethod(codRows);
  const cashIn = sumOf(movements.filter((m: any) => m.type === "in"));
  const cashOut = sumOf(movements.filter((m: any) => m.type === "out"));
  const refunds = sumOf(
    returns
      .filter((r: any) => r.refundMethod === "cash")
      .map((r: any) => ({ amount: r.refundAmount })),
  );
  // Punto 10: todo lo que entra en efectivo menos lo que sale.
  const cashSalesDetail = {
    sales: salesByMethod.cash,
    receipts: receipts.cash,
    cod: codCollected.cash,
    cashIn,
    refunds,
    cashOut,
    total: money(
      d(salesByMethod.cash)
        .plus(receipts.cash)
        .plus(codCollected.cash)
        .plus(cashIn)
        .minus(refunds)
        .minus(cashOut),
    ),
  };
  const closed = !!session.closedAt;
  const counted =
    session.countedCash === null || session.countedCash === undefined
      ? null
      : Number(session.countedCash);
  const vouchers = Number(details.vouchers ?? 0);
  const opening = Number(session.openingAmount);
  const differenceDop =
    counted === null
      ? null
      : cashDifference({
          counted,
          vouchers,
          cashSales: cashSalesDetail.total,
          opening,
        });
  const usdRate = details.usdRate ?? settings.usdRate ?? null;
  const eurRate = details.eurRate ?? settings.eurRate ?? null;
  const foreign = (counted: number, rate: number | null) => ({
    counted,
    expected: 0,
    difference: counted,
    rate,
    dop: rate ? money(d(counted).times(rate)) : null,
  });
  const countedUsd = Number(details.countedUsd ?? 0);
  const countedEur = Number(details.countedEur ?? 0);
  // Rentabilidad: ventas sin ITBIS menos costo, neto de las devoluciones que
  // se registraron EN ESTA caja. Una devolución hecha después desde otra caja
  // ajusta el cuadre de esa otra caja, con referencia a la venta original; el
  // cierre ya aprobado no se reescribe (R9-A02).
  const showProfit = can(actor.permissions, "profit:read");
  const profit = showProfit
    ? money(
        completed
          .reduce(
            (a: any, s: any) =>
              a.plus(s.total).minus(s.taxTotal).minus(s.costTotal),
            d(0),
          )
          .minus(
            returns.reduce(
              (b: any, r: any) =>
                b.plus(r.total).minus(r.taxTotal).minus(r.costTotal),
              d(0),
            ),
          ),
      )
    : null;
  const total = money(
    completed.reduce((a: any, s: any) => a.plus(s.total), d(0)),
  );
  const discounts = money(
    completed.reduce((a: any, s: any) => a.plus(s.discountTotal), d(0)),
  );
  const values: [string, string, number | null][] = [
    ["credit", "Crédito RD$", creditSold],
    ["cash", "Efectivo RD$", counted],
    ["cards", "Tarjetas", salesByMethod.card],
    ["transfers", "Transferencia", salesByMethod.transfer],
    ["vouchers", "Vale de caja", vouchers],
    ["usd", "Dólares US$", countedUsd],
    ["eur", "Euro €", countedEur],
    ["tickets", "Cantidad ticket", completed.length],
    ["voidedTickets", "Ticket nulo", voided.length],
    ["cashSales", "Total en venta efectivo", cashSalesDetail.total],
    ["receipts", "Recibos CxC", receipts.total],
    ["differenceDop", "Diferencias RD$", differenceDop],
    ["differenceUsd", "Diferencias US$", closed ? countedUsd : null],
    ["differenceEur", "Diferencias €", closed ? countedEur : null],
    ["discounts", "Total Desc.", discounts],
    ["total", "Total", total],
    ["profit", "Rentabilidad", profit],
    ["openingAmount", "Fondo Caja inicial", opening],
  ];
  const counts = countDenominations(details.denominations ?? {});
  const split = closed
    ? {
        delivered: details.delivered ?? null,
        left: details.left ?? null,
      }
    : { delivered: null, left: null };
  // Dueña (21-oct): falte o sobre, el descuadre se ve en grande con su
  // justificación y quién lo aprobó.
  const offCash = closed ? Number(session.differenceCash ?? 0) : 0;
  const offCard = closed ? Number(session.differenceCard ?? 0) : 0;
  const offTransfer = closed ? Number(session.differenceTransfer ?? 0) : 0;
  const approverIds = [details.cashApprovedBy, details.cardApprovedBy].filter(
    Boolean,
  );
  const approvers = approverIds.length
    ? await db.user.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = (id: unknown) =>
    approvers.find((u: any) => u.id === id)?.name ?? null;
  const descuadre =
    offCash || offCard || offTransfer
      ? {
          cash: offCash,
          card: offCard,
          transfer: offTransfer,
          reason: details.differenceReason ?? null,
          resolution: details.differenceResolution?.note ?? null,
          notes: session.notes ?? null,
          cashApprovedBy: nameOf(details.cashApprovedBy),
          cardApprovedBy: nameOf(details.cardApprovedBy),
        }
      : null;
  return {
    sessionId: session.id,
    title: "Cuadre de Caja",
    descuadre,
    footer: "FIN DEL CUADRE",
    business: {
      name: settings.name ?? "",
      branchName: settings.branchName ?? "",
      address: settings.address ?? "",
      legalId: settings.legalId ?? "",
      phone: settings.phone ?? "",
      phone2: settings.phone2 ?? "",
      logo: settings.logo ?? null,
    },
    register: {
      id: session.registerId,
      number: terminal?.registerNumber ?? null,
      name: terminal?.registerName || terminal?.name || session.registerId,
    },
    cashier: {
      id: session.userId,
      number: cashier?.cashierNumber ?? null,
      name: cashier?.name ?? "",
    },
    // Quién cerró la caja; «en nombre de» cuando no es su dueña. Las cajas
    // cerradas antes de la decisión 38 no lo guardaron: null.
    closedBy: details.closedBy?.id
      ? {
          id: details.closedBy.id,
          name: details.closedBy.name ?? "",
          onBehalfOf: details.closedBy.id !== session.userId,
        }
      : null,
    nonFiscalNotice: "DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL",
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    denominations: counts.lines.map((l) => ({
      value: l.value,
      qty: l.qty,
      total: l.total,
    })),
    denominationsSubtotal: details.denominations ? counts.total : counted,
    lines: values.map(([key, label, value], n) => ({
      line: n + 1,
      key,
      label,
      value,
    })),
    salesByMethod,
    cashSalesDetail,
    receipts,
    receiptsNote:
      "RD$ " +
      formatAmount(receipts.cash) +
      " de recibos CxC del mismo día ya están incluidos en Ventas Efectivo",
    cod: {
      sold: salesByMethod.cod,
      collected: codCollected,
      // Estadística (dueña, 19-oct): cobrado según la etiqueta de la venta.
      // Los de «Crédito» ya están en Recibos CxC; los de «Contraentrega», en
      // `collected`. Esto sólo lo reparte.
      collectedByKind: {
        credit: sumOf(
          receiptRows.filter(
            (p: any) => p.status === "ok" && p.sale.receivableKind === "credit",
          ),
        ),
        cod: sumOf(
          codRows.filter(
            (p: any) => p.status === "ok" && p.sale.receivableKind === "cod",
          ),
        ),
      },
      rows: codRows.map((p: any) => ({
        kind: p.sale.receivableKind ?? null,
        paymentId: p.id,
        saleId: p.saleId,
        number: p.sale.number,
        customerName: p.sale.customer?.name ?? null,
        soldAt: p.sale.createdAt,
        method: p.method,
        amount: Number(p.amount),
        status: p.status,
        reference: p.reference,
        hasProof: !!p.proofUrl,
        proofContentType: parsePaymentObjectReference(p.proofUrl)?.mime ??
          /^data:([^;,]+);base64,/.exec(p.proofUrl ?? "")?.[1] ?? null,
        proofBytes: parsePaymentObjectReference(p.proofUrl)?.bytes ?? (p.proofUrl
          ? Math.max(
              0,
              Math.floor(((p.proofUrl.split(",", 2)[1] ?? "").length * 3) / 4),
            )
          : 0),
        createdAt: p.createdAt,
      })),
    },
    returns: returns.map((r: any) => {
      const sold = returnedSales.find((x: any) => x.id === r.saleId);
      return {
        id: r.id,
        number: r.number,
        saleId: r.saleId,
        saleNumber: sold?.number ?? null,
        fromOtherSession: !!sold && sold.cashSessionId !== session.id,
        refundMethod: r.refundMethod,
        refundAmount: Number(r.refundAmount),
        total: Number(r.total),
        taxTotal: Number(r.taxTotal),
        // El costo sólo lo ve quien puede ver la rentabilidad.
        ...(showProfit ? { costTotal: Number(r.costTotal) } : {}),
        createdAt: r.createdAt,
      };
    }),
    voided: {
      count: voided.length,
      total: money(voided.reduce((a: any, s: any) => a.plus(s.total), d(0))),
      numbers: voided.map((s: any) => s.number),
    },
    foreign: {
      usd: foreign(countedUsd, usdRate),
      eur: foreign(countedEur, eurRate),
    },
    summary: {
      formula:
        "12-Diferencias = (2-Efectivo introducido + 5-Vale de caja) − 10-Total venta efectivo − 18-Total fondo",
      text:
        differenceDop === null
          ? null
          : `${formatAmount(differenceDop)} = (${formatAmount(counted!)} + ${formatAmount(vouchers)}) − ${formatAmount(cashSalesDetail.total)} − ${formatAmount(opening)}`,
    },
    delivered: split,
    // Bloque A2 (24-oct): esperado, contado y diferencia en renglones propios.
    cashCheck:
      differenceDop === null
        ? null
        : {
            expected: money(d(cashSalesDetail.total).plus(opening)),
            counted: money(d(counted!).plus(vouchers)),
            difference: differenceDop,
          },
    // Efectivo que la dueña recibió en la mano mientras la caja estuvo
    // abierta (A1): informativo, no suma al esperado de la gaveta.
    ownerReceived: (
      await db.payment.findMany({
        where: {
          entryType: "installment",
          method: "cash",
          cashSessionId: null,
          status: "ok",
          reference: "Recibido por la dueña",
          sale: { branchId: session.branchId },
          createdAt: {
            gte: session.openedAt,
            ...(session.closedAt ? { lte: session.closedAt } : {}),
          },
        },
        select: {
          id: true,
          amount: true,
          sale: {
            select: { number: true, customer: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    ).map((p: any) => ({
      paymentId: p.id,
      number: p.sale.number,
      customerName: p.sale.customer?.name ?? null,
      amount: Number(p.amount),
    })),
    notes: session.notes,
  };
}
const UUID_RE = /^[0-9a-f-]{36}$/i;
const AUTO_DRAWER_WINDOW_MS = 2 * 60_000;
// Cajas cerradas que lista GET /cash-sessions (además de todas las abiertas).
const CLOSED_SESSIONS_LIMIT = 100;
@Controller("cash-sessions")
export class CashController {
  constructor(@Inject(Database) private db: Database) {}
  @Post("drawer-open/automatic")
  @Permit("sale:write")
  async automaticDrawerOpen(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const { saleId } = parse(z.object({ saleId: uuid }), body);
    return this.db.$transaction(async (tx) => {
      // Una misma venta sólo puede producir un pulso automático, incluso si
      // la pantalla reintenta o dos llamadas llegan al mismo tiempo.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`drawer-auto:${actor.tenantId}:${saleId}`}))::text AS locked`;
      const exists = await tx.sale.findFirst({
        where: {
          id: saleId,
          status: "completed",
          // CPC-10: sólo la venta recién cobrada y con la caja todavía abierta.
          createdAt: { gte: new Date(Date.now() - AUTO_DRAWER_WINDOW_MS) },
          cashSession: { branchId: actor.branchId, userId: actor.id, closedAt: null },
          payments: {
            some: { method: "cash", amount: { gt: 0 }, status: { not: "rejected" } },
          },
        },
        select: { id: true },
      });
      if (!exists)
        bad("La venta no pertenece a esta caja abierta, no es de los últimos 2 minutos o no recibió efectivo; la gaveta no se abrirá.");
      const previous = await tx.auditLog.findMany({
        where: {
          userId: actor.id,
          action: { in: ["cash_drawer_open_auto", "cash_drawer_open_auto_sent"] },
          entity: "sale",
          entityId: saleId,
        },
        select: { id: true, action: true },
      });
      // «Enviado» sólo existe cuando el equipo confirmó el pulso.
      const sent = previous.find((row: any) => row.action === "cash_drawer_open_auto_sent");
      if (sent) return { auditId: sent.id, open: false };
      const attempts = previous.filter((row: any) => row.action === "cash_drawer_open_auto").length;
      if (attempts >= 2)
        bad("La gaveta ya se intentó abrir dos veces con esta venta; pide a gerencia la apertura manual.");
      const row = await audit(
        tx,
        actor,
        "cash_drawer_open_auto",
        "sale",
        saleId,
        undefined,
        { source: "desktop", automatic: true, attempt: attempts + 1 },
      );
      return { auditId: row.id, open: true };
    });
  }
  @Post("drawer-open/automatic/sent")
  @Permit("sale:write")
  async automaticDrawerSent(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const { auditId } = parse(z.object({ auditId: uuid }), body);
    const row = await this.db.auditLog.findFirst({
      where: { id: auditId, userId: actor.id, action: "cash_drawer_open_auto", entity: "sale" },
      select: { entityId: true },
    });
    if (!row) bad("No hay una apertura automática pendiente con esa referencia.");
    const sent = await audit(
      this.db,
      actor,
      "cash_drawer_open_auto_sent",
      "sale",
      row!.entityId,
      undefined,
      { source: "desktop", auditId },
    );
    return { auditId: sent.id };
  }
  @Post("drawer-open")
  @Permit("cash:drawer")
  async drawerOpen(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const reference = parse(
      z
        .object({
          saleId: uuid.optional(),
          movementId: uuid.optional(),
          reason: z.string().trim().min(5, "Escribe el motivo de la apertura (mínimo 5 caracteres).").max(200),
        })
        .refine((value) => Boolean(value.saleId) !== Boolean(value.movementId), {
          message: "Indica una venta o un movimiento de caja.",
        }),
      body,
    );
    const entity = reference.saleId ? "sale" : "cash_movement";
    const entityId = reference.saleId ?? reference.movementId!;
    const exists = reference.saleId
      ? await this.db.sale.findFirst({
          where: {
            id: reference.saleId,
            status: "completed",
            cashSession: { branchId: actor.branchId },
            payments: {
              some: { method: "cash", amount: { gt: 0 }, status: { not: "rejected" } },
            },
          },
          select: { id: true },
        })
      : await this.db.cashMovement.findFirst({
          where: {
            id: reference.movementId,
            session: { branchId: actor.branchId },
          },
          select: { id: true },
        });
    if (!exists)
      bad("La referencia de caja no existe, no pertenece a esta sucursal o no permite abrir la gaveta.");
    const row = await audit(
      this.db,
      actor,
      "cash_drawer_open",
      entity,
      entityId,
      undefined,
      { source: "desktop", reason: reference.reason },
    );
    return { auditId: row.id };
  }
  @Get()
  @Permit("cash:write")
  async sessions(@CurrentUser() actor: Actor) {
    const showExpected = canViewCashExpected(actor);
    const scope = {
      branchId: actor.branchId,
      ...(can(actor.permissions, "sale:manage") ? {} : { userId: actor.id }),
    };
    // Todas las cajas abiertas (aunque sean antiguas) y las cerradas más
    // recientes; el esperado se calcula para todas con consultas agrupadas.
    const open = await this.db.cashSession.findMany({
      where: { ...scope, closedAt: null },
      orderBy: { openedAt: "desc" },
    });
    const closed = await this.db.cashSession.findMany({
      where: { ...scope, closedAt: { not: null } },
      orderBy: { openedAt: "desc" },
      take: CLOSED_SESSIONS_LIMIT,
    });
    const sessions = [...open, ...closed].sort(
      (a, b) => b.openedAt.getTime() - a.openedAt.getTime(),
    );
    const registerName = await terminalNames(
      this.db,
      sessions.map((s) => s.registerId),
    );
    // Dueño de cada caja: gerencia ve de quién es cada una para cerrarla.
    const owners = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: [...new Set(sessions.map((s) => s.userId))] } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    // La cajera nunca recibe el esperado (cierre ciego): ni se calcula.
    const expectedBySession = showExpected
      ? await cashExpectedMany(this.db, sessions)
      : new Map();
    return Promise.all(
      sessions.map(async (s) => {
        const {
          expectedCash,
          expectedCard,
          expectedTransfer,
          difference,
          differenceCash,
          differenceCard,
          differenceTransfer,
          ...visible
        } = s;
        return {
          ...visible,
          registerName: registerName(s.registerId),
          userName: owners.get(s.userId) ?? null,
          ...(showExpected
            ? {
                expectedCash,
                expectedCard,
                expectedTransfer,
                difference,
                differenceCash,
                differenceCard,
                differenceTransfer,
                expected: expectedBySession.get(s.id),
                differences: s.closedAt
                  ? {
                      cash: Number(s.differenceCash),
                      card: Number(s.differenceCard),
                      transfer: Number(s.differenceTransfer),
                    }
                  : null,
              }
            : {}),
        };
      }),
    );
  }
  @Post("open")
  @RequireTerminal()
  @Permit("cash:write")
  async open(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const {
      openingNote,
      managerPin: _managerPin,
      ...data
    } = parse(
      z.object({
        openingAmount: amount,
        registerId: z.string().min(1).max(80).default("terminal-1"),
        // Solo si el fondo es menor que lo dejado en el último cierre (D-03).
        openingNote: reason.optional(),
        managerPin: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
      }),
      body,
    );
    if (actor.terminalId) data.registerId = actor.terminalId;
    // D-03: el fondo que se declara al abrir no puede ser menor que lo que el
    // último cierre de este equipo dejó en la gaveta sin que quede explicado.
    // Menor exige solo una nota (sin PIN, orden de la dueña 15-oct); la
    // diferencia queda en la bitácora. Igual o mayor abre como siempre.
    let shortfall: {
      suggested: number;
      fromSessionId: string;
      approvedBy: string | null;
    } | null = null;
    const alreadyOpen = await this.db.cashSession.findFirst({
      where: { branchId: actor.branchId, closedAt: null, userId: actor.id },
      select: { id: true },
    });
    const suggestion = alreadyOpen ? null : await this.openingSuggestion(actor);
    if (
      suggestion?.amount != null &&
      d(data.openingAmount).lt(suggestion.amount)
    ) {
      if (!openingNote)
        bad(
          `El fondo es menor que lo dejado en el último cierre (RD$ ${formatAmount(suggestion.amount)}). Agrega una nota que explique la diferencia.`,
        );
      shortfall = {
        suggested: suggestion.amount,
        fromSessionId: suggestion.fromSessionId!,
        approvedBy: null,
      };
    }
    try {
      return await this.db.$transaction(async (tx) => {
        // Una apertura es poco frecuente. Serializar las aperturas de la sucursal
        // evita que el índice único parcial (una caja abierta por usuario)
        // termine mostrando un error Prisma al cajero en un doble clic.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.branchId + ":cash-open"}))::text AS locked`;
        // Repetir "Abrir caja" (doble clic, respuesta perdida o una pantalla
        // desactualizada) no debe crear otra caja ni dejar al usuario bloqueado.
        // Si la persona ya tiene una abierta, devolvemos esa misma sesión; la
        // interfaz indicará si pertenece a otro equipo y permitirá trasladarla.
        const own = await tx.cashSession.findFirst({
          where: {
            branchId: actor.branchId,
            closedAt: null,
            userId: actor.id,
          },
        });
        if (own) return own;
        await enforcePlanQuota(tx as any, "cashBoxes");
        // Decisión 38: otra persona puede tener su caja abierta en este mismo
        // equipo; la caja es de quien la abre, no del equipo.
        const row = await tx.cashSession.create({
          data: { ...data, userId: actor.id, branchId: actor.branchId },
        });
        await audit(tx, actor, "open", "cash", row.id, undefined, row);
        if (shortfall)
          await audit(
            tx,
            actor,
            "opening_difference",
            "cash",
            row.id,
            {
              suggested: shortfall.suggested,
              fromSessionId: shortfall.fromSessionId,
            },
            {
              declared: Number(row.openingAmount),
              difference: money(
                d(row.openingAmount).minus(shortfall.suggested),
              ),
              note: openingNote,
              approvedBy: shortfall.approvedBy,
            },
          );
        return row;
      });
    } catch (error: any) {
      // Durante un despliegue gradual puede responder otra instancia que aún
      // no usa el advisory lock. Recuperar el conflicto de los índices únicos
      // parciales y devolver la sesión del usuario o un mensaje accionable.
      if (error?.code !== "P2002") throw error;
      const own = await this.db.cashSession.findFirst({
        where: {
          branchId: actor.branchId,
          closedAt: null,
          userId: actor.id,
        },
      });
      if (own) return own;
      throw error;
    }
  }
  @Post(":id/movements")
  @RequireTerminal()
  @Permit("cash:write")
  async movement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const { managerPin, operationId, ...data } = parse(
      z.object({
        // D-M4 (auditoría 06): clave que la web genera una vez por formulario.
        // Obligatoria (DIN-02): sin ella un reenvío registra otra salida.
        operationId: uuid,
        type: z.enum(["in", "out"]),
        // 2 decimales y un tope (D-04/D-08): 0.004 o 1e15 son un 400, no un
        // movimiento de 0.00 ni un error 500 de la base.
        amount: moneyAmount(10000000),
        reason,
        managerPin: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
      }),
      body,
    );
    // Salidas (retiros y vales) de quien no gestiona ventas (D-04): si las
    // salidas del día superan cashMovementApprovalLimit (RD$ 1,000 por
    // defecto) hace falta el PIN de un gerente. Se suman todas las salidas de
    // la caja para que partir un retiro en varios vales no evite el control.
    const needsApproval =
      data.type === "out" && !can(actor.permissions, "sale:manage");
    let approvedBy: string | null = null;
    if (needsApproval && managerPin) {
      const managers = await this.db.user.findMany({
        where: { active: true, branchId: actor.branchId },
        include: { role: true },
      });
      approvedBy = await verifyPinAttempt(
        this.db,
        "approval:" + actor.id,
        async () => {
          for (const manager of managers.filter((m) =>
            can(m.role.permissions, "sale:manage"),
          ))
            if (await compare(managerPin, manager.pinHash)) return manager.id;
          return null;
        },
        { pin: managerPin, actor },
      );
    }
    return moneyDb(this.db).$transaction(async (tx) => {
      const session = await cashLock(tx, actor, parse(uuid, id));
      // El bloqueo de la sesión serializa movimientos y ventas concurrentes.
      // D-M4: un reintento con la misma clave devuelve el mismo movimiento
      // (antes que el tope y el saldo, que ya lo incluyen).
      if (operationId) {
        const existing = await tx.cashMovement.findUnique({
          where: tenantUnique("operationId", operationId),
        });
        if (existing) {
          if (
            existing.sessionId !== id ||
            existing.userId !== actor.id ||
            existing.type !== data.type ||
            !d(existing.amount).eq(data.amount) ||
            existing.reason !== data.reason
          )
            bad("La clave de la operación ya corresponde a otro movimiento.");
          return existing;
        }
      }
      if (needsApproval && !approvedBy) {
        const settings = await tx.settings.findUnique({
          where: tenantUnique("id", actor.branchId),
        });
        const limit = Number(
          (settings?.data as any)?.cashMovementApprovalLimit ?? 1000,
        );
        // M-4 (auditoría 01): el tope es por usuaria y día de negocio, no
        // por turno; cerrar y reabrir ya no lo reinicia. Se suman las salidas
        // de este turno (aunque empezara ayer) y las de la usuaria hoy.
        const dayStart = new Date(businessDate() + "T00:00:00-04:00");
        const outs = await tx.cashMovement.aggregate({
          where: {
            type: "out",
            OR: [
              { sessionId: session.id },
              { userId: actor.id, createdAt: { gte: dayStart } },
            ],
          },
          _sum: { amount: true },
        });
        if (
          d(outs._sum.amount ?? 0)
            .plus(data.amount)
            .gt(limit)
        )
          bad(
            `Las salidas de efectivo de este turno superan ${formatMoney(limit)}: se requiere el PIN de un gerente.`,
          );
      }
      // Un retiro nunca puede dejar el efectivo calculado por debajo de cero;
      // el mensaje deliberadamente no expone el saldo ni el monto esperado
      // (arqueo ciego): ninguna cifra, tampoco lo que falta.
      if (data.type === "out") {
        const expected = await cashExpected(tx, session);
        if (d(data.amount).gt(expected.cash))
          bad("No hay suficiente efectivo en caja.");
      }
      const row = await tx.cashMovement.create({
        data: {
          ...data,
          sessionId: id,
          userId: actor.id,
          ...(operationId ? { operationId } : {}),
        },
      });
      await audit(tx, actor, "movement", "cash", id, undefined, {
        ...row,
        ...(approvedBy ? { approvedBy } : {}),
      });
      return row;
    });
  }
  // Traslada la caja abierta del usuario al equipo desde el que se solicita
  // (por ejemplo, si el equipo original se dañó). Un vendedor necesita el PIN
  // de un gerente; el traslado queda en la bitácora con ambos equipos.
  @Post(":id/transfer")
  @RequireTerminal()
  @Permit("cash:write")
  async transfer(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        managerPin: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
      }),
      body,
    );
    const target = actor.terminalId;
    if (!target) bad("Este equipo aún no está registrado. Recarga la página.");
    let approvedBy: string | null = null;
    if (!can(actor.permissions, "sale:manage")) {
      if (!data.managerPin)
        bad("Trasladar la caja requiere el PIN de un gerente.");
      const managers = await this.db.user.findMany({
        where: { active: true, branchId: actor.branchId },
        include: { role: true },
      });
      approvedBy = await verifyPinAttempt(
        this.db,
        "approval:" + actor.id,
        async () => {
          for (const manager of managers.filter((m) =>
            can(m.role.permissions, "sale:manage"),
          ))
            if (await compare(data.managerPin!, manager.pinHash))
              return manager.id;
          return null;
        },
        { pin: data.managerPin, actor },
      );
    }
    return this.db.$transaction(async (tx) => {
      const sessionId = parse(uuid, id);
      await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id = ${sessionId}::uuid FOR UPDATE`;
      const session = await tx.cashSession.findFirstOrThrow({
        where: { id: sessionId, branchId: actor.branchId, closedAt: null },
      });
      if (session.userId !== actor.id) denied();
      if (session.registerId === target) return session;
      const from = await terminalName(tx, session.registerId);
      const to = await terminalName(tx, target!);
      const row = await tx.cashSession.update({
        where: { id: sessionId },
        data: { registerId: target },
      });
      await audit(
        tx,
        actor,
        "cash_transferred",
        "cash",
        sessionId,
        { registerId: session.registerId, terminal: from },
        { registerId: target, terminal: to, approvedBy },
      );
      return { ...row, registerName: to };
    });
  }
  @Post(":id/close")
  @RequireTerminal()
  @Permit("cash:write")
  async close(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const input = parse(cashCloseSchema, body);
    // Conteo por denominaciones: el subtotal es el efectivo contado.
    const counted = input.denominations
      ? countDenominations(input.denominations).total
      : input.countedCash!;
    if (
      input.denominations &&
      input.countedCash !== undefined &&
      !d(input.countedCash).eq(counted)
    )
      bad("El efectivo contado no coincide con el conteo por denominaciones.");
    let split: ReturnType<typeof deliveredSplit>;
    try {
      split = deliveredSplit(counted, input.delivered);
    } catch (e: any) {
      bad(e.message);
    }
    // A-1 (auditoría 01): un «Vale de caja» compensa efectivo que no está en
    // la gaveta. Sin control, una cajera se llevaba el turno entero y cerraba
    // en 0. Todo vale exige una nota; el de quien no gestiona ventas, además,
    // el PIN de un gerente (como las salidas sobre el tope, D-04). Queda en la
    // bitácora y como alerta alta que sólo una persona resuelve.
    let voucherApprovedBy: string | null = null;
    if (d(input.vouchers).gt(0)) {
      if (!input.notes.trim())
        bad(
          "Explica en las notas del cierre qué comprobantes forman el vale de caja.",
        );
      if (!can(actor.permissions, "sale:manage")) {
        if (!input.managerPin)
          bad(
            "Cerrar con un vale de caja requiere el PIN de un gerente. Si fue una salida de efectivo, regístrala en «Salida» antes de cerrar.",
          );
        voucherApprovedBy = await managerPinApproval(
          this.db,
          actor,
          input.managerPin!,
        );
      }
    }
    const closed = await moneyDb(this.db).$transaction(async (tx) => {
      const session = await cashLock(
        tx,
        actor,
        parse(uuid, id),
        true,
        undefined,
        { closing: true },
      );
      const expected = await cashExpected(tx, session);
      const settings = (
        await tx.settings.findUnique({ where: tenantUnique("id", actor.branchId) })
      )?.data as any;
      const data = {
        countedCash: counted,
        countedCard: input.countedCard,
        // Las transferencias las suma el sistema, no la cajera (dueña, 14-oct).
        countedTransfer: expected.transfer,
        notes: input.notes,
        closeDetails: {
          denominations: input.denominations ?? null,
          denominationsTotal: input.denominations ? counted : null,
          vouchers: input.vouchers,
          countedUsd: input.countedUsd,
          countedEur: input.countedEur,
          delivered: split!.delivered,
          left: split!.left,
          usdRate: settings?.usdRate ?? null,
          eurRate: settings?.eurRate ?? null,
          // Decisión 38: quién cerró la caja (puede no ser su dueño).
          closedBy: { id: actor.id, name: actor.name },
        },
      };
      const differences = closeDifferences(data, expected);
      const differenceLimit = Number(settings?.cashDifferenceLimit ?? 100);
      // Tarjeta = lo que imprimió el verifón. Si la cajera declara un total
      // distinto del sistema, no cierra sola: necesita el PIN de un gerente
      // (dueña, 14-oct). Así nadie «cuadra» ventas antes del cierre.
      // Igual con el efectivo (dueña, 17-oct): si no cuadra, la cajera no
      // cierra hasta que un gerente autorice con su PIN. El mensaje no dice
      // cuánto falta ni sobra (el cierre sigue siendo ciego).
      const cardOff = Number(differences.card) !== 0;
      const cashOff = Number(differences.cash) !== 0;
      if ((cardOff || cashOff) && !can(actor.permissions, "sale:manage")) {
        if (!input.managerPin)
          bad(
            cardOff
              ? "El total de tarjeta no coincide con el sistema. Revisa el voucher del verifón; para cerrar con esta diferencia se necesita el PIN de un gerente."
              : "La caja no cuadra con el sistema. Vuelve a contar; para cerrar con esta diferencia se necesita el PIN de un gerente.",
          );
        const approver = await managerPinApproval(
          this.db,
          actor,
          input.managerPin!,
        );
        if (cardOff) (data.closeDetails as any).cardApprovedBy = approver;
        if (cashOff) (data.closeDetails as any).cashApprovedBy = approver;
      } else if (cardOff || cashOff) {
        // Un gerente que cierra con descuadre queda como quien lo aprobó.
        if (cardOff) (data.closeDetails as any).cardApprovedBy = actor.id;
        if (cashOff) (data.closeDetails as any).cashApprovedBy = actor.id;
      }
      // Dueña (21-oct): falte o sobre, nadie cierra un descuadre sin decir
      // qué pasó, tampoco un gerente. El mensaje sigue sin decir el monto.
      if (
        (cardOff || cashOff) &&
        input.differenceReason.replace(/\s/g, "").length < 10
      )
        bad(
          "La caja no cuadra. Escribe la justificación del descuadre: qué pasó y quién lo sabe.",
        );
      if (cardOff || cashOff)
        (data.closeDetails as any).differenceReason = input.differenceReason;
      if (
        cashCloseRequiresNote(actor, differences, differenceLimit) &&
        !input.notes.trim()
      )
        bad(
          "Para cerrar con estos conteos, agrega una nota que explique la situación.",
        );
      const row = await tx.cashSession.update({
        where: { id },
        data: {
          ...data,
          expectedCash: expected.cash,
          expectedCard: expected.card,
          expectedTransfer: expected.transfer,
          difference: money(
            d(differences.cash)
              .plus(differences.card)
              .plus(differences.transfer),
          ),
          differenceCash: differences.cash,
          differenceCard: differences.card,
          differenceTransfer: differences.transfer,
          closedAt: new Date(),
        },
      });
      await audit(tx, actor, "close", "cash", id, session, row);
      // Cierre de emergencia: la administración cierra la caja de otra
      // persona. Queda «cerrada por X en nombre de Y» con el equipo.
      if (session.userId !== actor.id) {
        const owner = await tx.user.findUnique({
          where: { id: session.userId },
          select: { name: true },
        });
        await audit(tx, actor, "close_on_behalf", "cash", id, undefined, {
          ownerId: session.userId,
          ownerName: owner?.name ?? null,
          closedById: actor.id,
          closedByName: actor.name,
          registerId: session.registerId,
          terminal: await terminalName(tx, session.registerId),
          notes: input.notes,
        });
      }
      // D-10: Prisma.Decimal(0) es un objeto (verdadero); se compara el número.
      if (
        Number(row.differenceCash) ||
        Number(row.differenceCard) ||
        Number(row.differenceTransfer)
      )
        await audit(tx, actor, "close_difference", "cash", id, session, row);
      if (d(input.vouchers).gt(0)) {
        const approver = voucherApprovedBy
          ? await tx.user.findUnique({
              where: { id: voucherApprovedBy },
              select: { name: true },
            })
          : null;
        await audit(tx, actor, "close_vouchers", "cash", id, undefined, {
          vouchers: input.vouchers,
          notes: input.notes,
          approvedBy: voucherApprovedBy,
        });
        const message =
          `Caja cerrada con vale de caja por RD$ ${formatAmount(input.vouchers)} · ` +
          `${actor.name}` +
          (approver ? ` · aprobó ${approver.name}` : "") +
          ` · ${input.notes.trim().slice(0, 200)}`;
        await tx.alert.upsert({
          where: tenantUnique("key", "voucher:" + id),
          create: {
            key: "voucher:" + id,
            type: "cash_voucher",
            severity: "high",
            entityId: id,
            branchId: actor.branchId,
            message,
          },
          update: { status: "new", message },
        });
      }
      if (
        Math.max(
          Math.abs(Number(row.differenceCash)),
          Math.abs(Number(row.differenceCard)),
          Math.abs(Number(row.differenceTransfer)),
        ) > differenceLimit
      )
        await tx.alert.upsert({
          where: tenantUnique("key", "cash:" + id),
          create: {
            key: "cash:" + id,
            type: "cash_difference",
            severity: "high",
            entityId: id,
            branchId: actor.branchId,
            message: cashDifferenceMessage(row),
          },
          update: {
            status: "new",
            message: cashDifferenceMessage(row),
          },
        });
      const showExpected = canViewCashExpected(actor);
      return showExpected
        ? { ...row, differences }
        : { id: row.id, closedAt: row.closedAt };
      // D-M2 (auditoría 06): el cierre recalcula todo el turno; mismo plazo
      // que la venta en vez de los 5 s por defecto.
    }, MONEY_TRANSACTION);
    notify(this.db, "cash_close", closed.id);
    return closed;
  }
  // Fondo sugerido para abrir (decisión 40): lo dejado en el último cierre de
  // la propia persona, en cualquier equipo; si nunca cerró una caja, en el
  // último cierre de este equipo (D-03); si tampoco hay, 0.
  @Get("opening-suggestion")
  @Permit("cash:write")
  async openingSuggestion(@CurrentUser() actor: Actor) {
    const lastWhere = { branchId: actor.branchId, closedAt: { not: null } };
    const own = await this.db.cashSession.findFirst({
      where: { ...lastWhere, userId: actor.id },
      orderBy: { closedAt: "desc" },
    });
    const last =
      own ??
      (actor.terminalId
        ? await this.db.cashSession.findFirst({
            where: { ...lastWhere, registerId: actor.terminalId },
            orderBy: { closedAt: "desc" },
          })
        : null);
    // A-2 (auditoría 01): si el cierre no informó «Entregado», nada salió de
    // la gaveta: lo contado es lo dejado (es lo que la pantalla de cierre
    // anuncia como fondo sugerido). Sirve también para cierres ya guardados.
    const left =
      (last?.closeDetails as any)?.left ?? last?.countedCash ?? undefined;
    return left === undefined || left === null
      ? { amount: 0, fromSessionId: null }
      : { amount: Number(left), fromSessionId: last!.id };
  }
  // La cajera ve su propia caja; quien tiene sale:manage, cualquiera.
  private async ownSession(actor: Actor, id: string) {
    const session = await this.db.cashSession.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    if (session.userId !== actor.id && !can(actor.permissions, "sale:manage"))
      denied();
    return session;
  }
  // Dueña (21-oct): cómo se resolvió un descuadre. Queda en el cierre, en la
  // bitácora y cierra la alerta; el reporte «Descuadres» lo muestra.
  @Post(":id/descuadre")
  @Permit("*")
  async resolveDifference(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const { resolution } = parse(
      z.object({ resolution: z.string().trim().min(5).max(500) }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const session = await tx.cashSession.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      if (!session.closedAt) bad("La caja sigue abierta.");
      const details = (session.closeDetails ?? {}) as Record<string, unknown>;
      const differenceResolution = {
        note: resolution,
        byId: actor.id,
        byName: actor.name,
        at: new Date().toISOString(),
      };
      const row = await tx.cashSession.update({
        where: { id: session.id },
        data: { closeDetails: { ...details, differenceResolution } as any },
      });
      await tx.alert.updateMany({
        where: { key: "cash:" + session.id, branchId: actor.branchId },
        data: { status: "resolved" },
      });
      await audit(
        tx,
        actor,
        "difference_resolved",
        "cash",
        session.id,
        undefined,
        differenceResolution,
      );
      return row;
    });
  }
  @Get(":id/cuadre")
  @Permit("cash:write")
  async cuadre(@Param("id") id: string, @CurrentUser() actor: Actor) {
    const session = await this.ownSession(actor, id);
    if (!session.closedAt && !canViewCashExpected(actor))
      bad("Cierra la caja para consultar el cuadre.");
    const report = await buildCuadre(this.db, actor, session);
    const showExpected = canViewCashExpected(actor);
    if (showExpected) return report;
    const publicForeign = (currency: any) => {
      const { expected, difference, ...visible } = currency;
      void expected;
      void difference;
      return visible;
    };
    // Dueña (21-oct): ya cerrada, la cajera también imprime el aviso de
    // descuadre (la dueña lo revisa en la foto del cuadre). Antes de cerrar
    // sigue siendo ciego: sin cierre no hay cuadre para ella.
    return {
      ...report,
      lines: report.lines.filter(
        (line: any) => !String(line.key).startsWith("difference"),
      ),
      foreign: {
        usd: publicForeign(report.foreign.usd),
        eur: publicForeign(report.foreign.eur),
      },
      summary: { formula: null, text: null },
    };
  }
  // Reportes del día de una caja, para imprimir al cerrar.
  @Get(":id/reports/:name")
  @Permit("cash:write")
  async sessionReport(
    @Param("id") id: string,
    @Param("name") name: string,
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    if (!STORE_REPORTS.includes(name)) bad("Reporte no disponible.");
    const session = await this.ownSession(actor, id);
    if (!session.closedAt && !canViewCashExpected(actor))
      bad("Cierra la caja para consultar sus reportes.");
    const report = await storeReport(this.db, actor, name, {
      cashSessionId: session.id,
    });
    return sendStoreReport(res, report, query.format);
  }
}

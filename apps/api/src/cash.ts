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
  conflict,
  denied,
  canViewCashExpected,
} from "./common";
import { cashLock, terminalName } from "./sales";
import { STORE_REPORTS, storeReport, sendStoreReport } from "./reports";
import { verifyPinAttempt } from "./security";

export async function cashExpected(db: any, session: any) {
  const payments = await db.payment.findMany({
    where: {
      cashSessionId: session.id,
      sale: { status: "completed" },
      OR: [{ entryType: { not: "installment" } }, { status: "ok" }],
    },
  });
  const movements = await db.cashMovement.findMany({
    where: { sessionId: session.id },
  });
  const returns = await db.saleReturn.findMany({
    where: { cashSessionId: session.id },
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
        include: { sale: { include: { payments: true } } },
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
          (p: any) => p.entryType === "sale" && p.method === method,
        ),
      ),
    );
  // Abonos de la caja: recibos CxC y cobros de contraentrega van aparte.
  const isCod = (p: any) =>
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
    ["credit", "Crédito RD$", salesByMethod.credit],
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
  return {
    sessionId: session.id,
    title: "Cuadre de Caja",
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
      rows: codRows.map((p: any) => ({
        paymentId: p.id,
        saleId: p.saleId,
        number: p.sale.number,
        method: p.method,
        amount: Number(p.amount),
        status: p.status,
        reference: p.reference,
        hasProof: !!p.proofUrl,
        proofContentType:
          /^data:([^;,]+);base64,/.exec(p.proofUrl ?? "")?.[1] ?? null,
        proofBytes: p.proofUrl
          ? Math.max(
              0,
              Math.floor(((p.proofUrl.split(",", 2)[1] ?? "").length * 3) / 4),
            )
          : 0,
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
    notes: session.notes,
  };
}
const UUID_RE = /^[0-9a-f-]{36}$/i;
@Controller("cash-sessions")
export class CashController {
  constructor(@Inject(Database) private db: Database) {}
  @Get()
  @Permit("cash:write")
  async sessions(@CurrentUser() actor: Actor) {
    const showExpected = canViewCashExpected(actor);
    const sessions = await this.db.cashSession.findMany({
      where: {
        branchId: actor.branchId,
        ...(can(actor.permissions, "sale:manage") ? {} : { userId: actor.id }),
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
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
          registerName: await terminalName(this.db, s.registerId),
          ...(showExpected
            ? {
                expectedCash,
                expectedCard,
                expectedTransfer,
                difference,
                differenceCash,
                differenceCard,
                differenceTransfer,
                expected: await cashExpected(this.db, s),
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
    const { openingNote, managerPin, ...data } = parse(
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
    // Menor exige nota y, a quien no gestiona ventas, el PIN de un gerente; la
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
      let approvedBy: string | null = null;
      if (!can(actor.permissions, "sale:manage")) {
        if (!managerPin)
          bad(
            "Abrir con un fondo menor que lo dejado en el último cierre requiere el PIN de un gerente.",
          );
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
              if (await compare(managerPin!, manager.pinHash))
                return manager.id;
            return null;
          },
        );
      }
      shortfall = {
        suggested: suggestion.amount,
        fromSessionId: suggestion.fromSessionId!,
        approvedBy,
      };
    }
    try {
      return await this.db.$transaction(async (tx) => {
        // Una apertura es poco frecuente. Serializar las aperturas de la sucursal
        // evita que dos usuarios distintos compitan por el mismo terminal y que
        // el índice único parcial termine mostrando un error Prisma al cajero.
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
        const busy = await tx.cashSession.findFirst({
          where: {
            branchId: actor.branchId,
            closedAt: null,
            registerId: data.registerId,
          },
        });
        if (busy) conflict("Este equipo ya tiene otra caja abierta.");
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
      const busy = await this.db.cashSession.findFirst({
        where: {
          branchId: actor.branchId,
          closedAt: null,
          registerId: data.registerId,
        },
      });
      if (busy) conflict("Este equipo ya tiene otra caja abierta.");
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
    const data = parse(
      z.object({
        type: z.enum(["in", "out"]),
        amount: z.number().positive(),
        reason,
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const session = await cashLock(tx, actor, parse(uuid, id));
      // El bloqueo de la sesión serializa movimientos y ventas concurrentes.
      // Un retiro nunca puede dejar el efectivo calculado por debajo de cero;
      // el mensaje deliberadamente no expone el saldo ni el monto esperado.
      if (data.type === "out") {
        const expected = await cashExpected(tx, session);
        if (d(data.amount).gt(expected.cash))
          bad("No hay suficiente efectivo en caja.");
      }
      const row = await tx.cashMovement.create({
        data: { ...data, sessionId: id, userId: actor.id },
      });
      await audit(tx, actor, "movement", "cash", id, undefined, row);
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
      const busy = await tx.cashSession.findFirst({
        where: {
          branchId: actor.branchId,
          closedAt: null,
          registerId: target,
          id: { not: sessionId },
        },
      });
      if (busy) bad("Este equipo ya tiene otra caja abierta.");
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
    return this.db.$transaction(async (tx) => {
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
        await tx.settings.findUnique({ where: { id: actor.branchId } })
      )?.data as any;
      const data = {
        countedCash: counted,
        countedCard: input.countedCard,
        countedTransfer: input.countedTransfer,
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
        },
      };
      const differences = closeDifferences(data, expected);
      const differenceLimit = Number(settings?.cashDifferenceLimit ?? 100);
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
      if (row.differenceCash || row.differenceCard || row.differenceTransfer)
        await audit(tx, actor, "close_difference", "cash", id, session, row);
      if (
        Math.max(
          Math.abs(Number(row.differenceCash)),
          Math.abs(Number(row.differenceCard)),
          Math.abs(Number(row.differenceTransfer)),
        ) > differenceLimit
      )
        await tx.alert.upsert({
          where: { key: "cash:" + id },
          create: {
            key: "cash:" + id,
            type: "cash_difference",
            severity: "high",
            entityId: id,
            branchId: actor.branchId,
            message: `Diferencias de caja: efectivo RD$ ${row.differenceCash}, tarjeta RD$ ${row.differenceCard}, transferencia RD$ ${row.differenceTransfer}`,
          },
          update: {
            status: "new",
            message: `Diferencias de caja: efectivo RD$ ${row.differenceCash}, tarjeta RD$ ${row.differenceCard}, transferencia RD$ ${row.differenceTransfer}`,
          },
        });
      const showExpected = canViewCashExpected(actor);
      return showExpected
        ? { ...row, differences }
        : { id: row.id, closedAt: row.closedAt };
    });
  }
  // Fondo sugerido para abrir: lo dejado en el último cierre de este equipo
  // (o de este usuario si el equipo no tiene cierres).
  @Get("opening-suggestion")
  @Permit("cash:write")
  async openingSuggestion(@CurrentUser() actor: Actor) {
    const last = await this.db.cashSession.findFirst({
      where: {
        branchId: actor.branchId,
        closedAt: { not: null },
        ...(actor.terminalId
          ? { registerId: actor.terminalId }
          : { userId: actor.id }),
      },
      orderBy: { closedAt: "desc" },
    });
    const left = (last?.closeDetails as any)?.left;
    return left === undefined || left === null
      ? { amount: null, fromSessionId: null }
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

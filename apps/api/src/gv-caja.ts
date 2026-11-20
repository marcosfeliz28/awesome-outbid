// Caja propia de GV (opción B, orden 106): apertura, cierre con arqueo ciego y
// diferencias, separada de la caja de MacGen (CashSession no se toca).
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { businessDate, can, d, z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  parse,
  uuid,
} from "./common";
import {
  GV_PROOF_DATA_MAX,
  PROOF_INFO,
  gvCajaEsperado,
  gvProofFields,
  gvMoney,
  gvProofParse,
} from "./gv-money";

const fix = (v: unknown) => d(v as any).toFixed(2);

/** Resuelve los avisos de la caja `sessionId` y de los días con pagos en ella. */
export async function resolveGvCashAlerts(
  tx: any,
  branchId: string,
  sessionId: string,
) {
  const pays = await tx.gvPayment.findMany({
    where: { cashSessionId: sessionId },
    select: { createdAt: true },
  });
  const days = [
    ...new Set<string>(pays.map((p: any) => businessDate(p.createdAt))),
  ];
  await tx.alert.updateMany({
    where: {
      branchId,
      status: { not: "resolved" },
      OR: [
        { type: "gv_cash_open_night", entityId: sessionId },
        { type: "gv_day_no_close", entityId: { in: days } },
      ],
    },
    data: { status: "resolved" },
  });
}

/**
 * D16 (auditoría 19-nov): anular o rechazar un pago de una caja de GV ya
 * cerrada recalcula lo esperado y la diferencia de ese cierre (lo contado no
 * cambia), para que el cierre guardado y los informes digan lo mismo. Llamar
 * con el candado `branch:gv-cash` tomado.
 */
export async function refreshClosedGvCash(
  tx: any,
  actor: Actor,
  sessionId: string | null | undefined,
  ref: string,
) {
  if (!sessionId) return null;
  const s = await tx.gvCashSession.findUnique({ where: { id: sessionId } });
  if (!s?.closedAt) return null;
  // Decisión 2: un cierre de antes (sin US$ aparte) se recalcula como se
  // cerró, con los dólares en pesos dentro del efectivo.
  const details = (s.closeDetails ?? null) as Record<string, any> | null;
  const separate = details?.usdSeparate === true;
  const e = await gvCajaEsperado(tx, s.id, !separate);
  const expectedCash = d(s.openingAmount).plus(e.efectivo);
  const difference = d(s.countedCash ?? 0)
    .minus(expectedCash)
    .plus(d(s.countedCard ?? 0).minus(e.tarjeta))
    .plus(d(s.countedTransfer ?? 0).minus(e.transferencia));
  const row = await tx.gvCashSession.update({
    where: { id: s.id },
    data: {
      expectedCash: fix(expectedCash),
      expectedCard: fix(e.tarjeta),
      expectedTransfer: fix(e.transferencia),
      difference: fix(difference),
      ...(separate
        ? {
            closeDetails: {
              ...details,
              expectedUsd: fix(e.usd),
              differenceUsd: fix(d(details!.countedUsd ?? 0).minus(e.usd)),
            },
          }
        : {}),
    },
  });
  await audit(tx, actor, "gv_cash_refreshed", "gv_cash", s.id, s, {
    ...row,
    ref,
  });
  return row;
}

@Controller("gv/cash")
export class GvCajaController {
  constructor(@Inject(Database) private readonly db: Database) {}

  // Arqueo ciego: quien no verifica no ve cuánto debería haber hasta cerrar.
  @Get("current")
  @Permit("gv:read")
  async current(@CurrentUser() actor: Actor) {
    const s = await this.db.gvCashSession.findFirst({
      where: { branchId: actor.branchId, closedAt: null },
    });
    // Un cuerpo vacío rompe el JSON del navegador: sin caja, `open: false`.
    if (!s) return { open: false as const };
    const e = await gvCajaEsperado(this.db, s.id);
    return {
      ...s,
      open: true as const,
      payments: e.count,
      cardPayments: e.cards,
      overdue: businessDate(s.openedAt) < businessDate(new Date()),
      usdPayments: e.usdCount,
      // Decisión 3: caja ciega salvo gerencia de GV o si la dueña la apagó.
      ...(can(actor.permissions, "gv:verify") || actor.cashBlind === false
        ? {
            expected: {
              efectivo: fix(d(s.openingAmount).plus(e.efectivo)),
              tarjeta: fix(e.tarjeta),
              transferencia: fix(e.transferencia),
              // Decisión 2: dólares aparte, en US$ (no se suman a los pesos).
              usd: fix(e.usd),
            },
          }
        : {}),
    };
  }

  @Get()
  @Permit("gv:reports")
  async list(@CurrentUser() actor: Actor) {
    const rows = await this.db.gvCashSession.findMany({
      where: { branchId: actor.branchId },
      include: { proof: PROOF_INFO },
      orderBy: { openedAt: "desc" },
      take: 60,
    });
    return rows.map(gvProofFields);
  }

  // Foto del cierre de lote: solo quien revisa los informes de GV.
  @Get(":id/proof")
  @Permit("gv:reports")
  async proof(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const p = await this.db.gvProof.findFirst({
      where: {
        cashSession: { id: parse(uuid, id), branchId: actor.branchId },
      },
    });
    if (!p) bad("Este cierre no tiene foto de lote.");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.type(p.contentType).send(Buffer.from(p.data));
  }

  @Post("open")
  @Permit("gv:write")
  async open(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { openingAmount } = parse(
      z.object({ openingAmount: gvMoney(true) }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.branchId + ":gv-cash"}))::text AS locked`;
      const own = await tx.gvCashSession.findFirst({
        where: { branchId: actor.branchId, closedAt: null },
      });
      if (own) {
        if (businessDate(own.openedAt) < businessDate(new Date()))
          bad(
            "La caja de GV del día anterior sigue abierta: ciérrala primero.",
          );
        return own; // repetir «abrir»: la misma caja.
      }
      const row = await tx.gvCashSession.create({
        data: { branchId: actor.branchId, userId: actor.id, openingAmount },
      });
      await audit(tx, actor, "gv_cash_open", "gv_cash", row.id, undefined, row);
      return row;
    });
  }

  @Post("close")
  @Permit("gv:write")
  async close(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        countedCash: gvMoney(true),
        countedCard: gvMoney(true),
        countedTransfer: gvMoney(true),
        // Decisión 2 (20-nov): billetes en US$ contados aparte, en dólares.
        // Una pantalla anterior que no lo manda cierra como antes (US$ dentro
        // del efectivo en pesos) y queda marcado en el cierre.
        countedUsd: gvMoney(true).optional(),
        notes: z.string().trim().max(500).default(""),
        // Foto del cierre de lote del terminal (data URL): obligatoria si hubo tarjeta.
        batchProof: z.string().max(GV_PROOF_DATA_MAX).optional(),
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.branchId + ":gv-cash"}))::text AS locked`;
      const s = await tx.gvCashSession.findFirst({
        where: { branchId: actor.branchId, closedAt: null },
      });
      if (!s) bad("No hay una caja de GV abierta.");
      const separate = data.countedUsd !== undefined;
      const e = await gvCajaEsperado(tx, s.id, !separate);
      if (e.cards > 0 && !data.batchProof)
        bad(
          "Adjunta la foto del cierre de lote del terminal (hubo pagos con tarjeta).",
        );
      const batch = data.batchProof
        ? gvProofParse(data.batchProof, "foto del cierre de lote")
        : null;
      const expectedCash = d(s.openingAmount).plus(e.efectivo);
      const diffs = {
        cash: d(data.countedCash).minus(expectedCash),
        card: d(data.countedCard).minus(e.tarjeta),
        transfer: d(data.countedTransfer).minus(e.transferencia),
        usd: separate ? d(data.countedUsd!).minus(e.usd) : d(0),
      };
      // La diferencia total es en pesos; la de US$ va aparte, sin sumarla.
      const difference = diffs.cash.plus(diffs.card).plus(diffs.transfer);
      const usdOff = !diffs.usd.isZero();
      // D16 (auditoría 19-nov): un cierre con diferencia lleva justificación,
      // como en la caja de MacGen. Sin montos en el mensaje (arqueo ciego).
      if (
        (!diffs.cash.isZero() ||
          !diffs.card.isZero() ||
          !diffs.transfer.isZero() ||
          usdOff) &&
        data.notes.length < 3
      )
        bad(
          "El conteo no cuadra con lo registrado. Vuelve a contar o escribe la justificación en notas para cerrar.",
        );
      const row = await tx.gvCashSession.update({
        where: { id: s.id },
        data: {
          closedAt: new Date(),
          closedBy: actor.id,
          expectedCash: fix(expectedCash),
          countedCash: data.countedCash,
          expectedCard: fix(e.tarjeta),
          countedCard: data.countedCard,
          expectedTransfer: fix(e.transferencia),
          countedTransfer: data.countedTransfer,
          difference: fix(difference),
          notes: data.notes,
          closeDetails: separate
            ? {
                usdSeparate: true,
                expectedUsd: fix(e.usd),
                countedUsd: fix(data.countedUsd),
                differenceUsd: fix(diffs.usd),
              }
            : { usdSeparate: false },
        },
      });
      if (batch)
        await tx.gvProof.create({
          data: {
            cashSessionId: s.id,
            contentType: batch.contentType,
            size: batch.size,
            data: batch.bytes,
            createdBy: actor.id,
          },
        });
      // Cerrar la caja resuelve sus avisos (10 PM abierta / día sin cierre).
      await resolveGvCashAlerts(tx, actor.branchId, s.id);
      await audit(tx, actor, "gv_cash_close", "gv_cash", row.id, s, {
        ...row,
        ...(batch
          ? { batchProof: `(${batch.contentType}, ${batch.size} bytes)` }
          : {}),
      });
      const differences = {
        cash: fix(diffs.cash),
        card: fix(diffs.card),
        transfer: fix(diffs.transfer),
        total: fix(difference),
        ...(separate ? { usd: fix(diffs.usd) } : {}),
      };
      // Descuadre: asiento propio para que la dueña lo vea.
      if (
        !diffs.cash.isZero() ||
        !diffs.card.isZero() ||
        !diffs.transfer.isZero() ||
        usdOff
      )
        await audit(
          tx,
          actor,
          "gv_cash_difference",
          "gv_cash",
          row.id,
          undefined,
          differences,
        );
      const receipts = await tx.gvPayment.findMany({
        where: { cashSessionId: s.id, rejectedAt: null },
        select: {
          receiptNumber: true,
          method: true,
          amountDop: true,
          amount: true,
          currency: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return { session: row, differences, receipts };
    });
  }
}

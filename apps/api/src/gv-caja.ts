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
    if (!s) return null;
    const e = await gvCajaEsperado(this.db, s.id);
    return {
      ...s,
      payments: e.count,
      cardPayments: e.cards,
      overdue: businessDate(s.openedAt) < businessDate(new Date()),
      ...(can(actor.permissions, "gv:verify")
        ? {
            expected: {
              efectivo: fix(d(s.openingAmount).plus(e.efectivo)),
              tarjeta: fix(e.tarjeta),
              transferencia: fix(e.transferencia),
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
      const e = await gvCajaEsperado(tx, s.id);
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
      };
      const difference = diffs.cash.plus(diffs.card).plus(diffs.transfer);
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
      };
      // Descuadre: asiento propio para que la dueña lo vea.
      if (
        !diffs.cash.isZero() ||
        !diffs.card.isZero() ||
        !diffs.transfer.isZero()
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
        },
        orderBy: { createdAt: "asc" },
      });
      return { session: row, differences, receipts };
    });
  }
}

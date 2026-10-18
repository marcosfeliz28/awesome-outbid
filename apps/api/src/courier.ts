import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  audit,
  bad,
  conflict,
  parse,
  uuid,
} from "./common";

const feeInput = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine(
    (value) =>
      /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(value) && Number(value) <= 5000,
    "El envío debe estar entre RD$ 0 y RD$ 5,000, con hasta dos decimales.",
  );
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const rangeInput = z.object({ from: dateInput, to: dateInput });

function dates(query: Record<string, string>) {
  const { from, to } = parse(rangeInput, query);
  if (from && to && from > to)
    bad("La fecha inicial no puede ser posterior a la final.");
  for (const value of [from, to])
    if (
      value &&
      new Date(value + "T00:00:00-04:00").toLocaleDateString("en-CA", {
        timeZone: "America/Santo_Domingo",
      }) !== value
    )
      bad("Fecha inválida.");
  return {
    ...(from ? { gte: new Date(from + "T00:00:00-04:00") } : {}),
    ...(to ? { lte: new Date(to + "T23:59:59.999-04:00") } : {}),
  };
}

@Controller()
export class CourierController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Patch("sales/:id/courier")
  @Permit("sale:manage")
  @RequireTerminal()
  async setFee(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        fee: feeInput,
        courierName: z.string().trim().min(1).max(100).optional(),
      }),
      body,
    );
    const saleId = parse(uuid, id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirst({
        where: { id: saleId, branchId: actor.branchId },
      });
      if (!sale) bad("Venta no encontrada.");
      if (sale.status !== "completed")
        bad("No se puede poner envío a una venta anulada.");
      if (sale.courierPaidAt)
        conflict("El envío ya está pagado y no puede modificarse.");
      const before = {
        courierFee: String(sale.courierFee),
        courierName: sale.courierName,
      };
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          courierFee: data.fee,
          courierName: data.courierName ?? sale.courierName ?? "Addison",
        },
      });
      await audit(tx, actor, "courier_fee_changed", "sale", saleId, before, {
        courierFee: String(updated.courierFee),
        courierName: updated.courierName,
      });
      return {
        id: saleId,
        courierFee: String(updated.courierFee),
        courierName: updated.courierName,
        courierPaidAt: updated.courierPaidAt,
      };
    });
  }

  @Get("courier/pending")
  @Permit("sale:manage")
  async pending(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
  ) {
    const createdAt = dates(query);
    const rows = await this.db.sale.findMany({
      where: {
        branchId: actor.branchId,
        status: "completed",
        courierFee: { gt: 0 },
        courierPaidAt: null,
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      },
      select: {
        id: true,
        number: true,
        createdAt: true,
        courierName: true,
        courierFee: true,
        customer: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const total = rows.reduce(
      (sum, row) => sum.plus(row.courierFee),
      new Prisma.Decimal(0),
    );
    return {
      total: total.toFixed(2),
      rows: rows.map((row) => ({
        id: row.id,
        invoice: row.number,
        date: row.createdAt.toISOString(),
        customer: row.customer?.name ?? null,
        courierName: row.courierName ?? "Addison",
        courierFee: row.courierFee.toFixed(2),
      })),
    };
  }

  @Get("courier/payouts")
  @Permit("sale:manage")
  async history(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
  ) {
    const createdAt = dates(query);
    const rows = await this.db.courierPayout.findMany({
      where: {
        branchId: actor.branchId,
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      },
      include: {
        actor: { select: { name: true } },
        items: {
          include: { sale: { select: { number: true, courierName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map((row) => ({
      operationId: row.operationId,
      date: row.createdAt.toISOString(),
      paidBy: row.actor.name,
      note: row.note,
      total: row.total.toFixed(2),
      sales: row.items.map((item) => ({
        invoice: item.sale.number,
        courierName: item.sale.courierName ?? "Addison",
        fee: item.fee.toFixed(2),
      })),
    }));
  }

  @Post("courier/payouts")
  @Permit("*")
  @RequireTerminal()
  async payout(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        operationId: uuid,
        saleIds: z.array(uuid).min(1).max(500),
        note: z.string().trim().max(500).optional(),
      }),
      body,
    );
    const saleIds = [...new Set(data.saleIds)].sort();
    if (saleIds.length !== data.saleIds.length)
      bad("No repitas facturas en el pago.");
    const note = data.note || null;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ saleIds, note }))
      .digest("hex");
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"courier:" + data.operationId}))`;
        const previous = await tx.courierPayout.findUnique({
          where: { operationId: data.operationId },
        });
        if (previous) {
          if (
            previous.branchId !== actor.branchId ||
            previous.requestHash !== requestHash
          )
            conflict(
              "El identificador de pago ya corresponde a otra operación.",
            );
          return {
            operationId: previous.operationId,
            total: previous.total.toFixed(2),
            paidAt: previous.createdAt.toISOString(),
            replayed: true,
          };
        }
        const rows = [];
        for (const saleId of saleIds) {
          await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId}::uuid FOR UPDATE`;
          const sale = await tx.sale.findFirst({
            where: { id: saleId, branchId: actor.branchId },
          });
          if (!sale || sale.status !== "completed" || sale.courierFee.lte(0))
            bad("Una factura no tiene un envío pendiente en esta sucursal.");
          if (sale.courierPaidAt)
            conflict("Un envío seleccionado ya fue pagado.");
          rows.push(sale);
        }
        const total = rows.reduce(
          (sum, row) => sum.plus(row.courierFee),
          new Prisma.Decimal(0),
        );
        const payout = await tx.courierPayout.create({
          data: {
            operationId: data.operationId,
            branchId: actor.branchId,
            actorId: actor.id,
            note,
            requestHash,
            total,
          },
        });
        for (const sale of rows) {
          await tx.courierPayoutItem.create({
            data: {
              saleId: sale.id,
              payoutId: payout.operationId,
              fee: sale.courierFee,
            },
          });
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              courierPaidAt: payout.createdAt,
              courierPaidById: actor.id,
            },
          });
        }
        await audit(
          tx,
          actor,
          "courier_payout",
          "courier_payout",
          payout.operationId,
          null,
          { saleIds, total: total.toFixed(2), note },
        );
        return {
          operationId: payout.operationId,
          total: total.toFixed(2),
          paidAt: payout.createdAt.toISOString(),
          replayed: false,
        };
      },
      { timeout: 20000 },
    );
  }
}

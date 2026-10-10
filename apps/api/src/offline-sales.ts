import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { can, formatAmount, money, z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  audit,
  conflict,
  denied,
  parse,
} from "./common";
import { refreshClosedCash } from "./cash";

const resolutionBase = {
  offlineUuid: z.string().uuid(),
  previousTotal: z.number().nonnegative().max(100000000),
  reason: z.string().trim().min(3).max(300),
};
const resolution = z.discriminatedUnion("action", [
  z.object({ ...resolutionBase, action: z.literal("discard") }),
  z.object({
    ...resolutionBase,
    action: z.literal("reprice"),
    currentTotal: z.number().nonnegative().max(100000000),
  }),
]);

@Controller()
export class OfflineSalesController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Post("sales/offline-resolution")
  @Permit("sale:write")
  @RequireTerminal()
  async record(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(resolution, body);
    if (data.action === "discard") {
      if (!can(actor.permissions, "sale:manage")) denied();
      await this.db.$transaction(async (tx) => {
        // N-M1: mismo candado del UUID que la sincronización, para que el
        // descarte y un reenvío simultáneo se atiendan uno tras otro.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.offlineUuid}))::text AS locked`;
        // La alerta no basta para demostrar propiedad: toda la sucursal puede
        // verla. El primer intento fallido deja esta marca con el usuario que
        // realmente entregó la venta offline.
        const ownership = await tx.auditLog.findFirst({
          where: {
            action: "offline_sale_conflict",
            entity: "offline_sale",
            entityId: data.offlineUuid,
            userId: actor.id,
            branchId: actor.branchId,
          },
          orderBy: { createdAt: "desc" },
        });
        const alert = await tx.alert.findFirst({
          where: {
            key: "offline:" + data.offlineUuid,
            type: "offline_conflict",
            branchId: actor.branchId,
            status: { not: "resolved" },
          },
        });
        if (!ownership || !alert)
          throw new NotFoundException(
            "No existe una venta offline pendiente de este usuario.",
          );
        if (
          await tx.sale.findUnique({ where: { offlineUuid: data.offlineUuid } })
        )
          conflict("La venta ya fue sincronizada y no se puede descartar.");

        const evidence = (ownership.after ?? {}) as Record<string, unknown>;
        if (Number(evidence.paymentTotal ?? 0) > 0)
          conflict(
            "La venta ya fue cobrada. Debes sincronizarla o procesar una devolución; no se puede descartar.",
          );

        const resolved = await tx.alert.updateMany({
          where: { id: alert.id, status: { not: "resolved" } },
          data: { status: "resolved" },
        });
        if (resolved.count !== 1)
          throw new NotFoundException(
            "La venta offline pendiente ya fue resuelta.",
          );
        // Se audita después de validar y resolver; si falla, la transacción
        // revierte también la alerta.
        await audit(
          tx,
          actor,
          "offline_sale_discarded",
          "offline_sale",
          data.offlineUuid,
          { total: data.previousTotal },
          { reason: data.reason },
        );
      });
      return { ok: true };
    }
    return this.db.$transaction(async (tx) => {
      // Serializa resolución y reintentos. La auditoría sólo puede existir si
      // el UUID ya produjo exactamente una Sale en la sincronización.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.offlineUuid}))::text AS locked`;
      const ownership = await tx.auditLog.findFirst({
        where: {
          action: "offline_sale_conflict",
          entity: "offline_sale",
          entityId: data.offlineUuid,
          userId: actor.id,
          branchId: actor.branchId,
        },
        orderBy: { createdAt: "desc" },
      });
      const sale = await tx.sale.findUnique({
        where: { offlineUuid: data.offlineUuid },
        include: { payments: true },
      });
      if (
        !ownership ||
        !sale ||
        sale.sellerId !== actor.id ||
        sale.branchId !== actor.branchId
      )
        throw new NotFoundException(
          "No existe una venta offline sincronizada de este usuario.",
        );
      const conflictEvidence = (ownership.after ?? {}) as Record<
        string,
        unknown
      >;
      // paymentTotal is the amount tendered and may legitimately exceed the
      // sale total. New conflict records keep the expected sale total apart;
      // paymentTotal remains as a backward-compatible fallback.
      const attemptedExpectedTotal = Number(
        conflictEvidence.attemptedExpectedTotal ??
          conflictEvidence.paymentTotal,
      );
      if (
        Number.isFinite(attemptedExpectedTotal) &&
        Math.abs(attemptedExpectedTotal - data.previousTotal) > 0.01
      )
        conflict("El total anterior no coincide con el conflicto registrado.");
      if (Math.abs(Number(sale.total) - data.currentTotal) > 0.01)
        conflict("El total corregido no coincide con la venta sincronizada.");

      const cash = sale.payments.filter(
        (payment: any) =>
          payment.method === "cash" && payment.entryType === "sale",
      );
      const cashTendered = money(
        cash.reduce(
          (sum: number, payment: any) =>
            sum + Number(payment.tendered ?? payment.amount),
          0,
        ),
      );
      const cashApplied = money(
        cash.reduce(
          (sum: number, payment: any) => sum + Number(payment.amount),
          0,
        ),
      );
      const cashChange = money(
        cash.reduce(
          (sum: number, payment: any) => sum + Number(payment.change ?? 0),
          0,
        ),
      );
      if (Math.abs(cashTendered - cashApplied - cashChange) > 0.01)
        conflict("El efectivo corregido no cuadra con el cambio entregado.");
      const onlyCash =
        cash.length > 0 &&
        sale.payments
          .filter((payment: any) => payment.entryType === "sale")
          .every((payment: any) => payment.method === "cash");
      if (onlyCash && data.previousTotal > data.currentTotal) {
        const expectedChange = money(cashTendered - data.currentTotal);
        if (
          Math.abs(cashApplied - data.currentTotal) > 0.01 ||
          Math.abs(cashChange - expectedChange) > 0.01
        )
          conflict(
            "La rebaja en efectivo debe quedar registrada como cambio entregado.",
          );
      }

      const existing = await tx.auditLog.findFirst({
        where: {
          action: "offline_sale_repriced",
          entity: "sale",
          entityId: sale.id,
        },
      });
      if (!existing) {
        await audit(
          tx,
          actor,
          "offline_sale_repriced",
          "sale",
          sale.id,
          { total: data.previousTotal, offlineUuid: data.offlineUuid },
          {
            total: data.currentTotal,
            reason: data.reason,
            offlineUuid: data.offlineUuid,
            cashTendered,
            cashApplied,
            cashChange,
          },
        );
        // B-1 (auditoría 01): la venta quedó con el precio actual y un
        // «cambio» que el cliente nunca recibió: pagó el total anterior y esa
        // diferencia sigue en la gaveta. Una entrada de caja por ese monto
        // deja el esperado igual al efectivo real, en vez de un sobrante que
        // nadie espera. Sólo una vez (la auditoría de arriba la protege).
        if (
          onlyCash &&
          data.previousTotal > data.currentTotal &&
          sale.cashSessionId
        ) {
          await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id=${sale.cashSessionId}::uuid FOR UPDATE`;
          const surplus = money(data.previousTotal - data.currentTotal);
          await tx.cashMovement.create({
            data: {
              sessionId: sale.cashSessionId,
              type: "in",
              amount: surplus,
              reason: `Diferencia de precio de la venta offline ${sale.number}: el cliente pagó RD$ ${formatAmount(data.previousTotal)} y no recibió esa diferencia.`,
              userId: actor.id,
            },
          });
          const cash = await tx.cashSession.findUnique({
            where: { id: sale.cashSessionId },
          });
          if (cash?.closedAt) await refreshClosedCash(tx, cash);
        }
      }
      return { ok: true, saleId: sale.id };
    });
  }
}

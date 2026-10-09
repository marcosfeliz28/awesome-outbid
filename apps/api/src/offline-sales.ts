import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { can, z } from "@fitstore/shared";
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

const resolution = z.object({
  offlineUuid: z.string().uuid(),
  action: z.enum(["reprice", "discard"]),
  previousTotal: z.number().nonnegative().max(100000000),
  currentTotal: z.number().nonnegative().max(100000000).optional(),
  reason: z.string().trim().min(3).max(300),
});

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
        if (await tx.sale.findUnique({ where: { offlineUuid: data.offlineUuid } }))
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
    await audit(
      this.db,
      actor,
      "offline_sale_repriced",
      "offline_sale",
      data.offlineUuid,
      { total: data.previousTotal },
      {
        ...(data.currentTotal === undefined
          ? {}
          : { total: data.currentTotal }),
        reason: data.reason,
      },
    );
    return { ok: true };
  }
}

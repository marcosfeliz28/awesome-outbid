// Auditoría 05-A2: salida para una venta sin conexión en conflicto.
//
// Antes, «Descartar» exigía sale:manage y, además, que lo pidiera quien envió
// la venta (offline-sales.ts), y no aceptaba ventas ya cobradas: nadie podía
// descartar el conflicto de una cajera y su caja no se podía cerrar en ese
// equipo. Este endpoint mínimo permite descartarlo con aprobación de gerencia
// y deja la evidencia completa:
// - la cajera, en su equipo, con el PIN de un gerente o administrador de la
//   sucursal (mismo contador de intentos que las demás aprobaciones con PIN);
// - o un gerente con su propia sesión, también para la venta de otra persona
//   de su sucursal.
// La bitácora guarda quién la envió, quién aprobó, el motivo y el detalle que
// la caja tenía (artículos y pagos), y queda una alerta para gerencia: si el
// dinero quedó en la gaveta, el cuadre de esa caja lo mostrará como sobrante.
// La venta no se crea ni se mueve inventario ni dinero.
import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { compare } from "bcryptjs";
import { can, money, z } from "@fitstore/shared";
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
} from "./common";
import { verifyPinAttempt } from "./security";

const amount = z.number().nonnegative().max(100000000);
const discardSchema = z.object({
  offlineUuid: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
  managerPin: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional(),
  // Lo que la caja tenía guardado: sólo informativo, para cuadrar.
  detail: z.object({
    receiptNumber: z.string().trim().max(40),
    total: amount,
    capturedAt: z.string().max(40).optional(),
    items: z
      .array(
        z.object({
          variantId: z.string().max(64).optional(),
          name: z.string().trim().max(300),
          sku: z.string().max(100).optional(),
          qty: z.number().positive().max(100000),
          unitPrice: amount.optional(),
          lineTotal: amount.optional(),
        }),
      )
      .max(200),
    payments: z.array(z.object({ method: z.string().max(20), amount })).max(20),
  }),
});

@Controller()
export class OfflineSaleReviewController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Post("sales/offline-review/discard")
  @Permit("sale:write")
  @RequireTerminal()
  async discard(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(discardSchema, body);
    const manages = can(actor.permissions, "sale:manage");
    let approverId = actor.id;
    if (!manages) {
      if (!data.managerPin)
        bad("Para descartar esta venta hace falta el PIN de un gerente.");
      const managers = await this.db.user.findMany({
        where: { active: true, branchId: actor.branchId },
        include: { role: true },
      });
      approverId = await verifyPinAttempt(
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
    const approver = await this.db.user.findUniqueOrThrow({
      where: { id: approverId },
      select: { id: true, name: true },
    });
    await this.db.$transaction(async (tx) => {
      // Serializa con la sincronización y con offline-resolution.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.offlineUuid}))::text AS locked`;
      // La cajera sólo descarta lo suyo; gerencia, lo de su sucursal.
      const ownership = await tx.auditLog.findFirst({
        where: {
          action: "offline_sale_conflict",
          entity: "offline_sale",
          entityId: data.offlineUuid,
          branchId: actor.branchId,
          ...(manages ? {} : { userId: actor.id }),
        },
        orderBy: { createdAt: "desc" },
      });
      if (!ownership)
        throw new NotFoundException(
          "No hay un conflicto registrado para esta venta en tu sucursal.",
        );
      if (
        await tx.sale.findUnique({ where: { offlineUuid: data.offlineUuid } })
      )
        conflict(
          "La venta ya está registrada en el servidor; no se puede descartar.",
        );
      const resolved = await tx.alert.updateMany({
        where: {
          key: "offline:" + data.offlineUuid,
          type: "offline_conflict",
          branchId: actor.branchId,
          status: { not: "resolved" },
        },
        data: { status: "resolved" },
      });
      if (resolved.count !== 1)
        throw new NotFoundException("Esta venta sin conexión ya fue resuelta.");
      const evidence = (ownership.after ?? {}) as Record<string, unknown>;
      const paid = money(
        data.detail.payments.reduce((sum, p) => sum + p.amount, 0),
      );
      await audit(
        tx,
        actor,
        "offline_sale_discarded",
        "offline_sale",
        data.offlineUuid,
        {
          sellerId: ownership.userId,
          paymentTotal: evidence.paymentTotal ?? paid,
          attemptedExpectedTotal: evidence.attemptedExpectedTotal ?? null,
          cashSessionId: evidence.cashSessionId ?? null,
        },
        {
          reason: data.reason,
          approvedById: approver.id,
          approvedByName: approver.name,
          approval: manages ? "session" : "pin",
          detail: data.detail,
        },
      );
      // Tipo offline_conflict: la evaluación periódica de alertas no la
      // resuelve sola; queda hasta que gerencia la revise.
      await tx.alert.upsert({
        where: { key: "offline-discarded:" + data.offlineUuid },
        create: {
          key: "offline-discarded:" + data.offlineUuid,
          type: "offline_conflict",
          severity: "high",
          entityId: data.offlineUuid,
          branchId: actor.branchId,
          message:
            "Venta sin conexión " +
            data.detail.receiptNumber +
            " descartada con aprobación de " +
            approver.name +
            ": " +
            data.reason +
            ". Cobrado en el equipo: RD$ " +
            paid.toFixed(2) +
            ". Si el dinero quedó en la caja, el cuadre lo mostrará como sobrante.",
        },
        update: {},
      });
    });
    return { ok: true, approvedBy: approver.name };
  }
}

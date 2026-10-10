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
// Por defecto («returned») la venta no se crea ni se mueve inventario ni
// dinero: la mercancía y el dinero se devolvieron. M-6 (v1/v2): si el cliente
// SE LLEVÓ la mercancía y pagó («delivered»), descartar dejaba el stock
// sobrestimado y un sobrante sin explicar; con esa salida el servidor registra
// la salida de inventario (ajuste, a costo, cuenta en mermas y ajustes) y una
// entrada de caja por lo cobrado en efectivo, ambas con la referencia de la
// venta descartada. No es una venta: gerencia puede cobrar la diferencia o
// registrarla aparte.
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
import { lockVariant, takeStock } from "./inventory";
import { refreshClosedCash } from "./cash";

const amount = z.number().nonnegative().max(100000000);
const discardSchema = z.object({
  offlineUuid: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
  // M-6: qué pasó con la mercancía y el dinero. Sin la clave se conserva el
  // comportamiento anterior (no se mueve nada).
  outcome: z.enum(["returned", "delivered"]).default("returned"),
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
        // Cupos del solicitante y de PIN cortos (S-03), como las demás
        // aprobaciones con PIN.
        { pin: data.managerPin, actor },
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
      // M-6: el cliente se llevó la mercancía y pagó, pero la venta no se crea.
      const consequences: string[] = [];
      if (data.outcome === "delivered") {
        const wanted = new Map<string, number>();
        for (const item of data.detail.items)
          if (
            item.variantId &&
            z.string().uuid().safeParse(item.variantId).success
          )
            wanted.set(
              item.variantId,
              (wanted.get(item.variantId) ?? 0) + item.qty,
            );
        // La evidencia viene de lo que la caja envió: nunca se confía en ella.
        // La caja debe ser de esta sucursal y de quien sincronizó la venta.
        let sessionId: string | null = null;
        if (
          typeof evidence.cashSessionId === "string" &&
          z.string().uuid().safeParse(evidence.cashSessionId).success
        ) {
          const own = await tx.cashSession.findFirst({
            where: {
              id: evidence.cashSessionId,
              branchId: actor.branchId,
              userId: ownership.userId,
            },
            select: { id: true },
          });
          if (!own)
            bad(
              "La caja de esta venta no corresponde a la sucursal o a la cajera que la envió: no se puede registrar la entrada de dinero.",
            );
          sessionId = own!.id;
        }
        // Mismo orden que la venta: caja primero, luego las variantes por id.
        if (sessionId)
          await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id=${sessionId}::uuid FOR UPDATE`;
        for (const variantId of [...wanted.keys()].sort()) {
          const variant = await lockVariant(tx, variantId, actor);
          await takeStock(
            tx,
            actor,
            variant,
            wanted.get(variantId)!,
            "adjustment",
            data.offlineUuid,
          );
        }
        if (wanted.size) {
          await tx.inventoryMovement.updateMany({
            where: { refId: data.offlineUuid, type: "adjustment" },
            data: {
              reason:
                "Venta sin conexión " +
                data.detail.receiptNumber +
                " descartada con la mercancía entregada",
            },
          });
          consequences.push("salida de inventario");
        }
        const cashPaid = money(
          data.detail.payments
            .filter((p) => p.method === "cash")
            .reduce((sum, p) => sum + p.amount, 0),
        );
        if (sessionId && cashPaid > 0) {
          await tx.cashMovement.create({
            data: {
              sessionId,
              type: "in",
              amount: cashPaid,
              reason:
                "Venta sin conexión " +
                data.detail.receiptNumber +
                " descartada: efectivo cobrado por mercancía entregada",
              userId: actor.id,
            },
          });
          const cash = await tx.cashSession.findUnique({
            where: { id: sessionId },
          });
          if (cash?.closedAt) await refreshClosedCash(tx, cash);
          consequences.push("entrada de caja");
        }
      }
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
          outcome: data.outcome,
          consequences,
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
            (data.outcome === "delivered"
              ? ". El cliente se llevó la mercancía: se registró " +
                (consequences.join(" y ") || "sin movimientos") +
                " (no es una venta; cóbrala o regístrala aparte)."
              : ". Si el dinero quedó en la caja, el cuadre lo mostrará como sobrante."),
        },
        update: {},
      });
    });
    return { ok: true, approvedBy: approver.name };
  }
}

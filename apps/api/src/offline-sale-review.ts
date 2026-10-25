import { tenantUnique } from "./tenant-context";
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
// sobrestimado y un sobrante sin explicar. #4 (revisión 25-oct): con esa
// salida se registra la venta REAL (NCF, ITBIS, inventario, pagos, incentivos)
// con los datos que el servidor guardó al sincronizar, en la caja de quien la
// cobró; si no se puede, se rechaza. Ya no hay ajuste más entrada de caja.
import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { can, money, saleSchema, z } from "@fitstore/shared";
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
import { managerPinApproval } from "./security";
import { SalesController } from "./sales";

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
    payments: z
      .array(
        z.object({
          method: z.string().max(20),
          amount,
          currency: z.enum(["DOP", "USD"]).optional(),
        }),
      )
      .max(20),
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
      approverId = await managerPinApproval(this.db, actor, data.managerPin);
    }
    const approver = await this.db.user.findUniqueOrThrow({
      where: { id: approverId },
      select: { id: true, name: true },
    });
    // La cajera sólo descarta lo suyo; gerencia, lo de su sucursal.
    const findOwnership = (tx: Prisma.TransactionClient) =>
      tx.auditLog.findFirst({
        where: {
          action: "offline_sale_conflict",
          entity: "offline_sale",
          entityId: data.offlineUuid,
          branchId: actor.branchId,
          ...(manages ? {} : { userId: actor.id }),
        },
        orderBy: { createdAt: "desc" },
      });
    // Se resuelve el conflicto bajo el candado del UUID (el mismo de la
    // sincronización); `sale` es la venta real registrada si se entregó.
    const settle = async (
      tx: Prisma.TransactionClient,
      sale?: { offlineUuid: string },
    ) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.offlineUuid}))::text AS locked`;
      const ownership = await findOwnership(tx);
      if (!ownership)
        throw new NotFoundException(
          "No hay un conflicto registrado para esta venta en tu sucursal.",
        );
      if (
        await tx.sale.findUnique({ where: tenantUnique("offlineUuid", data.offlineUuid) })
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
          outcome: data.outcome,
          // La venta real, con el UUID nuevo con que se registró.
          saleOfflineUuid: sale?.offlineUuid ?? null,
          detail: data.detail,
        },
      );
      // Tipo offline_conflict: la evaluación periódica de alertas no la
      // resuelve sola; queda hasta que gerencia la revise.
      await tx.alert.upsert({
        where: tenantUnique("key", "offline-discarded:" + data.offlineUuid),
        create: {
          key: "offline-discarded:" + data.offlineUuid,
          type: "offline_conflict",
          severity: "high",
          entityId: data.offlineUuid,
          branchId: actor.branchId,
          message:
            "Venta sin conexión " +
            data.detail.receiptNumber +
            " revisada con aprobación de " +
            approver.name +
            ": " +
            data.reason +
            ". Cobrado en el equipo: RD$ " +
            paid.toFixed(2) +
            (sale
              ? ". El cliente se llevó la mercancía: se registró como venta con los datos que guardó el servidor."
              : ". Si el dinero quedó en la caja, el cuadre lo mostrará como sobrante."),
        },
        update: {},
      });
    };
    if (data.outcome === "returned") {
      await this.db.$transaction((tx) => settle(tx));
      return { ok: true, approvedBy: approver.name };
    }
    // #4 (revisión 25-oct): «entregada» registra la venta real por la ruta
    // normal (precios, impuestos, inventario, pagos e incentivos) con lo que
    // el SERVIDOR guardó al sincronizar, nunca con lo que manda el navegador.
    // Si no se puede, se rechaza: no se mueve inventario ni dinero sin venta.
    const ownership = await findOwnership(this.db as any);
    if (!ownership)
      throw new NotFoundException(
        "No hay un conflicto registrado para esta venta en tu sucursal.",
      );
    if (ownership.userId !== actor.id)
      bad(
        "La venta entregada se registra en la caja de quien la cobró: que la cajera la revise en su equipo con tu PIN.",
      );
    const evidence = (ownership.after ?? {}) as any;
    const stored = evidence.sale ?? evidence.detail ?? {};
    if (
      (stored.payments ?? []).some((p: any) => p?.currency === "USD") ||
      (evidence.detail?.payments ?? []).some((p: any) => p?.currency === "USD")
    )
      bad(
        "Esta venta incluía un pago en dólares: no se puede registrar desde aquí. Pide a la administración que la registre a mano.",
      );
    // N8: el servidor no guarda banco ni referencia; una transferencia no se
    // puede registrar sin ellos (ni verificar después).
    if (
      (stored.payments ?? []).some((p: any) => p?.method === "transfer") ||
      (evidence.detail?.payments ?? []).some(
        (p: any) => p?.method === "transfer",
      )
    )
      bad(
        "Esta venta incluía una transferencia: no se puede registrar desde aquí. Descártala como devuelta y vuelve a facturarla con la referencia.",
      );
    // Las evidencias antiguas guardan null en lo que no venía.
    const clean = JSON.parse(
      JSON.stringify(stored, (_k, v) => (v === null ? undefined : v)),
    );
    const input = saleSchema.safeParse({
      ...clean,
      offlineUuid: randomUUID(),
      cashSessionId: evidence.cashSessionId ?? undefined,
      // Los precios de hoy mandan; el pago guardado debe cubrir el total.
      expectedTotal: undefined,
      managerPin: data.managerPin,
    });
    if (!input.success)
      bad(
        "El servidor no guardó los datos completos de esta venta (caja, cliente, artículos o pagos): no se puede registrar como entregada. Descártala como devuelta y vuelve a facturarla.",
      );
    const sale = await new SalesController(this.db).complete(
      actor,
      input.data!,
      true,
      {
        closedCashReason: data.reason,
        inTransaction: (tx) => settle(tx, input.data!),
      },
    );
    return {
      ok: true,
      approvedBy: approver.name,
      sale: { id: sale.id, number: sale.number },
    };
  }
}

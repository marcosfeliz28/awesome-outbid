import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  expired,
  weightedCost,
  landedCosts,
  quantity,
  money,
  d,
  z,
  signedStockQty,
  countedQty,
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
  positive,
  reason,
  audit,
  bad,
  safe,
  json,
  qty,
} from "./common";

export async function lockVariant(tx: any, id: string, actor: Actor) {
  await tx.$queryRaw`SELECT id FROM "Variant" WHERE id = ${id}::uuid AND "branchId" = ${actor.branchId} FOR UPDATE`;
  const variant = await tx.variant.findFirstOrThrow({
    where: { id, branchId: actor.branchId },
    include: {
      product: { include: { category: true } },
      lots: {
        where: { qty: { gt: 0 } },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  const settings = await tx.settings.findUnique({
    where: { id: actor.branchId },
  });
  return {
    ...variant,
    allowNegativeStock:
      (settings?.data as any)?.allowNegativeStock === true &&
      !variant.product.category.requiresLot,
  };
}
export async function stockChange(
  tx: any,
  actor: Actor,
  variant: any,
  qty: number,
  type: string,
  reasonText: string,
  refId?: string,
  lotId?: string,
  // Entradas: costo unitario de lo recibido (con flete); salidas: costo promedio.
  unitCost?: number,
) {
  const balance = quantity(d(variant.stock).plus(qty));
  if (balance < 0 && !variant.allowNegativeStock)
    bad("Stock insuficiente para " + variant.product.name + ".");
  await tx.variant.update({
    where: { id: variant.id },
    data: { stock: balance },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId: variant.id,
      lotId,
      type,
      qty,
      unitCost: unitCost ?? variant.costAvg,
      balanceAfter: balance,
      refId,
      reason: reasonText,
      userId: actor.id,
      branchId: actor.branchId,
    },
  });
  variant.stock = balance;
  if (balance < 0)
    await tx.alert.upsert({
      where: { key: "negative:" + variant.id },
      create: {
        key: "negative:" + variant.id,
        type: "negative_stock",
        severity: "high",
        entityId: variant.id,
        branchId: actor.branchId,
        message:
          variant.product.name +
          ": stock negativo (" +
          balance +
          "). Revisa el inventario.",
      },
      update: {
        status: "new",
        message:
          variant.product.name +
          ": stock negativo (" +
          balance +
          "). Revisa el inventario.",
      },
    });
}
export async function takeStock(
  tx: any,
  actor: Actor,
  variant: any,
  qty: number,
  type: string,
  refId: string,
) {
  if (!variant.active || !variant.product.active) bad("Producto inactivo.");
  if (Number(variant.stock) < qty && !variant.allowNegativeStock)
    bad("Stock insuficiente para " + variant.product.name + ".");
  const pieces: { lotId?: string; qty: number }[] = [];
  let remaining = d(qty);
  const untracked = Math.max(
    0,
    Number(variant.stock) -
      variant.lots.reduce((sum: number, l: any) => sum + Number(l.qty), 0),
  );
  if (variant.product.category.requiresLot || variant.lots.length) {
    for (const lot of variant.lots) {
      if (
        expired(lot.expiryDate) ||
        (variant.product.category.requiresExpiry && !lot.expiryDate)
      )
        continue;
      const picked = d(lot.qty).lt(remaining) ? d(lot.qty) : remaining;
      if (picked.lte(0)) continue;
      await tx.lot.update({
        where: { id: lot.id },
        data: { qty: { decrement: picked.toNumber() } },
      });
      lot.qty = quantity(d(lot.qty).minus(picked));
      remaining = remaining.minus(picked);
      pieces.push({ lotId: lot.id, qty: picked.toNumber() });
      if (remaining.lte(0)) break;
    }
    if (remaining.gt(0) && !variant.product.category.requiresLot) {
      const picked = d(untracked).lt(remaining) ? d(untracked) : remaining;
      if (picked.gt(0)) pieces.push({ qty: picked.toNumber() });
      remaining = remaining.minus(picked);
    }
    if (remaining.gt(0) && variant.allowNegativeStock) {
      pieces.push({ qty: remaining.toNumber() });
      remaining = d(0);
    }
    if (remaining.gt(0))
      bad(
        "No hay lotes vigentes suficientes para " + variant.product.name + ".",
      );
  } else pieces.push({ qty });
  for (const part of pieces)
    await stockChange(
      tx,
      actor,
      variant,
      -part.qty,
      type,
      type === "sale" ? "Venta FEFO" : "Salida",
      refId,
      part.lotId,
    );
  return pieces;
}

@Controller()
export class InventoryController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("inventory/stock")
  @Permit("catalog:read")
  async stock(@CurrentUser() actor: Actor) {
    return safe(
      await this.db.variant.findMany({
        where: { branchId: actor.branchId, active: true },
        include: { product: { include: { category: true } }, lots: true },
        orderBy: { sku: "asc" },
      }),
      actor,
    );
  }
  @Get("inventory/movements")
  @Permit("catalog:read")
  async movements(
    @Query("variantId") variantId: string,
    @CurrentUser() actor: Actor,
  ) {
    return safe(
      await this.db.inventoryMovement.findMany({
        where: {
          branchId: actor.branchId,
          ...(variantId ? { variantId: parse(uuid, variantId) } : {}),
        },
        include: { variant: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      actor,
    );
  }
  @Post("inventory/adjustments")
  @RequireTerminal()
  @Permit("inventory:write")
  async adjustment(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        variantId: uuid,
        qty: signedStockQty(),
        reason,
        lotId: uuid.optional(),
        lotNumber: z.string().optional(),
        expiryDate: z.string().datetime().optional(),
        type: z
          .enum(["adjustment", "waste", "supplier_return"])
          .default("adjustment"),
      }),
      body,
    );
    return this.db.$transaction(
      async (tx) => {
        const variant = await lockVariant(tx, data.variantId, actor);
        let lotId = data.lotId;
        if (
          data.qty < 0 &&
          !data.lotId &&
          !variant.product.category.requiresLot &&
          !variant.allowNegativeStock
        ) {
          const untracked =
            Number(variant.stock) -
            variant.lots.reduce(
              (sum: number, l: any) => sum + Number(l.qty),
              0,
            );
          if (untracked + data.qty < 0)
            bad("Stock insuficiente sin lote. Selecciona el lote de salida.");
        }
        if (data.expiryDate && expired(data.expiryDate))
          bad("No puedes ajustar un lote vencido.");
        if (
          variant.product.category.requiresLot ||
          data.lotId ||
          data.lotNumber
        ) {
          if (data.qty < 0) {
            if (!lotId) bad("Selecciona el lote de salida.");
            const lot = await tx.lot.findFirstOrThrow({
              where: { id: lotId, variantId: variant.id },
            });
            if (Number(lot.qty) + data.qty < 0)
              bad("Stock insuficiente en el lote.");
            await tx.lot.update({
              where: { id: lot.id },
              data: { qty: { increment: data.qty } },
            });
          } else {
            if (
              !data.lotNumber ||
              (variant.product.category.requiresExpiry && !data.expiryDate)
            )
              bad("Indica lote y vencimiento.");
            const existingLot = await tx.lot.findUnique({
              where: {
                variantId_lotNumber: {
                  variantId: variant.id,
                  lotNumber: data.lotNumber,
                },
              },
            });
            if (existingLot && expired(existingLot.expiryDate))
              bad("No puedes aumentar un lote vencido.");
            const lot = await tx.lot.upsert({
              where: {
                variantId_lotNumber: {
                  variantId: variant.id,
                  lotNumber: data.lotNumber,
                },
              },
              create: {
                variantId: variant.id,
                lotNumber: data.lotNumber,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                qty: data.qty,
                cost: variant.costAvg,
                branchId: actor.branchId,
              },
              update: { qty: { increment: data.qty } },
            });
            lotId = lot.id;
          }
        }
        await stockChange(
          tx,
          actor,
          variant,
          data.qty,
          data.type,
          data.reason,
          undefined,
          lotId,
        );
        await audit(
          tx,
          actor,
          data.type,
          "variant",
          variant.id,
          undefined,
          data,
        );
        return safe(variant, actor);
      },
      { isolationLevel: "Serializable" },
    );
  }
  @Get("purchase-orders")
  @Permit("purchase:write")
  async orders(@CurrentUser() actor: Actor) {
    return safe(
      await this.db.purchaseOrder.findMany({
        where: { branchId: actor.branchId },
        include: { items: true, receipts: true },
        orderBy: { createdAt: "desc" },
      }),
      actor,
    );
  }
  @Post("purchase-orders")
  @Permit("purchase:write")
  async order(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        supplierId: uuid,
        expectedDate: z.string().datetime().optional(),
        items: z
          .array(z.object({ variantId: uuid, qty, unitCost: positive }))
          .min(1)
          .max(200),
      }),
      body,
    );
    if (new Set(data.items.map((i) => i.variantId)).size !== data.items.length)
      bad("Agrupa las cantidades por variante.");
    return this.db.$transaction(async (tx) => {
      await tx.supplier.findFirstOrThrow({
        where: { id: data.supplierId, branchId: actor.branchId, active: true },
      });
      const count = await tx.counter.upsert({
        where: { key: "purchase" },
        create: { key: "purchase", value: 1 },
        update: { value: { increment: 1 } },
      });
      const row = await tx.purchaseOrder.create({
        data: {
          supplierId: data.supplierId,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          number: "OC-" + String(count.value).padStart(6, "0"),
          total: money(
            data.items.reduce(
              (a, i) => a.plus(d(i.qty).times(i.unitCost)),
              d(0),
            ),
          ),
          items: { create: data.items },
          createdBy: actor.id,
          branchId: actor.branchId,
        },
        include: { items: true },
      });
      await audit(tx, actor, "create", "purchase", row.id, undefined, row);
      return safe(row, actor);
    });
  }
  @Post("purchase-orders/:id/receive")
  @RequireTerminal()
  @Permit("purchase:write")
  async receive(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        // Id de la recepción, creado al abrir el formulario: si se pierde la
        // respuesta y se reenvía, no se recibe dos veces (R9-facturas-8).
        operationId: uuid.optional(),
        freight: amount.default(0),
        otherCosts: amount.default(0),
        allocation: z.enum(["value", "units"]).default("value"),
        items: z
          .array(
            z.object({
              itemId: uuid,
              qty,
              lotNumber: z.string().min(1).optional(),
              expiryDate: z.string().datetime().optional(),
            }),
          )
          .min(1),
      }),
      body,
    );
    if (new Set(data.items.map((i) => i.itemId)).size !== data.items.length)
      bad("No repitas líneas de recepción.");
    // ¿La recepción guardada es este mismo envío? Se comparan las líneas, el
    // flete y el costo final de cada línea (que depende del reparto).
    const sameRequest = (prior: any, orderId: string) => {
      const stored = prior.items as any[];
      if (
        prior.orderId !== orderId ||
        prior.branchId !== actor.branchId ||
        prior.userId !== actor.id ||
        Number(prior.freight) !== data.freight ||
        Number(prior.otherCosts) !== data.otherCosts ||
        stored.length !== data.items.length
      )
        return false;
      const costs = landedCosts(
        stored,
        money(d(data.freight).plus(data.otherCosts)),
        data.allocation,
      );
      return data.items.every(
        (item, i) =>
          stored[i].itemId === item.itemId &&
          Number(stored[i].qty) === item.qty &&
          (stored[i].lotNumber ?? null) === (item.lotNumber ?? null) &&
          (stored[i].expiryDate ?? null) === (item.expiryDate ?? null) &&
          Number(stored[i].landedCost) === costs[i],
      );
    };
    return this.db.$transaction(
      async (tx) => {
        if (data.operationId)
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.operationId}))::text`;
        await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${parse(uuid, id)}::uuid FOR UPDATE`;
        const order = await tx.purchaseOrder.findFirstOrThrow({
          where: { id, branchId: actor.branchId },
          include: { items: true },
        });
        // Antes de revisar lo pendiente: el reintento de una recepción que
        // completó la orden devuelve esa recepción, no «ya fue recibida».
        if (data.operationId) {
          const prior = await tx.goodsReceipt.findUnique({
            where: { operationId: data.operationId },
          });
          if (prior) {
            if (!sameRequest(prior, order.id))
              bad("UUID usado con datos distintos.");
            return safe(prior, actor);
          }
        }
        if (order.status === "received") bad("La orden ya fue recibida.");
        const lines = data.items.map((item) => {
          const ordered = order.items.find((i) => i.id === item.itemId);
          if (!ordered || d(ordered.receivedQty).plus(item.qty).gt(ordered.qty))
            bad("Cantidad mayor que lo pendiente.");
          return {
            ...item,
            variantId: ordered.variantId,
            cost: Number(ordered.unitCost),
          };
        });
        const costs = landedCosts(
          lines,
          money(d(data.freight).plus(data.otherCosts)),
          data.allocation,
        );
        const receipt = await tx.goodsReceipt.create({
          data: {
            orderId: id,
            operationId: data.operationId,
            supplierId: order.supplierId,
            total: money(
              lines.reduce((sum, l) => sum + l.qty * l.cost, 0) +
                data.freight +
                data.otherCosts,
            ),
            freight: data.freight,
            otherCosts: data.otherCosts,
            items: json(
              lines.map((line, i) => ({ ...line, landedCost: costs[i] })),
            ),
            userId: actor.id,
            branchId: actor.branchId,
          },
        });
        for (const [index, line] of [...lines]
          .sort((a, b) => a.variantId.localeCompare(b.variantId))
          .map((line) => [lines.indexOf(line), line] as const)) {
          const variant = await lockVariant(tx, line.variantId, actor);
          let lotId: string | undefined;
          if (variant.product.category.requiresLot && !line.lotNumber)
            bad("El producto requiere un lote.");
          if (variant.product.category.requiresExpiry && !line.expiryDate)
            bad("El producto requiere vencimiento.");
          if (expired(line.expiryDate))
            bad("No puedes recibir un lote vencido.");
          const newCost = weightedCost(
            Math.max(0, Number(variant.stock)),
            Number(variant.costAvg),
            line.qty,
            costs[index],
          );
          await tx.variant.update({
            where: { id: variant.id },
            data: { costAvg: newCost },
          });
          if (line.lotNumber) {
            const existingLot = await tx.lot.findUnique({
              where: {
                variantId_lotNumber: {
                  variantId: variant.id,
                  lotNumber: line.lotNumber,
                },
              },
            });
            if (existingLot && expired(existingLot.expiryDate))
              bad("No puedes recibir existencias en un lote vencido.");
            const lot = await tx.lot.upsert({
              where: {
                variantId_lotNumber: {
                  variantId: variant.id,
                  lotNumber: line.lotNumber,
                },
              },
              create: {
                variantId: variant.id,
                lotNumber: line.lotNumber,
                expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
                qty: line.qty,
                cost: costs[index],
                branchId: actor.branchId,
              },
              update: { qty: { increment: line.qty } },
            });
            lotId = lot.id;
          }
          await stockChange(
            tx,
            actor,
            variant,
            line.qty,
            "purchase",
            "Recepción " + order.number,
            receipt.id,
            lotId,
            costs[index],
          );
          await tx.purchaseItem.update({
            where: { id: line.itemId },
            data: { receivedQty: { increment: line.qty } },
          });
        }
        const items = await tx.purchaseItem.findMany({
          where: { orderId: id },
        });
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: items.every((i) => d(i.receivedQty).gte(i.qty))
              ? "received"
              : "partial",
          },
        });
        await audit(tx, actor, "receive", "purchase", id, undefined, receipt);
        return safe(receipt, actor);
      },
      { isolationLevel: "Serializable", timeout: 15000 },
    );
  }
  @Get("inventory/counts") @Permit("inventory:write") counts(
    @CurrentUser() actor: Actor,
  ) {
    return this.db.inventoryCount.findMany({
      where: { branchId: actor.branchId },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("inventory/counts")
  @Permit("inventory:write")
  async count(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        items: z
          .array(z.object({ variantId: uuid, counted: countedQty() }))
          .min(1)
          .max(1000),
      }),
      body,
    );
    const items = [];
    for (const item of data.items) {
      const variant = await this.db.variant.findFirstOrThrow({
        where: { id: item.variantId, branchId: actor.branchId },
      });
      items.push({ ...item, expected: Number(variant.stock) });
    }
    return this.db.inventoryCount.create({
      data: { items, userId: actor.id, branchId: actor.branchId },
    });
  }
  @Post("inventory/counts/:id/apply")
  @RequireTerminal()
  @Permit("sale:manage")
  async applyCount(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "InventoryCount" WHERE id=${parse(uuid, id)}::uuid FOR UPDATE`;
        const count = await tx.inventoryCount.findFirstOrThrow({
          where: { id: parse(uuid, id), branchId: actor.branchId },
        });
        if (count.status !== "pending") bad("El conteo ya fue aplicado.");
        for (const item of (count.items as any[]).sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        )) {
          const variant = await lockVariant(tx, item.variantId, actor);
          if (Number(variant.stock) !== item.expected)
            bad("El stock cambió. Repite el conteo.");
          if (variant.product.category.requiresLot)
            bad("Ajusta productos con lote desde su lote específico.");
          const lotStock = variant.lots.reduce(
            (sum: number, l: any) => sum + Number(l.qty),
            0,
          );
          if (item.counted < lotStock)
            bad(
              "El conteo no puede quedar por debajo del stock con lote. Ajusta el lote específico.",
            );
          const delta = quantity(d(item.counted).minus(variant.stock));
          if (delta)
            await stockChange(
              tx,
              actor,
              variant,
              delta,
              "count",
              "Conteo físico aprobado",
              id,
            );
        }
        await tx.inventoryCount.update({
          where: { id },
          data: { status: "applied", appliedBy: actor.id },
        });
        await audit(tx, actor, "count_apply", "count", id);
        return { ok: true };
      },
      { isolationLevel: "Serializable" },
    );
  }
}

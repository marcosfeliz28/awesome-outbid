import { tenantUnique } from "./tenant-context";
import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { d, quantity, z } from "@fitstore/shared";
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
  safe,
  uuid,
  assertWholeUnits,
} from "./common";
import { lockVariant, stockChange } from "./inventory";
import { retrySerializable } from "./inventory-resilience";

const transferSchema = z.object({
  operationId: uuid,
  fromId: uuid,
  toId: uuid,
  reason: z.string().trim().min(3).max(300),
  lines: z
    .array(
      z.object({
        variantId: uuid,
        lotId: uuid.optional(),
        qty: z
          .number()
          .positive()
          .max(999999)
          .refine((v) => Number.isInteger(v * 1000), "Máximo tres decimales."),
      }),
    )
    .min(1)
    .max(100),
});
const renameWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

@Controller()
export class WarehousesController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get("inventory/warehouses")
  @Permit("catalog:read")
  async warehouses(@CurrentUser() actor: Actor) {
    return this.db.warehouse.findMany({
      where: { branchId: actor.branchId, active: true },
      orderBy: { kind: "desc" },
    });
  }

  @Patch("inventory/warehouses/:id")
  @Permit("*")
  async renameWarehouse(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const warehouseId = parse(uuid, id);
    const input = parse(renameWarehouseSchema, body);
    return this.db.$transaction(async (tx) => {
      const before = await tx.warehouse.findFirst({
        where: { id: warehouseId, branchId: actor.branchId, active: true },
      });
      if (!before) throw new NotFoundException("Almacén no encontrado.");
      const updated = await tx.warehouse.update({
        where: { id: warehouseId, branchId: actor.branchId, active: true },
        data: { name: input.name },
      });
      await audit(
        tx,
        actor,
        "warehouse_renamed",
        "warehouse",
        warehouseId,
        { name: before.name },
        { name: updated.name },
      );
      return updated;
    });
  }

  @Get("inventory/location-report")
  @Permit("catalog:read")
  async locationReport(@CurrentUser() actor: Actor) {
    const variants = await this.db.variant.findMany({
      where: { branchId: actor.branchId, active: true },
      select: {
        id: true,
        sku: true,
        stock: true,
        costAvg: true,
        product: { select: { name: true } },
        warehouseStocks: {
          where: { warehouse: { branchId: actor.branchId } },
          select: { qty: true, warehouse: { select: { kind: true } } },
        },
      },
      orderBy: { sku: "asc" },
    });
    const rows = variants.map((v) => {
      const home = quantity(
        v.warehouseStocks
          .filter((s) => s.warehouse.kind === "home")
          .reduce((sum, s) => sum.plus(s.qty), d(0)),
      );
      const total = quantity(
        v.warehouseStocks.reduce((sum, s) => sum.plus(s.qty), d(0)),
      );
      return {
        variantId: v.id,
        sku: v.sku,
        product: v.product.name,
        store: v.stock,
        home,
        total,
        valueAtCost: d(total).times(v.costAvg).toFixed(2),
      };
    });
    return safe(rows, actor);
  }

  @Get("inventory/transfers")
  @Permit("catalog:read")
  async transfers(@CurrentUser() actor: Actor) {
    return safe(
      await this.db.stockTransfer.findMany({
        where: { branchId: actor.branchId },
        include: {
          from: true,
          to: true,
          lines: { include: { variant: { include: { product: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      actor,
    );
  }

  @Post("inventory/transfers")
  @RequireTerminal()
  @Permit("*")
  async transfer(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const input = parse(transferSchema, body);
    if (input.fromId === input.toId) bad("Elige dos almacenes diferentes.");
    await assertWholeUnits(this.db, actor.branchId, input.lines);
    const keys = input.lines.map((l) => `${l.variantId}:${l.lotId ?? ""}`);
    if (new Set(keys).size !== keys.length)
      bad("Hay productos o lotes repetidos.");
    return retrySerializable(() =>
      this.db.$transaction(
        async (tx) => {
          // Serializa los reenvíos aun cuando lleguen al mismo tiempo.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.operationId}))`;
          const previous = await tx.stockTransfer.findUnique({
            where: tenantUnique("operationId", input.operationId),
            include: { lines: true },
          });
          if (previous) {
            const same =
              previous.branchId === actor.branchId &&
              previous.userId === actor.id &&
              previous.fromId === input.fromId &&
              previous.toId === input.toId &&
              previous.reason === input.reason &&
              JSON.stringify(
                previous.lines
                  .map((l) => [l.variantId, l.lotId, Number(l.qty).toFixed(3)])
                  .sort(),
              ) ===
                JSON.stringify(
                  input.lines
                    .map((l) => [
                      l.variantId,
                      l.lotId ?? null,
                      l.qty.toFixed(3),
                    ])
                    .sort(),
                );
            if (!same)
              conflict(
                "Esta clave de operación ya corresponde a otro traspaso.",
              );
            return { id: previous.id, repeated: true };
          }
          const warehouses = await tx.warehouse.findMany({
            where: {
              id: { in: [input.fromId, input.toId] },
              branchId: actor.branchId,
              active: true,
            },
          });
          if (warehouses.length !== 2) bad("Almacén inválido o inactivo.");
          const from = warehouses.find((w) => w.id === input.fromId)!;
          const to = warehouses.find((w) => w.id === input.toId)!;
          const transfer = await tx.stockTransfer.create({
            data: {
              id: randomUUID(),
              operationId: input.operationId,
              branchId: actor.branchId,
              fromId: from.id,
              toId: to.id,
              reason: input.reason,
              userId: actor.id,
            },
          });
          for (const line of [...input.lines].sort(
            (a, b) =>
              a.variantId.localeCompare(b.variantId) ||
              (a.lotId ?? "").localeCompare(b.lotId ?? ""),
          )) {
            const variant = await lockVariant(tx, line.variantId, actor);
            const sourceStock = from.sellable
              ? Number(variant.stock)
              : Number(
                  (
                    await tx.variantStock.findUnique({
                      where: {
                        variantId_warehouseId: {
                          variantId: variant.id,
                          warehouseId: from.id,
                        },
                      },
                    })
                  )?.qty ?? 0,
                );
            if (sourceStock < line.qty)
              bad(
                "No hay suficiente existencia en " +
                  from.name +
                  " para " +
                  variant.product.name +
                  ".",
              );
            const sourceLots = from.sellable
              ? Number(
                  (
                    await tx.lot.aggregate({
                      where: { variantId: variant.id },
                      _sum: { qty: true },
                    })
                  )._sum.qty ?? 0,
                )
              : Number(
                  (
                    await tx.lotStock.aggregate({
                      where: {
                        warehouseId: from.id,
                        lot: { variantId: variant.id },
                      },
                      _sum: { qty: true },
                    })
                  )._sum.qty ?? 0,
                );
            if (line.lotId) {
              const lot = await tx.lot.findFirst({
                where: {
                  id: line.lotId,
                  variantId: variant.id,
                  branchId: actor.branchId,
                },
              });
              if (!lot) bad("El lote no pertenece al producto.");
              const lotQty = from.sellable
                ? Number(lot.qty)
                : Number(
                    (
                      await tx.lotStock.findUnique({
                        where: {
                          lotId_warehouseId: {
                            lotId: lot.id,
                            warehouseId: from.id,
                          },
                        },
                      })
                    )?.qty ?? 0,
                  );
              if (lotQty < line.qty)
                bad("Stock insuficiente en el lote de origen.");
              if (from.sellable)
                await tx.lot.update({
                  where: { id: lot.id },
                  data: { qty: { decrement: line.qty } },
                });
              else
                await tx.lotStock.update({
                  where: {
                    lotId_warehouseId: { lotId: lot.id, warehouseId: from.id },
                  },
                  data: { qty: { decrement: line.qty } },
                });
              if (to.sellable)
                await tx.lot.update({
                  where: { id: lot.id },
                  data: { qty: { increment: line.qty } },
                });
              else
                await tx.lotStock.upsert({
                  where: {
                    lotId_warehouseId: { lotId: lot.id, warehouseId: to.id },
                  },
                  create: { lotId: lot.id, warehouseId: to.id, qty: line.qty },
                  update: { qty: { increment: line.qty } },
                });
            } else if (
              variant.product.category.requiresLot ||
              variant.product.category.requiresExpiry ||
              sourceStock - sourceLots < line.qty
            ) {
              bad("Selecciona el lote de la mercancía que quieres mover.");
            }
            const movement = async (
              warehouseId: string,
              qty: number,
              balanceAfter: number,
              type: string,
            ) =>
              tx.inventoryMovement.create({
                data: {
                  variantId: variant.id,
                  lotId: line.lotId,
                  warehouseId,
                  type,
                  qty,
                  unitCost: variant.costAvg,
                  balanceAfter,
                  refId: transfer.id,
                  reason: input.reason,
                  userId: actor.id,
                  branchId: actor.branchId,
                },
              });
            if (from.sellable)
              await stockChange(
                tx,
                actor,
                variant,
                -line.qty,
                "transfer_out",
                input.reason,
                transfer.id,
                line.lotId,
              );
            else {
              const after = quantity(d(sourceStock).minus(line.qty));
              await tx.variantStock.update({
                where: {
                  variantId_warehouseId: {
                    variantId: variant.id,
                    warehouseId: from.id,
                  },
                },
                data: { qty: after },
              });
              await movement(from.id, -line.qty, after, "transfer_out");
            }
            if (to.sellable)
              await stockChange(
                tx,
                actor,
                variant,
                line.qty,
                "transfer_in",
                input.reason,
                transfer.id,
                line.lotId,
              );
            else {
              const destination = await tx.variantStock.upsert({
                where: {
                  variantId_warehouseId: {
                    variantId: variant.id,
                    warehouseId: to.id,
                  },
                },
                create: {
                  variantId: variant.id,
                  warehouseId: to.id,
                  qty: line.qty,
                },
                update: { qty: { increment: line.qty } },
              });
              await movement(
                to.id,
                line.qty,
                Number(destination.qty),
                "transfer_in",
              );
            }
            await tx.stockTransferLine.create({
              data: {
                id: randomUUID(),
                transferId: transfer.id,
                variantId: variant.id,
                lotId: line.lotId,
                qty: line.qty,
              },
            });
          }
          await audit(
            tx,
            actor,
            "stock_transfer",
            "stock_transfer",
            transfer.id,
            undefined,
            {
              fromId: from.id,
              toId: to.id,
              lines: input.lines,
              reason: input.reason,
            },
          );
          return { id: transfer.id, repeated: false };
        },
        { isolationLevel: "Serializable" },
      ),
    );
  }
}

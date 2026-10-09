import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import ExcelJS from "exceljs";
import {
  businessDate,
  can,
  expired,
  weightedCost,
  landedCosts,
  quantity,
  money,
  moneyAmount,
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
  cost,
  reason,
  audit,
  bad,
  denied,
  safe,
  json,
  qty,
} from "./common";
import {
  isSerializationConflict,
  lotIdentity,
  reconcileLotExpiry,
  retrySerializable,
} from "./inventory-resilience";

// Unidades que la venta no toma (paso 04): lotes vencidos según la fecha de
// Santo Domingo, o sin vencimiento cuando la categoría lo exige.
export const unsellableLot = (
  lot: { expiryDate: Date | string | null },
  category: { requiresExpiry: boolean },
) => expired(lot.expiryDate) || (category.requiresExpiry && !lot.expiryDate);
export const expiredQty = (
  lots: { qty: unknown; expiryDate: Date | string | null }[],
  category: { requiresExpiry: boolean },
) =>
  quantity(
    lots
      .filter((l) => Number(l.qty) > 0 && unsellableLot(l, category))
      .reduce((sum, l) => sum.plus(String(l.qty)), d(0)),
  );

// Documento del proveedor y condición de pago (paso 35). Todo es opcional
// para no frenar la recepción; un texto vacío o null borra el dato.
export const documentSchema = z.object({
  supplierInvoice: z.string().max(60).nullish(),
  supplierNcf: z.string().max(30).nullish(),
  invoiceDate: z.string().max(30).nullish(),
  paymentType: z.enum(["cash", "credit"]).nullish(),
  creditDays: z.number().int().min(0).max(365).nullish(),
  itbis: moneyAmount(100000000, true).nullish(),
});
type DocumentInput = z.infer<typeof documentSchema>;
const DOCUMENT_KEYS = [
  "supplierInvoice",
  "supplierNcf",
  "invoiceDate",
  "paymentType",
  "creditDays",
  "itbis",
] as const;
type DocumentFields = {
  supplierInvoice: string | null;
  supplierNcf: string | null;
  invoiceDate: Date | null;
  paymentType: string | null;
  creditDays: number | null;
  itbis: number | null;
};
/**
 * Mezcla el documento enviado con el actual (o heredado) y lo normaliza:
 * NCF en mayúsculas sin espacios (B + 10 dígitos o e-CF E + 12), fecha del
 * día de la factura (no futura), contado sin días y crédito con el plazo del
 * proveedor si no se indica otro.
 */
export function documentData(
  input: DocumentInput,
  base: Partial<Record<(typeof DOCUMENT_KEYS)[number], unknown>> = {},
  termsDays?: number,
): DocumentFields {
  const text = (v: string | null | undefined) => v?.trim() || null;
  const doc: any = {};
  for (const key of DOCUMENT_KEYS) doc[key] = base[key] ?? null;
  if (doc.itbis !== null) doc.itbis = Number(doc.itbis);
  if (input.supplierInvoice !== undefined)
    doc.supplierInvoice = text(input.supplierInvoice);
  if (input.supplierNcf !== undefined) {
    const ncf = text(input.supplierNcf)?.replace(/[\s-]/g, "").toUpperCase();
    if (ncf && !/^(B\d{10}|E\d{12})$/.test(ncf))
      bad(
        "NCF del proveedor inválido: B + 10 dígitos (B0100000123) o E + 12 dígitos (E310000000123).",
      );
    doc.supplierNcf = ncf || null;
  }
  if (input.invoiceDate !== undefined) {
    const day = text(input.invoiceDate)?.slice(0, 10);
    const date = day ? new Date(day + "T12:00:00.000Z") : null;
    if (day && (!date || date.toISOString().slice(0, 10) !== day))
      bad("Fecha de la factura inválida. Usa AAAA-MM-DD.");
    if (day && day > businessDate())
      bad("La fecha de la factura no puede ser futura.");
    doc.invoiceDate = date;
  }
  if (input.paymentType !== undefined) doc.paymentType = input.paymentType;
  if (input.creditDays !== undefined) doc.creditDays = input.creditDays;
  if (input.itbis !== undefined) doc.itbis = input.itbis;
  if (!doc.paymentType && termsDays !== undefined)
    doc.paymentType = termsDays > 0 ? "credit" : "cash";
  if (doc.paymentType === "cash") doc.creditDays = null;
  else if (doc.paymentType === "credit" && doc.creditDays === null)
    doc.creditDays = termsDays ?? null;
  return doc;
}

// Unidades dañadas o rechazadas por línea al recibir (paso 36): no entran al
// stock, cierran lo pendiente y quedan con motivo y costo.
export const damageFields = {
  damagedQty: countedQty().default(0),
  damageReason: z.string().trim().max(200).optional(),
};
export function checkDamage(line: {
  qty: number;
  damagedQty: number;
  damageReason?: string;
}) {
  if (!(line.qty > 0) && !(line.damagedQty > 0))
    bad("Cada línea necesita unidades recibidas o dañadas.");
  if (line.damagedQty > 0 && (line.damageReason?.length ?? 0) < 3)
    bad("Indica el motivo de las unidades dañadas o rechazadas.");
  if (!(line.damagedQty > 0)) delete line.damageReason;
}
/**
 * Costo final de cada línea: el flete y otros costos se reparten sólo entre
 * las unidades buenas; una línea sin unidades buenas conserva su costo.
 */
export function receiptCosts(
  lines: { qty: number; cost: number }[],
  additional: number,
  by: "value" | "units",
) {
  const good = lines.flatMap((l, i) => (l.qty > 0 ? [i] : []));
  if (!good.length && additional > 0)
    bad(
      "No hay unidades buenas entre las que repartir el flete y otros costos.",
    );
  const costs = good.length
    ? landedCosts(
        good.map((i) => lines[i]),
        additional,
        by,
      )
    : [];
  return lines.map((l, i) =>
    l.qty > 0 ? costs[good.indexOf(i)] : money(l.cost),
  );
}
export const damagedCostOf = (line: { damagedQty: number; cost: number }) =>
  money(d(line.damagedQty).times(line.cost));

// Historial de recepciones: lo ven quienes compran o mueven mercancía.
function receiptAccess(actor: Actor) {
  if (
    actor.role === "seller" ||
    (!can(actor.permissions, "purchase:write") &&
      !can(actor.permissions, "inventory:write"))
  )
    denied();
}
const seesCost = (actor: Actor) =>
  actor.role !== "seller" && can(actor.permissions, "profit:read");
// Período por la fecha de la factura (como el 606) o, si falta, la de recepción.
function receiptPeriod(query: Record<string, string>) {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (
    (query.from && !day.test(query.from)) ||
    (query.to && !day.test(query.to))
  )
    bad("Usa fechas AAAA-MM-DD.");
  if (!query.from && !query.to) return {};
  const range = {
    ...(query.from ? { gte: new Date(query.from + "T00:00:00-04:00") } : {}),
    ...(query.to ? { lte: new Date(query.to + "T23:59:59.999-04:00") } : {}),
  };
  return {
    OR: [{ invoiceDate: range }, { invoiceDate: null, createdAt: range }],
  };
}
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Recepción legible: proveedor, documento, quién recibió, líneas y dañados.
async function describeReceipts(db: any, rows: any[], actor: Actor) {
  const ids = (values: unknown[]) => [
    ...new Set(
      values.filter(
        (v): v is string => typeof v === "string" && UUID_RE.test(v),
      ),
    ),
  ];
  const supplierOf = (r: any) => r.supplierId ?? r.order?.supplierId ?? null;
  const [suppliers, users, variants] = await Promise.all([
    db.supplier.findMany({ where: { id: { in: ids(rows.map(supplierOf)) } } }),
    db.user.findMany({
      where: { id: { in: ids(rows.map((r) => r.userId)) } },
      select: { id: true, name: true },
    }),
    db.variant.findMany({
      where: {
        id: {
          in: ids(
            rows.flatMap((r) => (r.items as any[]).map((l) => l.variantId)),
          ),
        },
      },
      include: { product: true },
    }),
  ]);
  const cost = seesCost(actor);
  return rows.map((r) => {
    const supplier = suppliers.find((s: any) => s.id === supplierOf(r));
    const lines = (r.items as any[]).map((l) => {
      const v = variants.find((v: any) => v.id === l.variantId);
      const unitCost = Number(l.unitCost ?? l.cost ?? 0);
      return {
        variantId: l.variantId,
        name: v?.product.name ?? l.quick?.name ?? "Producto",
        sku: v?.sku ?? null,
        attributes: v?.attributes ?? {},
        qty: Number(l.qty),
        damagedQty: Number(l.damagedQty ?? 0),
        damageReason: l.damageReason ?? null,
        lotNumber: l.lotNumber ?? null,
        expiryDate: l.expiryDate ?? null,
        ...(cost
          ? {
              unitCost,
              landedCost: Number(l.landedCost ?? unitCost),
              damagedCost: Number(l.damagedCost ?? 0),
            }
          : {}),
      };
    });
    const goods = money(
      lines.reduce(
        (s, l, i) =>
          s.plus(
            d(l.qty).times(
              (r.items as any[])[i].unitCost ?? (r.items as any[])[i].cost ?? 0,
            ),
          ),
        d(0),
      ),
    );
    return {
      id: r.id,
      createdAt: r.createdAt,
      orderId: r.orderId,
      orderNumber: r.order?.number ?? null,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      supplierLegalId: supplier?.legalId ?? null,
      supplierInvoice: r.supplierInvoice,
      supplierNcf: r.supplierNcf,
      invoiceDate: r.invoiceDate,
      paymentType: r.paymentType,
      creditDays: r.creditDays,
      itbis: r.itbis == null ? null : Number(r.itbis),
      // Documento del proveedor frente a lo aceptado (R9-A03).
      invoiceTotal: r.invoiceTotal == null ? null : Number(r.invoiceTotal),
      invoiceDifference: Number(r.invoiceDifference ?? 0),
      goods,
      freight: Number(r.freight),
      otherCosts: Number(r.otherCosts),
      total:
        r.total == null
          ? money(d(goods).plus(r.freight).plus(r.otherCosts))
          : Number(r.total),
      ...(cost ? { damagedCost: Number(r.damagedCost ?? 0) } : {}),
      attachmentId: r.attachmentId,
      userId: r.userId,
      userName: users.find((u: any) => u.id === r.userId)?.name ?? null,
      units: quantity(lines.reduce((s, l) => s.plus(l.qty), d(0))),
      damagedUnits: quantity(
        lines.reduce((s, l) => s.plus(l.damagedQty), d(0)),
      ),
      lines,
    };
  });
}
const paymentLabel = (r: {
  paymentType: string | null;
  creditDays: number | null;
}) =>
  r.paymentType === "cash"
    ? "Contado"
    : r.paymentType === "credit"
      ? "Crédito" + (r.creditDays ? " " + r.creditDays + " días" : "")
      : "";

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
      if (unsellableLot(lot, variant.product.category)) continue;
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
    const rows = await this.db.variant.findMany({
      where: { branchId: actor.branchId, active: true },
      include: { product: { include: { category: true } }, lots: true },
      orderBy: { sku: "asc" },
    });
    // `stock` es lo físico (para contar); lo vencido y lo vendible aparte.
    return safe(
      rows.map((v) => {
        const blocked = expiredQty(v.lots, v.product.category);
        return {
          ...v,
          expiredStock: String(blocked),
          sellableStock: String(quantity(d(v.stock).minus(blocked))),
        };
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
    const parsed = parse(
      z.object({
        variantId: uuid,
        qty: signedStockQty(),
        reason,
        lotId: uuid.optional(),
        lotNumber: z.string().trim().min(1).max(120).optional(),
        expiryDate: z.string().datetime().optional(),
        type: z
          .enum(["adjustment", "waste", "supplier_return"])
          .default("adjustment"),
      }),
      body,
    );
    const data = parsed.lotNumber
      ? { ...parsed, ...lotIdentity(parsed.lotNumber, parsed.expiryDate) }
      : parsed;
    return retrySerializable(() =>
      this.db.$transaction(
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
              const identity = lotIdentity(data.lotNumber, data.expiryDate);
              const existingLot = await tx.lot.findUnique({
                where: {
                  variantId_lotNumberNormalized: {
                    variantId: variant.id,
                    lotNumberNormalized: identity.lotNumberNormalized,
                  },
                },
              });
              const reconciled = reconcileLotExpiry(
                existingLot?.expiryDate,
                identity.expiryDate,
              );
              if (reconciled.conflict)
                bad("Ese lote ya tiene un vencimiento diferente.");
              if (existingLot && expired(reconciled.expiryDate))
                bad("No puedes aumentar un lote vencido.");
              const lot = await tx.lot.upsert({
                where: {
                  variantId_lotNumberNormalized: {
                    variantId: variant.id,
                    lotNumberNormalized: identity.lotNumberNormalized,
                  },
                },
                create: {
                  variantId: variant.id,
                  ...identity,
                  qty: data.qty,
                  cost: variant.costAvg,
                  branchId: actor.branchId,
                },
                update: {
                  qty: { increment: data.qty },
                  expiryDate: reconciled.expiryDate,
                },
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
      ),
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
    const { items, supplierId, expectedDate, ...document } = parse(
      documentSchema.extend({
        supplierId: uuid,
        expectedDate: z.string().datetime().optional(),
        items: z
          .array(z.object({ variantId: uuid, qty, unitCost: cost }))
          .min(1)
          .max(200),
      }),
      body,
    );
    const data = { items, supplierId, expectedDate };
    if (new Set(data.items.map((i) => i.variantId)).size !== data.items.length)
      bad("Agrupa las cantidades por variante.");
    return this.db.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirstOrThrow({
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
          ...documentData(document, {}, supplier.paymentTermsDays),
          createdBy: actor.id,
          branchId: actor.branchId,
        },
        include: { items: true },
      });
      await audit(tx, actor, "create", "purchase", row.id, undefined, row);
      return safe(row, actor);
    });
  }
  // Completar después la factura, el NCF o la condición de pago de la orden.
  @Patch("purchase-orders/:id/document")
  @Permit("purchase:write")
  async orderDocument(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const input = parse(documentSchema, body);
    return this.db.$transaction(async (tx) => {
      const before = await tx.purchaseOrder.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      const supplier = await tx.supplier.findUnique({
        where: { id: before.supplierId },
      });
      const row = await tx.purchaseOrder.update({
        where: { id: before.id },
        data: documentData(input, before, supplier?.paymentTermsDays),
        include: { items: true },
      });
      await audit(tx, actor, "order_document", "purchase", id, before, row);
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
    const { operationId, freight, otherCosts, allocation, items, ...document } =
      parse(
        documentSchema.extend({
          // Id de la recepción, creado al abrir el formulario: si se pierde la
          // respuesta y se reenvía, no se recibe dos veces (R9-facturas-8).
          operationId: uuid,
          freight: amount.default(0),
          otherCosts: amount.default(0),
          allocation: z.enum(["value", "units"]).default("value"),
          items: z
            .array(
              z.object({
                itemId: uuid,
                // Unidades buenas: 0 si toda la línea llegó dañada.
                qty: countedQty(),
                ...damageFields,
                lotNumber: z.string().trim().min(1).max(120).optional(),
                expiryDate: z.string().datetime().optional(),
              }),
            )
            .min(1),
        }),
        body,
      );
    const data = {
      operationId,
      freight,
      otherCosts,
      allocation,
      items: items.map((item) =>
        item.lotNumber
          ? {
              ...item,
              ...lotIdentity(item.lotNumber, item.expiryDate),
              expiryDate: lotIdentity(
                item.lotNumber,
                item.expiryDate,
              ).expiryDate?.toISOString(),
            }
          : item.expiryDate
            ? { ...item, expiryDate: new Date(item.expiryDate).toISOString() }
            : item,
      ),
    };
    if (new Set(data.items.map((i) => i.itemId)).size !== data.items.length)
      bad("No repitas líneas de recepción.");
    data.items.forEach(checkDamage);
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
      const costs = receiptCosts(
        stored.map((l) => ({ qty: Number(l.qty), cost: Number(l.cost) })),
        money(d(data.freight).plus(data.otherCosts)),
        data.allocation,
      );
      // El documento no se compara: se puede completar después.
      return data.items.every(
        (item, i) =>
          stored[i].itemId === item.itemId &&
          Number(stored[i].qty) === item.qty &&
          Number(stored[i].damagedQty ?? 0) === item.damagedQty &&
          (stored[i].damageReason ?? null) === (item.damageReason ?? null) &&
          (stored[i].lotNumber ?? null) === (item.lotNumber ?? null) &&
          (stored[i].expiryDate ?? null) === (item.expiryDate ?? null) &&
          Number(stored[i].landedCost) === costs[i],
      );
    };
    const execute = () =>
      this.db.$transaction(
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
          // Pedido = recibido bueno + dañado/rechazado + pendiente.
          const lines = data.items.map((item) => {
            const ordered = order.items.find((i) => i.id === item.itemId);
            if (
              !ordered ||
              d(ordered.receivedQty)
                .plus(ordered.damagedQty)
                .plus(item.qty)
                .plus(item.damagedQty)
                .gt(ordered.qty)
            )
              bad("Cantidad mayor que lo pendiente.");
            return {
              ...item,
              variantId: ordered.variantId,
              cost: Number(ordered.unitCost),
            };
          });
          const costs = receiptCosts(
            lines,
            money(d(data.freight).plus(data.otherCosts)),
            data.allocation,
          );
          const supplier = await tx.supplier.findUnique({
            where: { id: order.supplierId },
          });
          const receipt = await tx.goodsReceipt.create({
            data: {
              orderId: id,
              operationId: data.operationId,
              supplierId: order.supplierId,
              // Lo que se debe: unidades buenas, flete y otros costos.
              total: money(
                lines.reduce((sum, l) => sum + l.qty * l.cost, 0) +
                  data.freight +
                  data.otherCosts,
              ),
              freight: data.freight,
              otherCosts: data.otherCosts,
              damagedCost: money(
                lines.reduce((sum, l) => sum.plus(damagedCostOf(l)), d(0)),
              ),
              // Sin condición propia, la de la orden (o el plazo del proveedor).
              ...documentData(
                document,
                {
                  paymentType: order.paymentType,
                  creditDays: order.creditDays,
                },
                supplier?.paymentTermsDays,
              ),
              items: json(
                lines.map((line, i) => ({
                  ...line,
                  landedCost: costs[i],
                  damagedCost: damagedCostOf(line),
                })),
              ),
              userId: actor.id,
              branchId: actor.branchId,
            },
          });
          for (const [index, line] of [...lines]
            .sort((a, b) => a.variantId.localeCompare(b.variantId))
            .map((line) => [lines.indexOf(line), line] as const)) {
            // Lo dañado no entra al stock: sólo cierra lo pendiente de la orden.
            if (!(line.qty > 0)) {
              await tx.purchaseItem.update({
                where: { id: line.itemId },
                data: { damagedQty: { increment: line.damagedQty } },
              });
              continue;
            }
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
              const identity = lotIdentity(line.lotNumber, line.expiryDate);
              const existingLot = await tx.lot.findUnique({
                where: {
                  variantId_lotNumberNormalized: {
                    variantId: variant.id,
                    lotNumberNormalized: identity.lotNumberNormalized,
                  },
                },
              });
              const reconciled = reconcileLotExpiry(
                existingLot?.expiryDate,
                identity.expiryDate,
              );
              if (reconciled.conflict)
                bad("Ese lote ya tiene un vencimiento diferente.");
              if (existingLot && expired(reconciled.expiryDate))
                bad("No puedes recibir existencias en un lote vencido.");
              const lot = await tx.lot.upsert({
                where: {
                  variantId_lotNumberNormalized: {
                    variantId: variant.id,
                    lotNumberNormalized: identity.lotNumberNormalized,
                  },
                },
                create: {
                  variantId: variant.id,
                  ...identity,
                  qty: line.qty,
                  cost: costs[index],
                  branchId: actor.branchId,
                },
                update: {
                  qty: { increment: line.qty },
                  expiryDate: reconciled.expiryDate,
                },
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
              data: {
                receivedQty: { increment: line.qty },
                damagedQty: { increment: line.damagedQty },
              },
            });
          }
          const items = await tx.purchaseItem.findMany({
            where: { orderId: id },
          });
          await tx.purchaseOrder.update({
            where: { id },
            data: {
              status: items.every((i) =>
                d(i.receivedQty).plus(i.damagedQty).gte(i.qty),
              )
                ? "received"
                : "partial",
            },
          });
          await audit(tx, actor, "receive", "purchase", id, undefined, receipt);
          return safe(receipt, actor);
        },
        { isolationLevel: "Serializable", timeout: 15000 },
      );
    // PostgreSQL puede abortar una de dos transacciones serializables aunque
    // ambas representen exactamente la misma recepción. La segunda petición
    // debe recuperar el resultado confirmado, no exponer P2010/40001 como 500.
    return retrySerializable(async () => {
      try {
        return await execute();
      } catch (error) {
        if (!isSerializationConflict(error)) throw error;
        const prior = await this.db.goodsReceipt.findUnique({
          where: { operationId: data.operationId },
        });
        if (prior) {
          if (!sameRequest(prior, parse(uuid, id)))
            bad("UUID usado con datos distintos.");
          return safe(prior, actor);
        }
        throw error;
      }
    });
  }
  // Historial de recepciones (paso 37): las últimas 50 o las de un período.
  @Get("goods-receipts")
  @Permit("catalog:read")
  async receipts(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
  ) {
    receiptAccess(actor);
    const period = receiptPeriod(query);
    const rows = await this.db.goodsReceipt.findMany({
      where: {
        branchId: actor.branchId,
        ...period,
        ...(query.supplierId
          ? { supplierId: parse(uuid, query.supplierId) }
          : {}),
      },
      include: { order: { select: { number: true, supplierId: true } } },
      orderBy: { createdAt: "desc" },
      take: "OR" in period ? 2000 : 50,
    });
    return safe(await describeReceipts(this.db, rows, actor), actor);
  }
  // Compras del período en Excel para la contable (prepara el 606).
  @Get("goods-receipts/export")
  @Permit("reports:read")
  async exportReceipts(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const rows = await describeReceipts(
      this.db,
      await this.db.goodsReceipt.findMany({
        where: { branchId: actor.branchId, ...receiptPeriod(query) },
        include: { order: { select: { number: true, supplierId: true } } },
        orderBy: { createdAt: "asc" },
        take: 5000,
      }),
      actor,
    );
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Compras");
    sheet.columns = [
      ["Fecha factura", 14],
      ["Fecha recepción", 16],
      ["Proveedor", 30],
      ["RNC", 14],
      ["Factura", 14],
      ["NCF", 16],
      ["Condición", 16],
      ["Orden", 12],
      ["Mercancía", 13],
      ["Flete", 11],
      ["Otros cargos", 13],
      ["ITBIS", 11],
      ["Total", 13],
      ["Dañado o rechazado", 18],
      ["Total factura", 14],
      ["Diferencia reconocida", 20],
      ["Recibió", 20],
      ["Observación", 24],
    ].map(([header, width]) => ({
      header: String(header),
      width: Number(width),
    }));
    sheet.getRow(1).font = { bold: true };
    for (const r of rows)
      sheet.addRow([
        r.invoiceDate ? businessDate(r.invoiceDate) : null,
        businessDate(r.createdAt),
        r.supplierName,
        r.supplierLegalId,
        r.supplierInvoice,
        r.supplierNcf,
        paymentLabel(r) || null,
        r.orderNumber,
        r.goods,
        r.freight,
        r.otherCosts,
        r.itbis,
        r.total,
        (r as any).damagedCost || null,
        r.invoiceTotal,
        r.invoiceDifference || null,
        r.userName,
        [
          !r.supplierName && "Sin proveedor",
          !r.supplierNcf && "Falta NCF",
          !r.invoiceDate && "Falta fecha de factura",
        ]
          .filter(Boolean)
          .join(" · ") || null,
      ]);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="compras-${query.from || "inicio"}-${query.to || businessDate()}.xlsx"`,
    );
    res.end(Buffer.from(await book.xlsx.writeBuffer()));
  }
  // Abrir una recepción: su comprobante.
  @Get("goods-receipts/:id")
  @Permit("catalog:read")
  async receiptDetail(@Param("id") id: string, @CurrentUser() actor: Actor) {
    receiptAccess(actor);
    const row = await this.db.goodsReceipt.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
      include: { order: { select: { number: true, supplierId: true } } },
    });
    return safe((await describeReceipts(this.db, [row], actor))[0], actor);
  }
  // Completar después el documento del proveedor de una recepción.
  @Patch("goods-receipts/:id/document")
  @Permit("catalog:read")
  async receiptDocument(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    receiptAccess(actor);
    const input = parse(documentSchema, body);
    return this.db.$transaction(async (tx) => {
      const before = await tx.goodsReceipt.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
        include: { order: { select: { number: true, supplierId: true } } },
      });
      const supplierId = before.supplierId ?? before.order?.supplierId;
      const supplier = supplierId
        ? await tx.supplier.findUnique({ where: { id: supplierId } })
        : null;
      const row = await tx.goodsReceipt.update({
        where: { id: before.id },
        data: documentData(input, before, supplier?.paymentTermsDays),
        include: { order: { select: { number: true, supplierId: true } } },
      });
      await audit(
        tx,
        actor,
        "receipt_document",
        "goods_receipt",
        row.id,
        documentData({}, before),
        documentData({}, row),
      );
      return safe((await describeReceipts(tx, [row], actor))[0], actor);
    });
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
    return retrySerializable(() =>
      this.db.$transaction(
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
      ),
    );
  }
}

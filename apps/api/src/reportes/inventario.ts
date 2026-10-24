import { Prisma } from "@prisma/client";
import type { Actor } from "../common";
import { COUNT_CORRECTION_SQL, INVENTORY_LOSS_SQL } from "../inventory";
import { local, num, utc, type Range, type ReportDef } from "./base";

// Unidades vendidas netas (menos lo devuelto) por variante en el período.
const sold = (actor: Actor, range: Range) =>
  Prisma.sql`SELECT i."variantId", SUM(i.qty - i."returnedQty") AS units, MAX(s."createdAt") AS last FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" WHERE s."branchId" = ${actor.branchId} AND s.status = 'completed' AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)} GROUP BY 1`;
// Existencia en Casa (Tienda es Variant.stock).
const home = Prisma.sql`COALESCE((SELECT SUM(vs.qty) FROM "VariantStock" vs JOIN "Warehouse" w ON w.id = vs."warehouseId" WHERE vs."variantId" = v.id AND w.kind = 'home'), 0)`;
const days = (range: Range) =>
  Math.max(1, Math.round((+range.lte - +range.gte) / 86400000));
const day = (column: Prisma.Sql) =>
  Prisma.sql`to_char(${local(column)}, 'YYYY-MM-DD')`;

async function warehouseLabels(db: any, actor: Actor) {
  const warehouses: { kind: string; name: string }[] = await db.warehouse.findMany({
    where: { branchId: actor.branchId, active: true, kind: { in: ["store", "home"] } },
    select: { kind: true, name: true },
    orderBy: { name: "asc" },
  });
  const store = warehouses.find((warehouse) => warehouse.kind === "store")?.name || "Almacén principal";
  const homes = warehouses.filter((warehouse) => warehouse.kind === "home").map((warehouse) => warehouse.name);
  const home = homes.length === 1 ? homes[0] : homes.length > 1 ? homes.join(" + ") : "Otros almacenes";
  // Los nombres son configurables. No pueden pisar claves fijas como SKU o Mínimo.
  return {
    store: `Existencia en ${store}`,
    home: `Existencia en ${home === store ? `${home} (auxiliar)` : home}`,
  };
}

export const inventario: Record<string, ReportDef> = {
  "rotacion-producto": {
    title: "Rotación por producto",
    group: "Inventario",
    async run(db, actor, range) {
      // Stock al inicio y al final del período: el actual menos los
      // movimientos posteriores (los traspasos Casa↔Tienda se anulan).
      const rows: any[] = await db.$queryRaw`
        SELECT v.sku, p.name, c.name AS category, COALESCE(x.units, 0) AS units,
          v.stock + ${home} - COALESCE((SELECT SUM(m.qty) FROM "InventoryMovement" m WHERE m."variantId" = v.id AND m."createdAt" >= ${utc(range.gte)}), 0) AS start,
          v.stock + ${home} - COALESCE((SELECT SUM(m.qty) FROM "InventoryMovement" m WHERE m."variantId" = v.id AND m."createdAt" > ${utc(range.lte)}), 0) AS "end"
        FROM "Variant" v JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        LEFT JOIN (${sold(actor, range)}) x ON x."variantId" = v.id
        WHERE v."branchId" = ${actor.branchId} AND (v.active OR x.units IS NOT NULL)
        ORDER BY COALESCE(x.units, 0) DESC, p.name`;
      return rows.map((r) => {
        const average = (Number(r.start) + Number(r.end)) / 2;
        return {
          SKU: r.sku,
          Producto: r.name,
          Categoría: r.category,
          Vendidas: num(r.units),
          "Stock inicial": num(r.start),
          "Stock final": num(r.end),
          "Stock promedio": num(average),
          Rotación: average > 0 ? num(Number(r.units) / average) : null,
        };
      });
    },
  },
  "dias-inventario": {
    title: "Días de inventario restantes",
    group: "Inventario",
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        SELECT v.sku, p.name, c.name AS category, v.stock AS store, ${home} AS home, x.units
        FROM "Variant" v JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        JOIN (${sold(actor, range)}) x ON x."variantId" = v.id
        WHERE v."branchId" = ${actor.branchId} AND x.units > 0`;
      const n = days(range);
      const labels = await warehouseLabels(db, actor);
      return rows
        .map((r) => {
          const total = Number(r.store) + Number(r.home);
          const rate = Number(r.units) / n;
          return {
            SKU: r.sku,
            Producto: r.name,
            Categoría: r.category,
            [labels.store]: num(r.store),
            [labels.home]: num(r.home),
            "Stock total": num(total),
            "Vendidas en el período": num(r.units),
            "Venta diaria": num(rate),
            "Días restantes": Math.max(0, Math.floor(total / rate)),
          };
        })
        .sort((a, b) => a["Días restantes"] - b["Días restantes"]);
    },
  },
  "sin-movimiento": {
    title: "Sin movimiento 30/60/90 días",
    group: "Inventario",
    async run(db, actor, range) {
      // Días sin vender al cierre del período; si nunca se vendió, desde que
      // se creó el producto.
      const rows: any[] = await db.$queryRaw`
        SELECT v.sku, p.name, c.name AS category, v.stock AS store, ${home} AS home,
          ${day(Prisma.sql`x.last`)} AS last,
          floor(extract(epoch FROM (${utc(range.lte)} - COALESCE(x.last, v."createdAt"))) / 86400) AS idle
        FROM "Variant" v JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        LEFT JOIN (SELECT i."variantId", MAX(s."createdAt") AS last FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" WHERE s."branchId" = ${actor.branchId} AND s.status = 'completed' AND s."createdAt" <= ${utc(range.lte)} GROUP BY 1) x ON x."variantId" = v.id
        WHERE v."branchId" = ${actor.branchId} AND v.active AND v.stock + ${home} > 0
          AND COALESCE(x.last, v."createdAt") <= ${utc(range.lte)} - interval '30 days'
        ORDER BY idle DESC, p.name`;
      const labels = await warehouseLabels(db, actor);
      return rows.map((r) => {
        const idle = Number(r.idle);
        return {
          SKU: r.sku,
          Producto: r.name,
          Categoría: r.category,
          [labels.store]: num(r.store),
          [labels.home]: num(r.home),
          "Última venta": r.last ?? "Nunca",
          "Días sin vender": idle,
          Tramo:
            idle >= 90 ? "90+ días" : idle >= 60 ? "60-89 días" : "30-59 días",
        };
      });
    },
  },
  "bajo-minimo": {
    title: "Bajo el mínimo",
    group: "Inventario",
    async run(db, actor) {
      // Mismo criterio que «low-stock»: lo vendible en Tienda ≤ mínimo.
      const rows: any[] = await db.$queryRaw`
        SELECT v.sku, p.name, c.name AS category, v.stock AS store, ${home} AS home, p."minStock" AS min
        FROM "Variant" v JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        WHERE v."branchId" = ${actor.branchId} AND v.active AND v.stock <= p."minStock"
        ORDER BY v.stock - p."minStock", p.name`;
      const labels = await warehouseLabels(db, actor);
      return rows.map((r) => ({
        SKU: r.sku,
        Producto: r.name,
        Categoría: r.category,
        [labels.store]: num(r.store),
        [labels.home]: num(r.home),
        Mínimo: num(r.min),
        Faltan: num(Math.max(0, Number(r.min) - Number(r.store))),
      }));
    },
  },
  "valor-inventario-almacen": {
    title: "Valor del inventario por categoría y almacén",
    group: "Inventario",
    margin: true,
    async run(db, actor) {
      const rows: any[] = await db.$queryRaw`
        SELECT c.name AS category, w.name AS warehouse, SUM(vs.qty) AS units, SUM(vs.qty * v."costAvg") AS value
        FROM "VariantStock" vs JOIN "Warehouse" w ON w.id = vs."warehouseId"
        JOIN "Variant" v ON v.id = vs."variantId" JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        WHERE v."branchId" = ${actor.branchId} AND w."branchId" = ${actor.branchId} AND v.active
        GROUP BY 1, 2 HAVING SUM(vs.qty) <> 0 ORDER BY 1, w.name DESC`;
      return rows.map((r) => ({
        Categoría: r.category,
        Almacén: r.warehouse,
        Unidades: num(r.units),
        "Valor a costo": num(r.value),
      }));
    },
  },
  "perdidas-conteo": {
    title: "Pérdidas por ajustes de conteo por mes",
    group: "Inventario",
    margin: true,
    async run(db, actor, range) {
      // Mismas salidas a costo que el estado de resultados; la corrección de
      // conteo se separa de la salida real como en el dashboard.
      const rows: any[] = await db.$queryRaw`
        SELECT to_char(${local(Prisma.sql`m."createdAt"`)}, 'YYYY-MM') AS month,
          (${Prisma.raw(COUNT_CORRECTION_SQL)}) AS correction,
          SUM(-m.qty) AS units, SUM(-m.qty * m."unitCost") AS value
        FROM "InventoryMovement" m
        WHERE m."branchId" = ${actor.branchId} AND m."createdAt" >= ${utc(range.gte)} AND m."createdAt" <= ${utc(range.lte)} AND ${Prisma.raw(INVENTORY_LOSS_SQL)}
        GROUP BY 1, 2 ORDER BY 1, 2 DESC`;
      return rows.map((r) => ({
        Mes: r.month,
        Tipo: r.correction ? "Corrección de conteo" : "Salida real",
        Unidades: num(r.units),
        "Valor a costo": num(r.value),
      }));
    },
  },
  traspasos: {
    title: "Traspasos entre almacenes",
    group: "Inventario",
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        SELECT to_char(${local(Prisma.sql`t."createdAt"`)}, 'YYYY-MM-DD HH24:MI') AS date,
          v.sku, p.name, l.qty, f.name AS "from", w.name AS "to", u.name AS "user", t.reason
        FROM "StockTransfer" t JOIN "StockTransferLine" l ON l."transferId" = t.id
        JOIN "Warehouse" f ON f.id = t."fromId" JOIN "Warehouse" w ON w.id = t."toId"
        JOIN "Variant" v ON v.id = l."variantId" JOIN "Product" p ON p.id = v."productId"
        LEFT JOIN "User" u ON u.id::text = t."userId"
        WHERE t."branchId" = ${actor.branchId} AND t."createdAt" >= ${utc(range.gte)} AND t."createdAt" <= ${utc(range.lte)}
        ORDER BY t."createdAt" DESC, p.name`;
      return rows.map((r) => ({
        Fecha: r.date,
        SKU: r.sku,
        Producto: r.name,
        Cantidad: num(r.qty),
        Dirección: `${r.from} → ${r.to}`,
        Usuario: r.user ?? "",
        Motivo: r.reason,
      }));
    },
  },
  "agotados-con-ventas": {
    title: "Agotados con ventas recientes",
    group: "Inventario",
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        SELECT v.sku, p.name, c.name AS category, v.stock AS store, ${home} AS home, x.units, ${day(Prisma.sql`x.last`)} AS last
        FROM "Variant" v JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        JOIN (${sold(actor, range)}) x ON x."variantId" = v.id
        WHERE v."branchId" = ${actor.branchId} AND v.stock <= 0 AND x.units > 0
        ORDER BY x.units DESC, p.name`;
      const labels = await warehouseLabels(db, actor);
      return rows.map((r) => ({
        SKU: r.sku,
        Producto: r.name,
        Categoría: r.category,
        [labels.store]: num(r.store),
        [labels.home]: num(r.home),
        "Vendidas en el período": num(r.units),
        "Última venta": r.last,
      }));
    },
  },
};

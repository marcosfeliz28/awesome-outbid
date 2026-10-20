import { Prisma } from "@prisma/client";
import type { Actor } from "../common";
import { local, num, pct, utc, type Range, type ReportDef } from "./base";

// Ventas netas de devoluciones, como dashboard/breakdown. Margen de la dueña:
// (precio − costo)/precio sin restar ITBIS.
const line = Prisma.sql`i."lineTotal"*(1-i."returnedQty"/i.qty)`;
const units = Prisma.sql`(i.qty-i."returnedQty")`;
const cost = Prisma.sql`(i.qty-i."returnedQty")*i."unitCost"`;
const sold = (actor: Actor, range: Range) =>
  Prisma.sql`FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Variant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId" JOIN "Category" c ON c.id=p."categoryId" LEFT JOIN "User" u ON u.id=s."sellerId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${utc(range.gte)} AND s."createdAt"<=${utc(range.lte)}`;
const MIN = 15;

const money = (venta: unknown, costo: unknown) => ({
  Venta: num(venta),
  Costo: num(costo),
  Utilidad: num(Number(venta) - Number(costo)),
  "Margen %": pct(Number(venta) - Number(costo), venta),
});

// Margen agrupado por una columna (producto, categoría, marca, cajera).
const by =
  (header: string, key: Prisma.Sql): ReportDef["run"] =>
  async (db, actor, range) =>
    (
      await db.$queryRaw`SELECT ${key} AS k, SUM(${units}) AS units, SUM(${line}) AS venta, SUM(${cost}) AS costo ${sold(actor, range)} GROUP BY 1 HAVING SUM(${units}) > 0 ORDER BY venta DESC`
    ).map((r: any) => ({
      [header]: r.k,
      Unidades: num(r.units),
      ...money(r.venta, r.costo),
    }));

export const margen: Record<string, ReportDef> = {
  "margen-por-producto": {
    title: "Margen por producto",
    group: "Margen",
    margin: true,
    run: by("Producto", Prisma.sql`p.name`),
  },
  "margen-por-categoria": {
    title: "Margen por categoría",
    group: "Margen",
    margin: true,
    run: by("Categoría", Prisma.sql`c.name`),
  },
  // GV Makeup Studio y MacGen en la misma tienda (dueña, 20-oct): la
  // empresa sale de la categoría (las de GV empiezan por «GV »).
  "margen-por-empresa": {
    title: "Ventas y ganancia por empresa",
    group: "Margen",
    margin: true,
    run: by(
      "Empresa",
      Prisma.sql`CASE WHEN c.name ILIKE 'GV %' THEN 'GV Makeup Studio' ELSE 'MacGen' END`,
    ),
  },
  "margen-por-marca": {
    title: "Margen por marca",
    group: "Margen",
    margin: true,
    run: by("Marca", Prisma.sql`p.brand`),
  },
  "margen-por-cajera": {
    title: "Margen por cajera",
    group: "Margen",
    margin: true,
    run: by("Cajera", Prisma.sql`COALESCE(u.name, 'Sin cajera')`),
  },
  "ventas-margen-bajo": {
    title: `Ventas con margen menor a ${MIN} %`,
    group: "Margen",
    margin: true,
    run: async (db, actor, range) =>
      (
        await db.$queryRaw`SELECT s.number, to_char(${local(Prisma.sql`s."createdAt"`)}, 'YYYY-MM-DD HH24:MI') AS fecha, COALESCE(u.name, 'Sin cajera') AS cajera, SUM(${line}) AS venta, SUM(${cost}) AS costo ${sold(actor, range)} GROUP BY s.id, s.number, s."createdAt", u.name HAVING SUM(${line}) > 0 AND (SUM(${line})-SUM(${cost}))/SUM(${line}) < ${MIN / 100} ORDER BY s."createdAt"`
      ).map((r: any) => ({
        Factura: r.number,
        Fecha: r.fecha,
        Cajera: r.cajera,
        Total: num(r.venta),
        Costo: num(r.costo),
        Utilidad: num(Number(r.venta) - Number(r.costo)),
        "Margen %": pct(Number(r.venta) - Number(r.costo), r.venta),
      })),
  },
  "utilidad-bruta-por-mes": {
    title: "Utilidad bruta por mes",
    group: "Margen",
    margin: true,
    run: async (db, actor, range) =>
      (
        await db.$queryRaw`SELECT to_char(${local(Prisma.sql`s."createdAt"`)}, 'YYYY-MM') AS mes, COUNT(DISTINCT s.id)::int AS facturas, SUM(${line}) AS venta, SUM(${cost}) AS costo ${sold(actor, range)} GROUP BY 1 ORDER BY 1`
      ).map((r: any) => ({
        Mes: r.mes,
        Facturas: r.facturas,
        ...money(r.venta, r.costo),
      })),
  },
  "costo-vendido-vs-inventario": {
    title: "Costo de lo vendido vs valor del inventario",
    group: "Margen",
    margin: true,
    run: async (db, actor, range) => {
      const [[sale], [stock]] = await Promise.all([
        db.$queryRaw`SELECT COALESCE(SUM(${cost}),0) AS costo ${sold(actor, range)}`,
        // Igual que inventory-value: todos los almacenes, al costo promedio.
        db.$queryRaw`SELECT COALESCE(SUM(vs.qty*v."costAvg"),0) AS valor FROM "VariantStock" vs JOIN "Variant" v ON v.id=vs."variantId" WHERE v."branchId"=${actor.branchId} AND v.active`,
      ]);
      // Días del período hasta hoy, para no diluir con días que no llegan.
      const end = Math.min(+range.lte, Date.now());
      const days = Math.max(1, Math.ceil((end - +range.gte) / 86400000));
      const cogs = Number(sale.costo),
        value = Number(stock.valor),
        perDay = cogs / days;
      return [
        {
          "Costo de lo vendido": num(cogs),
          "Valor del inventario (costo)": num(value),
          "Días del período": days,
          "Costo vendido por día": num(perDay),
          "Días de cobertura": perDay ? Math.round(value / perDay) : null,
          "Inventario / costo vendido": cogs ? num(value / cogs) : null,
        },
      ];
    },
  },
  "precio-vendido-vs-lista": {
    title: "Precio promedio vendido vs precio de lista",
    group: "Margen",
    margin: true,
    run: async (db, actor, range) =>
      (
        await db.$queryRaw`SELECT p.name, v.sku, v.price, SUM(${units}) AS units, SUM(${line}) AS venta ${sold(actor, range)} GROUP BY p.name, v.sku, v.price HAVING SUM(${units}) > 0 ORDER BY venta DESC`
      ).map((r: any) => {
        const avg = Number(r.venta) / Number(r.units);
        return {
          Producto: r.name,
          SKU: r.sku,
          Unidades: num(r.units),
          "Precio promedio vendido": num(avg),
          "Precio de lista": num(r.price),
          "Diferencia %": pct(avg - Number(r.price), r.price),
        };
      }),
  },
};

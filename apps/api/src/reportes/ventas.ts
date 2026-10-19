import { Prisma } from "@prisma/client";
import type { Actor } from "../common";
import { local, num, pct, utc, type Range, type ReportDef } from "./base";

// Venta neta (D-05, como dashboard/breakdown): cada línea vendida en el
// período menos la parte devuelta de esa línea. Así todos los reportes del
// grupo cuadran entre sí (la suma por hora = por cajera = por categoría).
const where = (actor: Actor, range: Range) =>
  Prisma.sql`s."branchId" = ${actor.branchId} AND s.status = 'completed' AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)}`;
const NET = Prisma.sql`i."lineTotal" * (1 - i."returnedQty" / i.qty)`;
const UNITS = Prisma.sql`(i.qty - i."returnedQty")`;
// Una fila por factura: hora, cajera, cliente, unidades y venta neta.
const sales = (actor: Actor, range: Range) =>
  Prisma.sql`WITH f AS (SELECT s.id, s."createdAt" AS at, s."sellerId" AS seller, s."customerId" AS customer, SUM(${UNITS}) AS units, SUM(${NET}) AS net FROM "Sale" s JOIN "SaleItem" i ON i."saleId" = s.id WHERE ${where(actor, range)} GROUP BY s.id)`;
// Una fila por línea, con su categoría y marca.
const lines = (actor: Actor, range: Range) =>
  Prisma.sql`WITH l AS (SELECT s.id AS sale, s."createdAt" AS at, c.name AS category, p.brand, ${UNITS} AS units, ${NET} AS net FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId" WHERE ${where(actor, range)})`;
const AT = local(Prisma.sql`at`);

const total = (rows: any[]) => rows.reduce((a, r) => a + Number(r.net), 0);
const ticket = (net: unknown, invoices: unknown) =>
  Number(invoices) ? num(Number(net) / Number(invoices)) : 0;

// Mes de negocio (AAAA-MM) de una fecha. shortcut: Santo Domingo es UTC-4 todo
// el año (sin horario de verano); si eso cambia, usar la zona horaria real.
const monthOf = (date: Date) =>
  new Date(+date - 4 * 3600000).toISOString().slice(0, 7);
const shift = (ym: string, months: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
};
const monthRange = (ym: string): Range => ({
  gte: new Date(`${ym}-01T00:00:00-04:00`),
  lte: new Date(+new Date(`${shift(ym, 1)}-01T00:00:00-04:00`) - 1),
});
const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("es-DO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
async function month(db: any, actor: Actor, ym: string) {
  const [r] =
    await db.$queryRaw`${sales(actor, monthRange(ym))} SELECT COUNT(*)::int AS invoices, COALESCE(SUM(net), 0) AS net FROM f`;
  return { ym, invoices: Number(r.invoices), net: num(r.net) };
}
// Mes de `to` contra otro mes, con el cambio en %.
async function compare(db: any, actor: Actor, range: Range, back: number) {
  const ym = monthOf(range.lte);
  const [now, before] = await Promise.all([
    month(db, actor, ym),
    month(db, actor, shift(ym, -back)),
  ]);
  return [now, before].map((m, index) => ({
    Mes: monthName(m.ym),
    Facturas: m.invoices,
    "Ventas netas": m.net,
    "Ticket promedio": ticket(m.net, m.invoices),
    "Cambio %":
      index === 0 && before.net ? pct(now.net - before.net, before.net) : null,
  }));
}

const DAYS = [
  "",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export const ventas: Record<string, ReportDef> = {
  "ventas-por-hora": {
    title: "Ventas por hora del día",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${sales(actor, range)} SELECT EXTRACT(HOUR FROM ${AT})::int AS hour, COUNT(*)::int AS invoices, SUM(net) AS net FROM f GROUP BY 1 ORDER BY 1`;
      const all = total(rows);
      return rows.map((r) => ({
        Hora: `${String(r.hour).padStart(2, "0")}:00`,
        Facturas: r.invoices,
        "Ventas netas": num(r.net),
        "% del total": pct(r.net, all),
      }));
    },
  },
  "ventas-por-dia-semana": {
    title: "Ventas por día de la semana",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${sales(actor, range)} SELECT EXTRACT(ISODOW FROM ${AT})::int AS day, COUNT(*)::int AS invoices, SUM(net) AS net FROM f GROUP BY 1 ORDER BY 1`;
      const all = total(rows);
      return rows.map((r) => ({
        Día: DAYS[r.day],
        Facturas: r.invoices,
        "Ventas netas": num(r.net),
        "Ticket promedio": ticket(r.net, r.invoices),
        "% del total": pct(r.net, all),
      }));
    },
  },
  "ventas-mes-anterior": {
    title: "Mes contra mes anterior",
    group: "Ventas",
    run: (db, actor, range) => compare(db, actor, range, 1),
  },
  "ventas-mes-ano-anterior": {
    title: "Mes contra el mismo mes del año anterior",
    group: "Ventas",
    run: (db, actor, range) => compare(db, actor, range, 12),
  },
  "ticket-promedio": {
    title: "Ticket promedio por día y por mes",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${sales(actor, range)} SELECT month, day, COUNT(*)::int AS invoices, SUM(net) AS net FROM (SELECT to_char(${AT}, 'YYYY-MM') AS month, to_char(${AT}, 'YYYY-MM-DD') AS day, net FROM f) x GROUP BY GROUPING SETS ((month), (month, day)) ORDER BY month, day NULLS LAST`;
      return rows.map((r) => ({
        Tipo: r.day ? "Día" : "Mes",
        Período: r.day ?? monthName(r.month),
        Facturas: r.invoices,
        "Ventas netas": num(r.net),
        "Ticket promedio": ticket(r.net, r.invoices),
      }));
    },
  },
  "unidades-por-factura": {
    title: "Unidades por factura",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${sales(actor, range)} SELECT CASE WHEN units <= 0 THEN 0 WHEN units <= 5 THEN CEIL(units)::int WHEN units <= 10 THEN 6 ELSE 11 END AS bucket, COUNT(*)::int AS invoices, SUM(units) AS units, SUM(net) AS net FROM f GROUP BY 1 ORDER BY 1`;
      const invoices = rows.reduce((a, r) => a + r.invoices, 0);
      const units = rows.reduce((a, r) => a + Number(r.units), 0);
      const label = (b: number) =>
        b === 0
          ? "Devuelta completa"
          : b === 6
            ? "6 a 10"
            : b === 11
              ? "Más de 10"
              : String(b);
      return [
        ...rows.map((r) => ({
          Unidades: label(r.bucket),
          Facturas: r.invoices,
          "% de facturas": pct(r.invoices, invoices),
          "Ventas netas": num(r.net),
        })),
        {
          Unidades: `Promedio: ${num(invoices ? units / invoices : 0)} por factura`,
          Facturas: invoices,
          "% de facturas": invoices ? 100 : 0,
          "Ventas netas": num(total(rows)),
        },
      ];
    },
  },
  "ranking-cajeras": {
    title: "Ranking de cajeras",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${sales(actor, range)} SELECT u.name, COUNT(*)::int AS invoices, SUM(f.units) AS units, SUM(f.net) AS net FROM f LEFT JOIN "User" u ON u.id = f.seller GROUP BY f.seller, u.name ORDER BY net DESC`;
      const all = total(rows);
      return rows.map((r, index) => ({
        Puesto: index + 1,
        Cajera: r.name ?? "(sin nombre)",
        Facturas: r.invoices,
        Unidades: num(r.units),
        "Ventas netas": num(r.net),
        "Ticket promedio": ticket(r.net, r.invoices),
        "% del total": pct(r.net, all),
      }));
    },
  },
  "top-clientes": {
    title: "Los 20 mejores clientes",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${sales(actor, range)} SELECT c.name, COUNT(*)::int AS invoices, SUM(f.net) AS net, (SELECT SUM(net) FROM f) AS "all" FROM f JOIN "Customer" c ON c.id = f.customer GROUP BY c.id, c.name ORDER BY net DESC, c.name LIMIT 20`;
      return rows.map((r, index) => ({
        Puesto: index + 1,
        Cliente: r.name,
        Facturas: r.invoices,
        "Ventas netas": num(r.net),
        "Ticket promedio": ticket(r.net, r.invoices),
        "% de las ventas": pct(r.net, r.all),
      }));
    },
  },
  "ventas-categoria-mes": {
    title: "Ventas por categoría y mes",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${lines(actor, range)} SELECT month, category, COUNT(DISTINCT sale)::int AS invoices, SUM(units) AS units, SUM(net) AS net, SUM(SUM(net)) OVER (PARTITION BY month) AS "monthNet" FROM (SELECT to_char(${AT}, 'YYYY-MM') AS month, category, sale, units, net FROM l) x GROUP BY month, category ORDER BY month, net DESC`;
      return rows.map((r) => ({
        Mes: monthName(r.month),
        Categoría: r.category,
        Facturas: r.invoices,
        Unidades: num(r.units),
        "Ventas netas": num(r.net),
        "% del mes": pct(r.net, r.monthNet),
      }));
    },
  },
  "ventas-por-marca": {
    title: "Ventas por marca",
    group: "Ventas",
    async run(db, actor, range) {
      const rows: any[] =
        await db.$queryRaw`${lines(actor, range)} SELECT COALESCE(NULLIF(TRIM(brand), ''), 'Sin marca') AS brand, COUNT(DISTINCT sale)::int AS invoices, SUM(units) AS units, SUM(net) AS net FROM l GROUP BY 1 ORDER BY net DESC`;
      const all = total(rows);
      return rows.map((r) => ({
        Marca: r.brand,
        Facturas: r.invoices,
        Unidades: num(r.units),
        "Ventas netas": num(r.net),
        "% del total": pct(r.net, all),
      }));
    },
  },
};

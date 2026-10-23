import { Prisma } from "@prisma/client";
import { canViewCashExpected, denied, type Actor } from "../common";
import {
  local,
  num,
  pct,
  utc,
  type Range,
  type ReportDef,
  type Row,
} from "./base";

// Grupo «Dinero» de los 40 reportes (orden 18-oct). Sin costo ni margen.
const sold = (actor: Actor, range: Range) =>
  Prisma.sql`s."branchId" = ${actor.branchId} AND s.status = 'completed' AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)}`;
const returned = (actor: Actor, range: Range) =>
  Prisma.sql`r."branchId" = ${actor.branchId} AND r."createdAt" >= ${utc(range.gte)} AND r."createdAt" <= ${utc(range.lte)}`;
const month = (column: Prisma.Sql) =>
  Prisma.sql`to_char(${local(column)}, 'YYYY-MM')`;

// Igual que «by-payment»: sin arqueo visible, no se desglosa cómo se cobró
// mientras haya una caja abierta (revelaría el esperado antes del cierre).
async function openCashGuard(db: any, actor: Actor) {
  if (canViewCashExpected(actor)) return;
  const open = await db.cashSession.findFirst({
    where: { branchId: actor.branchId, closedAt: null },
    select: { id: true },
  });
  if (open) denied();
}

const MIX = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Crédito/contraentrega",
  "Otros",
] as const;
const BUCKET: Record<string, (typeof MIX)[number]> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  credit: "Crédito/contraentrega",
  cod: "Crédito/contraentrega",
};
// Filas {claves…, method, amount} → una fila por clave con montos y % por forma.
function mix(rows: any[], keys: string[]): Row[] {
  const out = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const id = keys.map((k) => r[k]).join("\u0000");
    if (!out.has(id))
      out.set(id, {
        ...Object.fromEntries(keys.map((k) => [k, r[k]])),
        ...Object.fromEntries(MIX.map((m) => [m, 0])),
      });
    const row = out.get(id)!;
    row[BUCKET[r.method] ?? "Otros"] += Number(r.amount ?? 0);
  }
  return [...out.values()].map((row) => {
    const total = MIX.reduce((a, m) => a + row[m], 0);
    return {
      ...row,
      ...Object.fromEntries(MIX.map((m) => [m, num(row[m])])),
      Total: num(total),
      "% Efectivo": pct(row.Efectivo, total),
      "% Transferencia": pct(row.Transferencia, total),
      "% Tarjeta": pct(row.Tarjeta, total),
      "% Crédito/contraentrega": pct(row["Crédito/contraentrega"], total),
    };
  });
}

export const dinero: Record<string, ReportDef> = {
  descuadres: {
    title: "Descuadres de caja por fecha",
    group: "Dinero",
    // Orden de la dueña (21-oct): cada descuadre (falta o sobra) con la
    // cajera, el mensajero, cuánto fue por área y cómo se resolvió.
    async run(db, actor, range) {
      if (!canViewCashExpected(actor)) denied();
      const rows: any[] = await db.$queryRaw`
        SELECT cs.id, to_char(${local(Prisma.sql`cs."closedAt"`)}, 'YYYY-MM-DD') AS dia,
               cs."registerId", u.name AS cajera, cs."differenceCash" AS efectivo,
               cs."differenceCard" AS tarjeta, cs."differenceTransfer" AS transferencia,
               cs.notes, cs."closeDetails" AS det,
               (SELECT string_agg(DISTINCT s."courierName", ', ') FROM "Sale" s
                 WHERE s."cashSessionId" = cs.id AND s."courierFee" > 0) AS mensajero
          FROM "CashSession" cs JOIN "User" u ON u.id::text = cs."userId"
          WHERE cs."branchId" = ${actor.branchId} AND cs."closedAt" IS NOT NULL
            AND cs."closedAt" >= ${utc(range.gte)} AND cs."closedAt" <= ${utc(range.lte)}
            AND (cs."differenceCash" <> 0 OR cs."differenceCard" <> 0 OR cs."differenceTransfer" <> 0)
          ORDER BY cs."closedAt"`;
      const ids = [
        ...new Set(
          rows.flatMap((r) => [r.det?.cashApprovedBy, r.det?.cardApprovedBy]),
        ),
      ].filter(Boolean);
      const users: { id: string; name: string }[] = ids.length
        ? await db.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : [];
      const name = (id: unknown) => users.find((u) => u.id === id)?.name ?? "";
      const terminals: { id: string; name: string }[] =
        await db.terminal.findMany({ select: { id: true, name: true } });
      return rows.map((r) => {
        const fix = r.det?.differenceResolution;
        return {
          Día: r.dia,
          Caja:
            terminals.find((t) => t.id === r.registerId)?.name ?? r.registerId,
          Cajera: r.cajera,
          Mensajero: r.mensajero ?? "",
          Efectivo: num(r.efectivo),
          Tarjeta: num(r.tarjeta),
          Transferencia: num(r.transferencia),
          Aprobó:
            [name(r.det?.cashApprovedBy), name(r.det?.cardApprovedBy)]
              .filter((v, i, a) => v && a.indexOf(v) === i)
              .join(", ") || "Sin aprobar",
          Justificación: r.det?.differenceReason || r.notes || "",
          Resolución: fix ? `${fix.note} (${fix.byName})` : "PENDIENTE",
        };
      });
    },
  },
  "entradas-cuenta": {
    title: "Entradas por cuenta de banco y terminal",
    group: "Dinero",
    // Orden de la dueña (20-oct): por dónde entró el dinero cada día. Cuenta
    // cobros de venta y abonos (lo que de verdad llegó), no lo pendiente.
    async run(db, actor, range) {
      await openCashGuard(db, actor);
      const rows: any[] = await db.$queryRaw`
        SELECT to_char(${local(Prisma.sql`p."createdAt"`)}, 'YYYY-MM-DD') AS dia, p.method,
               COALESCE(NULLIF(TRIM(p.bank), ''), 'Sin indicar') AS cuenta,
               SUM(p.amount) AS amount, COUNT(*) AS n
          FROM "Payment" p JOIN "Sale" s ON s.id = p."saleId"
          WHERE s."branchId" = ${actor.branchId} AND s.status = 'completed'
            AND p."createdAt" >= ${utc(range.gte)} AND p."createdAt" <= ${utc(range.lte)}
            AND p.method IN ('cash', 'card', 'transfer') AND p.status <> 'rejected'
          GROUP BY 1, 2, 3`;
      const label: Record<string, string> = {
        cash: "Efectivo",
        card: "Tarjeta",
        transfer: "Transferencia",
      };
      return rows
        .map((r) => ({
          Día: r.dia,
          Forma: label[r.method] ?? r.method,
          "Cuenta / terminal": r.method === "cash" ? "Caja" : r.cuenta,
          Cobros: Number(r.n),
          Monto: num(r.amount),
        }))
        .sort(
          (a, b) =>
            String(a.Día).localeCompare(String(b.Día)) ||
            a.Forma.localeCompare(b.Forma) ||
            String(a["Cuenta / terminal"]).localeCompare(
              String(b["Cuenta / terminal"]),
            ),
        );
    },
  },
  "formas-pago-mes": {
    title: "Formas de pago por mes",
    group: "Dinero",
    // D-05 como «by-payment»: lo cobrado de las facturas del mes (transferencia
    // rechazada = crédito, N-4) menos lo devuelto en el mes: el reembolso con su
    // método y lo que redujo la deuda con el crédito/contraentrega de la venta.
    async run(db, actor, range) {
      await openCashGuard(db, actor);
      const rows = await db.$queryRaw`
        SELECT ${month(Prisma.sql`s."createdAt"`)} AS "Mes", CASE WHEN p.status = 'rejected' THEN 'credit' ELSE p.method END AS method, SUM(p.amount) AS amount
          FROM "Payment" p JOIN "Sale" s ON s.id = p."saleId"
          WHERE ${sold(actor, range)} AND p."entryType" <> 'installment' GROUP BY 1, 2
        UNION ALL
        SELECT ${month(Prisma.sql`r."createdAt"`)}, r."refundMethod", -SUM(r."refundAmount")
          FROM "SaleReturn" r JOIN "Sale" s ON s.id = r."saleId"
          WHERE ${returned(actor, range)} AND s.status = 'completed' AND r."refundAmount" > 0 GROUP BY 1, 2
        UNION ALL
        SELECT mes, method, -SUM(debt) FROM (
          SELECT ${month(Prisma.sql`r."createdAt"`)} AS mes, COALESCE((SELECT p.method FROM "Payment" p WHERE p."saleId" = r."saleId" AND p."entryType" <> 'installment' AND p.method IN ('credit', 'cod') LIMIT 1), 'credit') AS method, r.total - r."refundAmount" AS debt
            FROM "SaleReturn" r JOIN "Sale" s ON s.id = r."saleId"
            WHERE ${returned(actor, range)} AND s.status = 'completed' AND r.total > r."refundAmount") x
          GROUP BY 1, 2`;
      return mix(rows, ["Mes"]).sort((a, b) =>
        String(a.Mes).localeCompare(String(b.Mes)),
      );
    },
  },
  "formas-pago-categoria": {
    title: "Formas de pago por categoría",
    group: "Dinero",
    // Como «ventas-categoria-forma-pago»: lo vendido de la categoría en cada
    // factura (neto de lo devuelto) se reparte según la mezcla de pagos.
    async run(db, actor, range) {
      await openCashGuard(db, actor);
      const rows = await db.$queryRaw`
        WITH cl AS (SELECT i."saleId", ${month(Prisma.sql`s."createdAt"`)} AS mes, c.name, SUM(i."lineTotal" * (1 - i."returnedQty" / i.qty)) AS rev
          FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
          WHERE ${sold(actor, range)} GROUP BY 1, 2, 3),
        sp AS (SELECT p."saleId", CASE WHEN p.status = 'rejected' THEN 'credit' ELSE p.method END AS method, SUM(p.amount) AS amt
          FROM "Payment" p WHERE p."entryType" = 'sale' AND p."saleId" IN (SELECT "saleId" FROM cl) GROUP BY 1, 2),
        st AS (SELECT "saleId", SUM(amt) AS tot FROM sp GROUP BY 1)
        SELECT cl.mes AS "Mes", cl.name AS "Categoría", sp.method, SUM(cl.rev * sp.amt / NULLIF(st.tot, 0)) AS amount
          FROM cl JOIN sp ON sp."saleId" = cl."saleId" JOIN st ON st."saleId" = cl."saleId"
          GROUP BY 1, 2, 3`;
      return mix(rows, ["Mes", "Categoría"]).sort(
        (a, b) =>
          String(a.Mes).localeCompare(String(b.Mes)) ||
          Number(b.Total) - Number(a.Total),
      );
    },
  },
  "descuentos-cajera": {
    title: "Descuentos dados por cajera",
    group: "Dinero",
    // % sobre su venta neta del período (facturas menos devoluciones, D-05).
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        WITH v AS (SELECT s."sellerId" AS uid, COUNT(*) FILTER (WHERE s."discountTotal" > 0) AS n, SUM(s."discountTotal") AS disc, COUNT(*) FILTER (WHERE s."discountTotal" > 0 AND s."discountApprovedBy" = s."sellerId") AS own, SUM(s.total) AS sales
          FROM "Sale" s WHERE ${sold(actor, range)} GROUP BY 1),
        d AS (SELECT s."sellerId" AS uid, SUM(r.total) AS ret
          FROM "SaleReturn" r JOIN "Sale" s ON s.id = r."saleId" WHERE ${returned(actor, range)} AND s.status = 'completed' GROUP BY 1)
        SELECT COALESCE(u.name, v.uid::text) AS name, v.n, v.disc, v.own, v.sales - COALESCE(d.ret, 0) AS net
          FROM v LEFT JOIN d ON d.uid = v.uid LEFT JOIN "User" u ON u.id = v.uid
          WHERE v.n > 0 ORDER BY v.disc DESC`;
      return rows.map((r) => ({
        Cajera: r.name,
        "Facturas con descuento": Number(r.n),
        "Descuento total": num(r.disc),
        "Ventas netas": num(r.net),
        "% de sus ventas": pct(r.disc, r.net),
        "Aprobados por ella misma": Number(r.own),
      }));
    },
  },
  "por-mayor-detalle": {
    title: "Ventas por mayor vs detalle",
    group: "Dinero",
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        WITH v AS (SELECT s.wholesale, COUNT(*) AS n, SUM(s.total) AS sales FROM "Sale" s WHERE ${sold(actor, range)} GROUP BY 1),
        d AS (SELECT s.wholesale, SUM(r.total) AS ret FROM "SaleReturn" r JOIN "Sale" s ON s.id = r."saleId" WHERE ${returned(actor, range)} AND s.status = 'completed' GROUP BY 1)
        SELECT w.wholesale, COALESCE(v.n, 0) AS n, COALESCE(v.sales, 0) AS sales, COALESCE(d.ret, 0) AS ret
          FROM (VALUES (true), (false)) w(wholesale) LEFT JOIN v ON v.wholesale = w.wholesale LEFT JOIN d ON d.wholesale = w.wholesale`;
      const all = rows.reduce((a, r) => a + Number(r.sales) - Number(r.ret), 0);
      return rows.map((r) => ({
        Tipo: r.wholesale ? "Por mayor" : "Detalle",
        Facturas: Number(r.n),
        Ventas: num(r.sales),
        Devoluciones: num(r.ret),
        Neto: num(Number(r.sales) - Number(r.ret)),
        "% del total": pct(Number(r.sales) - Number(r.ret), all),
      }));
    },
  },
  "envios-mensajero": {
    title: "Envíos del mensajero cobrados",
    group: "Dinero",
    // Envío de tercero: va aparte de la venta. Pagado = ya se le liquidó.
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        SELECT COALESCE(s."courierName", '') AS name, COUNT(*) AS n, SUM(s."courierFee") AS total,
          COUNT(*) FILTER (WHERE s."courierPaidAt" IS NOT NULL) AS paid_n, COALESCE(SUM(s."courierFee") FILTER (WHERE s."courierPaidAt" IS NOT NULL), 0) AS paid
          FROM "Sale" s WHERE ${sold(actor, range)} AND s."courierFee" > 0 GROUP BY 1 ORDER BY 3 DESC`;
      return rows.map((r) => ({
        Mensajero: r.name,
        Envíos: Number(r.n),
        "Monto de envíos": num(r.total),
        Pagados: Number(r.paid_n),
        "Monto pagado": num(r.paid),
        Pendientes: Number(r.n) - Number(r.paid_n),
        "Monto pendiente": num(Number(r.total) - Number(r.paid)),
      }));
    },
  },
  "diferencias-cuadre": {
    title: "Diferencias de cuadre por cajera",
    group: "Dinero",
    // Como el informe «cash»: las diferencias sólo para quien ve el arqueo.
    async run(db, actor, range) {
      if (!canViewCashExpected(actor)) denied();
      const rows: any[] = await db.$queryRaw`
        SELECT COALESCE(u.name, c."userId") AS name, COUNT(*) AS n,
          COALESCE(SUM(c."differenceCash"), 0) AS cash, COALESCE(SUM(c."differenceCard"), 0) AS card, COALESCE(SUM(c."differenceTransfer"), 0) AS transfer, COALESCE(SUM(c.difference), 0) AS total,
          COUNT(*) FILTER (WHERE c.difference < 0) AS short, COUNT(*) FILTER (WHERE c.difference > 0) AS over
          FROM "CashSession" c LEFT JOIN "User" u ON u.id::text = c."userId"
          WHERE c."branchId" = ${actor.branchId} AND c."closedAt" IS NOT NULL AND c."closedAt" >= ${utc(range.gte)} AND c."closedAt" <= ${utc(range.lte)}
          GROUP BY 1 ORDER BY 6`;
      return rows.map((r) => ({
        Cajera: r.name,
        "Cajas cerradas": Number(r.n),
        "Diferencia efectivo": num(r.cash),
        "Diferencia tarjeta": num(r.card),
        "Diferencia transferencia": num(r.transfer),
        "Diferencia total": num(r.total),
        "Cajas con faltante": Number(r.short),
        "Cajas con sobrante": Number(r.over),
      }));
    },
  },
  anulaciones: {
    title: "Anulaciones por cajera y motivo",
    group: "Dinero",
    // Por la fecha de la factura anulada.
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        SELECT COALESCE(u.name, s."sellerId"::text) AS name, COALESCE(s."voidedReason", '') AS reason, COUNT(*) AS n, SUM(s.total) AS total
          FROM "Sale" s LEFT JOIN "User" u ON u.id = s."sellerId"
          WHERE s."branchId" = ${actor.branchId} AND s.status = 'voided' AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)}
          GROUP BY 1, 2 ORDER BY 1, 3 DESC`;
      return rows.map((r) => ({
        Cajera: r.name,
        Motivo: r.reason,
        Anuladas: Number(r.n),
        Monto: num(r.total),
      }));
    },
  },
  "devoluciones-producto": {
    title: "Devoluciones por producto",
    group: "Dinero",
    // Importe de cada parte registrada o, en devoluciones antiguas sin ese
    // dato, la proporción de la línea (como returnedByCategory).
    async run(db, actor, range) {
      const rows: any[] = await db.$queryRaw`
        SELECT p.name, v.sku, COUNT(DISTINCT r.id) AS n, SUM((e->>'qty')::numeric) AS qty,
          SUM(CASE WHEN jsonb_typeof(e->'total') = 'number' THEN (e->>'total')::numeric ELSE i."lineTotal" * (e->>'qty')::numeric / i.qty END) AS total
          FROM "SaleReturn" r CROSS JOIN LATERAL jsonb_array_elements(r.items::jsonb) e
          JOIN "SaleItem" i ON i.id::text = e->>'saleItemId' JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId"
          WHERE ${returned(actor, range)} GROUP BY p.id, p.name, v.id, v.sku ORDER BY 5 DESC`;
      return rows.map((r) => ({
        Producto: r.name,
        SKU: r.sku,
        Devoluciones: Number(r.n),
        Unidades: num(r.qty),
        Monto: num(r.total),
      }));
    },
  },
};

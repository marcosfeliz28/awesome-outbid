import { Prisma } from "@prisma/client";
import { canViewCustomerPii, maskTail, type Actor } from "../common";
import { local, num, utc, type ReportDef, type Row } from "./base";

// Clientes y crédito (reportes 35–40). El teléfono sale completo sólo para
// quien puede ver datos personales; los demás lo ven enmascarado.
const phoneFor = (actor: Actor) => {
  const full = canViewCustomerPii(actor);
  return (phone: string | null) => (full ? phone : maskTail(phone)) ?? null;
};
// Hoy en Santo Domingo: la antigüedad y la inactividad se cuentan hasta hoy,
// no hasta el «hasta» del filtro (que sólo elige qué facturas entran).
const TODAY = Prisma.sql`(now() AT TIME ZONE 'America/Santo_Domingo')::date`;
const day = (column: Prisma.Sql) =>
  Prisma.sql`to_char(${local(column)}, 'YYYY-MM-DD')`;
const month = (column: Prisma.Sql) =>
  Prisma.sql`to_char(${local(column)}, 'YYYY-MM')`;
// Cuenta por cobrar: la venta vigente con un pago de crédito o contraentrega,
// o con una transferencia rechazada que pasó a deuda (M-3).
const RECEIVABLE = Prisma.sql`EXISTS (SELECT 1 FROM "Payment" rp WHERE rp."saleId" = s.id AND rp."entryType" = 'sale' AND (rp.method IN ('credit','cod') OR (rp.method = 'transfer' AND rp.status = 'rejected')))`;
// Lo devuelto de cada venta, para las ventas netas (vigentes menos devoluciones).
const RETURNS = Prisma.sql`LEFT JOIN (SELECT "saleId", SUM(total) AS t FROM "SaleReturn" GROUP BY 1) rt ON rt."saleId" = s.id`;

const METHODS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit_note: "Nota de crédito",
};
const BUCKETS = ["0-15 días", "16-30 días", "31-60 días", "Más de 60 días"];
const bucket = (days: number) =>
  BUCKETS[days <= 15 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3];

type Open = {
  id: string;
  number: string;
  sold: string;
  due: string | null;
  days: number;
  balance: unknown;
  cod: boolean;
  kind: string | null;
  customerId: string | null;
  name: string | null;
  phone: string | null;
};
// shortcut: usa el saldo actual de cada factura vendida hasta «hasta»; un
// «hasta» en el pasado no descuenta cobros posteriores (rehacer con la
// historia de Payment si la dueña lo pide).
const openReceivables = (db: any, actor: Actor, to: Date) =>
  db.$queryRaw`
    SELECT s.id, s.number, ${day(Prisma.sql`s."createdAt"`)} AS sold,
      CASE WHEN s."creditDueDate" IS NULL THEN NULL ELSE ${day(Prisma.sql`s."creditDueDate"`)} END AS due,
      GREATEST(0, ${TODAY} - ${local(Prisma.sql`s."createdAt"`)}::date)::int AS days,
      s."creditBalance" AS balance,
      EXISTS (SELECT 1 FROM "Payment" cp WHERE cp."saleId" = s.id AND cp."entryType" = 'sale' AND cp.method = 'cod') AS cod,
      s."receivableKind" AS kind,
      s."customerId"::text AS "customerId", c.name, c.phone
    FROM "Sale" s LEFT JOIN "Customer" c ON c.id = s."customerId"
    WHERE s."branchId" = ${actor.branchId} AND s.status = 'completed'
      AND s."creditBalance" > 0 AND s."createdAt" <= ${utc(to)} AND ${RECEIVABLE}
    ORDER BY s."createdAt", s.number` as Promise<Open[]>;

export const clientes: Record<string, ReportDef> = {
  "creditos-por-antiguedad": {
    title: "Créditos y contraentregas por antigüedad",
    group: "Clientes y crédito",
    async run(db, actor, range) {
      const phone = phoneFor(actor);
      const open = await openReceivables(db, actor, range.lte);
      const summary = BUCKETS.map((Tramo) => {
        const rows = open.filter((o) => bucket(o.days) === Tramo);
        return {
          Tramo,
          Factura: "Resumen",
          Tipo: null,
          Cliente: null,
          Teléfono: null,
          Fecha: null,
          Vence: null,
          Días: null,
          Facturas: rows.length,
          Saldo: num(rows.reduce((t, o) => t + Number(o.balance), 0)),
        };
      });
      const detail: Row[] = open.map((o) => ({
        Tramo: bucket(o.days),
        Factura: o.number,
        // Etiqueta de la caja (dueña, 19-oct); antes no se distinguía.
        Tipo:
          o.kind === "credit"
            ? "Crédito"
            : o.kind === "cod"
              ? "Contraentrega"
              : o.cod
                ? "Crédito / contraentrega"
                : "Crédito",
        Cliente: o.name ?? "Consumidor final",
        Teléfono: phone(o.phone),
        Fecha: o.sold,
        Vence: o.due,
        Días: o.days,
        Facturas: 1,
        Saldo: num(o.balance),
      }));
      return [...summary, ...detail];
    },
  },
  "clientes-con-mas-deuda": {
    title: "Clientes con más deuda",
    group: "Clientes y crédito",
    async run(db, actor, range) {
      const phone = phoneFor(actor);
      const by = new Map<string, Open[]>();
      for (const o of await openReceivables(db, actor, range.lte))
        if (o.customerId)
          by.set(o.customerId, [...(by.get(o.customerId) ?? []), o]);
      return [...by.values()]
        .map((list) => ({
          Cliente: list[0].name,
          Teléfono: phone(list[0].phone),
          "Facturas abiertas": list.length,
          Deuda: num(list.reduce((t, o) => t + Number(o.balance), 0)),
          "Factura más antigua": list[0].sold,
          "Días de la más antigua": list[0].days,
        }))
        .sort((a, b) => b.Deuda - a.Deuda);
    },
  },
  "clientes-nuevos-por-mes": {
    title: "Clientes nuevos por mes",
    group: "Clientes y crédito",
    async run(db, actor, range) {
      const rows = (await db.$queryRaw`
        SELECT ${month(Prisma.sql`c."createdAt"`)} AS month, COUNT(DISTINCT c.id)::int AS n,
          COUNT(DISTINCT s."customerId")::int AS buyers
        FROM "Customer" c
          LEFT JOIN "Sale" s ON s."customerId" = c.id AND s.status = 'completed'
        WHERE c."branchId" = ${actor.branchId}
          AND c."createdAt" >= ${utc(range.gte)} AND c."createdAt" <= ${utc(range.lte)}
        GROUP BY 1 ORDER BY 1`) as {
        month: string;
        n: number;
        buyers: number;
      }[];
      return rows.map((r) => ({
        Mes: r.month,
        "Clientes nuevos": r.n,
        "Ya compraron": r.buyers,
      }));
    },
  },
  "frecuencia-de-compra": {
    title: "Frecuencia de compra por cliente",
    group: "Clientes y crédito",
    async run(db, actor, range) {
      const phone = phoneFor(actor);
      const rows = (await db.$queryRaw`
        SELECT c.name, c.phone, COUNT(*)::int AS n,
          SUM(s.total - COALESCE(rt.t, 0)) AS net,
          MIN(${local(Prisma.sql`s."createdAt"`)}::date) AS first,
          MAX(${local(Prisma.sql`s."createdAt"`)}::date) AS last,
          ${day(Prisma.sql`MAX(s."createdAt")`)} AS "lastDay"
        FROM "Sale" s JOIN "Customer" c ON c.id = s."customerId" ${RETURNS}
        WHERE s."branchId" = ${actor.branchId} AND s.status = 'completed'
          AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)}
        GROUP BY c.id, c.name, c.phone
        ORDER BY n DESC, net DESC`) as {
        name: string;
        phone: string | null;
        n: number;
        net: unknown;
        first: Date;
        last: Date;
        lastDay: string;
      }[];
      return rows.map((r) => ({
        Cliente: r.name,
        Teléfono: phone(r.phone),
        Compras: r.n,
        "Ventas netas": num(r.net),
        // Días entre la primera y la última compra repartidos entre los intervalos.
        "Promedio de días entre compras":
          r.n > 1
            ? Math.round(((+r.last - +r.first) / 86400000 / (r.n - 1)) * 10) /
              10
            : null,
        "Última compra": r.lastDay,
      }));
    },
  },
  "clientes-inactivos": {
    title: "Clientes inactivos (60 días sin comprar)",
    group: "Clientes y crédito",
    // Inactividad a hoy: el período del filtro no aplica (una compra de
    // después del «hasta» también la saca de la lista).
    async run(db, actor) {
      const phone = phoneFor(actor);
      const rows = (await db.$queryRaw`
        SELECT c.name, c.phone, COUNT(*)::int AS n,
          SUM(s.total - COALESCE(rt.t, 0)) AS net,
          ${day(Prisma.sql`MAX(s."createdAt")`)} AS "lastDay",
          (${TODAY} - MAX(${local(Prisma.sql`s."createdAt"`)})::date)::int AS days
        FROM "Sale" s JOIN "Customer" c ON c.id = s."customerId" ${RETURNS}
        WHERE s."branchId" = ${actor.branchId} AND s.status = 'completed'
          AND c."anonymizedAt" IS NULL
        GROUP BY c.id, c.name, c.phone
        HAVING (${TODAY} - MAX(${local(Prisma.sql`s."createdAt"`)})::date) > 60
        ORDER BY days, net DESC`) as {
        name: string;
        phone: string | null;
        n: number;
        net: unknown;
        lastDay: string;
        days: number;
      }[];
      return rows.map((r) => ({
        Cliente: r.name,
        Teléfono: phone(r.phone),
        "Última compra": r.lastDay,
        "Días sin comprar": r.days,
        Compras: r.n,
        "Ventas netas": num(r.net),
      }));
    },
  },
  "cobros-por-mes": {
    title: "Cobros recibidos por mes y forma de pago",
    group: "Clientes y crédito",
    async run(db, actor, range) {
      // Sólo abonos de crédito / contraentrega ya verificados (status ok): una
      // transferencia pendiente o rechazada no es dinero cobrado.
      const rows = (await db.$queryRaw`
        SELECT ${month(Prisma.sql`p."createdAt"`)} AS month, p.method,
          COUNT(*)::int AS n, SUM(p.amount) AS amount
        FROM "Payment" p JOIN "Sale" s ON s.id = p."saleId"
        WHERE s."branchId" = ${actor.branchId} AND p."entryType" = 'installment'
          AND p.status = 'ok'
          AND p."createdAt" >= ${utc(range.gte)} AND p."createdAt" <= ${utc(range.lte)}
        GROUP BY 1, 2 ORDER BY 1, 2`) as {
        month: string;
        method: string;
        n: number;
        amount: unknown;
      }[];
      return rows.map((r) => ({
        Mes: r.month,
        "Forma de pago": METHODS[r.method] ?? r.method,
        Cobros: r.n,
        Monto: num(r.amount),
      }));
    },
  },
};

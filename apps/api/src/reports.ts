import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import {
  businessDate,
  expiryDays,
  BUSINESS_TIME_ZONE,
  abc,
  money,
  d,
  margin,
  netProfit,
  averageTicket,
  can,
  bookedLineCosts,
  replayReturns,
  returnedAt,
  PAYMENT_GROUPS,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  bad,
  parse,
  uuid,
  safe,
  denied,
  canViewCashExpected,
} from "./common";
import { alertForActor } from "./alerts";

export function dateRange(query: Record<string, string>) {
  const from = query.from
    ? new Date(query.from + "T00:00:00-04:00")
    : new Date(Date.now() - 30 * 86400000);
  const to = query.to ? new Date(query.to + "T23:59:59.999-04:00") : new Date();
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
    bad("Rango de fechas inválido.");
  return { gte: from, lte: to };
}
// Prisma guarda DateTime como «timestamp sin zona» en UTC, pero un Date de JS
// llega al SQL crudo como timestamptz: al compararlo con la columna, PostgreSQL
// la convertiría con la zona horaria de la sesión y, en UTC-4, el período se
// corría cuatro horas respecto a los totales del ORM. Se compara con la hora
// UTC, que además deja usar el índice de la columna.
const utc = (date: Date) =>
  Prisma.sql`(${date}::timestamptz AT TIME ZONE 'UTC')`;
const sum = (rows: any[], field: string) =>
  money(rows.reduce((total, row) => total.plus(row[field] ?? 0), d(0)));
const group = (
  rows: any[],
  key: (row: any) => string,
  value: (row: any) => number,
) => {
  const result = new Map<string, number>();
  for (const row of rows) {
    const label = key(row);
    result.set(label, money(d(result.get(label) || 0).plus(value(row))));
  }
  return [...result]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
};

// PERF-informes: ningún informe carga todas las ventas del período. Con ~300
// ventas al día, el mes en curso (lo que abre Reportes) agotaba el montón de
// 256 MB de la API en Render. Los totales se agregan en PostgreSQL y lo que
// necesita la lógica de la API (costos contabilizados, devoluciones) se recorre
// por lotes con sólo las columnas necesarias; nunca comprobantes en base64.
const SALE_BATCH = 2000;
const RETURN_BATCH = 300;
// Listados que crecen con el historial: página en JSON y exportación por lotes.
export const LISTING_PAGE = { default: 500, max: 2000 };
export const EXPORT_LIMIT: Record<string, number> = { xlsx: 50000, pdf: 10000 };
// Utilidad y ABC: facturas que se recorren en un pedido (unos 4 meses).
export const PROFIT_LIMIT = 40000;
// Mismo filtro que `saleWhere`, en SQL sobre el alias «s».
function saleSql(
  actor: Actor,
  range: { gte: Date; lte: Date },
  sellerId?: string,
  method?: string,
) {
  return Prisma.sql`s."branchId" = ${actor.branchId} AND s.status = 'completed' AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)}${sellerId ? Prisma.sql` AND s."sellerId" = ${sellerId}::uuid` : Prisma.empty}${method ? Prisma.sql` AND EXISTS (SELECT 1 FROM "Payment" pm WHERE pm."saleId" = s.id AND pm.method = ${method})` : Prisma.empty}`;
}
const addTo = (map: Map<string, any>, key: string, amount: unknown) =>
  map.set(key, (map.get(key) ?? d(0)).plus(amount as any));

// D-05: una sola definición de venta neta en todos los informes de ventas.
// Lo vendido en el período (por la fecha de la venta) menos lo devuelto en el
// período (por la fecha de la devolución), igual que «ingresos» del dashboard.
// Cada desglose descuenta la devolución en su propia dimensión: día de la
// devolución, vendedor y categoría de la venta original, y forma de pago (lo
// reembolsado con su método; lo que redujo la deuda, con el crédito o la
// contraentrega de la venta).
async function periodReturns(
  db: Database,
  actor: Actor,
  range: { gte: Date; lte: Date },
  sale?: Record<string, unknown>,
  cursor?: string,
) {
  // Por lotes (forEachPeriodReturn): sin cargar todas las del período.
  return db.saleReturn.findMany({
    where: {
      branchId: actor.branchId,
      createdAt: range,
      ...(sale ? { sale } : {}),
    },
    orderBy: { id: "asc" },
    take: RETURN_BATCH,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sale: {
        select: {
          sellerId: true,
          payments: { select: { method: true, entryType: true } },
          items: {
            select: {
              id: true,
              qty: true,
              lineTotal: true,
              variant: {
                select: {
                  product: {
                    select: {
                      category: { select: { name: true, color: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
type PeriodReturn = Awaited<ReturnType<typeof periodReturns>>[number];
// Importe devuelto de cada forma de pago.
function returnedByMethod(r: PeriodReturn, includeRefund = true) {
  const parts: { method: string; amount: ReturnType<typeof d> }[] = [];
  if (includeRefund && d(r.refundAmount).gt(0))
    parts.push({ method: r.refundMethod, amount: d(r.refundAmount) });
  const debt = d(r.total).minus(r.refundAmount);
  if (debt.gt(0))
    parts.push({
      method:
        r.sale.payments.find(
          (p) =>
            p.entryType !== "installment" &&
            (p.method === "credit" || p.method === "cod"),
        )?.method ?? "credit",
      amount: debt,
    });
  return parts;
}
// Importe devuelto de cada categoría: lo registrado en cada parte o, en
// devoluciones antiguas sin ese dato, la proporción de la línea.
function returnedByCategory(r: PeriodReturn) {
  return (r.items as any[]).flatMap((part) => {
    const line = r.sale.items.find((i) => i.id === part.saleItemId);
    if (!line) return [];
    const amount =
      typeof part.total === "number"
        ? d(part.total)
        : d(line.lineTotal).times(part.qty).dividedBy(line.qty);
    return [{ category: line.variant.product.category, amount }];
  });
}
async function forEachPeriodReturn(
  db: Database,
  actor: Actor,
  range: { gte: Date; lte: Date },
  sale: Record<string, unknown> | undefined,
  visit: (r: PeriodReturn) => void,
) {
  for (let cursor: string | undefined; ;) {
    const page = await periodReturns(db, actor, range, sale, cursor);
    page.forEach(visit);
    if (page.length < RETURN_BATCH) return;
    cursor = page[page.length - 1].id;
  }
}
// D-05 del dashboard: lo devuelto en el período por día, categoría, forma de
// pago (lo reembolsado en cajas ocultas no se desglosa) y vendedor.
async function returnedBreakdown(
  db: Database,
  actor: Actor,
  range: { gte: Date; lte: Date },
  hiddenOpenCashSessionIds: string[],
) {
  const days = new Map<string, any>(),
    categories = new Map<string, any>(),
    colors = new Map<string, string>(),
    methods = new Map<string, any>(),
    sellers = new Map<string, any>();
  await forEachPeriodReturn(db, actor, range, undefined, (r) => {
    addTo(days, businessDate(r.createdAt), r.total);
    for (const { category, amount } of returnedByCategory(r)) {
      addTo(categories, category.name, amount);
      if (!colors.has(category.name)) colors.set(category.name, category.color);
    }
    for (const m of returnedByMethod(
      r,
      !r.cashSessionId || !hiddenOpenCashSessionIds.includes(r.cashSessionId),
    ))
      addTo(methods, m.method, m.amount);
    addTo(sellers, r.sale.sellerId, r.total);
  });
  const list = (map: Map<string, any>) =>
    [...map].map(([key, amount]) => ({ key, amount }));
  return {
    days: list(days),
    categories: list(categories),
    colors,
    methods: list(methods),
    sellers: list(sellers),
  };
}
@Controller()
export class ReportsController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("dashboard/summary")
  @Permit("reports:read")
  async dashboard(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
  ) {
    const range = dateRange(query);
    const where = {
      branchId: actor.branchId,
      status: "completed",
      createdAt: range,
    };
    // Los mismos límites para los paneles en SQL crudo.
    const since = utc(range.gte),
      until = utc(range.lte);
    const priorYearStart = new Date(range.gte);
    priorYearStart.setUTCFullYear(priorYearStart.getUTCFullYear() - 1);
    const priorYearEnd = new Date(range.lte);
    priorYearEnd.setUTCFullYear(priorYearEnd.getUTCFullYear() - 1);
    const previousRange = {
      gte: new Date(+range.gte - (+range.lte - +range.gte)),
      lt: range.gte,
    };
    // El dashboard conserva los totales operativos, pero para quien no puede
    // ver el arqueo no desglosa cómo se cobraron ventas que todavía pertenecen
    // a cajas abiertas. De lo contrario `payments` revela el efectivo/tarjeta/
    // transferencia esperado antes del cierre.
    const hiddenOpenCashSessionIds = canViewCashExpected(actor)
      ? []
      : (
          await this.db.cashSession.findMany({
            where: { branchId: actor.branchId, closedAt: null },
            select: { id: true },
          })
        ).map((session) => session.id);
    const [
      sales,
      returns,
      expenses,
      previous,
      variants,
      alerts,
      daily,
      category,
      payments,
      top,
      sellers,
      priorYear,
      priorYearReturns,
      peakHours,
      previousReturns,
      collected,
      returned,
    ] = await Promise.all([
      this.db.sale.aggregate({
        where,
        _sum: { total: true, taxTotal: true, costTotal: true },
        _count: true,
      }),
      this.db.saleReturn.aggregate({
        where: { branchId: actor.branchId, createdAt: range },
        _sum: { total: true, taxTotal: true, costTotal: true },
      }),
      this.db.expense.aggregate({
        where: { branchId: actor.branchId, voided: false, date: range },
        _sum: { amount: true },
      }),
      this.db.sale.aggregate({
        where: {
          branchId: actor.branchId,
          status: "completed",
          createdAt: previousRange,
        },
        _sum: { total: true },
      }),
      this.db.$queryRaw<
        any[]
      >`SELECT SUM(stock * "costAvg") AS cost, SUM(stock * price) AS retail FROM "Variant" WHERE "branchId"=${actor.branchId} AND active=true`,
      this.db.alert.findMany({
        where: { branchId: actor.branchId, status: { not: "resolved" } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      this.db.$queryRaw<
        any[]
      >`SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo','YYYY-MM-DD') AS day, SUM(total) AS total FROM "Sale" WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${since} AND "createdAt"<=${until} GROUP BY day ORDER BY day`,
      this.db.$queryRaw<
        any[]
      >`SELECT c.name,c.color,SUM(i."lineTotal") AS total FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Variant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId" JOIN "Category" c ON c.id=p."categoryId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${since} AND s."createdAt"<=${until} GROUP BY c.name,c.color ORDER BY total DESC`,
      // Cómo se cobraron las ventas del período: el crédito es su propio
      // método y sus abonos no se suman otra vez (R9-dinero-9).
      this.db.payment.groupBy({
        by: ["method"],
        where: {
          sale: where,
          entryType: { not: "installment" },
          ...(hiddenOpenCashSessionIds.length
            ? {
                OR: [
                  { cashSessionId: null },
                  { cashSessionId: { notIn: hiddenOpenCashSessionIds } },
                ],
              }
            : {}),
        },
        _sum: { amount: true, feeAmount: true },
      }),
      this.db.$queryRaw<
        any[]
      >`SELECT p.name,c.name AS category, SUM(i.qty-i."returnedQty") AS units,SUM(i."lineTotal"*(1-i."returnedQty"/i.qty)) AS revenue FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Variant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId" JOIN "Category" c ON c.id=p."categoryId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${since} AND s."createdAt"<=${until} GROUP BY p.id,p.name,c.name ORDER BY revenue DESC LIMIT 10`,
      this.db.$queryRaw<
        any[]
      >`SELECT u.name,SUM(s.total) AS total FROM "Sale" s JOIN "User" u ON u.id=s."sellerId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${since} AND s."createdAt"<=${until} GROUP BY u.name ORDER BY total DESC`,
      this.db.sale.aggregate({
        where: {
          branchId: actor.branchId,
          status: "completed",
          createdAt: { gte: priorYearStart, lte: priorYearEnd },
        },
        _sum: { total: true },
      }),
      this.db.saleReturn.aggregate({
        where: {
          branchId: actor.branchId,
          createdAt: { gte: priorYearStart, lte: priorYearEnd },
        },
        _sum: { total: true },
      }),
      this.db.$queryRaw<
        any[]
      >`SELECT EXTRACT(ISODOW FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo'))::int AS day, EXTRACT(HOUR FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo'))::int AS hour, COUNT(*)::int AS invoices, SUM(total) AS total FROM "Sale" WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${since} AND "createdAt"<=${until} GROUP BY day,hour ORDER BY day,hour`,
      // La tendencia compara ingresos netos de devoluciones (R9-dinero-10).
      this.db.saleReturn.aggregate({
        where: { branchId: actor.branchId, createdAt: previousRange },
        _sum: { total: true },
      }),
      // Abonos cobrados en el período (fecha del abono, no de la venta): su
      // comisión bancaria es gasto del período en que entró (R9-dinero-9).
      this.db.payment.aggregate({
        where: {
          entryType: "installment",
          status: "ok",
          createdAt: range,
          sale: { branchId: actor.branchId, status: "completed" },
        },
        _sum: { feeAmount: true },
      }),
      returnedBreakdown(this.db, actor, range, hiddenOpenCashSessionIds),
    ]);
    // D-05: los desgloses descuentan las mismas devoluciones que «revenue».
    const netOf = <T>(
      rows: T[],
      key: (row: T) => string,
      value: (row: T) => unknown,
      returns: { key: string; amount: unknown }[],
    ) => {
      const out = new Map<string, ReturnType<typeof d>>();
      for (const row of rows)
        out.set(key(row), (out.get(key(row)) ?? d(0)).plus(value(row) as any));
      for (const r of returns)
        out.set(r.key, (out.get(r.key) ?? d(0)).minus(r.amount as any));
      return out;
    };
    const dailyNet = netOf(
      daily,
      (i) => i.day,
      (i) => i.total,
      returned.days,
    );
    const colors = new Map<string, string>();
    for (const c of category) colors.set(c.name, c.color);
    for (const [name, color] of returned.colors)
      if (!colors.has(name)) colors.set(name, color);
    const categoryNet = netOf(
      category,
      (i) => i.name,
      (i) => i.total,
      returned.categories,
    );
    const paymentsNet = netOf(
      payments,
      (p) => p.method,
      (p) => p._sum.amount ?? 0,
      returned.methods,
    );
    const sellerIds = returned.sellers.map((r) => r.key);
    const sellerNames = new Map(
      (sellerIds.length
        ? await this.db.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, name: true },
          })
        : []
      ).map((u) => [u.id, u.name]),
    );
    const sellersNet = netOf(
      sellers,
      (i) => i.name,
      (i) => i.total,
      returned.sellers.map((r) => ({
        key: sellerNames.get(r.key) ?? r.key,
        amount: r.amount,
      })),
    );
    const byAmount = (a: { total: number }, b: { total: number }) =>
      b.total - a.total;
    const revenue = money(
        d(sales._sum.total ?? 0).minus(returns._sum.total ?? 0),
      ),
      tax = money(
        d(sales._sum.taxTotal ?? 0).minus(returns._sum.taxTotal ?? 0),
      ),
      net = money(d(revenue).minus(tax)),
      cost = money(
        d(sales._sum.costTotal ?? 0).minus(returns._sum.costTotal ?? 0),
      ),
      expense = Number(expenses._sum.amount ?? 0),
      fees = money(
        payments.reduce(
          (a, p) => a.plus(p._sum.feeAmount ?? 0),
          d(collected._sum.feeAmount ?? 0),
        ),
      ),
      prior = money(
        d(previous._sum.total ?? 0).minus(previousReturns._sum.total ?? 0),
      );
    return safe(
      {
        revenue,
        previousYearRevenue: money(
          d(priorYear._sum.total ?? 0).minus(priorYearReturns._sum.total ?? 0),
        ),
        yearOverYear:
          Number(priorYear._sum.total ?? 0) -
            Number(priorYearReturns._sum.total ?? 0) >
          0
            ? money(
                (revenue /
                  (Number(priorYear._sum.total ?? 0) -
                    Number(priorYearReturns._sum.total ?? 0)) -
                  1) *
                  100,
              )
            : null,
        peakHours: peakHours.map((row) => ({
          ...row,
          total: Number(row.total),
        })),
        netSales: net,
        tax,
        costTotal: cost,
        grossProfit: money(d(net).minus(cost)),
        expenses: expense,
        netProfit: netProfit(net, cost, expense, fees),
        margin: margin(net, cost),
        fees,
        invoices: sales._count,
        ticketAverage: averageTicket(revenue, sales._count),
        // Con un neto anterior en cero o negativo no hay base de comparación.
        trend: prior > 0 ? money(((revenue - prior) / prior) * 100) : 0,
        inventoryCost: Number(variants[0]?.cost ?? 0),
        inventoryRetail: Number(variants[0]?.retail ?? 0),
        daily: [...dailyNet]
          .map(([day, total]) => ({ day, total: money(total) }))
          .sort((a, b) => a.day.localeCompare(b.day)),
        category: [...categoryNet]
          .map(([name, total]) => ({
            name,
            color: colors.get(name),
            total: money(total),
          }))
          .sort(byAmount),
        payments: [...paymentsNet].map(([name, amount]) => ({
          name,
          amount: money(amount),
        })),
        top: top.map((i) => ({
          ...i,
          units: Number(i.units),
          revenue: Number(i.revenue),
        })),
        sellers: [...sellersNet]
          .map(([name, total]) => ({ name, total: money(total) }))
          .sort(byAmount),
        alerts: alerts.map((alert) => alertForActor(alert, actor)),
        from: range.gte,
        to: range.lte,
      },
      actor,
    );
  }
  @Get("reports/:name")
  @Permit("reports:read")
  async report(
    @Param("name") name: string,
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    if (
      [
        "profit",
        "inventory-value",
        "abc",
        "income-statement",
        "purchases",
      ].includes(name) &&
      (actor.role === "seller" || !can(actor.permissions, "profit:read"))
    )
      denied();
    if (name === "cash" && !canViewCashExpected(actor)) denied();
    if (name === "by-payment" && !canViewCashExpected(actor)) {
      const openCashSession = await this.db.cashSession.findFirst({
        where: { branchId: actor.branchId, closedAt: null },
        select: { id: true },
      });
      if (openCashSession) denied();
    }
    if (STORE_REPORTS.includes(name))
      return sendStoreReport(
        res,
        await storeReport(this.db, actor, name, query),
        query.format,
      );
    const range = dateRange(query);
    const saleWhere: any = {
      branchId: actor.branchId,
      status: "completed",
      createdAt: range,
      ...(query.sellerId ? { sellerId: parse(uuid, query.sellerId) } : {}),
      ...(query.method ? { payments: { some: { method: query.method } } } : {}),
    };
    // Las devoluciones del período de esas mismas ventas (de cualquier fecha).
    const { createdAt: _saleDate, ...returnSaleWhere } = saleWhere;
    if (query.categoryId) parse(uuid, query.categoryId);
    // El catálogo completo sólo para los informes de inventario.
    const variants = [
      "inventory-value",
      "low-stock",
      "expiring",
      "no-movement",
    ].includes(name)
      ? await this.db.variant.findMany({
          where: {
            branchId: actor.branchId,
            active: true,
            ...(query.categoryId
              ? { product: { categoryId: parse(uuid, query.categoryId) } }
              : {}),
          },
          include: {
            product: { include: { category: true } },
            lots: { where: { qty: { gt: 0 } } },
          },
        })
      : [];
    const baseVariants = variants.map((v) => ({
      SKU: v.sku,
      Producto: v.product.name,
      Categoría: v.product.category.name,
      Stock: Number(v.stock),
      Costo: Number(v.costAvg),
      Precio: Number(v.price),
      Valor: money(d(v.stock).times(v.costAvg)),
    }));
    let rows: any[] = [];
    if (name === "inventory-value") rows = baseVariants;
    else if (name === "low-stock")
      rows = baseVariants
        .filter((v, i) => v.Stock <= Number(variants[i].product.minStock))
        .map((v) => ({ ...v, Sugerido: Math.max(0, 20 - v.Stock) }));
    else if (name === "expiring")
      rows = variants.flatMap((v) =>
        v.lots
          .filter(
            (l) =>
              l.expiryDate &&
              expiryDays(l.expiryDate) <= Number(query.days ?? 60),
          )
          .map((l) => ({
            SKU: v.sku,
            Producto: v.product.name,
            Lote: l.lotNumber,
            Vencimiento: l.expiryDate ? businessDate(l.expiryDate) : "",
            Cantidad: Number(l.qty),
          })),
      );
    else if (name === "expenses")
      rows = (
        await this.db.expense.findMany({
          where: { branchId: actor.branchId, voided: false, date: range },
          include: { category: true },
        })
      ).map((e) => ({
        Fecha: e.date.toLocaleDateString("en-CA", {
          timeZone: BUSINESS_TIME_ZONE,
        }),
        Categoría: e.category.name,
        Descripción: e.description,
        Monto: Number(e.amount),
        Presupuesto: Number(e.category.monthlyBudget),
      }));
    else if (name === "cash")
      rows = (
        await this.db.cashSession.findMany({
          where: { branchId: actor.branchId, openedAt: range },
        })
      ).map((s) => ({
        Fecha: s.openedAt.toLocaleString("es-DO", {
          timeZone: BUSINESS_TIME_ZONE,
        }),
        Usuario: s.userId,
        Estado: s.closedAt ? "Cerrada" : "Abierta",
        Esperado: Number(s.expectedCash ?? 0),
        Contado: Number(s.countedCash ?? 0),
        Diferencia_efectivo: Number(s.differenceCash ?? 0),
        Diferencia_tarjeta: Number(s.differenceCard ?? 0),
        Diferencia_transferencia: Number(s.differenceTransfer ?? 0),
      }));
    else if (name === "income-statement") {
      const summary: any = await this.dashboard(query, actor);
      rows = [
        { Concepto: "Ventas sin ITBIS", Monto: summary.netSales },
        { Concepto: "Costo de lo vendido", Monto: summary.costTotal },
        { Concepto: "Ganancia bruta", Monto: summary.grossProfit },
        { Concepto: "Gastos", Monto: summary.expenses },
        { Concepto: "Comisiones bancarias", Monto: summary.fees },
        { Concepto: "Ganancia neta", Monto: summary.netProfit },
      ];
    } else if (name === "purchases") {
      // Compras = lo recibido/facturado y aceptado (total de cada recepción:
      // líneas al costo real, flete e impuestos), con o sin orden. La orden es
      // un compromiso y se muestra aparte; nunca se suma a la deuda (R4-04).
      // Recepciones sin proveedor o sin total quedan "sin conciliar" (R4-02).
      const [orders, receipts, payments] = await Promise.all([
        this.db.purchaseOrder.findMany({
          where: { branchId: actor.branchId, createdAt: range },
        }),
        this.db.goodsReceipt.findMany({
          where: { branchId: actor.branchId, createdAt: range },
          include: { order: { select: { supplierId: true } } },
        }),
        this.db.supplierPayment.findMany({
          where: { branchId: actor.branchId, createdAt: range },
        }),
      ]);
      const suppliers = await this.db.supplier.findMany({
        where: { branchId: actor.branchId },
      });
      const supplierOf = (r: (typeof receipts)[number]) =>
        r.supplierId ?? r.order?.supplierId ?? null;
      rows = suppliers.map((s) => {
        const own = receipts.filter((r) => supplierOf(r) === s.id);
        const bought = d(
          sum(
            own.filter((r) => r.total != null),
            "total",
          ),
        );
        const paid = sum(
          payments.filter((p) => p.supplierId === s.id),
          "amount",
        );
        return {
          Proveedor: s.name,
          Ordenado: sum(
            orders.filter((o) => o.supplierId === s.id),
            "total",
          ),
          Compras: money(bought),
          Pagado: paid,
          Pendiente: money(bought.minus(paid)),
          Sin_conciliar: own.filter((r) => r.total == null).length,
        };
      });
      const orphan = receipts.filter((r) => !supplierOf(r)).length;
      if (orphan)
        rows.push({
          Proveedor: "Recepciones sin proveedor (conciliar)",
          Ordenado: 0,
          Compras: 0,
          Pagado: 0,
          Pendiente: 0,
          Sin_conciliar: orphan,
        });
    } else if (name === "no-movement") {
      const last = await this.db.saleItem.groupBy({
        by: ["variantId"],
        where: {
          sale: {
            branchId: actor.branchId,
            status: "completed",
            createdAt: {
              gte: new Date(Date.now() - Number(query.days ?? 60) * 86400000),
            },
          },
        },
        _count: true,
      });
      rows = baseVariants.filter(
        (v, i) =>
          v.Stock > 0 && !last.some((l) => l.variantId === variants[i].id),
      );
    } else if (LISTINGS.includes(name))
      return sendListing(
        res,
        name,
        query,
        actor,
        range,
        listing(this.db, name, actor, range, saleWhere),
      );
    else {
      // Informes de ventas: agregados en PostgreSQL o recorridos por lotes,
      // nunca todas las ventas del período en memoria (PERF-informes).
      const sellerId = saleWhere.sellerId as string | undefined;
      const filter = saleSql(actor, range, sellerId, query.method);
      const inCategory = query.categoryId
        ? Prisma.sql` AND p."categoryId"::text = ${query.categoryId}`
        : Prisma.empty;
      // Orden de aparición de cada grupo (la venta más reciente primero), como
      // cuando se recorrían las ventas: decide los empates de `group`.
      if (name === "monthly-consumption")
        rows = group(
          await this.db.$queryRaw<
            any[]
          >`SELECT to_char((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo','YYYY-MM') AS month, p.name, SUM(i.qty - i."returnedQty") AS units FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId" WHERE ${filter}${inCategory} GROUP BY 1, 2 ORDER BY MAX(s."createdAt") DESC`,
          (i) => i.month + " · " + i.name,
          (i) => Number(i.units),
        ).map((g) => ({ Mes_Producto: g.name, Unidades: g.amount }));
      else if (name === "by-seller") {
        const sold = await this.db.$queryRaw<
          { seller: string; total: unknown }[]
        >`SELECT s."sellerId" AS seller, SUM(s.total) AS total FROM "Sale" s WHERE ${filter} GROUP BY 1 ORDER BY MAX(s."createdAt") DESC`;
        // D-05: neto de las devoluciones del período, como el dashboard.
        const returned = new Map<string, any>();
        await forEachPeriodReturn(this.db, actor, range, returnSaleWhere, (r) =>
          addTo(returned, r.sale.sellerId, r.total),
        );
        const ids = [
          ...new Set([...sold.map((s) => s.seller), ...returned.keys()]),
        ];
        const users = new Map(
          (ids.length
            ? await this.db.user.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true },
              })
            : []
          ).map((u) => [u.id, u.name]),
        );
        rows = group(
          [
            ...sold,
            ...[...returned].map(([seller, total]) => ({
              seller,
              total: d(total).negated(),
            })),
          ],
          (s) => users.get(s.seller) || s.seller,
          (s) => Number(s.total),
        ).map((g) => ({ Vendedor: g.name, Ventas: g.amount }));
      } else if (name === "by-payment") {
        // Dos columnas que no se suman entre sí (R9-dinero-9). Ventas: cómo se
        // cobraron las facturas del período, con el crédito como método
        // propio; su suma es la venta neta (D-05). Cobros de crédito: abonos verificados
        // por la fecha en que entraron, aunque la venta sea de otro período.
        const [sold, collected] = await Promise.all([
          this.db.$queryRaw<
            { method: string; amount: unknown }[]
          >`SELECT p.method, SUM(p.amount) AS amount FROM "Payment" p JOIN "Sale" s ON s.id = p."saleId" WHERE ${filter} AND p."entryType" <> 'installment' GROUP BY p.method ORDER BY MAX(s."createdAt") DESC`,
          this.db.payment.groupBy({
            by: ["method"],
            where: {
              entryType: "installment",
              status: "ok",
              createdAt: range,
              ...(query.method ? { method: query.method } : {}),
              sale: {
                branchId: actor.branchId,
                status: "completed",
                ...(sellerId ? { sellerId } : {}),
              },
            },
            _sum: { amount: true },
          }),
        ]);
        const methods = new Map<
          string,
          { sold: ReturnType<typeof d>; collected: ReturnType<typeof d> }
        >();
        const of = (method: string) => {
          if (!methods.has(method))
            methods.set(method, { sold: d(0), collected: d(0) });
          return methods.get(method)!;
        };
        for (const p of sold)
          of(p.method).sold = of(p.method).sold.plus(p.amount as any);
        // D-05: Ventas es neto de las devoluciones del período, como el
        // dashboard: lo reembolsado se descuenta de su método.
        await forEachPeriodReturn(
          this.db,
          actor,
          range,
          returnSaleWhere,
          (r) => {
            for (const m of returnedByMethod(r))
              of(m.method).sold = of(m.method).sold.minus(m.amount);
          },
        );
        for (const p of collected)
          of(p.method).collected = of(p.method).collected.plus(
            p._sum.amount ?? 0,
          );
        rows = [...methods]
          .map(([method, m]) => ({
            Método: method,
            Ventas: money(m.sold),
            Cobros_de_crédito: money(m.collected),
          }))
          .sort(
            (a, b) =>
              b.Ventas + b.Cobros_de_crédito - (a.Ventas + a.Cobros_de_crédito),
          );
      } else if (name === "profit" || name === "abc") {
        const grouped = new Map<string, any>();
        const rowOf = (variant: {
          productId: string;
          product: { name: string; category: { name: string } };
        }) =>
          grouped.get(variant.productId) ?? {
            Producto: variant.product.name,
            Categoría: variant.product.category.name,
            Ventas: 0,
            Costo: 0,
            Unidades: 0,
          };
        const lineSelect = {
          select: {
            id: true,
            qty: true,
            unitCost: true,
            variantId: true,
            stockAllocations: true,
            lineTotal: true,
            tax: true,
            variant: {
              select: {
                productId: true,
                product: {
                  select: {
                    name: true,
                    categoryId: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { id: "asc" as const },
        };
        // Lo contabilizado por línea: el costo redondeado de cada una o, en
        // ventas anteriores a la ronda 7 final, Sale.costTotal repartido. Se
        // reparte sobre todas las líneas de la venta, antes de filtrar por
        // categoría, para que cuadre con el dashboard (R9-dinero-7).
        // El costo contabilizado se calcula venta por venta en la API: con
        // un período muy largo la respuesta tardaría más que el plazo del
        // proxy (60 s en Render). Se avisa antes de empezar.
        const [{ invoices }] = await this.db.$queryRaw<
          { invoices: number }[]
        >`SELECT COUNT(*)::int AS invoices FROM "Sale" s WHERE ${filter}`;
        if (invoices > PROFIT_LIMIT)
          bad(
            `El período tiene ${count(invoices)} facturas y la utilidad por producto se calcula con hasta ${count(PROFIT_LIMIT)}. Selecciona un período más corto.`,
          );
        // Lotes de ventas con sus líneas en una consulta plana; el lote
        // siguiente se pide mientras se procesa el actual.
        const salesBatch = (cursor?: { at: Date; id: string }) => {
          const batch = this.db.$queryRaw<
            any[]
          >`WITH b AS (SELECT s.id, s."costTotal", s."createdAt" FROM "Sale" s WHERE ${filter}${cursor ? Prisma.sql` AND (s."createdAt", s.id) < (${utc(cursor.at)}, ${cursor.id}::uuid)` : Prisma.empty} ORDER BY s."createdAt" DESC, s.id DESC LIMIT ${SALE_BATCH}) SELECT b.id AS "saleId", b."costTotal", b."createdAt", i.id, i.qty, i."unitCost", i."variantId", i."stockAllocations", i."lineTotal" - i.tax AS net, v."productId", p.name, p."categoryId"::text AS "categoryId", c.name AS category FROM b LEFT JOIN "SaleItem" i ON i."saleId" = b.id LEFT JOIN "Variant" v ON v.id = i."variantId" LEFT JOIN "Product" p ON p.id = v."productId" LEFT JOIN "Category" c ON c.id = p."categoryId" ORDER BY b."createdAt" DESC, b.id DESC, i.id`;
          // Si el lote en curso falla, este no queda como rechazo sin atender.
          batch.catch(() => undefined);
          return batch;
        };
        for (let next: Promise<any[]> | undefined = salesBatch(); next;) {
          const lines: any[] = await next;
          const sales: { costTotal: unknown; items: any[] }[] = [];
          let last: string | undefined;
          for (const l of lines) {
            if (l.saleId !== last)
              sales.push({ costTotal: l.costTotal, items: [] });
            last = l.saleId;
            if (l.id)
              sales[sales.length - 1].items.push({
                id: l.id,
                qty: l.qty,
                unitCost: l.unitCost,
                variantId: l.variantId,
                stockAllocations: l.stockAllocations,
                net: l.net,
                variant: {
                  productId: l.productId,
                  product: {
                    name: l.name,
                    categoryId: l.categoryId,
                    category: { name: l.category },
                  },
                },
              });
          }
          const end: any = lines[lines.length - 1];
          next =
            sales.length < SALE_BATCH
              ? undefined
              : salesBatch({ at: end.createdAt, id: end.saleId });
          for (const s of sales) {
            const booked = bookedLineCosts(s as any);
            for (const i of s.items) {
              if (
                query.categoryId &&
                i.variant.product.categoryId !== query.categoryId
              )
                continue;
              const row = rowOf(i.variant);
              // Sin redondear hasta el final: ventas y devoluciones parciales se
              // compensan exactamente.
              row.Ventas = d(row.Ventas).plus(i.net);
              row.Costo = d(row.Costo).plus(booked.get(i.id)!);
              row.Unidades += Number(i.qty);
              grouped.set(i.variant.productId, row);
            }
          }
        }
        // Lo que contabilizó cada parte de cada devolución (R8-02, R9-dinero-1,
        // R9-dinero-6): el costo guardado desde la ronda 8 o, antes, el
        // reconstruido con todas las devoluciones de la venta, también las de
        // otros períodos. Se calcula al leer, así que es idempotente.
        const histories = new Map<string, ReturnType<typeof replayReturns>>();
        for (let cursor: string | undefined; ;) {
          const page = await this.db.saleReturn.findMany({
            where: {
              branchId: actor.branchId,
              createdAt: range,
              sale: returnSaleWhere,
            },
            orderBy: { id: "asc" },
            take: RETURN_BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
              id: true,
              saleId: true,
              items: true,
              sale: {
                select: {
                  costTotal: true,
                  items: lineSelect,
                  returns: {
                    select: {
                      id: true,
                      number: true,
                      createdAt: true,
                      costTotal: true,
                      items: true,
                    },
                  },
                },
              },
            },
          });
          for (const returned of page) {
            const history =
              histories.get(returned.saleId) ??
              replayReturns(returned.sale, returned.sale.returns);
            histories.set(returned.saleId, history);
            (returned.items as any[]).forEach((part, n) => {
              const found = history.parts.get(returned.id + "#" + n);
              const line = found
                ? returned.sale.items.find((i) => i.id === found.line.id)
                : undefined;
              if (
                !found ||
                !line ||
                (query.categoryId &&
                  line.variant.product.categoryId !== query.categoryId)
              )
                return;
              const row = rowOf(line.variant);
              // Venta devuelta sin ITBIS: lo registrado en la parte desde
              // R9-dinero-2; antes, el mismo redondeo acumulado de la línea.
              const after = found.before.plus(part.qty);
              const back = (value: ReturnType<typeof d>) =>
                returnedAt(value, line.qty, after).minus(
                  returnedAt(value, line.qty, found.before),
                );
              const net =
                typeof part.total === "number" && typeof part.tax === "number"
                  ? d(part.total).minus(part.tax)
                  : back(d(line.lineTotal)).minus(back(d(line.tax)));
              row.Ventas = d(row.Ventas).minus(net);
              if (found.restock) row.Costo = d(row.Costo).minus(found.cost);
              row.Unidades -= Number(part.qty);
              grouped.set(line.variant.productId, row);
            });
          }
          if (page.length < RETURN_BATCH) break;
          cursor = page[page.length - 1].id;
        }
        rows = [...grouped.values()].map((i) => {
          const Ventas = money(i.Ventas),
            Costo = money(i.Costo);
          return {
            ...i,
            Ventas,
            Costo,
            Utilidad: money(d(Ventas).minus(Costo)),
            Margen: margin(Ventas, Costo),
          };
        });
        if (name === "abc")
          rows = abc(rows.map((i) => ({ ...i, revenue: i.Ventas }))).map(
            ({ revenue: _revenue, ...i }) => ({ ...i, Clasificación: i.class }),
          );
      } else if (name === "customers") {
        const totals = await this.db.$queryRaw<
          { customer: string | null; total: unknown }[]
        >`SELECT s."customerId" AS customer, SUM(s.total) AS total FROM "Sale" s WHERE ${filter} GROUP BY 1 ORDER BY MAX(s."createdAt") DESC`;
        const ids = totals.flatMap((t) => (t.customer ? [t.customer] : []));
        const names = new Map(
          (ids.length
            ? await this.db.customer.findMany({
                where: { branchId: actor.branchId, id: { in: ids } },
                select: { id: true, name: true },
              })
            : []
          ).map((c) => [c.id, c.name]),
        );
        rows = group(
          totals,
          (t) => (t.customer && names.get(t.customer)) || "Consumidor final",
          (t) => Number(t.total),
        ).map((g) => ({ Cliente: g.name, Ventas: g.amount }));
      } else bad("Reporte no disponible.");
    }
    rows = safe(rows, actor);
    if (query.format === "xlsx") {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet(name.slice(0, 31));
      const keys = Object.keys(rows[0] || { Resultado: "" });
      sheet.columns = keys.map((k) => ({ header: k, key: k, width: 24 }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF7C3AED" },
      };
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="nexora-${name}.xlsx"`,
      );
      res.end(Buffer.from(await book.xlsx.writeBuffer()));
      return;
    }
    if (query.format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="nexora-${name}.pdf"`,
      );
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 32,
      });
      doc.pipe(res);
      doc
        .fontSize(18)
        .text("Nexora POS · " + name)
        .fontSize(9)
        .text(
          range.gte.toLocaleDateString("en-CA", {
            timeZone: BUSINESS_TIME_ZONE,
          }) +
            " / " +
            range.lte.toLocaleDateString("en-CA", {
              timeZone: BUSINESS_TIME_ZONE,
            }),
        )
        .moveDown();
      for (const row of rows)
        doc.text(
          Object.entries(row)
            .map(([k, v]) => k + ": " + v)
            .join(" | "),
        );
      doc.end();
      return;
    }
    return res.json({ name, rows, from: range.gte, to: range.lte });
  }
}

// ── Listados que crecen con el historial (PERF-informes) ──
// JSON: una página (`page`, `limit`) y el `total` aparte. Excel/PDF: por lotes
// en flujo, hasta EXPORT_LIMIT filas; si el período tiene más, se avisa antes
// de empezar la descarga.
export const LISTINGS = ["sales", "kardex", "returns-discounts"];
const EXPORT_BATCH = 1000;
type ListingPage = { take: number; skip?: number; cursor?: string };
type Listing = {
  count: () => Promise<number>;
  read: (page: ListingPage) => Promise<{ rows: any[]; last?: string }>;
};
const pageArgs = ({ take, skip, cursor }: ListingPage) => ({
  take,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: skip ?? 0 }),
});
const localTime = (date: Date) =>
  date.toLocaleString("es-DO", { timeZone: BUSINESS_TIME_ZONE });
function listing(
  db: Database,
  name: string,
  actor: Actor,
  range: { gte: Date; lte: Date },
  saleWhere: any,
): Listing {
  if (name === "sales")
    return {
      count: () => db.sale.count({ where: saleWhere }),
      read: async (page) => {
        const sales = await db.sale.findMany({
          where: saleWhere,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...pageArgs(page),
          select: {
            id: true,
            number: true,
            createdAt: true,
            sellerId: true,
            total: true,
            taxTotal: true,
            creditBalance: true,
            ncf: true,
            ncfType: true,
            fiscalStatus: true,
          },
        });
        const returned = new Map(
          (sales.length
            ? await db.saleReturn.groupBy({
                by: ["saleId"],
                where: { saleId: { in: sales.map((s) => s.id) } },
                _sum: { total: true },
              })
            : []
          ).map((r) => [r.saleId, r._sum.total ?? 0]),
        );
        return {
          last: sales.at(-1)?.id,
          rows: sales.map((s) => ({
            Factura: s.number,
            Fecha: localTime(s.createdAt),
            Vendedor: s.sellerId,
            Total: Number(s.total),
            ITBIS: Number(s.taxTotal),
            Saldo_crédito: Number(s.creditBalance),
            NCF: s.ncf ?? "",
            Tipo_NCF: s.ncfType ?? "",
            Estado_fiscal: s.fiscalStatus,
            Devoluciones: money(returned.get(s.id) ?? 0),
          })),
        };
      },
    };
  if (name === "kardex") {
    const where = { branchId: actor.branchId, createdAt: range };
    return {
      count: () => db.inventoryMovement.count({ where }),
      read: async (page) => {
        const moves = await db.inventoryMovement.findMany({
          where,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          ...pageArgs(page),
          select: {
            id: true,
            createdAt: true,
            type: true,
            qty: true,
            balanceAfter: true,
            unitCost: true,
            reason: true,
            variant: {
              select: { sku: true, product: { select: { name: true } } },
            },
          },
        });
        return {
          last: moves.at(-1)?.id,
          rows: moves.map((m) => ({
            Fecha: localTime(m.createdAt),
            SKU: m.variant.sku,
            Producto: m.variant.product.name,
            Tipo: m.type,
            Cantidad: Number(m.qty),
            Saldo: Number(m.balanceAfter),
            Costo: Number(m.unitCost),
            Motivo: m.reason,
          })),
        };
      },
    };
  }
  const where = {
    branchId: actor.branchId,
    createdAt: range,
    action: { in: ["void", "return", "discount_approved"] },
  };
  return {
    count: () => db.auditLog.count({ where }),
    read: async (page) => {
      const events = await db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageArgs(page),
        select: {
          id: true,
          createdAt: true,
          action: true,
          userId: true,
          entityId: true,
          after: true,
        },
      });
      return {
        last: events.at(-1)?.id,
        rows: events.map((e) => ({
          Fecha: localTime(e.createdAt),
          Evento: e.action,
          Usuario: e.userId,
          Referencia: e.entityId,
          // Sin costos para quien no tiene profit:read: el safe() final no
          // limpia dentro de un texto (R9-dinero-8).
          Detalle: JSON.stringify(safe(e.after, actor)),
        })),
      };
    },
  };
}
const count = (value: number) => value.toLocaleString("en-US");
async function sendListing(
  res: Response,
  name: string,
  query: Record<string, string>,
  actor: Actor,
  range: { gte: Date; lte: Date },
  list: Listing,
) {
  const format = query.format;
  if (format !== "xlsx" && format !== "pdf") {
    const limit = Math.min(
      Math.max(Math.floor(Number(query.limit)) || LISTING_PAGE.default, 1),
      LISTING_PAGE.max,
    );
    const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
    const [total, { rows }] = await Promise.all([
      list.count(),
      list.read({ take: limit, skip: (page - 1) * limit }),
    ]);
    return res.json({
      name,
      rows: safe(rows, actor),
      from: range.gte,
      to: range.lte,
      total,
      page,
      limit,
    });
  }
  const total = await list.count();
  if (total > EXPORT_LIMIT[format])
    bad(
      `El reporte tiene ${count(total)} filas y el máximo para exportar a ${format === "xlsx" ? "Excel" : "PDF"} es ${count(EXPORT_LIMIT[format])}. Selecciona un período más corto.`,
    );
  // El primer lote antes de las cabeceras: si la base falla, el error llega
  // como respuesta normal y no como un archivo cortado.
  let batch = await list.read({ take: EXPORT_BATCH });
  const batches = async function* () {
    for (;;) {
      yield safe(batch.rows, actor);
      if (batch.rows.length < EXPORT_BATCH) return;
      batch = await list.read({ take: EXPORT_BATCH, cursor: batch.last });
    }
  };
  res.setHeader(
    "Content-Type",
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="nexora-${name}.${format}"`,
  );
  try {
    if (format === "xlsx") {
      const book = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: false,
      });
      const sheet = book.addWorksheet(name.slice(0, 31));
      let started = false;
      for await (const rows of batches()) {
        if (!started) {
          const keys = Object.keys(rows[0] || { Resultado: "" });
          sheet.columns = keys.map((k) => ({ header: k, key: k, width: 24 }));
          sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
          sheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF7C3AED" },
          };
          started = true;
        }
        for (const row of rows) sheet.addRow(row).commit();
      }
      sheet.commit();
      await book.commit();
      return;
    }
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 32,
    });
    doc.pipe(res);
    doc
      .fontSize(18)
      .text("Nexora POS · " + name)
      .fontSize(9)
      .text(
        range.gte.toLocaleDateString("en-CA", {
          timeZone: BUSINESS_TIME_ZONE,
        }) +
          " / " +
          range.lte.toLocaleDateString("en-CA", {
            timeZone: BUSINESS_TIME_ZONE,
          }),
      )
      .moveDown();
    for await (const rows of batches())
      for (const row of rows)
        doc.text(
          Object.entries(row)
            .map(([k, v]) => k + ": " + v)
            .join(" | "),
        );
    doc.end();
  } catch (error) {
    // La descarga ya empezó: se corta para que no quede un archivo a medias
    // que parezca completo.
    console.error(error);
    res.destroy(error as Error);
  }
}

// ── Reportes del día de la tienda (docs/tienda/CUADRE_REPORTES_FACTURA.md) ──
export const STORE_REPORTS = ["venta-diaria-usuario", "venta-por-forma-pago"];
const NOTE = "Verificar si los totales tienen descuentos aplicados";
// Filtros: fechas (from/to), caja (cashSessionId) y usuario (userId). Con
// caja y sin fechas, se toma la caja completa.
export async function storeReport(
  db: any,
  actor: Actor,
  name: string,
  query: Record<string, string | undefined>,
) {
  const session = query.cashSessionId
    ? await db.cashSession.findFirstOrThrow({
        where: {
          id: parse(uuid, query.cashSessionId),
          branchId: actor.branchId,
        },
      })
    : null;
  if (!canViewCashExpected(actor)) {
    // Un reporte por fecha o por otra caja permite reconstruir el arqueo de
    // una jornada abierta. Sin privilegio financiero sólo se admite la caja
    // propia y después de cerrarla.
    if (!session || session.userId !== actor.id) denied();
    if (!session.closedAt) bad("Cierra la caja para consultar sus reportes.");
  }
  const range =
    session && !query.from && !query.to
      ? null
      : dateRange(query as Record<string, string>);
  const userId = query.userId
    ? parse(uuid, query.userId)
    : (session?.userId ?? null);
  // PERF-informes: el reporte por producto se agrega en PostgreSQL; el de
  // formas de pago lista cada factura (una caja o una jornada) con tope.
  const where = Prisma.sql`s."branchId" = ${actor.branchId} AND s.status = 'completed'${session ? Prisma.sql` AND s."cashSessionId" = ${session.id}::uuid` : Prisma.empty}${query.userId ? Prisma.sql` AND s."sellerId" = ${userId}::uuid` : Prisma.empty}${range ? Prisma.sql` AND s."createdAt" >= ${utc(range.gte)} AND s."createdAt" <= ${utc(range.lte)}` : Prisma.empty}`;
  const sales =
    name === "venta-diaria-usuario" ? [] : await storeSales(db, where);
  const [user, terminal] = await Promise.all([
    userId ? db.user.findUnique({ where: { id: userId } }) : null,
    session && /^[0-9a-f-]{36}$/i.test(session.registerId)
      ? db.terminal.findUnique({ where: { id: session.registerId } })
      : null,
  ]);
  const settings = ((
    await db.settings.findUnique({ where: { id: actor.branchId } })
  )?.data ?? {}) as any;
  const header = {
    name,
    business: {
      name: settings.name ?? "",
      branchName: settings.branchName ?? "",
      address: settings.address ?? "",
      legalId: settings.legalId ?? "",
    },
    from: range?.gte ?? session?.openedAt ?? null,
    to: range?.lte ?? session?.closedAt ?? null,
    printedAt: new Date(),
    user: user
      ? { id: user.id, number: user.cashierNumber ?? null, name: user.name }
      : null,
    register: session
      ? {
          id: session.registerId,
          number: terminal?.registerNumber ?? null,
          name: terminal?.registerName || terminal?.name || session.registerId,
        }
      : null,
    cashSessionId: session?.id ?? null,
    note: NOTE,
  };
  const units = (s: any) =>
    s.items.reduce((a: any, i: any) => a.plus(i.qty), d(0)).toNumber();
  if (name === "venta-diaria-usuario") {
    // Una fila por producto (variante); PRECIO es el bruto antes del descuento.
    // En orden de primera venta, como cuando se recorrían las facturas.
    const lines =
      await db.$queryRaw`SELECT p.name, v.sku, SUM(i.qty) AS qty, SUM(i.tax) AS tax, SUM(i.discount) AS discount, SUM(i."lineTotal" + i.discount) AS gross FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId" WHERE ${where} GROUP BY i."variantId", p.name, v.sku ORDER BY MIN(s."createdAt"), v.sku`;
    const rows = (lines as any[])
      .map((r) => ({
        Descripción: r.name as string,
        SKU: r.sku as string,
        Cant: d(r.qty).toNumber(),
        ITBIS: money(r.tax),
        Desc: money(r.discount),
        Precio: money(r.gross),
      }))
      .sort((a, b) => a.Descripción.localeCompare(b.Descripción, "es"));
    const totals = {
      Cant: d(rows.reduce((a, r) => a.plus(r.Cant), d(0))).toNumber(),
      ITBIS: money(rows.reduce((a, r) => a.plus(r.ITBIS), d(0))),
      Desc: money(rows.reduce((a, r) => a.plus(r.Desc), d(0))),
      Precio: money(rows.reduce((a, r) => a.plus(r.Precio), d(0))),
    };
    return {
      ...header,
      title: "REPORTE DE LA VENTA DIARIA DE USUARIO",
      totals,
      rows: [...rows, { Descripción: "TOTAL", SKU: "", ...totals }],
    };
  }
  // Por forma de pago: una venta combinada aparece en cada grupo con su parte.
  const groups = PAYMENT_GROUPS.map((g) => {
    const rows = sales.flatMap((s: any) => {
      const parts = s.payments.filter(
        (p: any) =>
          p.entryType === "sale" &&
          (g.method === "receivable"
            ? ["credit", "cod"].includes(p.method)
            : p.method === g.method),
      );
      if (!parts.length) return [];
      return [
        {
          saleId: s.id,
          number: s.number,
          description: "Factura",
          units: units(s),
          amount: money(
            parts.reduce((a: any, p: any) => a.plus(p.amount), d(0)),
          ),
          ...(g.method === "receivable"
            ? {
                status: Number(s.creditBalance) > 0 ? "pendiente" : "cobrada",
              }
            : {}),
        },
      ];
    });
    return {
      method: g.method,
      label: g.label,
      rows,
      subtotal: {
        units: d(
          rows.reduce((a: any, r: any) => a.plus(r.units), d(0)),
        ).toNumber(),
        amount: money(rows.reduce((a: any, r: any) => a.plus(r.amount), d(0))),
      },
    };
  }).filter((g) => g.method !== "credit_note" || g.rows.length);
  const byInvoice = {
    invoices: sales.length,
    units: d(
      sales.reduce((a: any, s: any) => a.plus(units(s)), d(0)),
    ).toNumber(),
    amount: money(sales.reduce((a: any, s: any) => a.plus(s.total), d(0))),
  };
  const rows: any[] = [];
  for (const g of groups) {
    rows.push({ COD: "", Descripción: g.label, Cant: "", T_Venta: "" });
    for (const r of g.rows)
      rows.push({
        COD: r.number,
        Descripción:
          r.description + ((r as any).status ? " · " + (r as any).status : ""),
        Cant: r.units,
        T_Venta: r.amount,
      });
    rows.push({
      COD: "",
      Descripción: "Sub-Total por Pago",
      Cant: g.subtotal.units,
      T_Venta: g.subtotal.amount,
    });
  }
  rows.push(
    {
      COD: "",
      Descripción: "Sub-Total por Fact.",
      Cant: byInvoice.units,
      T_Venta: byInvoice.amount,
    },
    {
      COD: "",
      Descripción: "TOTAL",
      Cant: byInvoice.units,
      T_Venta: byInvoice.amount,
    },
  );
  return {
    ...header,
    title: "REPORTE DE VENTA USUARIO",
    groups,
    byInvoice,
    total: byInvoice.amount,
    rows,
  };
}
// Facturas del reporte por forma de pago: sólo lo que imprime, sin
// comprobantes ni catálogo, y con tope para un período muy largo.
const STORE_REPORT_LIMIT = 10000;
async function storeSales(db: any, where: Prisma.Sql) {
  const [{ total }] =
    await db.$queryRaw`SELECT COUNT(*)::int AS total FROM "Sale" s WHERE ${where}`;
  if (total > STORE_REPORT_LIMIT)
    bad(
      `El período tiene ${count(total)} facturas y este reporte admite hasta ${count(STORE_REPORT_LIMIT)}. Elige una caja o un período más corto.`,
    );
  // Por factura: sus unidades y lo cobrado al vender con cada método.
  const rows: any[] =
    await db.$queryRaw`WITH sl AS (SELECT s.id, s.number, s.total, s."creditBalance", s."createdAt" FROM "Sale" s WHERE ${where}), u AS (SELECT i."saleId", SUM(i.qty) AS qty FROM "SaleItem" i JOIN sl ON sl.id = i."saleId" GROUP BY 1), pm AS (SELECT p."saleId", p.method, SUM(p.amount) AS amount FROM "Payment" p JOIN sl ON sl.id = p."saleId" WHERE p."entryType" = 'sale' GROUP BY 1, 2) SELECT sl.id, sl.number, sl.total, sl."creditBalance", u.qty, pm.method, pm.amount FROM sl LEFT JOIN u ON u."saleId" = sl.id LEFT JOIN pm ON pm."saleId" = sl.id ORDER BY sl."createdAt", sl.id, pm.method`;
  const sales: any[] = [];
  for (const row of rows) {
    if (sales.at(-1)?.id !== row.id)
      sales.push({
        id: row.id,
        number: row.number,
        total: row.total,
        creditBalance: row.creditBalance,
        items: row.qty == null ? [] : [{ qty: row.qty }],
        payments: [],
      });
    if (row.method)
      sales.at(-1).payments.push({
        method: row.method,
        amount: row.amount,
        entryType: "sale",
      });
  }
  return sales;
}
// Envía un reporte de la tienda como JSON, Excel o PDF (filas planas).
export async function sendStoreReport(
  res: Response,
  report: any,
  format?: string,
) {
  const rows: any[] = report.rows;
  if (format === "xlsx") {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(report.name.slice(0, 31));
    const keys = Object.keys(rows[0] || { Resultado: "" });
    sheet.columns = keys.map((k) => ({ header: k, key: k, width: 24 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nexora-${report.name}.xlsx"`,
    );
    res.end(Buffer.from(await book.xlsx.writeBuffer()));
    return;
  }
  if (format === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nexora-${report.name}.pdf"`,
    );
    const doc = new PDFDocument({ size: "A4", margin: 32 });
    doc.pipe(res);
    const date = (v: any) =>
      v
        ? new Date(v).toLocaleString("es-DO", { timeZone: BUSINESS_TIME_ZONE })
        : "";
    doc
      .fontSize(14)
      .text(report.business.name || "Nexora POS")
      .fontSize(12)
      .text(report.title)
      .fontSize(9)
      .text("Desde: " + date(report.from) + "  Hasta: " + date(report.to))
      .text(
        (report.user
          ? "Usuario: " + (report.user.number ?? "") + " " + report.user.name
          : "") +
          (report.register
            ? "   Caja: " +
              (report.register.number ?? "") +
              " " +
              report.register.name
            : ""),
      )
      .moveDown();
    for (const row of rows)
      doc.text(
        Object.values(row)
          .map((v) => String(v ?? ""))
          .join("  |  "),
      );
    doc.moveDown().text(report.note);
    doc.end();
    return;
  }
  res.json(report);
}

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
} from "./common";

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
        where: { sale: where, entryType: { not: "installment" } },
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
    ]);
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
        daily: daily.map((i) => ({ day: i.day, total: Number(i.total) })),
        category: category.map((i) => ({ ...i, total: Number(i.total) })),
        payments: payments.map((p) => ({
          name: p.method,
          amount: Number(p._sum.amount ?? 0),
        })),
        top: top.map((i) => ({
          ...i,
          units: Number(i.units),
          revenue: Number(i.revenue),
        })),
        sellers: sellers.map((i) => ({ ...i, total: Number(i.total) })),
        alerts,
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
    const variants = await this.db.variant.findMany({
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
    });
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
    } else {
      const count = await this.db.sale.count({ where: saleWhere });
      if (count > 10000)
        bad(
          "Selecciona un período con menos de 10,000 facturas para exportar el detalle.",
        );
      const sales = await this.db.sale.findMany({
        where: saleWhere,
        include: {
          items: {
            include: {
              variant: {
                include: { product: { include: { category: true } } },
              },
            },
          },
          payments: true,
          returns: true,
        },
        orderBy: { createdAt: "desc" },
      });
      const items = sales.flatMap((s) =>
        s.items
          .filter(
            (i) =>
              !query.categoryId ||
              i.variant.product.categoryId === query.categoryId,
          )
          .map((i) => ({ ...i, sale: s })),
      );
      if (name === "sales")
        rows = sales.map((s) => ({
          Factura: s.number,
          Fecha: s.createdAt.toLocaleString("es-DO", {
            timeZone: BUSINESS_TIME_ZONE,
          }),
          Vendedor: s.sellerId,
          Total: Number(s.total),
          ITBIS: Number(s.taxTotal),
          Saldo_crédito: Number(s.creditBalance),
          NCF: s.ncf ?? "",
          Tipo_NCF: s.ncfType ?? "",
          Estado_fiscal: s.fiscalStatus,
          Devoluciones: sum(s.returns, "total"),
        }));
      else if (name === "monthly-consumption")
        rows = group(
          items,
          (i) =>
            businessDate(i.sale.createdAt).slice(0, 7) +
            " · " +
            i.variant.product.name,
          (i) => Number(i.qty) - Number(i.returnedQty),
        ).map((g) => ({ Mes_Producto: g.name, Unidades: g.amount }));
      else if (name === "by-seller") {
        const users = await this.db.user.findMany({
          select: { id: true, name: true },
        });
        rows = group(
          sales,
          (s) => users.find((u) => u.id === s.sellerId)?.name || s.sellerId,
          (s) => Number(s.total),
        ).map((g) => ({ Vendedor: g.name, Ventas: g.amount }));
      } else if (name === "by-payment") {
        // Dos columnas que no se suman entre sí (R9-dinero-9). Ventas: cómo se
        // cobraron las facturas del período, con el crédito como método
        // propio; su suma es lo vendido. Cobros de crédito: abonos verificados
        // por la fecha en que entraron, aunque la venta sea de otro período.
        const collected = await this.db.payment.findMany({
          where: {
            entryType: "installment",
            status: "ok",
            createdAt: range,
            ...(query.method ? { method: query.method } : {}),
            sale: {
              branchId: actor.branchId,
              status: "completed",
              ...(query.sellerId
                ? { sellerId: parse(uuid, query.sellerId) }
                : {}),
            },
          },
        });
        const methods = new Map<
          string,
          { sold: ReturnType<typeof d>; collected: ReturnType<typeof d> }
        >();
        const of = (method: string) => {
          if (!methods.has(method))
            methods.set(method, { sold: d(0), collected: d(0) });
          return methods.get(method)!;
        };
        for (const p of sales.flatMap((s) => s.payments))
          if (p.entryType !== "installment")
            of(p.method).sold = of(p.method).sold.plus(p.amount);
        for (const p of collected)
          of(p.method).collected = of(p.method).collected.plus(p.amount);
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
        const rowOf = (variant: (typeof items)[number]["variant"]) =>
          grouped.get(variant.productId) ?? {
            Producto: variant.product.name,
            Categoría: variant.product.category.name,
            Ventas: 0,
            Costo: 0,
            Unidades: 0,
          };
        // Lo contabilizado por línea: el costo redondeado de cada una o, en
        // ventas anteriores a la ronda 7 final, Sale.costTotal repartido. Se
        // reparte sobre todas las líneas de la venta, antes de filtrar por
        // categoría, para que cuadre con el dashboard (R9-dinero-7).
        const booked = new Map(sales.map((s) => [s.id, bookedLineCosts(s)]));
        for (const i of items) {
          const row = rowOf(i.variant);
          // Sin redondear hasta el final: ventas y devoluciones parciales se
          // compensan exactamente.
          row.Ventas = d(row.Ventas).plus(d(i.lineTotal).minus(i.tax));
          row.Costo = d(row.Costo).plus(booked.get(i.sale.id)!.get(i.id)!);
          row.Unidades += Number(i.qty);
          grouped.set(i.variant.productId, row);
        }
        const periodReturns = await this.db.saleReturn.findMany({
          where: {
            branchId: actor.branchId,
            createdAt: range,
            sale: {
              branchId: actor.branchId,
              status: "completed",
              ...(query.sellerId
                ? { sellerId: parse(uuid, query.sellerId) }
                : {}),
              ...(query.method
                ? { payments: { some: { method: query.method } } }
                : {}),
            },
          },
          include: {
            sale: {
              include: {
                items: {
                  include: {
                    variant: {
                      include: { product: { include: { category: true } } },
                    },
                  },
                },
                returns: true,
              },
            },
          },
        });
        // Lo que contabilizó cada parte de cada devolución (R8-02, R9-dinero-1,
        // R9-dinero-6): el costo guardado desde la ronda 8 o, antes, el
        // reconstruido con todas las devoluciones de la venta, también las de
        // otros períodos. Se calcula al leer, así que es idempotente.
        const histories = new Map<string, ReturnType<typeof replayReturns>>();
        for (const returned of periodReturns) {
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
        const customers = await this.db.customer.findMany({
          where: { branchId: actor.branchId },
        });
        rows = group(
          sales,
          (s) =>
            customers.find((c) => c.id === s.customerId)?.name ||
            "Consumidor final",
          (s) => Number(s.total),
        ).map((g) => ({ Cliente: g.name, Ventas: g.amount }));
      } else if (name === "returns-discounts") {
        const events = await this.db.auditLog.findMany({
          where: {
            branchId: actor.branchId,
            createdAt: range,
            action: { in: ["void", "return", "discount_approved"] },
          },
          orderBy: { createdAt: "desc" },
        });
        rows = events.map((e) => ({
          Fecha: e.createdAt.toLocaleString("es-DO", {
            timeZone: BUSINESS_TIME_ZONE,
          }),
          Evento: e.action,
          Usuario: e.userId,
          Referencia: e.entityId,
          // Sin costos para quien no tiene profit:read: el safe() final no
          // limpia dentro de un texto (R9-dinero-8).
          Detalle: JSON.stringify(safe(e.after, actor)),
        }));
      } else if (name === "kardex")
        rows = (
          await this.db.inventoryMovement.findMany({
            where: { branchId: actor.branchId, createdAt: range },
            include: { variant: { include: { product: true } } },
            take: 10000,
          })
        ).map((m) => ({
          Fecha: m.createdAt.toLocaleString("es-DO", {
            timeZone: BUSINESS_TIME_ZONE,
          }),
          SKU: m.variant.sku,
          Producto: m.variant.product.name,
          Tipo: m.type,
          Cantidad: Number(m.qty),
          Saldo: Number(m.balanceAfter),
          Costo: Number(m.unitCost),
          Motivo: m.reason,
        }));
      else bad("Reporte no disponible.");
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
  const range =
    session && !query.from && !query.to
      ? null
      : dateRange(query as Record<string, string>);
  const userId = query.userId
    ? parse(uuid, query.userId)
    : (session?.userId ?? null);
  const sales = await db.sale.findMany({
    where: {
      branchId: actor.branchId,
      status: "completed",
      ...(session ? { cashSessionId: session.id } : {}),
      ...(query.userId ? { sellerId: userId } : {}),
      ...(range ? { createdAt: range } : {}),
    },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      payments: true,
    },
    orderBy: { createdAt: "asc" },
  });
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
    const byVariant = new Map<string, any>();
    for (const s of sales)
      for (const i of s.items) {
        const row = byVariant.get(i.variantId) ?? {
          Descripción: i.variant.product.name,
          SKU: i.variant.sku,
          Cant: d(0),
          ITBIS: d(0),
          Desc: d(0),
          Precio: d(0),
        };
        row.Cant = row.Cant.plus(i.qty);
        row.ITBIS = row.ITBIS.plus(i.tax);
        row.Desc = row.Desc.plus(i.discount);
        row.Precio = row.Precio.plus(i.lineTotal).plus(i.discount);
        byVariant.set(i.variantId, row);
      }
    const rows = [...byVariant.values()]
      .map((r) => ({
        ...r,
        Cant: r.Cant.toNumber(),
        ITBIS: money(r.ITBIS),
        Desc: money(r.Desc),
        Precio: money(r.Precio),
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
        (p: any) => p.entryType === "sale" && p.method === g.method,
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
          ...(g.method === "cod"
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

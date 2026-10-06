import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
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
  allocationCost,
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
      >`SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo','YYYY-MM-DD') AS day, SUM(total) AS total FROM "Sale" WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${range.gte} AND "createdAt"<=${range.lte} GROUP BY day ORDER BY day`,
      this.db.$queryRaw<
        any[]
      >`SELECT c.name,c.color,SUM(i."lineTotal") AS total FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Variant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId" JOIN "Category" c ON c.id=p."categoryId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${range.gte} AND s."createdAt"<=${range.lte} GROUP BY c.name,c.color ORDER BY total DESC`,
      this.db.payment.groupBy({
        by: ["method"],
        where: { sale: where },
        _sum: { amount: true, feeAmount: true },
      }),
      this.db.$queryRaw<
        any[]
      >`SELECT p.name,c.name AS category, SUM(i.qty-i."returnedQty") AS units,SUM(i."lineTotal"*(1-i."returnedQty"/i.qty)) AS revenue FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Variant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId" JOIN "Category" c ON c.id=p."categoryId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${range.gte} AND s."createdAt"<=${range.lte} GROUP BY p.id,p.name,c.name ORDER BY revenue DESC LIMIT 10`,
      this.db.$queryRaw<
        any[]
      >`SELECT u.name,SUM(s.total) AS total FROM "Sale" s JOIN "User" u ON u.id=s."sellerId" WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND s."createdAt">=${range.gte} AND s."createdAt"<=${range.lte} GROUP BY u.name ORDER BY total DESC`,
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
      >`SELECT EXTRACT(ISODOW FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo'))::int AS day, EXTRACT(HOUR FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo'))::int AS hour, COUNT(*)::int AS invoices, SUM(total) AS total FROM "Sale" WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${range.gte} AND "createdAt"<=${range.lte} GROUP BY day,hour ORDER BY day,hour`,
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
        payments.reduce((a, p) => a.plus(p._sum.feeAmount ?? 0), d(0)),
      ),
      prior = Number(previous._sum.total ?? 0);
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
        trend: prior ? money(((revenue - prior) / prior) * 100) : 0,
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
      } else if (name === "by-payment")
        rows = group(
          sales.flatMap((s) => s.payments),
          (p) => p.method,
          (p) => Number(p.amount),
        ).map((g) => ({ Método: g.name, Monto: g.amount }));
      else if (name === "profit" || name === "abc") {
        const grouped = new Map<string, any>();
        for (const i of items) {
          const id = i.variant.productId;
          const row = grouped.get(id) || {
            Producto: i.variant.product.name,
            Categoría: i.variant.product.category.name,
            Ventas: 0,
            Costo: 0,
            Unidades: 0,
          };
          row.Ventas = money(d(row.Ventas).plus(d(i.lineTotal).minus(i.tax)));
          // Sin redondear hasta el final: ventas y devoluciones parciales se
          // compensan exactamente.
          // Lo registrado por línea (redondeado como Sale.costTotal).
          row.Costo = d(row.Costo).plus(money(allocationCost(i)));
          row.Unidades += Number(i.qty);
          grouped.set(id, row);
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
              },
            },
          },
        });
        for (const returned of periodReturns) {
          // Costo de cada línea repuesta (R8-02). Desde la ronda 8 cada línea
          // guarda el suyo. Las anteriores no: se concilian con lo que la
          // devolución contabilizó (SaleReturn.costTotal), repartido en
          // proporción y con el resto en la última línea, para que la suma
          // sea exacta. Se calcula al leer, así que es idempotente.
          const parts = returned.items as any[];
          const lineOf = (part: any) =>
            returned.sale.items.find((i) => i.id === part.saleItemId);
          const partCost = new Map<any, ReturnType<typeof d>>();
          const unknown = parts.filter(
            (p) => p.restock && typeof p.cost !== "number" && lineOf(p),
          );
          for (const p of parts)
            if (p.restock && typeof p.cost === "number")
              partCost.set(p, d(p.cost));
          if (unknown.length) {
            const estimate = (p: any) => {
              const line = lineOf(p)!;
              return allocationCost(line).times(p.qty).div(line.qty);
            };
            const known = [...partCost.values()].reduce(
              (t, c) => t.plus(c),
              d(0),
            );
            const pending = d(returned.costTotal).minus(known);
            const weights = unknown.map(estimate);
            const total = weights.reduce((t, w) => t.plus(w), d(0));
            let given = d(0);
            unknown.forEach((p, n) => {
              const share =
                n === unknown.length - 1
                  ? pending.minus(given)
                  : d(
                      money(
                        total.isZero()
                          ? pending.div(unknown.length)
                          : pending.times(weights[n]).div(total),
                      ),
                    );
              given = given.plus(share);
              partCost.set(p, share);
            });
          }
          for (const part of parts) {
            const line = returned.sale.items.find(
              (i) => i.id === part.saleItemId,
            );
            if (
              !line ||
              (query.categoryId &&
                line.variant.product.categoryId !== query.categoryId)
            )
              continue;
            const id = line.variant.productId;
            const row = grouped.get(id) ?? {
              Producto: line.variant.product.name,
              Categoría: line.variant.product.category.name,
              Ventas: 0,
              Costo: 0,
              Unidades: 0,
            };
            row.Ventas = money(
              d(row.Ventas).minus(
                d(line.lineTotal).minus(line.tax).times(part.qty).div(line.qty),
              ),
            );
            if (part.restock)
              row.Costo = d(row.Costo).minus(partCost.get(part) ?? 0);
            row.Unidades -= Number(part.qty);
            grouped.set(id, row);
          }
        }
        rows = [...grouped.values()].map((i) => {
          const Costo = money(i.Costo);
          return {
            ...i,
            Costo,
            Utilidad: money(d(i.Ventas).minus(Costo)),
            Margen: margin(i.Ventas, Costo),
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
          Detalle: JSON.stringify(e.after),
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
        `attachment; filename="fitstore-${name}.xlsx"`,
      );
      res.end(Buffer.from(await book.xlsx.writeBuffer()));
      return;
    }
    if (query.format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="fitstore-${name}.pdf"`,
      );
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 32,
      });
      doc.pipe(res);
      doc
        .fontSize(18)
        .text("FitStore · " + name)
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

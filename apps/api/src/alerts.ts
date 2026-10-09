import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  expiryDays,
  businessDate,
  clearanceScore,
  safeDiscount,
  margin,
  money,
  d,
  z,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  parse,
  uuid,
  audit,
  canViewCashExpected,
} from "./common";

const CASH_DIFFERENCE_PRIVATE_MESSAGE =
  "Se detectó una diferencia en una caja cerrada. Administración debe revisarla.";

export function alertForActor<T extends { type?: string; message?: string }>(
  alert: T,
  actor: Actor,
): T {
  return alert.type === "cash_difference" && !canViewCashExpected(actor)
    ? { ...alert, message: CASH_DIFFERENCE_PRIVATE_MESSAGE }
    : alert;
}

@Injectable()
export class AlertEngine {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(@Inject(Database) private db: Database) {}
  onModuleInit() {
    this.timer = setInterval(
      () => this.evaluate().catch(console.error),
      24 * 3600000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async evaluate(branchId = "main") {
    const [variants, settings, lastSales, expenses, rules, cash] =
      await Promise.all([
        this.db.variant.findMany({
          where: { branchId, active: true, product: { active: true } },
          include: {
            product: { include: { category: true } },
            lots: { where: { qty: { gt: 0 } } },
          },
        }),
        this.db.settings.findUnique({ where: { id: branchId } }),
        this.db.$queryRaw<
          any[]
        >`SELECT i."variantId",MAX(s."createdAt") AS last FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE s."branchId"=${branchId} AND s.status='completed' GROUP BY i."variantId"`,
        this.db.expense.findMany({
          where: {
            branchId,
            voided: false,
            date: {
              gte: new Date(businessDate().slice(0, 8) + "01T00:00:00-04:00"),
            },
          },
          include: { category: true },
        }),
        this.db.alertRule.findMany(),
        this.db.cashSession.findMany({
          where: { branchId, closedAt: { not: null } },
          take: 30,
          orderBy: { closedAt: "desc" },
        }),
      ]);
    const config = settings?.data as any;
    const events: any[] = [];
    const candidates: any[] = [];
    const enabled = (type: string) =>
      rules.find((r) => r.type === type)?.active !== false;
    const add = (
      key: string,
      type: string,
      severity: string,
      entityId: string,
      message: string,
    ) => {
      if (enabled(type))
        events.push({ key, type, severity, entityId, message, branchId });
    };
    for (const v of variants) {
      const stock = Number(v.stock),
        cost = Number(v.costAvg),
        last = lastSales.find((s) => s.variantId === v.id)?.last ?? v.createdAt;
      const daysIdle = Math.floor((Date.now() - +new Date(last)) / 86400000);
      const lots = v.lots
        .filter((l) => l.expiryDate)
        .sort((a, b) => +a.expiryDate! - +b.expiryDate!);
      const daysToExpiry = lots[0]?.expiryDate
        ? expiryDays(lots[0].expiryDate)
        : null;
      if (stock <= Number(v.product.minStock))
        add(
          "stock:" + v.id,
          stock === 0 ? "out_of_stock" : "low_stock",
          stock === 0 ? "high" : "medium",
          v.id,
          `${v.product.name}: ${stock} unidades disponibles.`,
        );
      if (stock > Number(v.product.maxStock))
        add(
          "overstock:" + v.id,
          "overstock",
          "medium",
          v.id,
          `${v.product.name}: exceso de inventario.`,
        );
      if (stock > 0 && daysIdle >= (config?.idleDays ?? 60))
        add(
          "idle:" + v.id,
          "no_movement",
          "medium",
          v.id,
          `${v.product.name}: ${daysIdle} días sin ventas.`,
        );
      for (const lot of lots) {
        const days = expiryDays(lot.expiryDate!);
        if (days <= (config?.expiryDays ?? 60))
          add(
            "expiry:" + lot.id,
            days < 0 ? "expired" : "expiring",
            days < 30 ? "high" : "medium",
            lot.id,
            `${v.product.name} · ${lot.lotNumber}: ${days < 0 ? "vencido" : `vence en ${days} días`}.`,
          );
      }
      if (
        margin(Number(v.price) / (1 + Number(v.product.taxRate) / 100), cost) <
        (config?.lowMargin ?? 15)
      )
        add(
          "margin:" + v.id,
          "low_margin",
          "medium",
          v.id,
          `${v.product.name}: revisa el margen de venta.`,
        );
      if (
        stock > 0 &&
        (daysIdle >= (config?.idleDays ?? 60) ||
          (daysToExpiry !== null &&
            daysToExpiry >= 0 &&
            daysToExpiry <= (config?.expiryDays ?? 60)))
      )
        candidates.push({
          variantId: v.id,
          productId: v.productId,
          name: v.product.name,
          sku: v.sku,
          imageUrl: v.product.imageUrl,
          category: v.product.category.name,
          stock,
          price: Number(v.price),
          cost,
          daysIdle,
          daysToExpiry,
          lot: lots[0]?.lotNumber,
          capital: money(d(stock).times(cost)),
          margin: margin(
            Number(v.price) / (1 + Number(v.product.taxRate) / 100),
            cost,
          ),
          suggestedDiscount: Math.min(
            daysToExpiry !== null && daysToExpiry < 30 ? 25 : 15,
            safeDiscount(Number(v.price), cost, Number(v.product.taxRate)),
          ),
          score: clearanceScore(daysIdle, daysToExpiry, stock, cost),
        });
    }
    const byCategory = new Map<string, any>();
    for (const e of expenses) {
      const value = byCategory.get(e.categoryId) || {
        category: e.category,
        total: d(0),
      };
      value.total = value.total.plus(e.amount);
      byCategory.set(e.categoryId, value);
    }
    for (const [id, e] of byCategory) {
      const budget = Number(e.category.monthlyBudget);
      if (budget > 0 && e.total.gte(budget * 0.8))
        add(
          "budget:" + id,
          "expense_budget",
          e.total.gte(budget) ? "high" : "medium",
          id,
          `${e.category.name}: ${money(e.total.div(budget).times(100))}% del presupuesto mensual.`,
        );
    }
    for (const s of cash) {
      const difference = Math.abs(
        Number(
          s.differenceCash ?? Number(s.countedCash) - Number(s.expectedCash),
        ),
      );
      if (difference > (config?.cashDifferenceLimit ?? 100))
        add(
          "cash:" + s.id,
          "cash_difference",
          "high",
          s.id,
          `Caja ${s.registerId}: diferencia de RD$ ${difference.toFixed(2)}.`,
        );
    }
    const today = businessDate();
    const todayStart = new Date(today + "T00:00:00-04:00");
    const todayEnd = new Date(today + "T23:59:59.999-04:00");
    const monthStart = new Date(today.slice(0, 8) + "01T00:00:00-04:00");
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
    const baselineStart = new Date(lastMonthStart);
    baselineStart.setUTCMonth(baselineStart.getUTCMonth() - 3);
    const [recent, prior, discounted] = await Promise.all([
      this.db.saleItem.groupBy({
        by: ["variantId"],
        where: {
          sale: {
            branchId,
            status: "completed",
            createdAt: { gte: lastMonthStart, lt: monthStart },
          },
        },
        _sum: { lineTotal: true },
      }),
      this.db.saleItem.groupBy({
        by: ["variantId"],
        where: {
          sale: {
            branchId,
            status: "completed",
            createdAt: { gte: baselineStart, lt: lastMonthStart },
          },
        },
        _sum: { lineTotal: true },
      }),
      this.db.sale.findMany({
        where: {
          branchId,
          status: "completed",
          createdAt: { gte: todayStart, lte: todayEnd },
          discountTotal: { gt: 0 },
        },
      }),
    ]);
    for (const variant of variants) {
      const previous =
        Number(
          prior.find((row) => row.variantId === variant.id)?._sum.lineTotal ??
            0,
        ) / 3;
      const latest = Number(
        recent.find((row) => row.variantId === variant.id)?._sum.lineTotal ?? 0,
      );
      if (
        previous > 0 &&
        latest <
          previous * (1 - Number(config?.lowSalesDropPercent ?? 50) / 100)
      ) {
        add(
          "low-sales:" + variant.id,
          "low_sales",
          "medium",
          variant.id,
          variant.product.name +
            ": ventas del último mes por debajo del promedio de los tres meses anteriores. Candidato a oferta.",
        );
        const existing = candidates.find((c) => c.variantId === variant.id);
        if (existing) existing.lowSales = true;
        else if (Number(variant.stock) > 0)
          candidates.push({
            variantId: variant.id,
            productId: variant.productId,
            imageUrl: variant.product.imageUrl,
            category: variant.product.category.name,
            margin: margin(
              Number(variant.price) /
                (1 + Number(variant.product.taxRate) / 100),
              Number(variant.costAvg),
            ),
            name: variant.product.name,
            sku: variant.sku,
            stock: Number(variant.stock),
            capital: money(d(variant.stock).times(variant.costAvg)),
            price: Number(variant.price),
            cost: Number(variant.costAvg),
            daysIdle: 0,
            daysToExpiry: null,
            lowSales: true,
            score: 0,
            suggestedDiscount: safeDiscount(
              Number(variant.price),
              Number(variant.costAvg),
              Number(variant.product.taxRate),
            ),
          });
      }
    }
    const counts = new Map<string, number>();
    for (const sale of discounted)
      counts.set(sale.sellerId, (counts.get(sale.sellerId) ?? 0) + 1);
    for (const [sellerId, count] of counts)
      if (count >= Number(config?.unusualDiscountCount ?? 10))
        add(
          "discount-count:" + sellerId + ":" + today,
          "unusual_discount",
          "medium",
          sellerId,
          "Un vendedor registra " +
            count +
            " descuentos hoy. Revisa las aprobaciones en auditoría.",
        );
    for (const sale of discounted)
      if (
        Number(sale.subtotal) > 0 &&
        (Number(sale.discountTotal) / Number(sale.subtotal)) * 100 >=
          Number(config?.unusualDiscountPercent ?? 25)
      )
        add(
          "discount:" + sale.id,
          "unusual_discount",
          "medium",
          sale.id,
          "La factura " +
            sale.number +
            " tiene un descuento inusual. Revisa su aprobación.",
        );
    for (const v of variants)
      if (Number(v.stock) < 0)
        add(
          "negative:" + v.id,
          "negative_stock",
          "high",
          v.id,
          v.product.name + ": stock negativo. Revisa el inventario.",
        );
    // Resolver sólo reglas evaluadas; los conflictos offline y las cuentas por
    // cobrar permanecen hasta que su propio flujo las cierre.
    await this.db.alert.updateMany({
      where: {
        branchId,
        type: { notIn: ["offline_conflict", "receivable"] },
        key: { notIn: events.map((e) => e.key) },
        status: { not: "resolved" },
      },
      data: { status: "resolved" },
    });
    for (const event of events) {
      const existing = await this.db.alert.findUnique({
        where: { key: event.key },
      });
      if (
        existing &&
        existing.status !== "resolved" &&
        existing.message === event.message &&
        existing.severity === event.severity &&
        existing.type === event.type &&
        existing.entityId === event.entityId
      )
        continue;
      await this.db.alert.upsert({
        where: { key: event.key },
        create: event,
        update: {
          ...event,
          status:
            existing?.status === "resolved"
              ? "new"
              : (existing?.status ?? "new"),
        },
      });
    }
    return candidates.sort((a, b) => b.score - a.score);
  }
}
@Controller()
export class AlertsController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AlertEngine) private engine: AlertEngine,
  ) {}
  @Get("alerts") @Permit("alerts:write") async alerts(
    @CurrentUser() actor: Actor,
    @Query() query: any,
  ) {
    const filter = parse(
      z.object({
        status: z.enum(["new", "seen", "resolved", "all"]).default("all"),
        type: z.string().max(80).optional(),
        entityId: z.string().max(100).optional(),
      }),
      query,
    );
    await this.engine.evaluate(actor.branchId);
    const rows = await this.db.alert.findMany({
      where: {
        branchId: actor.branchId,
        ...(filter.status !== "all" ? { status: filter.status } : {}),
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return rows.map((row) => alertForActor(row, actor));
  }
  @Patch("alerts/:id") @Permit("alerts:write") async state(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({ status: z.enum(["new", "seen", "resolved"]) }),
      body,
    );
    await this.db.alert.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    await audit(this.db, actor, "state", "alert", id, undefined, data);
    return alertForActor(
      await this.db.alert.update({ where: { id }, data }),
      actor,
    );
  }
  @Get("promotions/clearance-candidates")
  @Permit("promotions:write")
  candidates(@CurrentUser() actor: Actor) {
    return this.engine.evaluate(actor.branchId);
  }
  @Get("alert-rules") @Permit("*") rules() {
    return this.db.alertRule.findMany();
  }
  @Put("alert-rules") @Permit("*") async setRules(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        rules: z.array(
          z.object({
            type: z.string(),
            active: z.boolean(),
            threshold: z.record(z.number()),
          }),
        ),
      }),
      body,
    );
    for (const rule of data.rules)
      await this.db.alertRule.upsert({
        where: { type: rule.type },
        create: rule,
        update: rule,
      });
    await audit(this.db, actor, "rules", "alert-rule", "all", undefined, data);
    return { ok: true };
  }
  @Post("alerts/evaluate") @Permit("alerts:write") evaluate(
    @CurrentUser() actor: Actor,
  ) {
    return this.engine.evaluate(actor.branchId);
  }
}

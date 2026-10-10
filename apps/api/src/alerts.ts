import { randomUUID } from "node:crypto";
import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  NestInterceptor,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { finalize, type Observable } from "rxjs";
import type { Prisma } from "@prisma/client";
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

/** Una evaluación se reutiliza este tiempo si ninguna escritura la invalidó. */
export const ALERT_EVALUATION_TTL_MS = 60_000;
/** Filas por sentencia al leer y escribir alertas en lote. */
const ALERT_BATCH = 1000;

type AlertEvent = {
  key: string;
  type: string;
  severity: string;
  entityId: string;
  message: string;
  branchId: string;
};
type StoredAlert = Pick<
  AlertEvent,
  "type" | "severity" | "entityId" | "message"
> & { status: string };
type AlertWrite = { event: AlertEvent; status: string; create: boolean };
type Evaluation = { generation: number; at: number; candidates: any[] };

const chunks = <T>(items: T[], size = ALERT_BATCH) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
// Hora UTC sin zona, como guarda Prisma las columnas timestamp(3).
const sqlTimestamp = (at: Date) =>
  at.toISOString().replace("T", " ").replace("Z", "");

@Injectable()
export class AlertEngine {
  private timer: ReturnType<typeof setInterval> | undefined;
  /** Sube con cada escritura de la API: la evaluación guardada queda vieja. */
  generation = 0;
  private now = () => Date.now();
  private results = new Map<string, Evaluation>();
  private running:
    | (Omit<Evaluation, "candidates"> & {
        branchId: string;
        promise: Promise<any[]>;
      })
    | undefined;
  constructor(@Inject(Database) private db: Database) {}
  onModuleInit() {
    this.timer = setInterval(
      () => this.evaluate("main", { fresh: true }).catch(console.error),
      24 * 3600000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  /** Una escritura (venta, ajuste, gasto, ajustes…) cambió los datos. */
  invalidate() {
    this.generation++;
  }
  /**
   * Candidatos de liquidación, con las alertas ya escritas en la tabla Alert.
   * - Las peticiones simultáneas comparten una evaluación y nunca corren dos
   *   a la vez (las que llegan durante una evaluación vieja esperan a que
   *   termine y comparten la siguiente).
   * - Sin escrituras desde la última evaluación y con menos de 60 s, responde
   *   con ella sin recalcular.
   * - Con una escritura pendiente espera una evaluación que la incluya, para
   *   que una venta o un ajuste se vean en el siguiente GET.
   * - Pasados los 60 s sin escrituras (sólo cambió la hora) responde con la
   *   anterior y recalcula en segundo plano.
   * - `fresh` exige una evaluación que empiece después de la llamada.
   */
  async evaluate(
    branchId = "main",
    options: { fresh?: boolean } = {},
  ): Promise<any[]> {
    const wanted = this.generation;
    const requestedAt = this.now();
    for (;;) {
      const running = this.running;
      const cached = this.results.get(branchId);
      if (!options.fresh && cached && cached.generation >= wanted) {
        if (!running && this.now() - cached.at >= ALERT_EVALUATION_TTL_MS)
          this.start(branchId).catch((error) => {
            // Reintenta en el próximo período, no en cada petición.
            cached.at = this.now();
            console.error(error);
          });
        return cached.candidates;
      }
      if (
        running?.branchId === branchId &&
        running.generation >= wanted &&
        (!options.fresh || running.at >= requestedAt)
      )
        return running.promise;
      if (!running) return this.start(branchId);
      await running.promise.catch(() => undefined);
    }
  }
  private start(branchId: string) {
    const generation = this.generation;
    const at = this.now();
    const promise: Promise<any[]> = this.compute(branchId)
      .then((candidates) => {
        this.results.set(branchId, { generation, at, candidates });
        return candidates;
      })
      .finally(() => {
        if (this.running?.promise === promise) this.running = undefined;
      });
    this.running = { branchId, generation, at, promise };
    return promise;
  }
  private async compute(branchId: string) {
    const today = businessDate();
    const todayStart = new Date(today + "T00:00:00-04:00");
    const todayEnd = new Date(today + "T23:59:59.999-04:00");
    const monthStart = new Date(today.slice(0, 8) + "01T00:00:00-04:00");
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
    const baselineStart = new Date(lastMonthStart);
    baselineStart.setUTCMonth(baselineStart.getUTCMonth() - 3);
    const [variants, settings, sales, expenses, rules, cash, discounted] =
      await Promise.all([
        this.db.variant.findMany({
          where: { branchId, active: true, product: { active: true } },
          // Sólo las columnas que usan las reglas: memoria acotada.
          select: {
            id: true,
            productId: true,
            sku: true,
            stock: true,
            costAvg: true,
            price: true,
            createdAt: true,
            product: {
              select: {
                name: true,
                minStock: true,
                maxStock: true,
                taxRate: true,
                imageUrl: true,
                category: { select: { name: true } },
              },
            },
            lots: {
              where: { qty: { gt: 0 } },
              select: { id: true, lotNumber: true, expiryDate: true },
            },
          },
        }),
        this.db.settings.findUnique({ where: { id: branchId } }),
        // Una sola pasada agregada en SQL por variante: última venta y ventas
        // del mes pasado y de los tres anteriores (antes, tres consultas).
        // Fechas como texto UTC: la columna es timestamp sin zona.
        this.db.$queryRaw<
          {
            variantId: string;
            last: Date;
            recent: Prisma.Decimal | null;
            prior: Prisma.Decimal | null;
          }[]
        >`SELECT i."variantId",MAX(s."createdAt") AS last,
            SUM(i."lineTotal") FILTER (WHERE s."createdAt" >= ${sqlTimestamp(lastMonthStart)}::timestamp AND s."createdAt" < ${sqlTimestamp(monthStart)}::timestamp) AS recent,
            SUM(i."lineTotal") FILTER (WHERE s."createdAt" >= ${sqlTimestamp(baselineStart)}::timestamp AND s."createdAt" < ${sqlTimestamp(lastMonthStart)}::timestamp) AS prior
          FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE s."branchId"=${branchId} AND s.status='completed' GROUP BY i."variantId"`,
        this.db.expense.findMany({
          where: {
            branchId,
            voided: false,
            date: {
              gte: new Date(businessDate().slice(0, 8) + "01T00:00:00-04:00"),
            },
          },
          select: {
            categoryId: true,
            amount: true,
            category: { select: { name: true, monthlyBudget: true } },
          },
        }),
        this.db.alertRule.findMany({ select: { type: true, active: true } }),
        this.db.cashSession.findMany({
          where: { branchId, closedAt: { not: null } },
          take: 30,
          orderBy: { closedAt: "desc" },
        }),
        this.db.sale.findMany({
          where: {
            branchId,
            status: "completed",
            createdAt: { gte: todayStart, lte: todayEnd },
            discountTotal: { gt: 0 },
          },
          select: {
            id: true,
            number: true,
            sellerId: true,
            subtotal: true,
            discountTotal: true,
          },
        }),
      ]);
    const config = settings?.data as any;
    const events: AlertEvent[] = [];
    const candidates: any[] = [];
    // Búsquedas por Map: con miles de variantes `.find` crecía al cuadrado.
    const ruleActive = new Map<string, boolean>();
    for (const r of rules)
      if (!ruleActive.has(r.type)) ruleActive.set(r.type, r.active);
    const salesByVariant = new Map(sales.map((row) => [row.variantId, row]));
    const enabled = (type: string) => ruleActive.get(type) !== false;
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
        last = salesByVariant.get(v.id)?.last ?? v.createdAt;
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
      const netMargin = margin(
        Number(v.price) / (1 + Number(v.product.taxRate) / 100),
        cost,
      );
      if (netMargin < (config?.lowMargin ?? 15))
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
          margin: netMargin,
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
    const candidateByVariant = new Map<string, any>();
    for (const c of candidates)
      if (!candidateByVariant.has(c.variantId))
        candidateByVariant.set(c.variantId, c);
    for (const variant of variants) {
      const previous = Number(salesByVariant.get(variant.id)?.prior ?? 0) / 3;
      const latest = Number(salesByVariant.get(variant.id)?.recent ?? 0);
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
        const existing = candidateByVariant.get(variant.id);
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
    const stored = await this.storedAlerts(events);
    const writes: AlertWrite[] = [];
    for (const event of events) {
      const existing = stored.get(event.key);
      if (
        existing &&
        existing.status !== "resolved" &&
        existing.message === event.message &&
        existing.severity === event.severity &&
        existing.type === event.type &&
        existing.entityId === event.entityId
      )
        continue;
      const status =
        existing?.status === "resolved" ? "new" : (existing?.status ?? "new");
      writes.push({ event, status, create: !existing });
      // Una clave repetida ve lo que dejó la anterior, como en serie.
      stored.set(event.key, { ...event, status });
    }
    await this.writeAlerts(writes);
    return candidates.sort((a, b) => b.score - a.score);
  }
  /** Estado guardado de las claves evaluadas, en lecturas de 1 000. */
  private async storedAlerts(events: AlertEvent[]) {
    const stored = new Map<string, StoredAlert>();
    const keys = [...new Set(events.map((e) => e.key))];
    for (const chunk of chunks(keys))
      for (const row of await this.db.alert.findMany({
        where: { key: { in: chunk } },
        select: {
          key: true,
          type: true,
          severity: true,
          entityId: true,
          message: true,
          status: true,
        },
      }))
        stored.set(row.key, row);
    return stored;
  }
  /**
   * Crea y actualiza en lote, en una transacción corta y con un candado para
   * que dos procesos no escriban a la vez. Cada alerta conserva una marca de
   * tiempo creciente en el orden de evaluación, como cuando se escribían de una
   * en una: el GET ordena por updatedAt.
   */
  private async writeAlerts(writes: AlertWrite[]) {
    if (!writes.length) return;
    const start = Date.now();
    const rows = writes.map((write, i) => ({
      ...write,
      id: randomUUID(),
      at: new Date(start + i),
    }));
    const creates = rows.filter((row) => row.create);
    const updates = rows.filter((row) => !row.create);
    await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fitstore:alert-engine'))`;
        for (const chunk of chunks(creates)) {
          const { count } = await tx.alert.createMany({
            data: chunk.map(({ event, status, id, at }) => ({
              ...event,
              id,
              status,
              createdAt: at,
              updatedAt: at,
            })),
            skipDuplicates: true,
          });
          if (count === chunk.length) continue;
          // Otra parte de la API creó la clave entre la lectura y esta
          // escritura: como hacía el upsert, se actualiza.
          const ours = new Set<string>(chunk.map((row) => row.id));
          const byKey = new Map(chunk.map((row) => [row.event.key, row]));
          for (const row of await tx.alert.findMany({
            where: { key: { in: [...byKey.keys()] } },
            select: { id: true, key: true },
          }))
            if (!ours.has(row.id)) updates.push(byKey.get(row.key)!);
        }
        for (const chunk of chunks(updates)) {
          const column = (pick: (row: (typeof chunk)[number]) => string) =>
            chunk.map(pick);
          await tx.$executeRaw`
            UPDATE "Alert" AS a
               SET "type" = v."type", "severity" = v."severity",
                   "entityId" = v."entityId", "message" = v."message",
                   "branchId" = v."branchId", "status" = v."status",
                   "updatedAt" = v."at"
              FROM unnest(
                ${column((r) => r.event.key)}::text[],
                ${column((r) => r.event.type)}::text[],
                ${column((r) => r.event.severity)}::text[],
                ${column((r) => r.event.entityId)}::text[],
                ${column((r) => r.event.message)}::text[],
                ${column((r) => r.event.branchId)}::text[],
                ${column((r) => r.status)}::text[],
                ${column((r) => sqlTimestamp(r.at))}::timestamp(3)[]
              ) AS v("key", "type", "severity", "entityId", "message", "branchId", "status", "at")
             WHERE a."key" = v."key"`;
        }
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}

const SESSION_CONTROLLERS = new Set(["AuthController", "RealtimeController"]);
/**
 * Toda escritura de la API (venta, devolución, ajuste, recepción, gasto,
 * ajustes, reglas, estado de una alerta…) invalida la evaluación guardada, así
 * el siguiente GET /alerts la incluye. Las de sesión y equipos no tocan datos
 * que use el motor; POST /alerts/evaluate ya evalúa.
 */
@Injectable()
export class AlertCacheInterceptor implements NestInterceptor {
  constructor(@Inject(AlertEngine) private engine: AlertEngine) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const method = String(
      context.switchToHttp().getRequest()?.method ?? "GET",
    ).toUpperCase();
    const controller = context.getClass().name;
    if (
      ["GET", "HEAD", "OPTIONS"].includes(method) ||
      SESSION_CONTROLLERS.has(controller) ||
      (controller === "AlertsController" &&
        context.getHandler().name === "evaluate")
    )
      return next.handle();
    // Al terminar (bien o con error): una escritura parcial también cuenta.
    return next.handle().pipe(finalize(() => this.engine.invalidate()));
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
    return this.engine.evaluate(actor.branchId, { fresh: true });
  }
}

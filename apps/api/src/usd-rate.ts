import { Inject, Injectable } from "@nestjs/common";
import { businessDate } from "@fitstore/shared";
import { Database } from "./common";
import { currentTenantId, tenantScope, tenantUnique } from "./tenant-context";

// Tasa del dólar del día (orden de la dueña, 20-oct): se busca sola en
// internet una vez al día. Los productos con precio en dólares (atributo
// `usd` de la variante, p. ej. los cursos VIP de GV Makeup Studio) se cobran
// en pesos a esa tasa; la factura guarda el precio en pesos del día, así que
// la tasa queda fija para esa venta aunque mañana cambie.
export const USD_RATE_URL = "https://open.er-api.com/v6/latest/USD";

export function parseUsdRate(body: any): number {
  const rate = Number(body?.rates?.DOP);
  if (!(rate > 20 && rate < 500)) throw new Error("Tasa USD/DOP inválida.");
  return Math.round(rate * 10000) / 10000;
}

export const usdPrice = (usd: number, rate: number) =>
  Math.round(usd * rate * 100) / 100;

const RATE_CHANGE_LIMIT = 0.05;
const LOW_MARGIN_LIMIT = 0.15;

type RateOptions = { userId?: string };

/** Guarda la tasa en Configuración y recalcula los precios en dólares. */
export async function applyUsdRate(
  db: any,
  branchId: string,
  rate: number,
  source: string,
  day = businessDate(),
  options: RateOptions = {},
) {
  const tenantId = currentTenantId();
  return db.$transaction(async (tx: any) => {
    // Dos instancias pueden despertar a la vez. El bloqueo y la relectura
    // dentro de la transacción evitan duplicar bitácoras o pisar un cambio.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`usd-rate:${tenantId}:${branchId}`}))::text AS locked`;
    const settings = await tx.settings.findUnique({
      where: tenantUnique("id", branchId),
    });
    const data = { ...((settings?.data as any) ?? {}) };
    const before = Number(data.usdRate) || null;
    const change = before ? Math.abs(rate - before) / before : 0;
    const largeChange = before !== null && change > RATE_CHANGE_LIMIT;
    data.usdRate = rate;
    data.usdRateDate = day;
    data.usdRateSource = source;
    delete data.usdRatePending;
    const variants = await tx.variant.findMany({
      where: { tenantId, branchId, active: true },
      select: { id: true, price: true, costAvg: true, attributes: true },
    });
    const changed: { id: string; from: string; to: number }[] = [];
    const lowMargin: {
      id: string;
      price: number;
      cost: number;
      margin: number;
    }[] = [];
    for (const v of variants) {
      const usd = Number((v.attributes as any)?.usd);
      if (!(usd > 0)) continue;
      const price = usdPrice(usd, rate);
      const cost = Number(v.costAvg);
      const margin = price > 0 ? (price - cost) / price : -Infinity;
      if (Number.isFinite(cost) && margin < LOW_MARGIN_LIMIT)
        lowMargin.push({ id: v.id, price, cost, margin });
      if (Number(v.price) === price) continue;
      const updated = await tx.variant.updateMany({
        where: { tenantId, id: v.id },
        data: { price },
      });
      if (updated.count !== 1)
        throw new Error("No se pudo actualizar el precio en dólares.");
      changed.push({ id: v.id, from: String(v.price), to: price });
    }
    data.usdRateLowMargin = lowMargin.length
      ? { day, count: lowMargin.length, variants: lowMargin.slice(0, 50) }
      : null;
    // La advertencia se conoce después de calcular los precios; se guarda en
    // la misma transacción para que Configuración pueda mostrarla.
    await tx.settings.upsert({
      where: tenantUnique("id", branchId),
      create: { id: branchId, data },
      update: { data },
    });
    if (largeChange) {
      const percent = (change * 100).toFixed(2);
      const message =
        `La tasa automática del dólar cambió ${percent} %: ` +
        `de RD$ ${before} a RD$ ${rate}. La actualización se aplicó; revisa la fuente ${source}.`;
      await tx.alert.upsert({
        where: tenantUnique("key", `usd-rate-change:${branchId}:${day}`),
        create: {
          key: `usd-rate-change:${branchId}:${day}`,
          type: "usd_rate_change",
          severity: "medium",
          entityId: branchId,
          branchId,
          message,
        },
        update: { status: "new", message },
      });
    }
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: options.userId ?? "sistema",
        action: "usd_rate_updated",
        entity: "settings",
        entityId: branchId,
        before: { usdRate: before },
        after: { usdRate: rate, day, source, prices: changed, lowMargin },
        branchId,
      },
    });
    return {
      rate,
      changed: changed.length,
      confirmationRequired: false,
      largeChange,
      lowMargin,
    };
  });
}

@Injectable()
export class UsdRateWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;
  constructor(@Inject(Database) private readonly db: Database) {}
  onApplicationBootstrap() {
    // Optativo por instalación; pruebas y CI no salen a internet.
    if (process.env.USD_RATE_AUTO !== "1") return;
    this.first = setTimeout(() => void this.run(), 30_000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), 3 * 3600_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    try {
      const today = businessDate();
      // Enumerar bajo el contexto RLS de cada empresa. Una sola consulta de
      // tasa sirve a todas sus sucursales; una sucursal ya actualizada se omite.
      const tenantIds =
        process.env.PRODUCT_TENANCY === "required" &&
        !tenantScope.getStore()?.tenantId
          ? await this.db.activeTenantIds()
          : [currentTenantId()];
      const pending: { tenantId: string; branchId: string }[] = [];
      for (const tenantId of tenantIds) {
        try {
          const rows = await tenantScope.run({ tenantId }, () =>
            this.db.settings.findMany({ select: { id: true, data: true } }),
          );
          pending.push(
            ...rows
              .filter((row) => (row.data as any)?.usdRateDate !== today)
              .map((row) => ({ tenantId, branchId: row.id })),
          );
        } catch (error: any) {
          // Una empresa dañada o temporalmente inaccesible no priva a las
          // demás de su actualización diaria.
          console.warn(
            `[tasa USD] empresa ${tenantId}: ${String(error?.message ?? error).slice(0, 240)}`,
          );
        }
      }
      if (!pending.length) return;
      const res = await fetch(USD_RATE_URL, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rate = parseUsdRate(await res.json());
      for (const { tenantId, branchId } of pending) {
        try {
          await tenantScope.run({ tenantId }, () =>
            applyUsdRate(this.db, branchId, rate, "open.er-api.com", today),
          );
        } catch (error: any) {
          console.warn(
            "[tasa USD] " + String(error?.message ?? error).slice(0, 300),
          );
        }
      }
    } catch (error: any) {
      console.warn(
        "[tasa USD] " + String(error?.message ?? error).slice(0, 300),
      );
    }
  }
}

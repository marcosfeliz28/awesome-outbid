import { Inject, Injectable } from "@nestjs/common";
import { businessDate } from "@fitstore/shared";
import { Database } from "./common";
import { tenantUnique } from "./tenant-context";

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

/** Guarda la tasa en Configuración y recalcula los precios en dólares. */
export async function applyUsdRate(
  db: any,
  branchId: string,
  rate: number,
  source: string,
  day = businessDate(),
) {
  return db.$transaction(async (tx: any) => {
    const settings = await tx.settings.findUnique({
      where: tenantUnique("id", branchId),
    });
    const data = { ...((settings?.data as any) ?? {}) };
    const before = data.usdRate ?? null;
    data.usdRate = rate;
    data.usdRateDate = day;
    data.usdRateSource = source;
    await tx.settings.upsert({
      where: tenantUnique("id", branchId),
      create: { id: branchId, data },
      update: { data },
    });
    const variants = await tx.variant.findMany({
      where: { branchId, active: true },
      select: { id: true, price: true, attributes: true },
    });
    const changed: { id: string; from: string; to: number }[] = [];
    for (const v of variants) {
      const usd = Number((v.attributes as any)?.usd);
      if (!(usd > 0)) continue;
      const price = usdPrice(usd, rate);
      if (Number(v.price) === price) continue;
      await tx.variant.update({
        where: tenantUnique("id", v.id),
        data: { price },
      });
      changed.push({ id: v.id, from: String(v.price), to: price });
    }
    await tx.auditLog.create({
      data: {
        userId: "sistema",
        action: "usd_rate_updated",
        entity: "settings",
        entityId: branchId,
        before: { usdRate: before },
        after: { usdRate: rate, day, source, prices: changed },
        branchId,
      },
    });
    return { rate, changed: changed.length };
  });
}

@Injectable()
export class UsdRateWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;
  constructor(@Inject(Database) private readonly db: Database) {}
  onApplicationBootstrap() {
    // Solo en la tienda real (variable en Render): pruebas y CI no salen a internet.
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
      const settings = await this.db.settings.findUnique({
        where: tenantUnique("id", "main"),
      });
      if ((settings?.data as any)?.usdRateDate === today) return;
      const res = await fetch(USD_RATE_URL, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rate = parseUsdRate(await res.json());
      await applyUsdRate(this.db, "main", rate, "open.er-api.com", today);
    } catch (error: any) {
      console.warn(
        "[tasa USD] " + String(error?.message ?? error).slice(0, 300),
      );
    }
  }
}

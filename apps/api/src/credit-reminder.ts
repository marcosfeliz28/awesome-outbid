// Recordatorio semanal de créditos por cobrar (decisión de la dueña).
//
// Cada lunes desde las 8:00 (America/Santo_Domingo) se crea UNA alerta
// «Créditos por cobrar» con el total pendiente, el número de clientes y la
// lista de clientes con su saldo y antigüedad (mayor saldo primero), y, si
// Telegram está configurado, el mismo aviso por la cola NotificationOutbox. No
// hay corte automático por antigüedad: la antigüedad es sólo información; la
// dueña decide caso por caso.
//
// Idempotencia: la clave de la alerta lleva la sucursal y la semana ISO
// (`credit-reminder:main:2026-W42`), hay un candado consultivo y el aviso de
// Telegram es único por (eventType, refId). Reinicios o varias instancias no
// repiten el aviso; si la alerta se resuelve o se descarta, tampoco se vuelve a
// crear esa semana. Sin créditos abiertos no se avisa.
import { Inject, Injectable } from "@nestjs/common";
import { BUSINESS_TIME_ZONE, d, formatMoney, money } from "@fitstore/shared";
import { Database } from "./common";
import { currentTenantId, forEachActiveTenant, tenantScope, tenantUnique } from "./tenant-context";
import {
  enqueue,
  escapeHtml,
  telegramSettings,
  wakeWorkers,
} from "./notifications";

export const CREDIT_REMINDER_TYPE = "credit_reminder";
/** Hora local (0-23) desde la que el lunes se envía el recordatorio. */
export const CREDIT_REMINDER_HOUR = 8;
/** Clientes que se nombran en el aviso; el resto se resume. */
export const CREDIT_REMINDER_LIST = 15;

const parts = (at: Date) => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => f.find((p) => p.type === type)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    weekday: get("weekday"), // Mon, Tue…
  };
};

/** Semana ISO (AAAA-Www) del día de negocio de `at`. */
export function isoWeekKey(at: Date) {
  const p = parts(at);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const day = date.getUTCDay() || 7; // lunes = 1 … domingo = 7
  date.setUTCDate(date.getUTCDate() + 4 - day); // jueves de esa semana
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((+date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * ¿Toca avisar? Desde el lunes a las 8:00 hora local; el resto de la semana
 * también (si la API estaba apagada el lunes) y la clave de la semana evita
 * repetirlo. Antes del lunes 8:00 aún pertenece a la semana anterior, que ya
 * se avisó.
 */
export function reminderDue(at: Date) {
  const p = parts(at);
  if (p.weekday === "Mon") return p.hour >= CREDIT_REMINDER_HOUR;
  return true;
}

export type OpenCredit = {
  customerId: string | null;
  customerName: string;
  pending: number;
  createdAt: Date;
};
export type ReminderLine = {
  name: string;
  pending: number;
  ageDays: number;
  sales: number;
};
/** Agrupa por cliente: mayor saldo primero y, a igual saldo, el más antiguo. */
export function summarizeCredits(rows: OpenCredit[], at: Date) {
  const by = new Map<string, ReminderLine>();
  for (const r of rows) {
    const key = r.customerId ?? "sin-cliente";
    const age = Math.max(0, Math.floor((+at - +r.createdAt) / 86400000));
    const current = by.get(key) ?? {
      name: r.customerName,
      pending: 0,
      ageDays: 0,
      sales: 0,
    };
    current.pending = Number(money(d(current.pending).plus(r.pending)));
    current.ageDays = Math.max(current.ageDays, age);
    current.sales += 1;
    by.set(key, current);
  }
  const lines = [...by.values()].sort(
    (a, b) => b.pending - a.pending || b.ageDays - a.ageDays,
  );
  return {
    total: Number(money(lines.reduce((s, l) => s.plus(l.pending), d(0)))),
    customers: lines.length,
    lines,
  };
}
const age = (days: number) =>
  days <= 0 ? "hoy" : days === 1 ? "1 día" : `${days} días`;
/** Texto de la alerta (plano) y de Telegram (HTML): nombre, saldo y antigüedad. */
export function renderReminder(
  week: string,
  s: ReturnType<typeof summarizeCredits>,
  html = false,
) {
  const esc = html ? escapeHtml : (v: string) => v;
  const shown = s.lines.slice(0, CREDIT_REMINDER_LIST);
  const rest = s.lines.length - shown.length;
  const head = `Créditos por cobrar (semana ${week}): ${formatMoney(s.total)} pendientes de ${s.customers} ${s.customers === 1 ? "cliente" : "clientes"}.`;
  const list = shown.map(
    (l) =>
      `• ${esc(l.name)}: ${formatMoney(l.pending)} · el más antiguo, ${age(l.ageDays)}`,
  );
  if (rest > 0)
    list.push(
      `• y ${rest} ${rest === 1 ? "cliente más" : "clientes más"} (míralos en la pantalla).`,
    );
  const tail = "Detalle en Caja › Créditos pendientes.";
  return [html ? `<b>${esc(head)}</b>` : head, ...list, tail].join("\n");
}

@Injectable()
export class CreditReminderService {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(@Inject(Database) private db: any) {}
  onModuleInit() {
    // Cada 15 minutos; la clave semanal y el candado evitan repetir.
    this.timer = setInterval(
      () =>
        void this.run().catch((e) => console.warn("[créditos]", e?.message)),
      15 * 60000,
    );
    this.timer.unref();
    setTimeout(() => void this.run().catch(() => undefined), 20000).unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Crea el recordatorio de la semana de `at` si toca. Devuelve lo creado. */
  async run(
    at: Date = new Date(),
    options: { telegram?: boolean } = {},
  ): Promise<{ created: string[] }> {
    if (process.env.PRODUCT_TENANCY === "required" && !tenantScope.getStore()?.tenantId) {
      const results = await forEachActiveTenant(this.db, async () => {
        try {
          return await this.run(at, options);
        } catch (error: any) {
          console.warn(
            `[créditos] Error de empresa ${currentTenantId()}: ` +
              String(error?.message ?? error).slice(0, 300),
          );
          return { created: [] };
        }
      });
      return { created: results.flatMap((result) => result.created) };
    }
    if (!reminderDue(at)) return { created: [] };
    const week = isoWeekKey(at);
    const telegram = options.telegram ?? telegramSettings().enabled;
    const branches: { branchId: string }[] = await this.db.sale.findMany({
      where: {
        status: "completed",
        creditBalance: { gt: 0 },
        payments: {
          some: { method: { in: ["credit", "cod"] }, entryType: "sale" },
        },
      },
      distinct: ["branchId"],
      select: { branchId: true },
    });
    const created: string[] = [];
    for (const { branchId } of branches) {
      const key = `credit-reminder:${branchId}:${week}`;
      const made = await this.db.$transaction(async (tx: any) => {
        // El candado no debe serializar empresas distintas que compartan caja.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"fitstore:" + currentTenantId() + ":" + key}))`;
        if (await tx.alert.findUnique({ where: tenantUnique("key", key), select: { id: true } }))
          return false;
        const sales = await tx.sale.findMany({
          where: {
            branchId,
            status: "completed",
            creditBalance: { gt: 0 },
            payments: {
              some: { method: { in: ["credit", "cod"] }, entryType: "sale" },
            },
          },
          select: { customerId: true, creditBalance: true, createdAt: true },
        });
        if (!sales.length) return false;
        const customers = await tx.customer.findMany({
          where: {
            id: {
              in: sales.flatMap((s: any) =>
                s.customerId ? [s.customerId] : [],
              ),
            },
          },
          select: { id: true, name: true },
        });
        const summary = summarizeCredits(
          sales.map((s: any) => ({
            customerId: s.customerId,
            customerName:
              customers
                .find((c: any) => c.id === s.customerId)
                ?.name?.slice(0, 60) ?? "Cliente sin identificar",
            pending: Number(s.creditBalance),
            createdAt: s.createdAt,
          })),
          at,
        );
        await tx.alert.create({
          data: {
            key,
            type: CREDIT_REMINDER_TYPE,
            severity: "medium",
            entityId: week,
            branchId,
            message: renderReminder(week, summary),
          },
        });
        if (telegram)
          await enqueue(
            tx,
            "credit_reminder",
            `${branchId}:${week}`,
            branchId,
            renderReminder(week, summary, true),
          );
        return true;
      });
      if (made) created.push(key);
    }
    if (created.length && telegram) wakeWorkers();
    return { created };
  }
}

import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { Database, type Actor } from "./common";
import { ReportsController } from "./reports";
import { emailSettings, sendEmail } from "./notifications";
import { currentTenantId, forEachActiveTenant, tenantUnique } from "./tenant-context";

export type DailyFacts = {
  day: string;
  revenue: number;
  invoices: number;
  cashDifference: number;
  pendingCod: number;
  newAlerts: number;
};

const money = (n: number) => "RD$ " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Puerta global apagada por defecto; cada sucursal además da su consentimiento
// en Ajustes antes de entrar al recorrido del trabajador.
const enabled = (env: NodeJS.ProcessEnv) => env.NEXORA_RESUMEN_DIARIO === "enabled" &&
  !!env.RESEND_API_KEY?.trim() && !!env.ANTHROPIC_API_KEY?.trim();

/** No crea correo antes de las 20:00 locales ni sin ambas claves. */
export function dailySummaryDue(at: Date, env: NodeJS.ProcessEnv = process.env, timeZone = "America/Santo_Domingo") {
  if (env.PRODUCT_TENANCY !== undefined && env.PRODUCT_TENANCY !== "required") return null;
  if (!enabled(env)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  if (Number(part("hour")) < 20) return null;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** El modelo sólo redacta una frase sin cifras. Todas las cifras se fijan abajo. */
export async function summarizeDailyFacts(facts: DailyFacts, model: (prompt: string) => Promise<string>) {
  const prompt = `Redacta una sola frase breve en español para presentar este resumen de la jornada. Sin cifras, fechas, nombres propios ni instrucciones. Magnitudes: ventas ${facts.revenue > 0 ? "sí" : "no"}; diferencia de caja ${facts.cashDifference === 0 ? "no" : "sí"}; contraentregas pendientes ${facts.pendingCod > 0 ? "sí" : "no"}; alertas ${facts.newAlerts > 0 ? "sí" : "no"}.`;
  try {
    const sentence = (await model(prompt)).trim();
    if (!sentence || sentence.length > 180 || /\d|\$|<|>|\b(?:mil|millón|millones|cien|ciento|dos|tres|PIN|clave)\b/i.test(sentence))
      return "Revisa el resumen de tu jornada.";
    return sentence;
  } catch {
    return "Revisa el resumen de tu jornada.";
  }
}

export function renderDailySummary(facts: DailyFacts, sentence: string) {
  return [
    `Resumen de Nexora POS · ${facts.day}`,
    sentence,
    `Ventas netas: ${money(facts.revenue)} · ${facts.invoices} ${facts.invoices === 1 ? "factura" : "facturas"}. Fuente: Dashboard, ${facts.day}.`,
    `Diferencia de cajas cerradas: ${money(facts.cashDifference)}. Fuente: cierres de caja, ${facts.day}.`,
    `${facts.pendingCod} ${facts.pendingCod === 1 ? "contraentrega pendiente" : "contraentregas pendientes"}. Fuente: cuentas por cobrar al preparar este mensaje.`,
    `${facts.newAlerts} ${facts.newAlerts === 1 ? "alerta nueva" : "alertas nuevas"}. Fuente: alertas del día.`,
    "Consulta el sistema antes de tomar decisiones. Este resumen no modifica datos.",
  ].join("\n");
}

const rangeForDay = (day: string) => ({
  gte: new Date(`${day}T00:00:00-04:00`), lte: new Date(`${day}T23:59:59.999-04:00`),
});
export type DailySummaryDependencies = {
  model?: (prompt: string) => Promise<string>;
  facts?: (db: Database, actor: Actor, day: string) => Promise<DailyFacts>;
  send?: typeof sendEmail;
};

/** Reusa el mismo cálculo del Dashboard, y sólo agregados para el resto. */
export async function collectFacts(db: Database, actor: Actor, day: string): Promise<DailyFacts> {
  const range = rangeForDay(day);
  const [dashboard, cash, pendingCod, newAlerts] = await Promise.all([
    new ReportsController(db).dashboard({ from: day, to: day }, actor),
    db.cashSession.aggregate({ where: { branchId: actor.branchId, closedAt: range }, _sum: { difference: true } }),
    db.sale.count({ where: { branchId: actor.branchId, status: "completed", creditBalance: { gt: 0 }, payments: { some: { method: "cod", entryType: "sale" } } } }),
    db.alert.count({ where: { branchId: actor.branchId, status: "new", createdAt: range } }),
  ]);
  return { day, revenue: Number(dashboard.revenue), invoices: Number(dashboard.invoices),
    cashDifference: Number(cash._sum.difference ?? 0), pendingCod, newAlerts };
}

/** Corre sólo en el producto, sin clave real durante las pruebas. */
@Injectable()
export class DailySummaryWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private first?: ReturnType<typeof setTimeout>;
  private running = false;
  constructor(@Inject(Database) private readonly db: Database) {}

  onApplicationBootstrap() {
    if (process.env.PRODUCT_TENANCY !== "required" || !enabled(process.env)) return;
    this.first = setTimeout(() => void this.run(), 20000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), 15 * 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async run(at = new Date(), deps: DailySummaryDependencies = {}) {
    if (this.running || process.env.PRODUCT_TENANCY !== "required" || !enabled(process.env)) return;
    this.running = true;
    try {
      await forEachActiveTenant(this.db, async () => {
        try {
          // El Dashboard actual fija su rango a Santo Domingo. El envío usa
          // el mismo día hasta que los reportes acepten zona por empresa.
          const day = dailySummaryDue(at);
          if (!day) return;
          const admins = await this.db.user.findMany({
            where: { active: true, emailVerifiedAt: { not: null }, role: { name: "admin" } },
            include: { role: true }, orderBy: { createdAt: "asc" },
          });
          const firstByBranch = new Map<string, typeof admins[number]>();
          for (const admin of admins) if (!firstByBranch.has(admin.branchId)) firstByBranch.set(admin.branchId, admin);
          for (const admin of firstByBranch.values()) {
            const settings = await this.db.settings.findUnique({ where: tenantUnique("id", admin.branchId) });
            if ((settings?.data as any)?.dailySummaryEnabled !== true) continue;
            await this.prepare(admin, day, deps);
          }
          await this.deliver(deps);
        } catch (error: any) {
          console.warn("[resumen-diario] No se pudo procesar empresa " + currentTenantId() + ": " + String(error?.message ?? error).slice(0, 120));
        }
      });
    } finally { this.running = false; }
  }

  private async prepare(admin: { id: string; name: string; email: string; branchId: string }, day: string, deps: DailySummaryDependencies) {
    const refId = `${day}:${admin.branchId}`;
    const existing = await this.db.notificationOutbox.findFirst({ where: { eventType: "ai_daily_email", refId } });
    if (existing) return;
    const actor: Actor = { id: admin.id, name: admin.name, email: admin.email, role: "admin",
      permissions: ["*"], branchId: admin.branchId, tenantId: currentTenantId() };
    const facts = await (deps.facts ?? collectFacts)(this.db, actor, day);
    const sentence = await summarizeDailyFacts(facts, deps.model ?? (async (prompt) => {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 15000, maxRetries: 1 });
      const response = await client.beta.messages.create({
        model: process.env.NEXORA_IA_MODEL || "claude-haiku-5-5", max_tokens: 80,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: prompt }],
      } as any);
      return response.content.filter((item: any) => item.type === "text").map((item: any) => item.text).join(" ");
    }));
    const text = renderDailySummary(facts, sentence);
    await this.db.notificationOutbox.create({ data: {
      id: randomUUID(), tenantId: currentTenantId(), eventType: "ai_daily_email", refId,
      branchId: admin.branchId, payload: { to: admin.email, subject: `Resumen diario · ${day}`, text },
    } }).catch((error: any) => { if (error?.code !== "P2002") throw error; });
  }

  private async deliver(deps: DailySummaryDependencies) {
    for (let i = 0; i < 10; i++) {
      const rows = await this.db.$queryRaw<Array<{ id: string; payload: { to: string; subject: string; text: string }; attempts: number }>>`
        UPDATE "NotificationOutbox" o SET "attempts"=o."attempts"+1,
          "nextAttemptAt"=timezone('UTC', now()) + interval '2 minutes'
        WHERE o.id=(SELECT id FROM "NotificationOutbox"
          WHERE "eventType"='ai_daily_email' AND status='pending'
            AND "nextAttemptAt"<=timezone('UTC', now())
          ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING o.id::text AS id, o.payload, o."attempts"`;
      const row = rows[0];
      if (!row) return;
      const settings = { ...emailSettings(), to: row.payload.to };
      const result = await (deps.send ?? sendEmail)(settings, row.payload.subject, row.payload.text, row.id);
      if (result.ok) {
        await this.db.notificationOutbox.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date(), lastError: null } });
      } else {
        await this.db.notificationOutbox.update({ where: { id: row.id }, data: {
          status: row.attempts >= 6 ? "failed" : "pending", lastError: result.error?.slice(0, 200),
          nextAttemptAt: new Date(Date.now() + Math.min(row.attempts * 15, 120) * 60000),
        } });
      }
    }
  }
}

import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy, HttpException } from "@nestjs/common";
import { PrismaClient, type Tenant } from "@prisma/client";
import { notifyOperator } from "./platform-notify";

export type TenantNoticeMailSettings = { apiKey: string; from: string; to: string; apiBase: string };
async function sendTenantNotice(settings: TenantNoticeMailSettings, subject: string, text: string, idempotencyKey: string) {
  try {
    const response = await fetch(`${settings.apiBase}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from: settings.from, to: [settings.to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: response.ok };
  } catch { return { ok: false }; }
}

const DAY = 86_400_000;
export const GRACE_DAYS = 7;
type Status = "trial" | "active" | "past_due" | "suspended";
type TenantDates = Pick<Tenant, "status" | "trialEndsAt" | "paidThroughAt" | "pastDueAt">;

/** Decide con el reloj del servidor, aun cuando el trabajador no haya corrido. */
export function effectiveTenantStatus(tenant: TenantDates, now = new Date()): Status {
  if (tenant.status === "suspended") return "suspended";
  const due = tenant.status === "trial" ? tenant.trialEndsAt : tenant.paidThroughAt;
  const since = tenant.status === "past_due"
    ? (tenant.pastDueAt ?? tenant.paidThroughAt ?? tenant.trialEndsAt) : due;
  if (tenant.status === "past_due" || (due && due <= now)) {
    if (since && now.getTime() - since.getTime() >= GRACE_DAYS * DAY) return "suspended";
    return "past_due";
  }
  return tenant.status === "active" ? "active" : "trial";
}

export function tenantDueAt(tenant: TenantDates): Date | null {
  return tenant.status === "trial" ? tenant.trialEndsAt : tenant.paidThroughAt;
}

type Mailer = (settings: TenantNoticeMailSettings, subject: string, text: string, key: string) => Promise<{ ok: boolean }>;
// Decisión de la dueña (19-nov): un aviso 2 días ANTES del vencimiento y otro
// 2 días DESPUÉS (en mora, antes de suspender). Uno por período: la clave es
// (empresa, tipo, fecha de vencimiento).
export const NOTICE_DAYS = 2;
type NoticeKind = "trial_due_2" | "billing_due_2" | "overdue_2";
export type TenantNotice = { kind: NoticeKind; dueAt: Date; graceEndsAt: Date };

/** Fecha corta en la zona de la empresa (H10), p. ej. «21 de noviembre de 2026». */
export function formatTenantDate(date: Date, timeZone?: string | null) {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  try { return new Intl.DateTimeFormat("es-DO", { ...options, timeZone: timeZone || "America/Santo_Domingo" }).format(date); }
  catch { return new Intl.DateTimeFormat("es-DO", { ...options, timeZone: "America/Santo_Domingo" }).format(date); }
}

/** Vencimiento del período en curso, también en mora (pastDueAt guarda el vencimiento). */
function periodDueAt(tenant: TenantDates): Date | null {
  return tenant.status === "past_due" ? (tenant.pastDueAt ?? tenant.paidThroughAt ?? tenant.trialEndsAt) : tenantDueAt(tenant);
}

/** El aviso que toca ahora (o null), con el reloj del servidor. Lo usan el trabajador y GET /tenant/status. */
export function tenantNotice(tenant: TenantDates, now = new Date()): TenantNotice | null {
  const status = effectiveTenantStatus(tenant, now);
  const due = periodDueAt(tenant);
  if (!due || status === "suspended") return null;
  const graceEndsAt = new Date(due.getTime() + GRACE_DAYS * DAY);
  if (status === "past_due")
    return now.getTime() - due.getTime() >= NOTICE_DAYS * DAY ? { kind: "overdue_2", dueAt: due, graceEndsAt } : null;
  if (due.getTime() - now.getTime() <= NOTICE_DAYS * DAY)
    return { kind: status === "trial" ? "trial_due_2" : "billing_due_2", dueAt: due, graceEndsAt };
  return null;
}

/** Texto del aviso (alerta y correo). */
export function noticeText(notice: TenantNotice, timeZone?: string | null) {
  const due = formatTenantDate(notice.dueAt, timeZone);
  if (notice.kind === "overdue_2") return {
    subject: "Tu plan de Norexos está vencido: se va a suspender",
    text: `Tu plan de Norexos venció el ${due} y está en mora. Si no pagas antes del ${formatTenantDate(notice.graceEndsAt, timeZone)}, ` +
      "el sistema se suspende y queda en solo lectura (nada se borra). Paga en «Plan y facturación».",
  };
  const what = notice.kind === "trial_due_2" ? "Tu prueba gratis de Norexos" : "Tu plan de Norexos";
  return {
    subject: `${what} vence el ${due}`,
    text: `${what} vence el ${due}. Paga para seguir usando el sistema sin interrupciones (en «Plan y facturación»).`,
  };
}

/** Servicio global deliberadamente limitado a Tenant y avisos, nunca tablas de negocio. */
@Injectable()
export class TenantLifecycleService implements OnModuleDestroy {
  private readonly root = new PrismaClient();
  async onModuleDestroy() { await this.root.$disconnect(); }

  async statusForTenant(tenantId: string, now = new Date()) {
    const tenant = await this.root.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, plan: true, timeZone: true },
    });
    if (!tenant) throw new HttpException("Empresa no disponible.", 403);
    const notice = tenantNotice(tenant, now);
    return {
      status: effectiveTenantStatus(tenant, now),
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
      paidThroughAt: tenant.paidThroughAt,
      graceEndsAt: (tenant.pastDueAt ?? tenant.paidThroughAt ?? tenant.trialEndsAt)
        ? new Date((tenant.pastDueAt ?? tenant.paidThroughAt ?? tenant.trialEndsAt)!.getTime() + GRACE_DAYS * DAY)
        : null,
      timeZone: tenant.timeZone,
      // Banner de la web: el mismo aviso que el trabajador (2 días antes / 2 después).
      notice: notice && { kind: notice.kind, dueAt: notice.dueAt, graceEndsAt: notice.graceEndsAt, message: noticeText(notice, tenant.timeZone).text },
      // «Habla con nosotros» en la pantalla de suspendido; sin valor fijo en el código.
      supportContact: process.env.NEXORA_SUPPORT_CONTACT?.trim().slice(0, 200) || null,
    };
  }

  /** El proveedor de prueba de la fase 1.4 llama esto al confirmar un período. */
  async activateTenant(tenantId: string, paidThroughAt: Date, now = new Date()) {
    if (!Number.isFinite(paidThroughAt.getTime()) || paidThroughAt <= now)
      throw new Error("El período pagado debe terminar en el futuro.");
    return this.root.tenant.update({
      where: { id: tenantId },
      data: { status: "active", paidThroughAt, pastDueAt: null, suspendedAt: null },
    });
  }

  /** Persistencia idempotente; jamás borra información ni renueva una prueba. */
  async advance(now = new Date()) {
    const rows = await this.root.tenant.findMany({
      where: { status: { in: ["trial", "active", "past_due"] } },
      select: { id: true, status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, timeZone: true },
    });
    for (const row of rows) {
      const projected = effectiveTenantStatus(row, now);
      if (projected === row.status) continue;
      const due = tenantDueAt(row);
      let changed = 0;
      if (row.status === "trial") {
        if (!due) continue;
        changed = (await this.root.tenant.updateMany({
          where: { id: row.id, status: "trial", trialEndsAt: { lte: now } },
          data: projected === "suspended"
            ? { status: "suspended", pastDueAt: due, suspendedAt: now }
            : { status: "past_due", pastDueAt: due },
        })).count;
      } else if (row.status === "active") {
        if (!due) continue;
        changed = (await this.root.tenant.updateMany({
          where: { id: row.id, status: "active", paidThroughAt: { lte: now } },
          data: projected === "suspended"
            ? { status: "suspended", pastDueAt: due, suspendedAt: now }
            : { status: "past_due", pastDueAt: due },
        })).count;
      } else if (row.pastDueAt) {
        changed = (await this.root.tenant.updateMany({
          where: { id: row.id, status: "past_due", pastDueAt: { lte: new Date(now.getTime() - GRACE_DAYS * DAY) } },
          data: { status: "suspended", suspendedAt: now },
        })).count;
      }
      const key = row.status === "past_due" ? row.pastDueAt : due;
      if (changed && key) await notifyOperator(this.root, {
        tenantId: row.id, event: projected === "suspended" ? "op_suspended" : "op_past_due", key,
        detail: `Venció el ${formatTenantDate(key, row.timeZone)}`,
      });
    }
  }

  /** Un aviso por período y tipo (2 días antes / 2 días después), también con varios workers. */
  async queueNotices(now = new Date()) {
    const rows = await this.root.tenant.findMany({
      where: { status: { in: ["trial", "active", "past_due"] } },
      select: { id: true, status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, timeZone: true },
    });
    for (const tenant of rows) {
      const due = tenant.status === "trial" ? tenant.trialEndsAt : tenant.paidThroughAt;
      // Aviso al operador (sin cambio): 7 días o menos antes de vencer.
      if ((tenant.status === "trial" || tenant.status === "active") && due && due > now) {
        const daysLeft = Math.ceil((due.getTime() - now.getTime()) / DAY);
        if (daysLeft <= 7) await notifyOperator(this.root, {
          tenantId: tenant.id, event: "op_due_7", key: due,
          detail: `Vence el ${formatTenantDate(due, tenant.timeZone)} (${daysLeft} días)`,
        });
      }
      const notice = tenantNotice(tenant, now);
      if (!notice) continue;
      // Correo (solo si hay RESEND) por la cola; la alerta en la app sale siempre.
      await this.root.tenantLifecycleNotice.createMany({
        data: [{ tenantId: tenant.id, kind: notice.kind, dueAt: notice.dueAt, nextAttemptAt: now }], skipDuplicates: true,
      });
      await this.queueInAppNotice(tenant.id, notice, tenant.timeZone);
    }
  }

  /** Aviso dentro del sistema (Alertas, sólo administración), aunque no haya correo. */
  private async queueInAppNotice(tenantId: string, notice: TenantNotice, timeZone: string | null) {
    const branches = await this.root.user.findMany({
      where: { tenantId, active: true, role: { name: "admin" } }, select: { branchId: true }, distinct: ["branchId"],
    });
    if (!branches.length) return;
    const message = noticeText(notice, timeZone).text;
    // El trigger de Alert publica un evento en tiempo real: debe salir con esta empresa.
    await this.root.$transaction([
      this.root.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      this.root.alert.createMany({
        data: branches.map(({ branchId }) => ({
          tenantId, branchId, key: `plan-due:${notice.kind}:${notice.dueAt.toISOString()}:${branchId}`,
          type: "plan_due", severity: notice.kind === "overdue_2" ? "high" : "medium", entityId: tenantId, message,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async sendPendingNotices(now = new Date(), mailer: Mailer = sendTenantNotice) {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.NOTIFY_EMAIL_FROM?.trim();
    if (!key || !from) return;
    const pending = await this.root.tenantLifecycleNotice.findMany({
      where: { status: "pending", nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" }, take: 50,
    });
    for (const notice of pending) {
      const claimUntil = new Date(now.getTime() + 120_000);
      const claimed = await this.root.tenantLifecycleNotice.updateMany({
        where: { id: notice.id, status: "pending", nextAttemptAt: { lte: now } },
        data: { nextAttemptAt: claimUntil, attempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      const tenant = await this.root.tenant.findUnique({
        where: { id: notice.tenantId },
        select: { status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, timeZone: true },
      });
      // Solo si sigue tocando el mismo aviso del mismo período (pagó, se prorrogó o ya se suspendió: se descarta).
      const current = tenant && tenantNotice(tenant, now);
      if (!tenant || !current || current.kind !== notice.kind || current.dueAt.getTime() !== notice.dueAt.getTime()) {
        await this.root.tenantLifecycleNotice.updateMany({
          where: { id: notice.id, status: "pending" }, data: { status: "superseded" },
        });
        continue;
      }
      const owner = await this.root.user.findFirst({
        where: { tenantId: notice.tenantId, active: true, emailVerifiedAt: { not: null }, role: { name: "admin" } },
        orderBy: { createdAt: "asc" }, select: { email: true },
      });
      if (!owner) continue;
      const { subject, text } = noticeText(current, tenant.timeZone);
      const settings: TenantNoticeMailSettings = {
        apiKey: key, from, to: owner.email,
        apiBase: (process.env.RESEND_API_BASE?.trim() || "https://api.resend.com").replace(/\/+$/, ""),
      };
      const idempotencyKey = `nexora/tenant-notice/${notice.id}`;
      const result = await mailer(settings, subject, text, idempotencyKey).catch(() => ({ ok: false }));
      if (result.ok) await this.root.tenantLifecycleNotice.updateMany({
        where: { id: notice.id, status: "pending" }, data: { status: "sent", sentAt: now },
      });
      else await this.root.tenantLifecycleNotice.updateMany({
        where: { id: notice.id, status: "pending" }, data: { nextAttemptAt: new Date(now.getTime() + Math.min(3600, 30 * 2 ** Math.min(notice.attempts, 7)) * 1000) },
      });
    }
  }
}

@Injectable()
export class TenantLifecycleWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  constructor(@Inject(TenantLifecycleService) private readonly lifecycle: TenantLifecycleService) {}
  onApplicationBootstrap() {
    this.first = setTimeout(() => void this.run(), 15_000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), 60 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }
  async run(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.lifecycle.queueNotices(now);
      await this.lifecycle.advance(now);
      await this.lifecycle.sendPendingNotices(now);
    } catch (error: any) {
      console.warn("[tenant-lifecycle] " + String(error?.message ?? error).slice(0, 200));
    } finally { this.running = false; }
  }
}

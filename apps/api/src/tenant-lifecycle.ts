import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy, HttpException } from "@nestjs/common";
import { PrismaClient, type Tenant } from "@prisma/client";

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
type NoticeKind = "trial_7" | "trial_3" | "billing_7" | "billing_3";

/** Servicio global deliberadamente limitado a Tenant y avisos, nunca tablas de negocio. */
@Injectable()
export class TenantLifecycleService implements OnModuleDestroy {
  private readonly root = new PrismaClient();
  async onModuleDestroy() { await this.root.$disconnect(); }

  async statusForTenant(tenantId: string, now = new Date()) {
    const tenant = await this.root.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true, plan: true },
    });
    if (!tenant) throw new HttpException("Empresa no disponible.", 403);
    return {
      status: effectiveTenantStatus(tenant, now),
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
      paidThroughAt: tenant.paidThroughAt,
      graceEndsAt: (tenant.pastDueAt ?? tenant.paidThroughAt ?? tenant.trialEndsAt)
        ? new Date((tenant.pastDueAt ?? tenant.paidThroughAt ?? tenant.trialEndsAt)!.getTime() + GRACE_DAYS * DAY)
        : null,
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
      select: { id: true, status: true, trialEndsAt: true, paidThroughAt: true, pastDueAt: true },
    });
    for (const row of rows) {
      const projected = effectiveTenantStatus(row, now);
      if (projected === row.status) continue;
      const due = tenantDueAt(row);
      if (row.status === "trial") {
        if (!due) continue;
        await this.root.tenant.updateMany({
          where: { id: row.id, status: "trial", trialEndsAt: { lte: now } },
          data: projected === "suspended"
            ? { status: "suspended", pastDueAt: due, suspendedAt: now }
            : { status: "past_due", pastDueAt: due },
        });
      } else if (row.status === "active") {
        if (!due) continue;
        await this.root.tenant.updateMany({
          where: { id: row.id, status: "active", paidThroughAt: { lte: now } },
          data: projected === "suspended"
            ? { status: "suspended", pastDueAt: due, suspendedAt: now }
            : { status: "past_due", pastDueAt: due },
        });
      } else if (row.pastDueAt) {
        await this.root.tenant.updateMany({
          where: { id: row.id, status: "past_due", pastDueAt: { lte: new Date(now.getTime() - GRACE_DAYS * DAY) } },
          data: { status: "suspended", suspendedAt: now },
        });
      }
    }
  }

  /** Una notificación por vencimiento y umbral, también con varios workers. */
  async queueNotices(now = new Date()) {
    const rows = await this.root.tenant.findMany({
      where: { status: { in: ["trial", "active"] } },
      select: { id: true, status: true, trialEndsAt: true, paidThroughAt: true },
    });
    for (const tenant of rows) {
      const due = tenant.status === "trial" ? tenant.trialEndsAt : tenant.paidThroughAt;
      if (!due || due <= now) continue;
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / DAY);
      for (const threshold of [7, 3] as const) {
        if (daysLeft !== threshold) continue;
        const kind = `${tenant.status === "trial" ? "trial" : "billing"}_${threshold}` as NoticeKind;
        await this.root.tenantLifecycleNotice.createMany({
          data: [{ tenantId: tenant.id, kind, dueAt: due, nextAttemptAt: now }], skipDuplicates: true,
        });
      }
    }
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
        select: { status: true, trialEndsAt: true, paidThroughAt: true },
      });
      const currentDue = tenant?.status === "trial" ? tenant.trialEndsAt : tenant?.paidThroughAt;
      const currentKind = tenant?.status === "trial" ? "trial_" : "billing_";
      if (!tenant || currentDue?.getTime() !== notice.dueAt.getTime() || !notice.kind.startsWith(currentKind)) {
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
      const days = notice.kind.endsWith("_7") ? "7" : "3";
      const subject = notice.kind.startsWith("trial_") ? "Tu prueba de Nexora vence pronto" : "Tu plan de Nexora vence pronto";
      const text = `Tu ${notice.kind.startsWith("trial_") ? "prueba" : "período de cobro"} vence en ${days} días. Ingresa a Nexora para revisar el estado de tu plan.`;
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

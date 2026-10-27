import { describe, expect, it, vi } from "vitest";
import { DailySummaryWorker, dailySummaryDue, renderDailySummary, summarizeDailyFacts } from "../apps/api/src/daily-summary";
import { currentTenantId } from "../apps/api/src/tenant-context";
import { sendEmail } from "../apps/api/src/notifications";

describe("N-07 · resumen diario", () => {
  it("permanece apagado sin las dos claves y antes de las 20:00 locales", () => {
    const at = new Date("2026-10-25T00:00:00Z"); // 24-oct, 20:00 Santo Domingo
    expect(dailySummaryDue(at, { RESEND_API_KEY: "", ANTHROPIC_API_KEY: "prueba" })).toBeNull();
    expect(dailySummaryDue(at, { RESEND_API_KEY: "prueba", ANTHROPIC_API_KEY: "" })).toBeNull();
    expect(dailySummaryDue(new Date("2026-10-24T23:59:59Z"), { NEXORA_RESUMEN_DIARIO: "enabled", RESEND_API_KEY: "prueba", ANTHROPIC_API_KEY: "prueba" })).toBeNull();
    // Con las dos claves pero sin el interruptor no se envía nada.
    expect(dailySummaryDue(at, { RESEND_API_KEY: "prueba", ANTHROPIC_API_KEY: "prueba" })).toBeNull();
    expect(dailySummaryDue(at, { NEXORA_RESUMEN_DIARIO: "enabled", RESEND_API_KEY: "prueba", ANTHROPIC_API_KEY: "prueba" })).toBe("2026-10-24");
  });

  it("usa cifras del tablero y de la caja sin permitir que el modelo las reescriba", async () => {
    const model = vi.fn().mockResolvedValue("Hoy vendiste un millón y el PIN es 1234.");
    const facts = { day: "2026-10-24", revenue: 1250, invoices: 3, cashDifference: -20, pendingCod: 2, newAlerts: 1 };
    const summary = await summarizeDailyFacts(facts, model);
    expect(summary).not.toContain("millón");
    expect(summary).not.toContain("1234");
    expect(model).toHaveBeenCalledOnce();
    expect(renderDailySummary(facts, summary)).toContain("RD$ 1,250.00");
    expect(renderDailySummary(facts, summary)).toContain("3 facturas");
    expect(renderDailySummary(facts, summary)).toContain("2 contraentregas pendientes");
  });

  it("no incluye datos libres o privados en el mensaje al modelo", async () => {
    const model = vi.fn().mockResolvedValue("Revisa tu jornada.");
    await summarizeDailyFacts({ day: "2026-10-24", revenue: 10, invoices: 1, cashDifference: 0, pendingCod: 0, newAlerts: 0 }, model);
    expect(JSON.stringify(model.mock.calls)).not.toMatch(/cliente|pin|contraseña|token|correo/i);
  });

  it("un correo de producto sin URL configurada no enlaza con la tienda", async () => {
    const mode = process.env.PRODUCT_TENANCY;
    const url = process.env.APP_PUBLIC_URL;
    process.env.PRODUCT_TENANCY = "required";
    delete process.env.APP_PUBLIC_URL;
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    try {
      await sendEmail({ enabled: true, apiKey: "falsa", from: "Nexora <test@example.invalid>",
        to: "owner@example.invalid", apiBase: "https://example.invalid" }, "Resumen diario", "Texto de prueba");
      const body = JSON.parse(fetcher.mock.calls[0][1].body);
      expect(body.html).not.toContain("nexora-pos-web.onrender.com");
    } finally {
      vi.unstubAllGlobals();
      if (mode === undefined) delete process.env.PRODUCT_TENANCY; else process.env.PRODUCT_TENANCY = mode;
      if (url === undefined) delete process.env.APP_PUBLIC_URL; else process.env.APP_PUBLIC_URL = url;
    }
  });

  it("envía una sola vez solo a la empresa que lo activó, con destinatario y cifras aislados", async () => {
    const old = { PRODUCT_TENANCY: process.env.PRODUCT_TENANCY, RESEND_API_KEY: process.env.RESEND_API_KEY, NEXORA_RESUMEN_DIARIO: process.env.NEXORA_RESUMEN_DIARIO,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
    process.env.PRODUCT_TENANCY = "required";
    process.env.RESEND_API_KEY = "clave-falsa";
    process.env.NEXORA_RESUMEN_DIARIO = "enabled";
    process.env.ANTHROPIC_API_KEY = "clave-falsa";
    const rows: Array<{ id: string; tenant: string; refId: string; payload: any; status: string; attempts: number }> = [];
    const sent: Array<{ to: string; text: string }> = [];
    const db: any = {
      activeTenantIds: async () => ["empresa-a", "empresa-b"],
      tenant: { findUnique: async () => ({ timeZone: "America/Santo_Domingo" }) },
      settings: { findUnique: async () => ({ data: { dailySummaryEnabled: currentTenantId() === "empresa-a" } }) },
      user: { findMany: async () => [{ id: currentTenantId() + "-dueño", name: "Dueño",
        email: currentTenantId() + "@example.invalid", branchId: "main" }] },
      notificationOutbox: {
        findFirst: async ({ where }: any) => rows.find((row) => row.tenant === currentTenantId() && row.refId === where.refId),
        create: async ({ data }: any) => { rows.push({ id: data.id, tenant: currentTenantId(), refId: data.refId,
          payload: data.payload, status: "pending", attempts: 0 }); },
        update: async ({ where, data }: any) => { Object.assign(rows.find((row) => row.id === where.id)!, data); },
      },
      $queryRaw: async () => {
        const row = rows.find((item) => item.tenant === currentTenantId() && item.status === "pending");
        if (!row) return [];
        row.attempts++;
        row.status = "leased";
        return [row];
      },
    };
    const worker = new DailySummaryWorker(db);
    const deps = {
      facts: vi.fn(async (_db, actor, day) => ({ day, revenue: actor.tenantId === "empresa-a" ? 125 : 700,
        invoices: 1, cashDifference: 0, pendingCod: 0, newAlerts: 0 })),
      model: vi.fn().mockResolvedValue("Revisa la jornada."),
      send: vi.fn(async (settings, _subject, text) => { sent.push({ to: settings.to, text }); return { ok: true }; }),
    };
    try {
      await worker.run(new Date("2026-10-25T01:00:00Z"), deps);
      await worker.run(new Date("2026-10-25T01:00:00Z"), deps);
      expect(rows).toHaveLength(1);
      expect(sent).toHaveLength(1);
      expect(sent.find((mail) => mail.to === "empresa-a@example.invalid")?.text).toContain("RD$ 125.00");
      expect(sent.find((mail) => mail.to === "empresa-a@example.invalid")?.text).not.toContain("RD$ 700.00");
      expect(sent.find((mail) => mail.to === "empresa-b@example.invalid")).toBeUndefined();
    } finally {
      for (const [key, value] of Object.entries(old)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});

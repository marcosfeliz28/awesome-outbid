import { describe, expect, it, vi } from "vitest";
import { assistantMonth, assistantPlanLimit, reserveAssistantQuery, usageForTenant } from "../apps/api/src/assistant-usage";

const actor = { id: "user-b", tenantId: "tenant-b", branchId: "main", name: "Prueba", email: "b@example.invalid", role: "admin", permissions: ["*"] };

describe("N-02 · cuota y bitácora del asistente", () => {
  it("abre el mes en la zona de Santo Domingo y lo reinicia al mes siguiente", () => {
    expect(assistantMonth(new Date("2026-11-01T03:59:00Z")).month).toBe("2026-10");
    expect(assistantMonth(new Date("2026-11-01T04:00:00Z")).month).toBe("2026-11");
  });

  it("usa los límites reales de los cuatro planes", () => {
    expect(["autoservicio", "basico", "pro", "premium"].map(assistantPlanLimit)).toEqual([30, 50, 300, 1000]);
  });

  it("la pregunta 31 da 429, el mes siguiente permite otra, y nunca guarda texto", async () => {
    const rows: any[] = Array.from({ length: 30 }, (_, i) => ({ tenantId: "tenant-b", createdAt: new Date(`2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`), action: "assistant.ask" }));
    const db: any = {
      $transaction: (fn: any) => fn(db),
      $queryRaw: vi.fn().mockResolvedValue([{ plan: "autoservicio" }]),
      auditLog: {
        count: vi.fn(({ where }) => Promise.resolve(rows.filter(row => row.tenantId === actor.tenantId && row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt).length)),
        create: vi.fn(({ data }) => { const row = { ...data, tenantId: actor.tenantId, createdAt: new Date("2026-11-01T04:00:00Z") }; rows.push(row); return Promise.resolve({ id: "audit-1", ...row }); }),
      },
    };
    await expect(reserveAssistantQuery(db, actor as any, new Date("2026-10-31T19:00:00Z"))).rejects.toMatchObject({ status: 429 });
    const next = await reserveAssistantQuery(db, actor as any, new Date("2026-11-01T04:00:00Z"));
    expect(next.remaining).toBe(29);
    expect(JSON.stringify(db.auditLog.create.mock.calls[0][0].data)).not.toContain("¿Qué hay?");
    rows.push({ tenantId: "tenant-a", createdAt: new Date("2026-11-01T12:00:00Z"), action: "assistant.ask" });
    expect((await usageForTenant(db, actor as any, new Date("2026-11-01T12:00:00Z"))).usadas).toBe(1);
  });
});

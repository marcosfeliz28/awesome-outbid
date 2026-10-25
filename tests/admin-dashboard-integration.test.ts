import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { audit } from "../apps/api/src/common";

const read = (path: string) => readFileSync(path, "utf8");

describe("tablero administrativo · integración", () => {
  it("monta las tarjetas sobre el tablero sin sondeo periódico", () => {
    const dashboard = read("apps/web/src/Dashboard.tsx");
    const cards = read("apps/web/src/admin-dashboard/AdminDashboardCards.tsx");
    expect(dashboard).toContain("<AdminDashboardCards");
    expect(dashboard.indexOf("<AdminDashboardCards")).toBeLessThan(
      dashboard.indexOf("<QueryState"),
    );
    expect(cards).toContain('queryKey: ["cash-sessions"]');
    expect(cards).toContain('queryKey: ["dashboard-liquidity"]');
    expect(cards).not.toContain("refetchInterval");
    expect(dashboard).not.toContain("refetchInterval");
  });

  it("cada operación auditada emite una señal SSE mínima sin datos sensibles", async () => {
    const created = { id: "audit-1" };
    const db = {
      auditLog: { create: vi.fn().mockResolvedValue(created) },
      realtimeEvent: { create: vi.fn().mockResolvedValue({ id: 1n }) },
    };
    const result = await audit(
      db,
      { id: "owner", branchId: "branch-a" } as never,
      "verify",
      "payment",
      "payment-secret-id",
      undefined,
      { amount: 5000, customer: "Nombre privado" },
    );
    expect(result).toBe(created);
    expect(db.realtimeEvent.create).toHaveBeenCalledWith({
      data: {
        branchId: "branch-a",
        type: "audit.created",
        data: { action: "verify", entity: "payment" },
      },
    });
    expect(JSON.stringify(db.realtimeEvent.create.mock.calls)).not.toContain(
      "Nombre privado",
    );
    expect(JSON.stringify(db.realtimeEvent.create.mock.calls)).not.toContain(
      "5000",
    );
    expect(JSON.stringify(db.realtimeEvent.create.mock.calls)).not.toContain(
      "payment-secret-id",
    );
  });

  it("filtra la bitácora por el día dominicano y resuelve el saleId del pago", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "audit-payment",
        entity: "payment",
        entityId: "payment-1",
        action: "verify",
        after: { status: "ok" },
        createdAt: new Date("2026-10-25T15:00:00Z"),
      },
      {
        id: "audit-sale",
        entity: "sale",
        entityId: "sale-2",
        action: "void",
        after: null,
        createdAt: new Date("2026-10-25T16:00:00Z"),
      },
    ]);
    const db = {
      auditLog: { findMany },
      payment: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "payment-1", saleId: "sale-1" }]),
      },
    };
    const controller = new AdminController(db as never);
    const result = await controller.auditLog(
      { branchId: "branch-a" } as never,
      { date: "2026-10-25" },
    );
    expect(findMany).toHaveBeenCalledWith({
      where: {
        branchId: "branch-a",
        createdAt: {
          gte: new Date("2026-10-25T04:00:00.000Z"),
          lte: new Date("2026-10-26T03:59:59.999Z"),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    expect(result.map((row) => row.saleId)).toEqual(["sale-1", "sale-2"]);
  });

  it("invalida las cinco lecturas del tablero al recibir audit.created", () => {
    const realtime = read("apps/web/src/realtime.tsx");
    expect(realtime).toContain('type === "audit.created"');
    for (const key of [
      "cash-sessions",
      "void-requests",
      "pending-transfers",
      "dashboard-liquidity",
      "audit-log",
    ])
      expect(realtime).toContain(`"${key}"`);
  });

  it("conserva la caja de cajeras fuera del alcance del rediseño", () => {
    const cards = read("apps/web/src/admin-dashboard/AdminDashboardCards.tsx");
    expect(cards).toContain("if (!canSeeReports) return null");
    expect(read("apps/web/src/POS.tsx")).not.toContain("AdminDashboardCards");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { audit, signalDashboard } from "../apps/api/src/common";
import { SalesController } from "../apps/api/src/sales";

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
    expect(read("apps/web/src/YearPie.tsx")).not.toContain("refetchInterval");
  });

  it("separa la bitácora de la señal SSE y no envía datos sensibles", async () => {
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
    expect(db.realtimeEvent.create).not.toHaveBeenCalled();

    await signalDashboard(
      db as never,
      { branchId: "branch-a" },
      {
        action: "verify",
        entity: "payment",
      },
    );
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

  it("un fallo de la señal posterior al commit no revierte la transferencia verificada", async () => {
    const paymentId = "00000000-0000-4000-8000-000000000001";
    const saleId = "00000000-0000-4000-8000-000000000002";
    let committed = false;
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      payment: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: paymentId,
          saleId,
          cashSessionId: null,
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: paymentId,
          saleId,
          cashSessionId: null,
          status: "pending_verification",
          entryType: "sale",
        }),
        update: vi.fn().mockResolvedValue({ id: paymentId, status: "ok" }),
      },
      sale: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ id: saleId, status: "completed" }),
      },
      alert: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const db = {
      $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => {
        const value = await operation(tx);
        committed = true;
        return value;
      }),
      realtimeEvent: {
        create: vi.fn().mockImplementation(async () => {
          expect(committed).toBe(true);
          throw new Error("SSE no disponible");
        }),
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await new SalesController(db as never).verify(paymentId, {
      id: "owner",
      branchId: "branch-a",
    } as never);

    expect(result).toEqual({ ok: true });
    expect(committed).toBe(true);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: paymentId },
      data: { status: "ok" },
    });
    expect(db.realtimeEvent.create).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[tablero] No se pudo emitir la señal de actualización.",
    );
    warn.mockRestore();
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
      "dashboard",
      "dashboard-year",
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

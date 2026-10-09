import { describe, expect, it } from "vitest";
import { AlertsController } from "../apps/api/src/alerts";
import { ReportsController, storeReport } from "../apps/api/src/reports";
import { CashController } from "../apps/api/src/cash";

const actor = (permissions: string[], id = "cashier-1") =>
  ({
    id,
    name: "Caja",
    email: "caja@example.test",
    role: "custom",
    permissions,
    branchId: "main",
  }) as any;

describe("C2 · privacidad de arqueo por rutas indirectas", () => {
  it("B4: rechaza un retiro sin efectivo suficiente sin revelar cifras", async () => {
    let created = false;
    const session = {
      id: "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
      branchId: "main",
      userId: "cashier-1",
      registerId: "terminal-1",
      openingAmount: 50,
      closedAt: null,
    };
    const tx = {
      $queryRaw: async () => [],
      cashSession: { findFirstOrThrow: async () => session },
      payment: { findMany: async () => [] },
      cashMovement: {
        findMany: async () => [],
        create: async () => {
          created = true;
          return {};
        },
      },
      saleReturn: { findMany: async () => [] },
      auditLog: { create: async () => ({}) },
    };
    const controller = new CashController({
      $transaction: async (run: (client: any) => unknown) => run(tx),
    } as any);

    await expect(
      controller.movement(
        session.id,
        { type: "out", amount: 51, reason: "Retiro operativo" },
        actor(["cash:write"]),
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: "No hay suficiente efectivo en caja.",
    });
    expect(created).toBe(false);
  });

  it("B3: dashboard oculta formas de pago de cajas abiertas y redacta alertas", async () => {
    const openSessionId = "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84";
    const paymentQueries: any[] = [];
    const zeroAggregate = {
      _sum: { total: 0, taxTotal: 0, costTotal: 0, amount: 0, feeAmount: 0 },
      _count: 0,
    };
    const db = {
      cashSession: {
        findMany: async () => [{ id: openSessionId }],
      },
      sale: { aggregate: async () => zeroAggregate },
      saleReturn: { aggregate: async () => zeroAggregate },
      expense: { aggregate: async () => zeroAggregate },
      payment: {
        aggregate: async () => zeroAggregate,
        groupBy: async (query: any) => {
          paymentQueries.push(query);
          const hidden = query.where.OR?.some((clause: any) =>
            clause.cashSessionId?.notIn?.includes(openSessionId),
          );
          return hidden
            ? [{ method: "transfer", _sum: { amount: 25, feeAmount: 0 } }]
            : [
                { method: "cash", _sum: { amount: 125, feeAmount: 0 } },
                { method: "transfer", _sum: { amount: 25, feeAmount: 0 } },
              ];
        },
      },
      alert: {
        findMany: async () => [
          {
            id: "cash-alert",
            type: "cash_difference",
            message: "Diferencia exacta RD$ 1,234.00",
          },
        ],
      },
      $queryRaw: async () => [],
    };
    const limited = actor(["reports:read", "cash:write"]);
    const result: any = await new ReportsController(db as any).dashboard(
      {},
      limited,
    );

    expect(paymentQueries).toHaveLength(1);
    expect(result.payments).toEqual([{ name: "transfer", amount: 25 }]);
    expect(result.payments).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "cash" })]),
    );
    expect(result.alerts[0].message).not.toMatch(/1,234|RD\$/);
  });

  it("el reporte genérico de caja exige privilegio financiero", async () => {
    const controller = new ReportsController({} as any);
    await expect(
      controller.report("cash", {}, actor(["reports:read"]), {} as any),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("sin privilegio sólo permite STORE_REPORTS de la caja propia cerrada", async () => {
    const openOwn = {
      id: "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
      branchId: "main",
      userId: "cashier-1",
      openedAt: new Date(),
      closedAt: null,
    };
    const db = {
      cashSession: {
        findFirstOrThrow: async ({ where }: any) =>
          where.id === openOwn.id ? openOwn : { ...openOwn, userId: "other" },
      },
    };
    await expect(
      storeReport(db, actor(["reports:read"]), "venta-por-forma-pago", {
        cashSessionId: openOwn.id,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      storeReport(db, actor(["reports:read"]), "venta-por-forma-pago", {}),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      storeReport(
        db,
        actor(["reports:read"], "other"),
        "venta-diaria-usuario",
        {
          cashSessionId: openOwn.id,
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("GET y PATCH de alertas ocultan montos de cash_difference", async () => {
    const exact = {
      id: "8cb86d0b-638b-4fb2-8a8b-2e18af78d35f",
      type: "cash_difference",
      message:
        "Diferencias de caja: efectivo RD$ 1,234.00, tarjeta RD$ 0, transferencia RD$ 0",
      status: "new",
    };
    const db = {
      alert: {
        findMany: async () => [
          exact,
          { id: "alert-2", type: "stock", message: "Stock bajo" },
        ],
        findFirstOrThrow: async () => exact,
        update: async () => ({ ...exact, status: "seen" }),
      },
      auditLog: { create: async () => ({}) },
    };
    const controller = new AlertsController(
      db as any,
      {
        evaluate: async () => [],
      } as any,
    );
    const limited = actor(["alerts:write"]);
    const rows = await controller.alerts(limited, {});
    expect(rows[0].message).not.toMatch(/1,234|RD\$/);
    expect(rows[1].message).toBe("Stock bajo");
    const updated = await controller.state(
      exact.id,
      { status: "seen" },
      limited,
    );
    expect(updated.message).not.toMatch(/1,234|RD\$/);

    const privileged = actor(["alerts:write", "profit:read"]);
    expect((await controller.alerts(privileged, {}))[0].message).toBe(
      exact.message,
    );
  });
});

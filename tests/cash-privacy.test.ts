import { describe, expect, it } from "vitest";
import { AlertsController } from "../apps/api/src/alerts";
import { ReportsController, storeReport } from "../apps/api/src/reports";

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

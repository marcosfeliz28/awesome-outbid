import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../apps/api/src/common";
import { createAppModule } from "../apps/api/src/app";
import { DashboardLiquidityController } from "../apps/api/src/dashboard-liquidity";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { Prisma } = requireApi("@prisma/client");
const decimal = (value: string | number) => new Prisma.Decimal(value);

const actor = {
  id: "owner",
  branchId: "sucursal-a",
  permissions: ["*"],
  name: "Dueña",
  email: "owner@example.test",
  role: "admin",
};

describe("GET /api/dashboard/liquidity", () => {
  it("hace coincidir cada bolsillo con su fuente actual usando Decimal", async () => {
    const paymentAggregate = vi
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: decimal("70.50") } })
      .mockResolvedValueOnce({ _sum: { amount: decimal("30.00") } })
      .mockResolvedValueOnce({ _sum: { amount: decimal("25.00") } });
    const db = {
      cashSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "cash-1",
            openingAmount: decimal("100.00"),
            openedAt: new Date(),
            closedAt: null,
          },
          {
            id: "cash-2",
            openingAmount: decimal("20.00"),
            openedAt: new Date(),
            closedAt: null,
          },
        ]),
      },
      payment: {
        groupBy: vi.fn().mockResolvedValue([
          {
            cashSessionId: "cash-1",
            method: "cash",
            _sum: { amount: decimal("50.00") },
          },
        ]),
        aggregate: paymentAggregate,
      },
      cashMovement: {
        findMany: vi.fn().mockResolvedValue([
          { sessionId: "cash-1", type: "in", amount: decimal("10.00") },
          { sessionId: "cash-1", type: "out", amount: decimal("20.00") },
        ]),
      },
      saleReturn: {
        groupBy: vi.fn().mockResolvedValue([
          {
            cashSessionId: "cash-1",
            refundMethod: "cash",
            _sum: { refundAmount: decimal("5.00") },
          },
        ]),
      },
      auditLog: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { after: { lines: [{ paymentId: "owner-payment" }] } },
            { after: { lines: [{ paymentId: "owner-payment" }] } },
          ]),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { cod: decimal("80.00"), credit: decimal("90.00") },
        ]),
    };

    const result = await new DashboardLiquidityController(
      db as never,
    ).liquidity(actor);

    // Gavetas = (100 + 50 + 10 - 20 - 5) + 20.
    expect(result.pockets).toEqual({
      drawers: {
        amount: "155.00",
        openRegisters: 2,
        basis: "Efectivo esperado en cajas abiertas, al momento",
      },
      owner: {
        amount: "25.00",
        basis: "Efectivo recibido por la dueña registrado hoy",
      },
      banks: {
        verified: "70.50",
        pending: "30.00",
        verifiedBasis: "Transferencias verificadas hoy; no es saldo bancario",
        pendingBasis: "Transferencias por verificar pendientes actualmente",
      },
      street: {
        cod: "80.00",
        credit: "90.00",
        basis: "Cuentas por cobrar pendientes actualmente",
      },
    });
    expect(db.cashSession.findMany).toHaveBeenCalledWith({
      where: { branchId: "sucursal-a", closedAt: null },
      select: expect.any(Object),
    });
    expect(paymentAggregate.mock.calls[0][0].where).toMatchObject({
      method: "transfer",
      status: "ok",
      sale: { branchId: "sucursal-a", status: "completed" },
    });
    expect(paymentAggregate.mock.calls[1][0].where).toEqual({
      method: "transfer",
      status: "pending_verification",
      sale: { branchId: "sucursal-a", status: "completed" },
    });
    expect(paymentAggregate.mock.calls[2][0].where.id.in).toEqual([
      "owner-payment",
    ]);
  });

  it("registra la ruta con permiso * y Cache-Control privado", () => {
    const method = DashboardLiquidityController.prototype.liquidity;
    expect(Reflect.getMetadata("permission", method)).toBe("*");
    expect(Reflect.getMetadata("__headers__", method)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Cache-Control",
          value: "private, no-store",
        }),
      ]),
    );
    const controllers = Reflect.getMetadata(
      "controllers",
      createAppModule("qa-secret-long-enough-for-tests"),
    );
    expect(controllers).toContain(DashboardLiquidityController);
  });

  it("un usuario autenticado sin * recibe 403 antes de consultar el endpoint", async () => {
    const userId = "8f2b1c1e-5c1a-4a43-9d37-3a5b0c1d2e3f";
    const sessionId = "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c";
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: userId,
          active: true,
          mustChangePassword: false,
          authVersion: 1,
          branchId: "sucursal-a",
          name: "Cajera",
          email: "cashier@example.test",
          role: { name: "seller", permissions: ["sale:write"] },
        }),
      },
      settings: { findUnique: vi.fn().mockResolvedValue(null) },
      authSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: sessionId,
          userId,
          terminalId: null,
          lastActivityAt: new Date(),
        }),
        updateMany: vi.fn(),
      },
      terminal: { findUnique: vi.fn(), update: vi.fn() },
    };
    const request: any = { headers: { authorization: "Bearer token" } };
    const guard = new AuthGuard(
      db as never,
      {
        verify: () => ({
          sub: userId,
          sid: sessionId,
          version: 1,
          type: "access",
        }),
      } as never,
      {
        getAllAndOverride: (key: string) =>
          key === "permission" ? "*" : undefined,
      } as never,
    );
    const context = {
      getHandler: () => DashboardLiquidityController.prototype.liquidity,
      getClass: () => DashboardLiquidityController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
    });
  });
});

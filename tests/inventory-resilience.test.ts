import { describe, expect, it, vi } from "vitest";
import {
  isSerializationConflict,
  lotIdentity,
  normalizeLotNumber,
  reconcileLotExpiry,
  retrySerializable,
} from "../apps/api/src/inventory-resilience";
import { InventoryController } from "../apps/api/src/inventory";
import { AuthGuard } from "../apps/api/src/common";
import { Reflector } from "../apps/api/node_modules/@nestjs/core/index.js";

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Inventario QA",
  email: "inventario@example.invalid",
  role: "manager",
  permissions: ["inventory:write", "purchase:write", "sale:manage"],
  branchId: "main",
};

const expectConflict = async (operation: Promise<unknown>) => {
  const error = await operation.catch((caught) => caught);
  expect(error?.getStatus?.()).toBe(409);
  expect(error?.message).toMatch(/otra operación modificó el inventario/i);
};

describe("Menor-merma · cantidad de salida obligatoria", () => {
  function fixture() {
    const variantId = "20000000-0000-4000-8000-000000000001";
    const tx = {
      $queryRaw: vi.fn(async () => []),
      variant: {
        findFirstOrThrow: vi.fn(async () => ({
          id: variantId,
          stock: 10,
          costAvg: 1,
          lots: [],
          product: { name: "QA", category: { requiresLot: false } },
        })),
        update: vi.fn(async () => ({})),
      },
      settings: { findUnique: vi.fn(async () => null) },
      inventoryMovement: { create: vi.fn(async () => ({})) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const db = { $transaction: vi.fn(async (run: any) => run(tx)) };
    return {
      controller: new InventoryController(db as any),
      db,
      tx,
      variantId,
    };
  }
  it.each([1, 0.001])(
    "merma positiva %s responde400 antes de acceder a la base",
    async (qty) => {
      const { controller, db, variantId } = fixture();
      await expect(
        controller.adjustment(
          { variantId, qty, type: "waste", reason: "Merma QA" },
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("merma negativa resta stock y ajuste positivo sigue permitido", async () => {
    const { controller, tx, variantId } = fixture();
    await controller.adjustment(
      { variantId, qty: -2, type: "waste", reason: "Merma QA" },
      actor,
    );
    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: variantId },
      data: { stock: 8 },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "waste", qty: -2 }),
      }),
    );
    await controller.adjustment(
      { variantId, qty: 2, type: "adjustment", reason: "Ajuste QA" },
      actor,
    );
    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: variantId },
      data: { stock: 12 },
    });
  });
  it.each([true, false])(
    "la ruta exige inventory:write, permiso presente=%s",
    async (permitted) => {
      const user = {
        ...actor,
        active: true,
        mustChangePassword: false,
        authVersion: 1,
        role: { name: "qa", permissions: permitted ? ["inventory:write"] : [] },
      };
      const db = {
        user: { findUnique: async () => user },
        settings: { findUnique: async () => null },
        authSession: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({ terminalId: "qa-terminal" }),
        },
        terminal: {
          findUnique: async () => ({
            branchId: "main",
            approvedAt: new Date(),
            secretHash: "fixture",
          }),
          update: async () => ({}),
        },
      };
      const guard = new AuthGuard(
        db as any,
        {
          verify: () => ({
            sub: actor.id,
            type: "access",
            version: 1,
            sid: "qa-session",
          }),
        } as any,
        new Reflector(),
      );
      const request = { headers: { authorization: "Bearer local-fixture" } };
      const context = {
        getHandler: () => InventoryController.prototype.adjustment,
        getClass: () => InventoryController,
        switchToHttp: () => ({ getRequest: () => request }),
      };
      if (permitted) expect(await guard.canActivate(context as any)).toBe(true);
      else
        await expect(guard.canActivate(context as any)).rejects.toMatchObject({
          status: 403,
        });
    },
  );
});

describe("I1 · identidad canónica de lote", () => {
  it("unifica el código sin distinguir mayúsculas, espacios ni vencimiento", () => {
    expect(lotIdentity("  lote   abc  ", null)).toEqual(
      lotIdentity("LOTE ABC", undefined),
    );
    expect(lotIdentity(" lote abc ", null).lotNumberNormalized).toBe(
      "LOTE ABC",
    );
  });

  it("unifica Unicode canónico sin confundir identificadores compatibles distintos", () => {
    expect(normalizeLotNumber("café")).toBe(normalizeLotNumber("cafe\u0301"));
    expect(normalizeLotNumber("LOT-1")).not.toBe(
      normalizeLotNumber("ＬＯＴ－１"),
    );
  });

  it("completa un vencimiento nulo y rechaza otro día para el mismo código", () => {
    const received = new Date("2030-01-01T04:00:00.000Z");
    expect(reconcileLotExpiry(null, received)).toEqual({
      conflict: false,
      expiryDate: received,
    });
    expect(
      reconcileLotExpiry(received, "2030-01-01T12:00:00.000Z").conflict,
    ).toBe(false);
    expect(
      reconcileLotExpiry(received, "2030-01-02T04:00:00.000Z").conflict,
    ).toBe(true);
  });

  it("trata como el mismo vencimiento las horas distintas del mismo día dominicano", () => {
    expect(
      reconcileLotExpiry("2030-01-01T12:00:00.000Z", "2030-01-02T03:59:59.000Z")
        .conflict,
    ).toBe(false);
  });
});

describe("K1 · reintentos serializables acotados", () => {
  it("dos solicitudes recuperan un 40001/P2010 transitorio sin duplicar", async () => {
    let committed: { id: string } | undefined;
    let conflicts = 0;
    const request = async () =>
      retrySerializable(async () => {
        if (!committed) {
          if (!conflicts++) throw { code: "P2010", meta: { code: "40001" } };
          committed = { id: "recepcion-1" };
        }
        return committed;
      });
    const results = await Promise.all([request(), request()]);
    expect(results).toEqual([{ id: "recepcion-1" }, { id: "recepcion-1" }]);
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
  });

  it("se detiene al quinto conflicto y no reintenta errores de negocio", async () => {
    let attempts = 0;
    await expectConflict(
      retrySerializable(async () => {
        attempts++;
        throw { code: "P2010", meta: { message: "SQLSTATE 40001" } };
      }),
    );
    expect(attempts).toBe(5);
    expect(isSerializationConflict({ code: "P2034" })).toBe(true);

    attempts = 0;
    await expect(
      retrySerializable(async () => {
        attempts++;
        throw new Error("stock insuficiente");
      }),
    ).rejects.toThrow("stock insuficiente");
    expect(attempts).toBe(1);
  });

  it("adjustment, receive y applyCount agotan cinco reintentos y responden 409", async () => {
    const conflicts = [
      { code: "P2034" },
      { code: "P2010", meta: { code: "40001" } },
      { code: "40001" },
    ];
    let attempts = 0;
    const db = {
      $transaction: async () => {
        const error = conflicts[Math.floor(attempts / 5)];
        attempts++;
        throw error;
      },
      goodsReceipt: { findUnique: async () => null },
    };
    const controller = new InventoryController(db as any);
    const variantId = "20000000-0000-4000-8000-000000000001";
    const orderId = "30000000-0000-4000-8000-000000000001";
    const itemId = "40000000-0000-4000-8000-000000000001";
    const operationId = "50000000-0000-4000-8000-000000000001";
    const countId = "60000000-0000-4000-8000-000000000001";

    await expectConflict(
      controller.adjustment(
        { variantId, qty: 1, reason: "Regresión B6" },
        actor,
      ),
    );
    expect(attempts).toBe(5);

    await expectConflict(
      controller.receive(
        orderId,
        {
          operationId,
          freight: 0,
          otherCosts: 0,
          allocation: "value",
          items: [{ itemId, qty: 1, damagedQty: 0 }],
        },
        actor,
      ),
    );
    expect(attempts).toBe(10);

    await expectConflict(controller.applyCount(countId, actor));
    expect(attempts).toBe(15);
  });
});

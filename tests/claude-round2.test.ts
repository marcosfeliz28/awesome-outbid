import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ValidatedRateLimitStore } from "../apps/api/src/rate-limit";
import {
  CashController,
  canViewCashExpected,
  cashCloseRequiresNote,
} from "../apps/api/src/cash";
import { safe } from "../apps/api/src/common";
import { SalesController, saleHistoryDto } from "../apps/api/src/sales";
import { paymentReceiptLine } from "../packages/shared/src";

const source = (path: string) => readFileSync(path, "utf8");

describe("Auditoría Claude 2 · regresiones focales", () => {
  it("N1: separa el límite compartido del límite por cuenta e IP", () => {
    const main = source("apps/api/src/main.ts");
    const limiter = source("apps/api/src/rate-limit.ts");
    expect(main).not.toContain("createRequestRateLimiter");
    expect(limiter).not.toContain("auth-shared:");
    expect(limiter).not.toContain("sales-shared:");
    expect(limiter).toContain("actor?.sessionId");

    const store = new ValidatedRateLimitStore();
    for (let attempt = 0; attempt < 60; attempt++)
      expect(store.exceeds("auth-account", ["10.0.0.1", "cuenta-a"], 60)).toBe(
        false,
      );
    expect(store.exceeds("auth-account", ["10.0.0.1", "cuenta-a"], 60)).toBe(
      true,
    );
    expect(store.exceeds("auth-account", ["10.0.0.1", "cuenta-b"], 60)).toBe(
      false,
    );
  });

  it("A07: oculta esperado y diferencias, y exige confirmar el conteo ciego", () => {
    const cash = source("apps/api/src/cash.ts");
    const tienda = source("apps/web/src/Tienda.tsx");
    expect(cash).toContain('can(actor.permissions, "profit:read")');
    expect(cash).toMatch(/\.\.\.\(showExpected\s*\?/);
    expect(cash).toContain('startsWith("difference")');
    expect(tienda).toContain("confirmBlindClose");
    expect(tienda).toContain("countedCard: parse(form.countedCard)");
    const management = source("apps/web/src/Management.tsx");
    expect(management).not.toContain("s.expectedCash ?? s.expected.cash");
    expect(management).toContain("s.expected?.cash");
    expect(management).toMatch(/s\.differenceCash\s*==\s*null\s*\?\s*"—"/);
  });

  it("A08: las listas no llevan base64 y la evidencia se consume como blob", () => {
    const sales = source("apps/api/src/sales.ts");
    const tienda = source("apps/web/src/Tienda.tsx");
    expect(sales).toContain("res.type(match[1]).send(Buffer.from(match[2]");
    expect(sales).not.toContain("return { proofUrl: payment.proofUrl }");
    expect(tienda).toContain("apiBlob(");
    expect(tienda).toContain("URL.createObjectURL");
  });

  it("A06: operationId es obligatorio y la concurrencia tiene regresión", () => {
    const inventory = source("apps/api/src/inventory.ts");
    const apiTests = source("tests/api.test.ts");
    expect(inventory).toContain("operationId: uuid,");
    expect(inventory).not.toContain("operationId: uuid.optional()");
    expect(apiTests).toContain("misma recepción de una orden no la duplica");
    expect(apiTests).toContain("Promise.all");
  });

  it("A12: persiste discountApprovedBy y muestra el nombre del autorizador", () => {
    const schema = source("apps/api/prisma/schema.prisma");
    const sales = source("apps/api/src/sales.ts");
    const prints = source("apps/web/src/Prints.tsx");
    expect(schema).toContain("discountApprovedBy");
    expect(sales).toContain("Autorizó:");
    expect(prints).toContain("Autorizó:");
  });

  it("A11: PDF e historial muestran recibido, aplicado y cambio", () => {
    const sales = source("apps/api/src/sales.ts");
    const management = source("apps/web/src/Management.tsx");
    expect(sales).toContain("paymentReceiptLine(p)");
    expect(
      paymentReceiptLine({
        method: "Efectivo",
        tendered: 2000,
        amount: 1750,
        change: 250,
      }),
    ).toBe("Efectivo: Recibido RD$ 2000 · Aplicado RD$ 1750 · Cambio RD$ 250");
    expect(management).toContain("Recibido:");
    expect(management).toContain("Cambio:");
  });

  it("C2: la cajera no obtiene el arqueo abierto ni usa retiros o el umbral como oráculo", async () => {
    const seller = {
      role: "seller",
      permissions: ["cash:write"],
    } as any;
    const manager = {
      role: "manager",
      permissions: ["cash:write", "sale:manage"],
    } as any;
    expect(canViewCashExpected(seller)).toBe(false);
    expect(canViewCashExpected(manager)).toBe(true);
    expect(
      cashCloseRequiresNote(seller, { cash: 0.01, card: 0, transfer: 0 }, 100),
    ).toBe(true);
    expect(
      cashCloseRequiresNote(manager, { cash: 0.01, card: 0, transfer: 0 }, 100),
    ).toBe(false);

    const cash = source("apps/api/src/cash.ts");
    expect(cash).toContain("Cierra la caja para consultar el cuadre.");
    expect(cash).toContain("Cierra la caja para consultar sus reportes.");
    expect(cash).toContain('bad("No hay suficiente efectivo en caja.")');

    const controller = new CashController({
      cashSession: {
        findFirstOrThrow: async () => ({
          id: "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
          branchId: "main",
          userId: "seller-1",
          closedAt: null,
        }),
      },
    } as any);
    const actor = {
      id: "seller-1",
      branchId: "main",
      role: "seller",
      permissions: ["cash:write"],
    } as any;
    await expect(
      controller.cuadre("3e6b82b5-bb56-45ca-9f5a-d19f4955fc84", actor),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      controller.sessionReport(
        "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
        "venta-por-forma-pago",
        {},
        actor,
        {} as any,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("F1: POST y GET de evidencia comparten propietario de caja o sale:manage", async () => {
    const payment = {
      id: "b05b9bc2-7bd3-4c22-8c88-2e598bb42869",
      saleId: "2d57851f-646e-40de-a571-ab4576651c6f",
      cashSessionId: "owner-session",
      entryType: "installment",
      proofUrl: "data:image/png;base64,iVBORw0KGgo=",
    };
    const db = {
      payment: { findFirstOrThrow: async () => payment },
      cashSession: {
        findFirst: async ({ where }: any) =>
          where.userId === "owner" ? { id: payment.cashSessionId } : null,
      },
    };
    const controller = new SalesController(db as any);
    const authorize = (actor: any) =>
      (controller as any).proofPayment(actor, payment.id);
    await expect(
      authorize({
        id: "owner",
        branchId: "main",
        permissions: ["sale:write"],
      }),
    ).resolves.toBe(payment);
    await expect(
      authorize({
        id: "manager",
        branchId: "main",
        permissions: ["sale:manage"],
      }),
    ).resolves.toBe(payment);
    await expect(
      authorize({
        id: "other",
        branchId: "main",
        permissions: ["sale:write"],
      }),
    ).rejects.toMatchObject({ status: 403 });
    const response = {
      setHeader: () => undefined,
      type: () => response,
      send: (bytes: Buffer) => bytes,
    } as any;
    for (const identity of [
      { id: "owner", permissions: [] },
      { id: "manager", permissions: ["sale:manage"] },
    ]) {
      await expect(
        controller.getPaymentProof(
          payment.id,
          { ...identity, branchId: "main" } as any,
          response,
        ),
      ).resolves.toEqual(Buffer.from("iVBORw0KGgo=", "base64"));
    }
    await expect(
      controller.getPaymentProof(
        payment.id,
        { id: "other", permissions: [], branchId: "main" } as any,
        response,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      Reflect.getMetadata("permission", SalesController.prototype.paymentProof),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        "permission",
        SalesController.prototype.getPaymentProof,
      ),
    ).toBe("authenticated");
  });

  it("F2: el historial usa lista blanca y no entrega costos de merma a la cajera", () => {
    const sale = {
      id: "sale-1",
      number: "N-1",
      status: "completed",
      total: 100,
      costTotal: 40,
      requestHash: "no-debe-salir",
      items: [
        {
          id: "item-1",
          variantId: "variant-1",
          qty: 1,
          returnedQty: 1,
          unitPrice: 100,
          unitCost: 40,
          discount: 0,
          tax: 0,
          lineTotal: 100,
          stockAllocations: [{ cost: 40 }],
          variant: {
            id: "variant-1",
            productId: "product-1",
            sku: "SKU-1",
            attributes: {},
            costAvg: 40,
            product: { id: "product-1", name: "Producto", secret: "x" },
          },
        },
      ],
      payments: [
        {
          id: "payment-1",
          method: "cash",
          amount: 100,
          tendered: 100,
          change: 0,
          entryType: "sale",
          status: "ok",
          feeAmount: 9,
          proofUrl: null,
        },
      ],
      returns: [
        {
          id: "return-1",
          number: "NC-1",
          reason: "Dañado",
          total: 100,
          taxTotal: 0,
          costTotal: 0,
          wasteQty: 1,
          wasteCostTotal: 40,
          refundAmount: 100,
          refundMethod: "cash",
          items: [{ wasteCost: 40 }],
        },
      ],
    };
    const seller = saleHistoryDto(sale, {
      role: "seller",
      permissions: ["sale:write"],
    } as any) as any;
    expect(seller.number).toBe("N-1");
    expect(seller.items[0].variant.product.name).toBe("Producto");
    expect(seller).not.toHaveProperty("requestHash");
    expect(seller).not.toHaveProperty("costTotal");
    expect(seller.items[0]).not.toHaveProperty("unitCost");
    expect(seller.items[0]).not.toHaveProperty("stockAllocations");
    expect(seller.items[0].variant).not.toHaveProperty("costAvg");
    expect(seller.payments[0]).not.toHaveProperty("feeAmount");
    expect(seller.returns[0]).not.toHaveProperty("costTotal");
    expect(seller.returns[0]).not.toHaveProperty("wasteCostTotal");
    expect(seller.returns[0]).not.toHaveProperty("items");

    const manager = saleHistoryDto(sale, {
      role: "manager",
      permissions: ["profit:read"],
    } as any) as any;
    expect(manager.costTotal).toBe(40);
    expect(manager.returns[0].wasteCostTotal).toBe(40);
  });

  it("F2: safe usa lista blanca y no publica campos nuevos por omisión", () => {
    const payload = {
      id: "variant-1",
      sku: "SKU-1",
      price: 100,
      stock: 2,
      product: {
        id: "product-1",
        name: "Producto",
        attributes: { Color: "Rojo", capital: 200 },
      },
      costAvg: 40,
      wasteCostTotal: 15,
      futureInternalCostProjection: 999,
    };
    const seller = safe(payload, {
      role: "seller",
      permissions: ["catalog:read"],
    } as any) as any;
    expect(seller).toEqual({
      id: "variant-1",
      sku: "SKU-1",
      price: 100,
      stock: 2,
      product: {
        id: "product-1",
        name: "Producto",
        attributes: { Color: "Rojo" },
      },
    });

    expect(
      safe(
        {
          id: "receipt-1",
          supplierId: "supplier-1",
          orderId: "order-1",
          total: 500,
          freight: 20,
          otherCosts: 5,
          invoiceTotal: 525,
          items: [{ itemId: "item-1", qty: 2, landedCost: 250 }],
          lines: [
            {
              variantId: "variant-1",
              name: "Producto",
              qty: 2,
              damagedQty: 1,
              unitCost: 250,
            },
          ],
        },
        { role: "warehouse", permissions: ["catalog:read"] } as any,
      ),
    ).toEqual({
      id: "receipt-1",
      supplierId: "supplier-1",
      orderId: "order-1",
      items: [{ itemId: "item-1", qty: 2 }],
      lines: [
        { variantId: "variant-1", name: "Producto", qty: 2, damagedQty: 1 },
      ],
    });

    expect(
      safe(
        {
          from: "2026-10-09T00:00:00.000Z",
          to: "2026-10-09T23:59:59.999Z",
          sellers: [{ name: "Caja uno", total: 300, margin: 70 }],
          alerts: [{ id: "alert-1", message: "Revisar stock", capital: 80 }],
          movements: [
            {
              id: "movement-1",
              type: "sale",
              qty: -1,
              unitCost: 40,
              variant: {
                id: "variant-1",
                sku: "SKU-1",
                product: { id: "product-1", name: "Producto" },
              },
            },
          ],
        },
        { role: "seller", permissions: ["reports:read"] } as any,
      ),
    ).toEqual({
      from: "2026-10-09T00:00:00.000Z",
      to: "2026-10-09T23:59:59.999Z",
      sellers: [{ name: "Caja uno", total: 300 }],
      alerts: [{ id: "alert-1", message: "Revisar stock" }],
      movements: [
        {
          id: "movement-1",
          type: "sale",
          qty: -1,
          variant: {
            id: "variant-1",
            sku: "SKU-1",
            product: { id: "product-1", name: "Producto" },
          },
        },
      ],
    });

    const finance = safe(payload, {
      role: "manager",
      permissions: ["profit:read"],
    } as any);
    expect(finance).toEqual(payload);
  });

  it("Rev F2: vendedora con profit:read sin costos; dañados y arqueo autorizado visibles", () => {
    expect(
      safe({ id: "v", price: 100, costAvg: 40 }, {
        role: "seller",
        permissions: ["catalog:read", "profit:read"],
      } as any),
    ).toEqual({ id: "v", price: 100 });
    expect(
      safe(
        {
          id: "receipt-1",
          supplierId: "supplier-1",
          orderId: null,
          units: 2,
          damagedUnits: 1,
          itbis: 54,
          total: 200,
        },
        { role: "warehouse", permissions: ["purchase:write"] } as any,
      ),
    ).toEqual({
      id: "receipt-1",
      supplierId: "supplier-1",
      orderId: null,
      units: 2,
      damagedUnits: 1,
    });
    const cash = {
      Fecha: "hoy",
      Usuario: "u",
      Estado: "Cerrada",
      Esperado: 100,
      Contado: 90,
      Diferencia_efectivo: -10,
      Diferencia_tarjeta: 0,
      Diferencia_transferencia: 0,
    };
    expect(
      safe([cash], {
        role: "supervisor",
        permissions: ["reports:read", "sale:manage"],
      } as any),
    ).toEqual([cash]);
  });
});

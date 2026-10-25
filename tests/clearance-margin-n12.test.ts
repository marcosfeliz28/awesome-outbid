import { describe, expect, it, vi } from "vitest";
import { clearanceDiscountLimit, lineTotals } from "../packages/shared/src/index";
import { cappedPromotionDiscount } from "../apps/api/src/sales";
import { promotionCostFloor } from "../apps/api/src/inventory";
import { AdminController } from "../apps/api/src/admin";

// Regla de la dueña (CLAUDE.md 3): margen sobre lo cobrado, sin restar ITBIS.
const marginOf = (total: number, cost: number) => (total - cost) / total;

describe("N-12 · oferta con margen mínimo de 15 % sin restar ITBIS", () => {
  it("limita el descuento sobre el precio cobrado (ITBIS incluido) y costo por unidad", () => {
    const limit = clearanceDiscountLimit(200, 100, 18, true);
    expect(limit).toBeCloseTo(41.17, 2);
    expect(marginOf(lineTotals(1, 200, limit, 18, true).total, 100)).toBeGreaterThanOrEqual(0.15);
    expect(marginOf(lineTotals(1, 200, limit + 0.01, 18, true).total, 100)).toBeLessThan(0.15);
    // Antes (restando ITBIS) 236/100 sólo admitía 41.17 %; ahora el tope es 50 %.
    expect(clearanceDiscountLimit(236, 100, 18, true)).toBe(50);
  });

  it("no sugiere rebaja cuando el precio base ya incumple el margen", () => {
    expect(clearanceDiscountLimit(117, 100, 18, true)).toBe(0);
  });

  it("con precio sin ITBIS, el margen se mide sobre el total cobrado", () => {
    const limit = clearanceDiscountLimit(100, 80, 18, false);
    expect(marginOf(lineTotals(1, 100, limit, 18, false).total, 80)).toBeGreaterThanOrEqual(0.15);
    expect(marginOf(lineTotals(1, 100, limit + 0.1, 18, false).total, 80)).toBeLessThan(0.15);
  });

  it("respeta el piso con varias unidades y redondeo al centavo", () => {
    const limit = clearanceDiscountLimit(1.52, 1.07, 18, true, 7);
    expect(marginOf(lineTotals(7, 1.52, limit, 18, true).total, 7 * 1.07)).toBeGreaterThanOrEqual(0.15);
  });

  it("la caja limita también una promoción sin isClearance y usa el lote FEFO más caro", () => {
    const variant = {
      id: "variant", productId: "product", price: 236, costAvg: 100,
      product: { taxRate: 18, categoryId: "category", brand: "X", category: { requiresExpiry: false } },
      lots: [{ qty: 1, cost: 140, expiryDate: new Date("2030-01-01") }],
    };
    const promo = { type: "percent", value: 60, isClearance: false, scope: { variantId: "variant" } };
    expect(promotionCostFloor(variant)).toBe(140);
    const applied = cappedPromotionDiscount(promo, variant, 1, true);
    expect(applied).toBeLessThan(60);
    expect(marginOf(lineTotals(1, 236, applied, 18, true).total, 140)).toBeGreaterThanOrEqual(0.15);
  });

  it("POST promotions real rechaza el 60% sin marcador antes de crear la promoción", async () => {
    const create = vi.fn();
    const db = {
      variant: { findFirst: vi.fn().mockResolvedValue({
        price: 236, costAvg: 100,
        product: { taxRate: 18, category: { requiresExpiry: false } },
        lots: [{ qty: 1, cost: 140, expiryDate: new Date("2030-01-01") }],
      }) },
      settings: { findUnique: vi.fn().mockResolvedValue({ data: { taxIncluded: true } }) },
      promotion: { create },
    };
    const controller = new AdminController(db as any);
    const input = {
      name: "Descuento peligroso", type: "percent", value: 60,
      startsAt: "2026-10-24T00:00:00.000Z", endsAt: "2026-12-24T00:00:00.000Z",
      scope: { variantId: "60000000-0000-4000-8000-000000000001" }, isClearance: false,
    };
    await expect(controller.promotion(input, { id: "actor", branchId: "main" } as any))
      .rejects.toThrow(/supera el descuento máximo/);
    expect(create).not.toHaveBeenCalled();
  });
});

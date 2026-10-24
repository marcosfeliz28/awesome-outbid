import { describe, expect, it } from "vitest";
import { clearanceDiscountLimit, lineTotals } from "../packages/shared/src/index";

describe("N-12 · oferta con margen neto mínimo de 15 %", () => {
  it("limita el descuento con ITBIS incluido y costo por unidad", () => {
    const limit = clearanceDiscountLimit(236, 100, 18, true);
    expect(limit).toBeCloseTo(41.17, 2);
    const net = lineTotals(1, 236, limit, 18, true).net;
    expect((net - 100) / net).toBeGreaterThanOrEqual(0.15);
    expect((lineTotals(1, 236, limit + 0.01, 18, true).net - 100) /
      lineTotals(1, 236, limit + 0.01, 18, true).net).toBeLessThan(0.15);
  });

  it("no sugiere rebaja cuando el precio base ya incumple el margen", () => {
    expect(clearanceDiscountLimit(118, 100, 18, true)).toBe(0);
  });

  it("respeta el piso con varias unidades y redondeo al centavo", () => {
    const limit = clearanceDiscountLimit(1.52, 1.07, 18, true, 7);
    const net = lineTotals(7, 1.52, limit, 18, true).net;
    expect((net - 7 * 1.07) / net).toBeGreaterThanOrEqual(0.15);
  });
});

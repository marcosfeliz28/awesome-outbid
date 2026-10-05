import { describe, expect, it } from "vitest";
import {
  businessDate,
  expired,
  expiryDays,
  weekStart,
  weightedCost,
  landedCosts,
  lineTotals,
  paymentTotals,
  grossProfit,
  netProfit,
  margin,
  markup,
  breakEven,
  turnover,
  inventoryDays,
  reorderPoint,
  averageTicket,
  abc,
  clearanceScore,
  safeDiscount,
  saleSchema,
  money,
} from "./index";
describe("Fórmulas financieras", () => {
  it("costo promedio ponderado", () => {
    expect(weightedCost(10, 100, 5, 160)).toBe(120);
    expect(weightedCost(0, 0, 5, 160)).toBe(160);
    expect(weightedCost(0, 0, 0, 0)).toBe(0);
  });
  it("flete por valor y unidades", () => {
    expect(
      landedCosts(
        [
          { qty: 10, cost: 100 },
          { qty: 5, cost: 200 },
        ],
        300,
      ),
    ).toEqual([115, 230]);
    expect(
      landedCosts(
        [
          { qty: 10, cost: 100 },
          { qty: 5, cost: 200 },
        ],
        300,
        "units",
      ),
    ).toEqual([120, 220]);
  });
  it("ITBIS incluido y adicional después del descuento", () => {
    expect(lineTotals(2, 118, 10, 18, true)).toEqual({
      subtotal: 236,
      discount: 23.6,
      tax: 32.4,
      net: 180,
      total: 212.4,
    });
    expect(lineTotals(2, 100, 10, 18, false)).toEqual({
      subtotal: 200,
      discount: 20,
      tax: 32.4,
      net: 180,
      total: 212.4,
    });
  });
  it("redondeo contable", () => {
    expect(money("1.005")).toBe(1.01);
    expect(lineTotals(3, 0.1, 0, 18).total).toBe(0.3);
  });
  it("cambio sólo con efectivo", () => {
    expect(
      paymentTotals(354, [
        { method: "cash", amount: 250 },
        { method: "card", amount: 150 },
      ]),
    ).toEqual({ paid: 400, pending: 0, change: 46 });
    expect(() => paymentTotals(100, [{ method: "card", amount: 110 }])).toThrow(
      "no pueden generar cambio",
    );
    expect(paymentTotals(100, [{ method: "cash", amount: 50 }]).pending).toBe(
      50,
    );
  });
  it("ganancias, margen y markup", () => {
    expect(grossProfit(200, 100)).toBe(100);
    expect(netProfit(1000, 400, 200, 25)).toBe(375);
    expect(margin(200, 100)).toBe(50);
    expect(markup(200, 100)).toBe(100);
    expect(margin(0, 100)).toBe(0);
  });
  it("equilibrio, rotación, días y reorden", () => {
    expect(breakEven(10000, 25)).toBe(40000);
    expect(breakEven(10000, 0)).toBeNull();
    expect(turnover(2000, 500)).toBe(4);
    expect(inventoryDays(60, 2)).toBe(30);
    expect(inventoryDays(60, 0)).toBeNull();
    expect(reorderPoint(2.5, 7, 5)).toBe(22.5);
    expect(averageTicket(1500, 3)).toBe(500);
    expect(averageTicket(0, 0)).toBe(0);
  });
  it("ABC y liquidación", () => {
    expect(
      abc([{ revenue: 80 }, { revenue: 15 }, { revenue: 5 }]).map(
        (i) => i.class,
      ),
    ).toEqual(["A", "B", "C"]);
    expect(clearanceScore(60, 15, 20, 500)).toBeGreaterThan(
      clearanceScore(60, 90, 20, 500),
    );
    expect(safeDiscount(118, 100, 18)).toBe(0);
    expect(safeDiscount(236, 100, 18)).toBe(50);
  });
  it("contrato de venta rechaza UUID y carrito inválidos", () => {
    expect(
      saleSchema.safeParse({ offlineUuid: "invalido", items: [] }).success,
    ).toBe(false);
  });
});

describe("Fechas dominicanas y descuentos por monto", () => {
  it("mantiene el día anterior en las primeras horas UTC", () => {
    expect(businessDate("2026-09-01T02:00:00Z")).toBe("2026-08-31");
    expect(weekStart(new Date("2026-09-01T02:00:00Z"))).toBe("2026-08-31");
    expect(weekStart(new Date("2026-08-31T02:00:00Z"))).toBe("2026-08-24");
  });
  it("vencimiento sigue vigente durante todo su día local", () => {
    expect(
      expired("2026-09-01T04:00:00Z", new Date("2026-09-02T03:59:59Z")),
    ).toBe(false);
    expect(
      expired("2026-09-01T04:00:00Z", new Date("2026-09-02T04:00:00Z")),
    ).toBe(true);
    expect(
      expiryDays("2026-09-01T04:00:00Z", new Date("2026-09-01T12:00:00Z")),
    ).toBe(0);
  });
  it("monto y porcentaje son alternativas y recalculan ITBIS", () => {
    expect(lineTotals(1, 118, 0, 18, true, 18)).toEqual({
      subtotal: 118,
      discount: 18,
      tax: 15.25,
      net: 84.75,
      total: 100,
    });
    expect(lineTotals(1, 118, 10, 18, true, 18).total).toBe(100);
    expect(() => lineTotals(1, 118, 0, 18, true, 119)).toThrow();
  });
});

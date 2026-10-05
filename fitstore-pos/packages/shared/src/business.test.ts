import { describe, expect, it } from "vitest";
import {
  businessDate,
  expired,
  expiryDays,
  weekStart,
  weightedCost,
  derivedStockQty,
  returnShares,
  allocationCost,
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

// Auditoría R6 (ChatGPT) · R6-01: consumos derivados de combos.
describe("derivedStockQty · consumos exactos", () => {
  it("acepta productos representables y rechaza los que se redondearían", () => {
    expect(derivedStockQty(0.4, 1)).toBe(0.4);
    expect(derivedStockQty(0.4, 3)).toBe(1.2);
    expect(derivedStockQty(0.123, 2)).toBe(0.246);
    // 0.4 × 0.001 = 0.0004: antes se guardaba como 0.
    expect(derivedStockQty(0.4, 0.001)).toBeNull();
    // Mayor que cero pero con más de tres decimales.
    expect(derivedStockQty(0.123, 1.5)).toBeNull();
    expect(derivedStockQty(0, 5)).toBeNull();
  });
});
describe("returnShares · devoluciones exactas por lote y componente", () => {
  const sum = (parts: { qty: number }[]) =>
    parts.reduce((s, p) => s + Math.round(p.qty * 1000), 0) / 1000;
  it("tres devoluciones de un combo repartido en dos lotes suman lo tomado de cada lote", () => {
    // 3 combos × 0.4 = 1.2 tomados de dos lotes: 0.7 + 0.5.
    const allocations = [
      { variantId: "comp", lotId: "A", qty: 0.7 },
      { variantId: "comp", lotId: "B", qty: 0.5 },
    ];
    const perLot: Record<string, number> = { A: 0, B: 0 };
    for (let returned = 0; returned < 3; returned++) {
      const parts = returnShares(allocations, 3, returned, 1);
      expect(sum(parts)).toBe(0.4);
      for (const p of parts)
        perLot[p.allocation.lotId] =
          Math.round((perLot[p.allocation.lotId] + p.qty) * 1000) / 1000;
    }
    expect(perLot).toEqual({ A: 0.7, B: 0.5 });
  });
  it("línea simple: devuelve exactamente la cantidad pedida", () => {
    const parts = returnShares([{ variantId: "v", qty: 3 }], 3, 0, 1);
    expect(parts.map((p) => p.qty)).toEqual([1]);
    expect(returnShares([{ variantId: "v", qty: 3 }], 3, 1, 2)[0].qty).toBe(2);
  });
  it("varios componentes: cada uno recibe su proporción exacta", () => {
    const parts = returnShares(
      [
        { variantId: "shaker", qty: 2 },
        { variantId: "whey", qty: 0.8 },
      ],
      2,
      0,
      1,
    );
    expect(
      Object.fromEntries(parts.map((p) => [p.allocation.variantId, p.qty])),
    ).toEqual({ shaker: 1, whey: 0.4 });
  });
  it("una asignación de 0 (ventas antiguas) no devuelve nada", () => {
    expect(returnShares([{ variantId: "v", qty: 0 }], 0.001, 0, 0.001)).toEqual(
      [],
    );
  });
});
describe("allocationCost · costo de una línea vendida", () => {
  it("combo de la ronda 7: valor exacto de las asignaciones", () => {
    expect(
      allocationCost({
        qty: 10,
        unitCost: 5.01,
        variantId: "combo",
        stockAllocations: [
          { variantId: "comp", qty: 5, unitCost: 10.01, exact: true },
        ],
      }).toNumber(),
    ).toBe(50.05);
  });
  it("combo antiguo (cantidades redondeadas): el costo registrado", () => {
    // 0.5 combo × 0.333 → asignación redondeada 0.167; registró 666.
    expect(
      allocationCost({
        qty: 0.5,
        unitCost: 1332,
        variantId: "combo",
        stockAllocations: [{ variantId: "comp", qty: 0.167, unitCost: 4000 }],
      }).toNumber(),
    ).toBe(666);
  });
  it("producto simple por lotes: cantidad × costo", () => {
    expect(
      allocationCost({
        qty: 0.5,
        unitCost: 10.01,
        variantId: "v",
        stockAllocations: [{ variantId: "v", qty: 0.5, unitCost: 10.01 }],
      }).toNumber(),
    ).toBe(5.005);
  });
});

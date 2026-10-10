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
  d,
  moneyAmount,
  bookedLineCosts,
  replayReturns,
  CASH_DENOMINATIONS,
  countDenominations,
  cashDifference,
  deliveredSplit,
  cashCloseSchema,
  PAYMENT_GROUPS,
  isImageDataUrl,
  receivableNeedsApproval,
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
  it("combo antiguo vendido entero: sus asignaciones eran exactas", () => {
    // 1000 combos × 0.001 a 4.00: se registró 4.00; unitCost redondeado 0.00.
    expect(
      allocationCost({
        qty: 1000,
        unitCost: 0,
        variantId: "combo",
        stockAllocations: [{ variantId: "comp", qty: 1, unitCost: 4 }],
      }).toNumber(),
    ).toBe(4);
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

// Revisión R9 · área dinero.
describe("R9-dinero-11 · el resumen de cada línea cuadra", () => {
  it("subtotal − descuento = total (ITBIS incluido) o = neto (ITBIS adicional)", () => {
    for (const [qty, price, discount] of [
      [3, 33.35, 10],
      [1, 1001, 12.5],
      [7, 0.15, 33.3],
    ]) {
      const included = lineTotals(qty, price, discount, 18, true);
      expect(money(d(included.subtotal).minus(included.discount))).toBe(
        included.total,
      );
      expect(money(d(included.net).plus(included.tax))).toBe(included.total);
      const added = lineTotals(qty, price, discount, 18, false);
      expect(money(d(added.subtotal).minus(added.discount))).toBe(added.net);
      expect(money(d(added.net).plus(added.tax))).toBe(added.total);
    }
    // 3 × 33.35 con 10 %: 100.05 − 10.00 = 90.05 (antes 10.01 de descuento).
    expect(lineTotals(3, 33.35, 10)).toMatchObject({
      subtotal: 100.05,
      discount: 10,
      total: 90.05,
      tax: 13.74,
    });
  });
});

describe("R9-dinero-5 · importes con 2 decimales", () => {
  it("rechaza fracciones de centavo y tolera el ruido de coma flotante", () => {
    expect(moneyAmount().safeParse(1.005).success).toBe(false);
    expect(moneyAmount().safeParse(1.01).success).toBe(true);
    expect(moneyAmount().safeParse(0.1 + 0.2).success).toBe(true);
    expect(moneyAmount().safeParse(0).success).toBe(false);
    expect(moneyAmount(100, true).safeParse(0).success).toBe(true);
    const sale = (payment: number, discountAmount?: number) =>
      saleSchema.safeParse({
        offlineUuid: "11111111-1111-4111-8111-111111111111",
        cashSessionId: "11111111-1111-4111-8111-111111111111",
        items: [
          {
            variantId: "11111111-1111-4111-8111-111111111111",
            qty: 1,
            discountAmount,
          },
        ],
        payments: [{ method: "cash", amount: payment }],
      }).success;
    expect(sale(100)).toBe(true);
    expect(sale(100.005)).toBe(false);
    // El descuento por monto sólo se vuelve porcentaje y la línea se cobra
    // redondeada: rechazarlo dejaba en conflicto la venta sin conexión que la
    // caja ya entregó (R9-dinero-5-pos).
    expect(sale(100, 0.005)).toBe(true);
    expect(sale(100, -1)).toBe(false);
  });
  it("R9-dinero-5-pos: la caja no agrega un pago con fracción de centavo", () => {
    expect(() =>
      paymentTotals(100, [{ method: "cash", amount: 1.005 }]),
    ).toThrow(/2 decimales/);
    expect(
      paymentTotals(0.3, [{ method: "cash", amount: 0.1 + 0.2 }]).pending,
    ).toBe(0);
  });
});

describe("R9-dinero-1/6/7 · costo contabilizado de ventas y devoluciones", () => {
  const combo = (id: string, qty: number, cost: number, exact = true) => ({
    id,
    qty,
    unitCost: money(cost),
    variantId: "kit-" + id,
    stockAllocations: [
      { variantId: "comp", qty: qty / 2, unitCost: cost * 2, exact },
    ],
  });
  it("una venta antigua reparte Sale.costTotal entre sus líneas", () => {
    const sale = {
      costTotal: 3.33,
      items: [combo("a", 1, 1.665), combo("b", 1, 1.665)],
    };
    const booked = bookedLineCosts(sale);
    expect([...booked.values()].map((v) => v.toNumber())).toEqual([1.67, 1.66]);
    // Una venta nueva conserva el costo redondeado de cada línea.
    expect(
      [...bookedLineCosts({ ...sale, costTotal: 3.34 }).values()].map((v) =>
        v.toNumber(),
      ),
    ).toEqual([1.67, 1.67]);
  });
  it("reconstruye por línea la devolución de la ronda 7", () => {
    const line = (id: string, cost: number) => ({
      id,
      qty: 1,
      unitCost: cost,
      variantId: "v" + id,
      stockAllocations: [{ variantId: "v" + id, qty: 1, unitCost: cost }],
    });
    const sale = {
      costTotal: 1.67,
      items: [line("a", 0.49), line("b", 0.59), line("c", 0.59)],
    };
    const { parts, lines } = replayReturns(sale, [
      {
        id: "r1",
        costTotal: 0.02,
        items: ["a", "b", "c"].map((saleItemId) => ({
          saleItemId,
          qty: 0.01,
          restock: true,
        })),
      },
    ]);
    expect([0, 1, 2].map((n) => parts.get("r1#" + n)!.cost.toNumber())).toEqual(
      [0, 0.01, 0.01],
    );
    expect(lines.get("a")!.returned.toNumber()).toBe(0.01);
  });
  it("concilia con costTotal la devolución de las rondas 3 a 6", () => {
    const sale = { costTotal: 16.65, items: [combo("k", 10, 1.665, false)] };
    const { parts, lines } = replayReturns(sale, [
      {
        id: "r1",
        costTotal: 8.35,
        items: [{ saleItemId: "k", qty: 5, restock: true }],
      },
    ]);
    expect(parts.get("r1#0")!.cost.toNumber()).toBe(8.35);
    expect(lines.get("k")).toMatchObject({
      returned: d(5),
      restocked: d(8.35),
      waste: d(0),
    });
  });
});

describe("Tienda · cuadre de caja y contraentrega", () => {
  it("denominaciones de RD$ en el orden del impreso y subtotal exacto", () => {
    expect(CASH_DENOMINATIONS).toEqual([
      1, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000,
    ]);
    const counted = countDenominations({
      "2000": 4,
      "1000": 1,
      "25": 3,
      "1": 2,
    });
    expect(counted.total).toBe(9077);
    expect(counted.lines).toHaveLength(11);
    expect(counted.lines.find((l) => l.value === 25)).toEqual({
      value: 25,
      qty: 3,
      total: 75,
    });
    expect(countDenominations().total).toBe(0);
  });
  it("12-Diferencias = (2-Efectivo + 5-Vale) − 10-Total venta efectivo − 18-Fondo, al centavo", () => {
    expect(
      cashDifference({
        counted: 2175,
        vouchers: 149.75,
        cashSales: 1830,
        opening: 500,
      }),
    ).toBe(-5.25);
    expect(
      cashDifference({
        counted: 0.3,
        vouchers: 0,
        cashSales: 0.1,
        opening: 0.2,
      }),
    ).toBe(0);
  });
  it("entregado + dejado = efectivo contado; lo entregado no supera lo contado", () => {
    expect(deliveredSplit(9825, 9000)).toEqual({ delivered: 9000, left: 825 });
    expect(deliveredSplit(100.5, 100.25)).toEqual({
      delivered: 100.25,
      left: 0.25,
    });
    expect(deliveredSplit(500, undefined)).toEqual({
      delivered: null,
      left: null,
    });
    expect(() => deliveredSplit(500, 500.01)).toThrow(/entregado/i);
  });
  it("cierre ciego: exige declarar tarjeta y transferencia además del efectivo", () => {
    expect(
      cashCloseSchema.parse({
        countedCash: 100,
        countedCard: 0,
        countedTransfer: 0,
      }),
    ).toMatchObject({
      countedCash: 100,
      countedCard: 0,
      countedTransfer: 0,
      vouchers: 0,
      countedUsd: 0,
      countedEur: 0,
    });
    expect(
      cashCloseSchema.parse({
        denominations: { "100": 2 },
        countedCard: 0,
        countedTransfer: 0,
        delivered: 150,
      }),
    ).toMatchObject({ denominations: { "100": 2 }, delivered: 150 });
    expect(() => cashCloseSchema.parse({})).toThrow();
    // Denominación inexistente, cantidad fraccionaria o vale con fracción de centavo.
    expect(() =>
      cashCloseSchema.parse({
        denominations: { "3": 1 },
        countedCard: 0,
        countedTransfer: 0,
      }),
    ).toThrow();
    expect(() =>
      cashCloseSchema.parse({
        denominations: { "100": 1.5 },
        countedCard: 0,
        countedTransfer: 0,
      }),
    ).toThrow();
    expect(() =>
      cashCloseSchema.parse({
        countedCash: 10,
        countedCard: 0,
        countedTransfer: 0,
        vouchers: 0.001,
      }),
    ).toThrow();
  });
  it("contraentrega: forma de pago propia, combinable y sin cambio", () => {
    const sale = {
      offlineUuid: "2f1c8f8e-8d4f-4b8e-9d47-6a1c3f9b1a11",
      cashSessionId: "2f1c8f8e-8d4f-4b8e-9d47-6a1c3f9b1a12",
      items: [{ variantId: "2f1c8f8e-8d4f-4b8e-9d47-6a1c3f9b1a13", qty: 1 }],
      payments: [
        { method: "transfer", amount: 180, bank: "BHD", reference: "1" },
        { method: "cod", amount: 1000 },
      ],
    };
    expect(saleSchema.parse(sale).payments[1].method).toBe("cod");
    expect(
      paymentTotals(1180, [
        { method: "transfer", amount: 180 },
        { method: "cod", amount: 1000 },
      ]),
    ).toEqual({ paid: 1180, pending: 0, change: 0 });
    expect(() =>
      paymentTotals(1000, [{ method: "cod", amount: 1200 }]),
    ).toThrow(/cambio/);
  });
  it("formas de pago del reporte en el orden de la tienda", () => {
    expect(PAYMENT_GROUPS.slice(0, 5)).toEqual([
      { method: "cash", label: "EFECTIVO" },
      { method: "transfer", label: "CHEQUES/TRANSFERENCIA" },
      { method: "receivable", label: "CRÉDITO / CONTRAENTREGA" },
      { method: "card", label: "TARJETA CRÉDITO/DÉBITO" },
      { method: "credit_note", label: "NOTA DE CRÉDITO" },
    ]);
  });
  it("logo: sólo imágenes como data URL y de hasta 200 KB", () => {
    const png =
      "data:image/png;base64," + Buffer.alloc(1000).toString("base64");
    expect(isImageDataUrl(png)).toBe(true);
    expect(
      isImageDataUrl(
        "data:image/png;base64," + Buffer.alloc(201 * 1024).toString("base64"),
      ),
    ).toBe(false);
    expect(isImageDataUrl("data:text/html;base64,PHA+")).toBe(false);
    expect(isImageDataUrl("data:image/png;base64,***")).toBe(false);
    expect(isImageDataUrl("https://example.com/logo.png")).toBe(false);
  });
});

describe("D-01 · la contraentrega pasa por la aprobación del crédito", () => {
  const on = { allowCreditSales: true, creditApprovalThreshold: 1000 };
  const cod = (amount: number) => [{ method: "cod", amount }];
  const credit = (amount: number) => [{ method: "credit", amount }];
  it("la cajera necesita PIN sobre el umbral; en el umbral o por debajo, no", () => {
    expect(receivableNeedsApproval(cod(12000), on, false)).toBe(true);
    expect(receivableNeedsApproval(cod(1000.01), on, false)).toBe(true);
    expect(receivableNeedsApproval(cod(1000), on, false)).toBe(false);
    expect(receivableNeedsApproval(cod(800), on, false)).toBe(false);
    // Varios pagos de contraentrega en la misma venta se suman.
    expect(receivableNeedsApproval([...cod(600), ...cod(600)], on, false)).toBe(
      true,
    );
    // Sin ajuste guardado, el umbral es RD$ 1,000.
    expect(
      receivableNeedsApproval(cod(1200), { allowCreditSales: true }, false),
    ).toBe(true);
  });
  it("con las ventas a crédito desactivadas, toda contraentrega de la cajera pide PIN", () => {
    expect(receivableNeedsApproval(cod(1), {}, false)).toBe(true);
    expect(receivableNeedsApproval(cod(800), null, false)).toBe(true);
    expect(
      receivableNeedsApproval([{ method: "cash", amount: 800 }], {}, false),
    ).toBe(false);
  });
  it("quien gestiona ventas despacha contraentrega sin PIN", () => {
    expect(receivableNeedsApproval(cod(12000), on, true)).toBe(false);
    expect(receivableNeedsApproval(cod(12000), {}, true)).toBe(false);
  });
  it("el crédito no cambia: sobre el umbral pide PIN a todos", () => {
    expect(receivableNeedsApproval(credit(1600), on, true)).toBe(true);
    expect(receivableNeedsApproval(credit(1600), on, false)).toBe(true);
    expect(receivableNeedsApproval(credit(800), on, false)).toBe(false);
    expect(receivableNeedsApproval(credit(800), {}, false)).toBe(false);
  });
});

describe("M-2 · el umbral del crédito y la contraentrega es por cliente", () => {
  const on = { allowCreditSales: true, creditApprovalThreshold: 1000 };
  const cod = (amount: number) => [{ method: "cod", amount }];
  const credit = (amount: number) => [{ method: "credit", amount }];
  it("la deuda abierta del cliente cuenta para la cajera", () => {
    expect(receivableNeedsApproval(cod(900), on, false, 0)).toBe(false);
    expect(receivableNeedsApproval(cod(900), on, false, 900)).toBe(true);
    expect(receivableNeedsApproval(credit(900), on, false, 900)).toBe(true);
    expect(receivableNeedsApproval(cod(100), on, false, 900)).toBe(false);
    // Crédito y contraentrega en la misma venta se suman.
    expect(
      receivableNeedsApproval([...cod(600), ...credit(600)], on, false),
    ).toBe(true);
  });
  it("una venta sin cuenta por cobrar no mira la deuda", () => {
    expect(
      receivableNeedsApproval(
        [{ method: "cash", amount: 900 }],
        on,
        false,
        5000,
      ),
    ).toBe(false);
  });
  it("quien gestiona ventas conserva la regla por venta", () => {
    expect(receivableNeedsApproval(cod(900), on, true, 5000)).toBe(false);
    expect(receivableNeedsApproval(credit(900), on, true, 5000)).toBe(false);
  });
});

describe("N-2 · tope por turno de lo que se deja por cobrar", () => {
  const on = { allowCreditSales: true, creditApprovalThreshold: 1000 };
  const cod = (amount: number) => [{ method: "cod", amount }];
  it("lo ya dejado por cobrar en el turno suma, de cualquier cliente", () => {
    expect(receivableNeedsApproval(cod(800), on, false, 0, 2200)).toBe(false);
    expect(receivableNeedsApproval(cod(800), on, false, 0, 2400)).toBe(true);
    // El tope es configurable.
    expect(
      receivableNeedsApproval(
        cod(800),
        { ...on, receivableShiftLimit: 5000 },
        false,
        0,
        4000,
      ),
    ).toBe(false);
  });
  it("no aplica a quien gestiona ventas ni a ventas sin cuenta por cobrar", () => {
    expect(receivableNeedsApproval(cod(800), on, true, 0, 9000)).toBe(false);
    expect(
      receivableNeedsApproval(
        [{ method: "cash", amount: 800 }],
        on,
        false,
        0,
        9000,
      ),
    ).toBe(false);
  });
});

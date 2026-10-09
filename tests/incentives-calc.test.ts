// INC: cálculo puro de los incentivos por cajera (sin base de datos). La
// integración por rol, la idempotencia offline y el cierre de mes están en
// tests/incentives-api.test.ts.
import { describe, expect, it } from "vitest";
import { saleSchema } from "../packages/shared/src/index";
import {
  businessMonth,
  defaultIncentiveRate,
  firstOpenPeriod,
  incentiveAmount,
  nextMonth,
  normalizeCategoryName,
  rateFor,
  reversalAmount,
  summarize,
  WHOLESALE_FACTOR,
  type EntryLike,
} from "../apps/api/src/incentives";
import { renderSale, type SaleView } from "../apps/api/src/notifications";

describe("tarifas por categoría", () => {
  it("por defecto: Suplementos 50, Fajas 50, Maquillaje 25 y las demás 0", () => {
    expect(defaultIncentiveRate("Suplementos")).toBe(50);
    expect(defaultIncentiveRate("Fajas")).toBe(50);
    expect(defaultIncentiveRate("Maquillaje")).toBe(25);
    expect(defaultIncentiveRate("Ropa deportiva")).toBe(0);
    expect(defaultIncentiveRate("Accesorios de gym")).toBe(0);
  });
  it("el nombre se compara sin mayúsculas, acentos ni espacios de más", () => {
    expect(normalizeCategoryName("  MÁQUILLAJE ")).toBe("maquillaje");
    expect(defaultIncentiveRate("SUPLEMENTOS")).toBe(50);
    expect(defaultIncentiveRate("suplementos ")).toBe(50);
    expect(defaultIncentiveRate("Máquillaje")).toBe(25);
    expect(defaultIncentiveRate("faja")).toBe(50);
    expect(defaultIncentiveRate("Suplementos deportivos")).toBe(0);
  });
  it("la tarifa configurada manda, también si es 0", () => {
    const fajas = { id: "f", name: "Fajas" };
    expect(rateFor(fajas, [])).toBe(50);
    expect(rateFor(fajas, [{ categoryId: "f", amount: "35.50" }])).toBe(35.5);
    expect(rateFor(fajas, [{ categoryId: "f", amount: 0 }])).toBe(0);
    expect(rateFor(fajas, [{ categoryId: "otra", amount: 10 }])).toBe(50);
  });
});

describe("monto por línea", () => {
  it("cantidad × tarifa", () => {
    expect(incentiveAmount(3, 50, false)).toBe(150);
    expect(incentiveAmount(1, 25, false)).toBe(25);
    expect(incentiveAmount(2, 0, false)).toBe(0);
  });
  it("«Venta al por mayor» paga la mitad", () => {
    expect(WHOLESALE_FACTOR).toBe(0.5);
    expect(incentiveAmount(3, 50, true)).toBe(75);
    expect(incentiveAmount(1, 25, true)).toBe(12.5);
  });
  it("redondea a 2 decimales (mitad hacia arriba)", () => {
    expect(incentiveAmount(0.333, 25, true)).toBe(4.16); // 4.1625
    expect(incentiveAmount(0.001, 5, false)).toBe(0.01); // 0.005
    expect(incentiveAmount("1.5", "33.33", false)).toBe(50); // 49.995
    expect(incentiveAmount(0.003, 1, true)).toBe(0); // 0.0015
  });
});

describe("reversos proporcionales", () => {
  it("devolución parcial: por unidades devueltas", () => {
    expect(reversalAmount(150, 3, 0, 1)).toBe(-50);
    expect(reversalAmount(75, 3, 0, 2)).toBe(-50);
  });
  it("devoluciones de a una unidad suman exactamente lo ganado", () => {
    const parts = [0, 1, 2].map((before) => reversalAmount(100, 3, before, 1));
    expect(parts).toEqual([-33.33, -33.34, -33.33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(-100, 10);
  });
  it("devolución total = todo lo ganado; nada si no ganó", () => {
    expect(reversalAmount(4.16, 0.333, 0, 0.333)).toBe(-4.16);
    expect(reversalAmount(0, 2, 0, 1)).toBe(0);
  });
});

describe("meses (America/Santo_Domingo)", () => {
  it("el límite del mes es la medianoche de Santo Domingo, no la UTC", () => {
    expect(businessMonth(new Date("2026-11-01T03:59:59Z"))).toBe("2026-10");
    expect(businessMonth(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11");
    expect(businessMonth(new Date("2027-01-01T03:00:00Z"))).toBe("2026-12");
  });
  it("un mes cerrado manda lo tardío al siguiente mes abierto", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(nextMonth("2026-09")).toBe("2026-10");
    expect(firstOpenPeriod("2026-10", [])).toBe("2026-10");
    expect(firstOpenPeriod("2026-10", ["2026-10", "2026-11"])).toBe("2026-12");
    expect(firstOpenPeriod("2026-10", ["2026-09", "2026-11"])).toBe("2026-10");
  });
});

const entry = (over: Partial<EntryLike>): EntryLike => ({
  kind: "sale",
  saleId: "s1",
  userId: "ana",
  categoryName: "Suplementos",
  qty: 1,
  amount: 50,
  wholesale: false,
  period: "2026-10",
  originPeriod: "2026-10",
  note: null,
  ...over,
});

describe("cuadre mensual por cajera", () => {
  it("venta con categorías mezcladas: unidades y bruto por persona", () => {
    const [ana] = summarize([
      entry({ qty: 2, amount: 100 }),
      entry({ categoryName: "Fajas", qty: 1, amount: 50 }),
      entry({ categoryName: "Maquillaje", qty: 1, amount: 25 }),
      entry({ categoryName: "Ropa deportiva", qty: 1, amount: 0 }),
    ]);
    expect(ana.gross).toBe(175);
    expect(ana.net).toBe(175);
    expect(ana.salesCount).toBe(1);
    expect(ana.units).toEqual([
      { category: "Fajas", sold: 1, returned: 0 },
      { category: "Maquillaje", sold: 1, returned: 0 },
      { category: "Ropa deportiva", sold: 1, returned: 0 },
      { category: "Suplementos", sold: 2, returned: 0 },
    ]);
  });
  it("separa cajeras, cuenta mayoristas, descuentos y lo que está por cobrar", () => {
    const rows = summarize(
      [
        entry({ qty: 2, amount: 100 }),
        entry({ saleId: "s2", wholesale: true, qty: 2, amount: 50 }),
        entry({ kind: "return", qty: -1, amount: -50 }),
        entry({ userId: "luz", saleId: "s3", amount: 50 }),
      ],
      new Set(["s2"]),
    );
    const ana = rows.find((r) => r.userId === "ana")!;
    const luz = rows.find((r) => r.userId === "luz")!;
    expect(ana).toMatchObject({
      salesCount: 2,
      wholesaleSales: 1,
      gross: 150,
      deductions: -50,
      net: 100,
      pendingCollection: 50,
      negative: false,
    });
    expect(ana.units).toEqual([
      { category: "Suplementos", sold: 4, returned: 1 },
    ]);
    expect(luz.net).toBe(50);
  });
  it("un reverso de un mes anterior se descuenta en el mes en que ocurre y se muestra", () => {
    const [ana] = summarize([
      entry({ amount: 25, categoryName: "Maquillaje" }),
      entry({
        kind: "void",
        saleId: "vieja",
        qty: -2,
        amount: -100,
        originPeriod: "2026-09",
        note: "Anulación de una venta de 2026-09: se descuenta en 2026-10.",
      }),
    ]);
    expect(ana.net).toBe(-75);
    expect(ana.negative).toBe(true);
    expect(ana.priorDeductions).toBe(-100);
    expect(ana.lateEntries).toBe(1);
  });
});

describe("venta: la marca mayorista viaja sin romper ventas anteriores", () => {
  const base = {
    offlineUuid: "7f0b2c51-3c8b-4a4e-9a55-0d9b3f6f1d10",
    cashSessionId: "0a3b2c51-3c8b-4a4e-9a55-0d9b3f6f1d10",
    items: [{ variantId: "1a3b2c51-3c8b-4a4e-9a55-0d9b3f6f1d10", qty: 1 }],
    payments: [{ method: "cash", amount: 100 }],
  };
  it("se conserva al validar y no aparece si no se envía", () => {
    expect(saleSchema.parse({ ...base, wholesale: true }).wholesale).toBe(true);
    // Sin valor por defecto: la huella (requestHash) de una venta offline
    // guardada antes de esta función no cambia.
    expect("wholesale" in saleSchema.parse(base)).toBe(false);
    expect(() => saleSchema.parse({ ...base, wholesale: "sí" })).toThrow();
  });
});

describe("aviso de Telegram (sólo administración)", () => {
  const view: SaleView = {
    number: "FS-0000001",
    createdAt: new Date("2026-10-09T19:05:00Z"),
    register: "Caja 1",
    cashier: "Ana",
    payments: [{ method: "cash", amount: 100 }],
    items: [{ name: "Proteína", qty: 1 }],
    total: 100,
    taxTotal: 0,
    taxIncluded: true,
    creditBalance: 0,
  };
  it("dice si fue al por mayor y el incentivo", () => {
    const text = renderSale({ ...view, wholesale: true, incentive: 25 });
    expect(text).toContain("Venta al por mayor (incentivo a la mitad)");
    expect(text).toContain("Incentivo: RD$ 25.00");
  });
  it("sin marca ni incentivo el aviso queda como antes", () => {
    expect(renderSale(view)).not.toMatch(/mayor|Incentivo/);
    expect(renderSale({ ...view, wholesale: false, incentive: 0 })).toBe(
      renderSale(view),
    );
  });
});

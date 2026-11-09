// Hallazgos de dinero de la auditoría DeepSeek (orden 104, 1-nov-2026).
// Cada bloque es una regresión que falla antes de la corrección y pasa después.
import { describe, expect, it } from "vitest";
import { usdCashPayments } from "../apps/api/src/sales";
import { lineTotals } from "../packages/shared/src/index";
import { repricePendingSale } from "../apps/web/src/pendingSales";
import {
  pendingCreditIncentive,
  recordSaleIncentives,
  syncCreditIncentives,
} from "../apps/api/src/incentives";

describe("H-01: un pago en US$ sólo puede ser en efectivo", () => {
  const usd = (method: string) => ({
    method,
    amount: 600,
    currency: "USD",
    amountUsd: 10,
  });
  it("rechaza US$ con tarjeta o transferencia", () => {
    for (const method of ["card", "transfer"])
      expect(() => usdCashPayments([usd(method)], 60)).toThrow(/efectivo/);
  });
  it("acepta US$ en efectivo al equivalente en pesos", () => {
    const [p] = usdCashPayments([usd("cash")], 60);
    expect(p.amount).toBe(600);
  });
});

describe("H-08: incentivo de ventas a crédito con fracción pagada entre 0 y 1", () => {
  // Venta de 2 unidades a RD$ 10 de incentivo cada una: el total completo es 20.
  const sale = (total: string, creditBalance: string) => ({
    id: "s1",
    number: 1,
    sellerId: "u1",
    branchId: "b1",
    createdAt: new Date("2026-10-15T15:00:00Z"),
    wholesale: false,
    total,
    creditBalance,
    incentiveOnCollection: true,
    items: [
      {
        id: "l1",
        qty: 2,
        variant: { product: { category: { id: "c1", name: "Suplementos" } } },
      },
    ],
  });
  const fakeTx = (s: any) => {
    const created: any[] = [];
    return {
      created,
      $queryRaw: async () => [{ locked: "" }],
      sale: { findUniqueOrThrow: async () => s },
      incentiveRate: {
        findMany: async () => [{ categoryId: "c1", amount: 10 }],
      },
      incentivePeriodClose: { findMany: async () => [] },
      incentiveEntry: {
        createMany: async ({ data }: any) => created.push(...data),
      },
    };
  };
  const actor = { id: "u1", branchId: "b1" } as any;

  it("con más saldo que total (fracción negativa) no acredita incentivo negativo", async () => {
    const tx = fakeTx(sale("100", "150"));
    await recordSaleIncentives(tx, actor, "s1");
    expect(tx.created.map((e) => Number(e.amount))).toEqual([0]);
  });
  it("con saldo negativo (fracción mayor que 1) no acredita más de lo vendido", async () => {
    const tx = fakeTx(sale("100", "-50"));
    await recordSaleIncentives(tx, actor, "s1");
    expect(tx.created.map((e) => Number(e.amount))).toEqual([20]);
  });
  it("venta a crédito normal acredita sólo la fracción pagada", async () => {
    const tx = fakeTx(sale("100", "60"));
    await recordSaleIncentives(tx, actor, "s1");
    expect(tx.created.map((e) => Number(e.amount))).toEqual([8]);
  });
  it("pendingCreditIncentive suma el pendiente por cajera en centavos exactos", async () => {
    const db = {
      sale: {
        findMany: async () => [
          { id: "s1", items: [{ id: "l1", qty: 3, returnedQty: 0 }] },
          { id: "s2", items: [{ id: "l2", qty: 1, returnedQty: 0 }] },
        ],
      },
      incentiveEntry: {
        findMany: async () => [
          {
            saleId: "s1",
            saleItemId: "l1",
            kind: "sale",
            userId: "u1",
            qty: 3,
            rateAtSale: "0.1",
            wholesale: false,
            amount: 0.1,
          },
          {
            saleId: "s2",
            saleItemId: "l2",
            kind: "sale",
            userId: "u1",
            qty: 1,
            rateAtSale: "0.004",
            wholesale: false,
            amount: 0,
          },
        ],
      },
    };
    const out = await pendingCreditIncentive(db, "b1");
    // s1: 0.30 − 0.10 = 0.20; s2: 0.004 − 0 = 0.004. Se suman en Decimal y el
    // total se redondea una sola vez al final: 0.204 → 0.20 (no venta por venta).
    expect(out.get("u1")).toBe(0.2);
  });
});

describe("LOW: incentivo a crédito se redondea una sola vez", () => {
  const base = (qty: number, wholesale: boolean) => ({
    id: "s1",
    number: 1,
    sellerId: "u1",
    branchId: "b1",
    createdAt: new Date("2026-10-15T15:00:00Z"),
    wholesale,
    total: "100",
    creditBalance: "50",
    incentiveOnCollection: true,
    items: [
      {
        id: "l1",
        qty,
        variant: { product: { category: { id: "c1", name: "Suplementos" } } },
      },
    ],
  });
  const rateRow = (rate: string) => [{ categoryId: "c1", amount: rate }];
  const fakeTx = (sale: any, rate: string, entries: any[] = []) => {
    const created: any[] = [];
    return {
      created,
      $queryRaw: async () => [{ locked: "" }],
      sale: {
        findUniqueOrThrow: async () => sale,
        findUnique: async () => ({
          total: sale.total,
          creditBalance: "0",
          incentiveOnCollection: true,
          items: sale.items.map((i: any) => ({
            id: i.id,
            qty: i.qty,
            returnedQty: 0,
          })),
        }),
      },
      saleReturn: { aggregate: async () => ({ _sum: { total: null } }) },
      auditLog: { create: async () => ({}) },
      incentiveRate: { findMany: async () => rateRow(rate) },
      incentivePeriodClose: { findMany: async () => [] },
      incentiveEntry: {
        findMany: async () => [...entries, ...created],
        createMany: async ({ data }: any) => created.push(...data),
      },
    };
  };
  const actor = { id: "u1", branchId: "b1" } as any;

  it("mayorista, tarifa 0.05, qty 1, 50 % al vender: 0.05 × 0.5 × 0.5 = 0.0125 → 0.01 (una vez)", async () => {
    // Antes: 0.05 × 0.5 = 0.025 → 0.03 y luego × 0.5 = 0.015 → 0.02.
    const tx = fakeTx(base(1, true), "0.05");
    await recordSaleIncentives(tx, actor, "s1");
    expect(tx.created.map((e) => Number(e.amount))).toEqual([0.01]);
  });

  it("rate 0.015, qty 1, 50 % al vender y luego cobro completo: total = 0.015 redondeado una vez (0.02)", async () => {
    const tx = fakeTx(base(1, false), "0.015");
    await recordSaleIncentives(tx, actor, "s1");
    await syncCreditIncentives(tx, actor, "s1", "collection", "pay-1");
    const total = tx.created.reduce((s, e) => s + Number(e.amount), 0);
    expect(total.toFixed(2)).toBe("0.02");
  });
});

describe("H-04: descuento por línea acotado a 100 %", () => {
  it("lineTotals con más de 100 % no deja el total negativo", () => {
    for (const taxIncluded of [true, false]) {
      const t = lineTotals(1, 100, 150, 18, taxIncluded);
      expect(t.total).toBe(0);
      expect(t.net).toBeGreaterThanOrEqual(0);
    }
  });
  it("reprecio offline con descuento de 150 % deja la línea en 0, no en negativo", () => {
    const products: any[] = [
      {
        id: "p1",
        name: "Producto",
        taxRate: 18,
        variants: [{ id: "v1", sku: "S1", price: 100 }],
      },
    ];
    const input: any = {
      items: [{ variantId: "v1", qty: 1, discountPercent: 150 }],
      globalDiscount: 0,
      payments: [{ method: "cash", amount: 0 }],
    };
    const r = repricePendingSale(input, products, []);
    expect(r.total).toBe(0);
    expect(r.prices[0].lineTotal).toBe(0);
  });
});

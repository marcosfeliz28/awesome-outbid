// Hallazgos de dinero de la auditoría DeepSeek (orden 104, 1-nov-2026).
// Cada bloque es una regresión que falla antes de la corrección y pasa después.
import { describe, expect, it } from "vitest";
import { usdCashPayments } from "../apps/api/src/sales";
import {
  pendingCreditIncentive,
  recordSaleIncentives,
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
      { id: "l1", qty: 2, variant: { product: { category: { id: "c1", name: "Suplementos" } } } },
    ],
  });
  const fakeTx = (s: any) => {
    const created: any[] = [];
    return {
      created,
      $queryRaw: async () => [{ locked: "" }],
      sale: { findUniqueOrThrow: async () => s },
      incentiveRate: { findMany: async () => [{ categoryId: "c1", amount: 10 }] },
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
          { saleId: "s1", saleItemId: "l1", kind: "sale", userId: "u1", qty: 3, rateAtSale: "0.1", wholesale: false, amount: 0.1 },
          { saleId: "s2", saleItemId: "l2", kind: "sale", userId: "u1", qty: 1, rateAtSale: "0.004", wholesale: false, amount: 0 },
        ],
      },
    };
    const out = await pendingCreditIncentive(db, "b1");
    // s1: 0.30 − 0.10 = 0.20; s2: 0.004 − 0 = 0.004 → 0.00 (centavos).
    expect(out.get("u1")).toBe(0.2);
  });
});

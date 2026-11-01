// Hallazgos de dinero de la auditoría DeepSeek (orden 104, 1-nov-2026).
// Cada bloque es una regresión que falla antes de la corrección y pasa después.
import { describe, expect, it } from "vitest";
import { usdCashPayments } from "../apps/api/src/sales";

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

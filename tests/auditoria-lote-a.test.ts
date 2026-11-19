// Auditoría lote A (19-nov-2026): pruebas unitarias de los arreglos A1-A6.
import { describe, expect, it } from "vitest";
import { dateRange } from "../apps/api/src/reports";

describe("A1 · dateRange acepta fecha sola o fecha con hora", () => {
  it("fecha sola cubre el día entero en UTC-4", () => {
    const r = dateRange({ from: "2026-11-19", to: "2026-11-19" });
    expect(r.gte.toISOString()).toBe("2026-11-19T04:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-11-20T03:59:59.999Z");
  });
  it("fecha con hora (lo que manda Caja) se usa tal cual", () => {
    const r = dateRange({
      from: "2026-11-19T00:00:00-04:00",
      to: "2026-11-19T23:59:59-04:00",
    });
    expect(r.gte.toISOString()).toBe("2026-11-19T04:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-11-20T03:59:59.000Z");
  });
  it("sigue rechazando fechas inválidas o al revés", () => {
    expect(() => dateRange({ from: "basura" })).toThrow(/Rango de fechas/);
    expect(() =>
      dateRange({ from: "2026-11-20", to: "2026-11-19T00:00:00-04:00" }),
    ).toThrow(/Rango de fechas/);
  });
});

// A2: al recalcular una caja cerrada, la transferencia contada (la pone el
// sistema al cerrar) sigue a la esperada; efectivo y tarjeta no se tocan.
function fakeTx(payments: any[]) {
  const updates: any[] = [];
  return {
    updates,
    payment: { findMany: async () => payments },
    cashMovement: { findMany: async () => [] },
    saleReturn: { findMany: async () => [] },
    cashSession: { update: async (args: any) => updates.push(args) },
  };
}
const closedSession = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  openingAmount: 1000,
  countedCash: 1500,
  countedCard: 300,
  countedTransfer: 800, // lo esperado al cerrar
  closedAt: new Date("2026-11-18T22:00:00Z"),
  closeDetails: { vouchers: 0, transferBySystem: true },
  ...extra,
});
const pay = (method: string, amount: number) => ({
  method,
  amount,
  currency: "DOP",
  change: 0,
  amountUsd: 0,
});

describe("A2 · caja cerrada: transferencia contada sigue a la esperada", () => {
  it("un abono por transferencia verificado tras el cierre no deja faltante", async () => {
    const { refreshClosedCash } = await import("../apps/api/src/cash");
    // Al cerrar: 500 efectivo, 300 tarjeta, 800 transferencia. Luego se
    // verifica un abono de 200 por transferencia.
    const tx = fakeTx([
      pay("cash", 500),
      pay("card", 300),
      pay("transfer", 800),
      pay("transfer", 200),
    ]);
    const diff = await refreshClosedCash(tx, closedSession());
    expect(diff.transfer).toBe(0);
    expect(diff.cash).toBe(0);
    expect(diff.card).toBe(0);
    const data = tx.updates[0].data;
    expect(Number(data.countedTransfer)).toBe(1000);
    expect(Number(data.expectedTransfer)).toBe(1000);
    expect(Number(data.differenceTransfer)).toBe(0);
    expect(data.countedCash).toBeUndefined();
    expect(data.countedCard).toBeUndefined();
  });
  it("una transferencia rechazada tras el cierre no deja sobrante", async () => {
    const { refreshClosedCash } = await import("../apps/api/src/cash");
    // Se rechazó una transferencia de 300: queda 500 por transferencia.
    const tx = fakeTx([
      pay("cash", 500),
      pay("card", 300),
      pay("transfer", 500),
    ]);
    const diff = await refreshClosedCash(tx, closedSession());
    expect(diff.transfer).toBe(0);
    expect(diff.cash).toBe(0);
    expect(Number(tx.updates[0].data.countedTransfer)).toBe(500);
  });
  it("un cierre viejo con transferencia escrita por la cajera no se pisa", async () => {
    const { refreshClosedCash } = await import("../apps/api/src/cash");
    const tx = fakeTx([
      pay("cash", 500),
      pay("card", 300),
      pay("transfer", 1000),
    ]);
    const diff = await refreshClosedCash(
      tx,
      closedSession({
        closedAt: new Date("2026-10-10T22:00:00Z"),
        closeDetails: { vouchers: 0 },
      }),
    );
    expect(diff.transfer).toBe(-200);
    expect(tx.updates[0].data.countedTransfer).toBeUndefined();
  });
});

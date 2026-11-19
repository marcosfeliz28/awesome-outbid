// Reparar caja y cobros (19-nov-2026): pruebas de los hallazgos de la
// auditoría de dinero y pantallas en caja, cobros y créditos.
import { describe, expect, it } from "vitest";

// Hallazgo 4: el cuadre cuenta los cobros de venta por la caja del pago.
function cuadreDb(opts: { sales: any[]; salePayments: any[] }) {
  return {
    settings: { findUnique: async () => null },
    terminal: { findUnique: async () => null },
    user: { findUnique: async () => null, findMany: async () => [] },
    sale: { findMany: async () => opts.sales },
    payment: {
      findMany: async (args: any) => {
        const w = args.where ?? {};
        if (w.entryType === "sale")
          return opts.salePayments.filter(
            (p) =>
              p.entryType === "sale" && p.cashSessionId === w.cashSessionId,
          );
        return [];
      },
    },
    cashMovement: { findMany: async () => [] },
    saleReturn: { findMany: async () => [] },
    auditLog: { findMany: async () => [] },
  };
}
const actor = { id: "u1", branchId: "b1", permissions: ["*"] } as any;
const session = (id: string) => ({
  id,
  branchId: "b1",
  registerId: "web",
  userId: "u1",
  openingAmount: 0,
  countedCash: null,
  openedAt: new Date("2026-11-18T12:00:00Z"),
  closedAt: null,
  closeDetails: {},
});

describe("Hallazgo 4 · cuadre tras mover un cobro de caja", () => {
  // Venta de RD$ 2,000 vendida en la caja A; su cobro en efectivo se movió a B.
  const payment = {
    id: "p1",
    saleId: "v1",
    entryType: "sale",
    method: "cash",
    amount: 2000,
    currency: "DOP",
    change: 0,
    amountUsd: 0,
    status: "ok",
    cashSessionId: "B",
  };
  const sale = {
    id: "v1",
    number: "FS-0000304",
    status: "completed",
    cashSessionId: "A",
    total: 2000,
    taxTotal: 0,
    costTotal: 0,
    discountTotal: 0,
    payments: [payment],
  };
  it("la caja A ya no suma el cobro movido", async () => {
    const { buildCuadre } = await import("../apps/api/src/cash");
    const db = cuadreDb({ sales: [sale], salePayments: [payment] });
    const report: any = await buildCuadre(db, actor, session("A"));
    expect(report.salesByMethod.cash).toBe(0);
    expect(report.cashSalesDetail.total).toBe(0);
  });
  it("la caja B sí lo suma aunque la venta sea de A", async () => {
    const { buildCuadre } = await import("../apps/api/src/cash");
    const db = cuadreDb({ sales: [], salePayments: [payment] });
    const report: any = await buildCuadre(db, actor, session("B"));
    expect(report.salesByMethod.cash).toBe(2000);
    expect(report.cashSalesDetail.total).toBe(2000);
  });
});

// Reparar caja y cobros (19-nov-2026): pruebas de los hallazgos de la
// auditoría de dinero y pantallas en caja, cobros y créditos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

// Hallazgo 17: verificar, des-verificar, corregir y rechazar transferencias
// usan el plazo largo de las operaciones de dinero (no los 5 s por defecto).
describe("Hallazgo 17 · transferencias con plazo de dinero", () => {
  it("las cuatro operaciones pasan MONEY_TRANSACTION", async () => {
    const { SalesController, MONEY_TRANSACTION } =
      await import("../apps/api/src/sales");
    const seen: unknown[] = [];
    const db: any = {
      $transaction: async (_fn: unknown, options: unknown) => {
        seen.push(options);
        return { ok: true };
      },
    };
    const sales = new SalesController(db);
    const id = "8f6c1a2e-1b2c-4d3e-8f4a-5b6c7d8e9f00";
    const reason = { reason: "Prueba de plazo" };
    await sales.verify(id, actor);
    await sales.unverify(id, reason, actor);
    await sales.correctTransfer(
      id,
      {
        ...reason,
        bank: "Popular",
        reference: "123",
        expectedBank: null,
        expectedReference: null,
      },
      actor,
    );
    await sales.reject(id, reason, actor);
    expect(seen).toEqual([
      MONEY_TRANSACTION,
      MONEY_TRANSACTION,
      MONEY_TRANSACTION,
      MONEY_TRANSACTION,
    ]);
  });
});

// Hallazgo 16: caja de GV. Base falsa con una caja y sus pagos.
function gvDb(session: any, payments: any[]) {
  const updates: any[] = [];
  const audits: any[] = [];
  const tx: any = {
    $queryRaw: async () => [],
    gvCashSession: {
      findFirst: async () => (session.closedAt ? null : session),
      findUnique: async () => session,
      update: async (args: any) => {
        updates.push(args.data);
        return { ...session, ...args.data };
      },
    },
    gvPayment: {
      findMany: async () => payments.filter((p) => !p.rejectedAt),
      findFirst: async ({ where }: any) =>
        payments.find((p) => p.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const p = payments.find((x) => x.id === where.id);
        Object.assign(p, data);
        return p;
      },
    },
    gvEnrollment: { findUnique: async () => ({ status: "activa" }) },
    alert: { updateMany: async () => ({ count: 0 }) },
    auditLog: { create: async (args: any) => audits.push(args.data) },
    gvProof: { create: async () => ({}) },
  };
  return {
    updates,
    audits,
    db: { ...tx, $transaction: async (fn: any) => fn(tx) },
  };
}

describe("Hallazgo 16 · caja de GV", () => {
  const efectivo = (id: string, amount: number) => ({
    id,
    method: "efectivo",
    amount,
    amountDop: amount,
    enrollmentId: "e1",
    cashSessionId: "g1",
    rejectedAt: null,
  });
  it("un cierre con diferencia pide justificación", async () => {
    const { GvCajaController } = await import("../apps/api/src/gv-caja");
    const session = { id: "g1", openingAmount: 0, closedAt: null };
    const { db } = gvDb(session, [efectivo("p1", 500)]);
    const caja = new GvCajaController(db);
    const count = { countedCash: 400, countedCard: 0, countedTransfer: 0 };
    const error: any = await caja.close(count, actor).catch((e) => e);
    expect(error?.status).toBe(400);
    expect(JSON.stringify(error.getResponse())).not.toMatch(/100|400|500/);
    const done: any = await caja.close(
      { ...count, notes: "Faltan 100, se pagó un taxi" },
      actor,
    );
    expect(done.differences.total).toBe("-100.00");
  });
  it("anular un pago de una caja de GV cerrada recalcula su cierre", async () => {
    const { GvController } = await import("../apps/api/src/gv");
    const session = {
      id: "g1",
      openingAmount: 0,
      closedAt: new Date("2026-11-18T22:00:00Z"),
      countedCash: 500,
      countedCard: 0,
      countedTransfer: 0,
      expectedCash: 500,
      difference: 0,
    };
    const { db, updates } = gvDb(session, [
      efectivo("8f6c1a2e-1b2c-4d3e-8f4a-5b6c7d8e9f01", 500),
    ]);
    const gv = new GvController(db);
    await gv.voidPayment(
      "8f6c1a2e-1b2c-4d3e-8f4a-5b6c7d8e9f01",
      { reason: "Cobro duplicado" },
      actor,
    );
    const refreshed = updates.find((u) => "expectedCash" in u);
    expect(refreshed).toMatchObject({
      expectedCash: "0.00",
      difference: "500.00",
    });
  });
});

// Pantallas (auditoría de pantallas 19-nov), comprobadas en el código fuente.
const source = (file: string) =>
  readFileSync(resolve("apps/web/src", file), "utf8");

describe("CC-05 · Conciliar transferencias agrupa «POULAR» con Popular", () => {
  it("las variantes conocidas de Popular van a su grupo", async () => {
    const { bankGroup } =
      await import("../apps/web/src/transfer-reconciliation-utils");
    expect(bankGroup("POULAR")).toBe("Popular");
    expect(bankGroup("BPD")).toBe("Popular");
    expect(bankGroup("Banco Popular")).toBe("Popular");
    expect(bankGroup("31434")).toBe("Otros");
  });
});

describe("P4 · Créditos por persona: el banco sale de la lista de Configuración", () => {
  it("usa settings.transferAccounts en un select", () => {
    const credit = source("CreditAccounts.tsx");
    expect(credit).toContain("settings.data?.transferAccounts");
    const bank = credit.indexOf("Banco donde cayó");
    expect(credit.indexOf("<select", bank)).toBeLessThan(
      credit.indexOf("<input", bank),
    );
  });
});

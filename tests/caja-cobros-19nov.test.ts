// Reparar caja y cobros (19-nov-2026): pruebas de los hallazgos de la
// auditoría de dinero y pantallas en caja, cobros y créditos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCorrectMethodPayload,
  needsCashDestination,
  openCashSessions,
} from "../apps/web/src/SaleEditPanel";
import {
  cashSessionMoveKind,
  openMoveDestinations,
} from "../apps/web/src/paymentCashMove";

const cardWithoutRegister = {
  id: "payment-1",
  method: "card",
  cashSessionId: null,
};

describe("A3 · presentación para corregir el método de pago", () => {
  it("ofrece únicamente cajas abiertas", () => {
    expect(
      openCashSessions([
        { id: "open-1", openedAt: "2026-11-20T08:00:00Z", closedAt: null },
        {
          id: "closed-1",
          openedAt: "2026-11-19T08:00:00Z",
          closedAt: "2026-11-19T17:00:00Z",
        },
        { id: "open-2", openedAt: "2026-11-20T09:00:00Z" },
      ]).map((session) => session.id),
    ).toEqual(["open-1", "open-2"]);
  });

  it("pide destino al cambiar tarjeta sin caja a efectivo", () => {
    expect(needsCashDestination(cardWithoutRegister, "cash")).toBe(true);
    expect(needsCashDestination(cardWithoutRegister, "transfer")).toBe(false);
    expect(
      needsCashDestination(
        { ...cardWithoutRegister, cashSessionId: "register-1" },
        "cash",
      ),
    ).toBe(false);
  });

  it("envía la caja elegida sin marcar efectivo de la dueña", () => {
    expect(
      buildCorrectMethodPayload({
        payment: cardWithoutRegister,
        method: "cash",
        cashSessionId: "register-1",
        ownerConfirmed: true,
      }),
    ).toEqual({ method: "cash", cashSessionId: "register-1" });
  });

  it("envía ownerConfirmed solo cuando no se elige caja", () => {
    expect(
      buildCorrectMethodPayload({
        payment: cardWithoutRegister,
        method: "cash",
        ownerConfirmed: true,
      }),
    ).toEqual({ method: "cash", ownerConfirmed: true });
  });

  it("conserva los campos de transferencia sin campos de efectivo", () => {
    expect(
      buildCorrectMethodPayload({
        payment: cardWithoutRegister,
        method: "transfer",
        bank: "Popular",
        reference: "ABC-123",
        cashSessionId: "register-1",
        ownerConfirmed: true,
      }),
    ).toEqual({
      method: "transfer",
      bank: "Popular",
      reference: "ABC-123",
    });
  });
});

describe("A4 · mover efectivo recibido por la dueña", () => {
  const ownerCash = {
    method: "cash",
    cashSessionId: null,
    entryType: "installment",
    status: "ok",
    reference: "Recibido por la dueña · mensajero",
  };

  it("habilita el efectivo de la dueña y conserva el movimiento ya existente", () => {
    expect(cashSessionMoveKind(ownerCash)).toBe("owner-cash");
    expect(
      cashSessionMoveKind({
        ...ownerCash,
        cashSessionId: "register-1",
        reference: null,
      }),
    ).toBe("registered");
  });

  it("acepta la semántica ownerConfirmed cuando la respuesta la incluye", () => {
    expect(
      cashSessionMoveKind({
        ...ownerCash,
        reference: null,
        ownerConfirmed: true,
      }),
    ).toBe("owner-cash");
  });

  it.each([
    ["tarjeta sin caja", { ...ownerCash, method: "card" }],
    ["efectivo ordinario sin caja", { ...ownerCash, reference: null }],
    ["pago de venta", { ...ownerCash, entryType: "sale" }],
    ["cobro rechazado", { ...ownerCash, status: "rejected" }],
  ])("no ofrece el botón para %s", (_label, payment) => {
    expect(cashSessionMoveKind(payment)).toBeNull();
  });

  it("ofrece solo cajas abiertas como destino del efectivo de la dueña", () => {
    expect(
      openMoveDestinations([
        { id: "open-1", closedAt: null },
        { id: "closed-1", closedAt: "2026-11-19T18:00:00Z" },
        { id: "open-2" },
      ]).map((session) => session.id),
    ).toEqual(["open-1", "open-2"]);
  });
});

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

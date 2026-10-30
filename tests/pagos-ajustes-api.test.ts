// Herramientas de administración para corregir cobros (29-oct, caso FS-328):
// 1) corregir el método de un COBRO (abono / contraentrega) aunque la caja ya
//    cerró: efectivo -> transferencia debe devolver la deuda hasta verificar,
//    recalcular la caja cerrada y NO descontar dos veces al verificar.
// 2) devolver a «por verificar» una transferencia de venta ya verificada.
// 3) mover un cobro a otra caja (cobrado en una caja temporal), recalculando
//    las dos cajas.
// Contra la API real y PostgreSQL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const ip = "198.18.52." + ((Date.now() % 250) + 1);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const tag = Date.now().toString(36);

async function call(path: string, token: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function ok(path: string, token: string, data?: unknown) {
  const r = await call(path, token, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function enroll(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA ajustes " + label + " " + id.slice(0, 6),
    secret: "qa-aj-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}

let owner = "",
  cashierToken = "",
  cashierToken2 = "",
  sellerToken = "",
  customerId = "",
  productId = "",
  variantId = "";
let session: any; // caja de la cajera 1 (se cierra)
let session2: any; // caja de la cajera 2 (destino de movimientos)

async function person(label: string, role: "admin" | "seller") {
  const roles = await ok("/roles", owner);
  const email = `qa-aj-${label}-${tag}@example.test`;
  const temporary = role === "admin" ? "FitStore-QA-Aj-2026!" : "739205";
  const final = role === "admin" ? "FitStore-QA-Aj-Definitiva-2026!" : "583904";
  await ok("/users", owner, {
    name: `QA Ajustes ${label} ${tag}`,
    email,
    password: temporary,
    pin: "357902",
    roleId: roles.find((r: any) => r.name === role).id,
  });
  const token = (
    await ok("/auth/change-password", "", {
      login: email,
      currentPassword: temporary,
      newPassword: final,
      confirmPassword: final,
    })
  ).accessToken;
  await enroll(token, label);
  return token;
}
const saleOf = (
  token: string,
  cashSessionId: string,
  total: number,
  payments: any[],
) =>
  call("/sales", token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId,
    items: [{ variantId, qty: total / 100 }],
    payments,
    expectedTotal: total,
  });
const sessionRow = (id: string) =>
  db.cashSession.findUniqueOrThrow({ where: { id } });
const saleRow = (id: string) => db.sale.findUniqueOrThrow({ where: { id } });
const alertsOf = (sessionId: string) =>
  db.alert.findMany({
    where: { entityId: sessionId, type: "cash_after_close" },
  });

beforeAll(async () => {
  owner = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: demo,
    })
  ).accessToken;
  await enroll(owner, "dueña");
  cashierToken = await person("uno", "admin");
  cashierToken2 = await person("dos", "admin");
  sellerToken = await person("vendedora", "seller");
  session = await ok("/cash-sessions/open", cashierToken, { openingAmount: 0 });
  session2 = await ok("/cash-sessions/open", cashierToken2, {
    openingAmount: 0,
  });
  customerId = (await ok("/customers", owner, { name: "QA Ajustes " + tag }))
    .id;
  const categories = await ok("/categories", owner);
  const product = await ok("/products", owner, {
    name: "QA ajustes " + tag,
    sku: "QA-AJ-" + tag,
    categoryId: categories.find((c: any) => c.name === "Fajas").id,
    taxRate: 18,
    variants: [
      {
        sku: "QA-AJV-" + tag,
        barcode: "QA-AJB-" + tag,
        price: 100,
        costAvg: 40,
      },
    ],
  });
  productId = product.id;
  variantId = product.variants[0].id;
  await ok("/inventory/adjustments", owner, {
    variantId,
    qty: 500,
    reason: "QA ajustes: existencias",
  });
}, 120000);

afterAll(async () => {
  await fetch(base + "/products/" + productId, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      Authorization: "Bearer " + owner,
    },
    body: JSON.stringify({ active: false }),
  });
  await db.$disconnect();
});

describe("1 · corregir el método de un cobro (abono) con la caja cerrada", () => {
  it("efectivo -> transferencia: devuelve la deuda hasta verificar, recalcula la caja y no descuenta dos veces", async () => {
    // Venta a contraentrega de 7,500 y cobro en EFECTIVO en la caja 1 (mal marcado).
    const cod = await saleOf(cashierToken, session.id, 7500, [
      { method: "cod", amount: 7500 },
    ]);
    expect(cod.status, JSON.stringify(cod.body)).toBe(201);
    const saleId = cod.body.id;
    const paid = await ok(`/sales/${saleId}/installments`, cashierToken, {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      amount: 7500,
      method: "cash",
    });
    const payment = await db.payment.findFirstOrThrow({
      where: { saleId, entryType: "installment" },
    });
    expect(payment.method).toBe("cash");
    expect(Number((await saleRow(saleId)).creditBalance)).toBe(0);
    expect(paid.closed ?? true).toBeTruthy();

    // Cerrar la caja 1 contando lo que de verdad había (sin ese efectivo).
    const before = await ok("/cash-sessions", owner);
    const exp = before.find((s: any) => s.id === session.id).expected;
    await ok(`/cash-sessions/${session.id}/close`, owner, {
      countedCash: Number(exp.cash) - 7500,
      countedCard: 0,
      countedTransfer: 0,
      delivered: 0,
      differenceReason:
        "QA: faltan 7,500 que fueron una transferencia, no efectivo",
      notes: "QA: el cobro de 7,500 fue una transferencia a Banreservas",
    });
    const closed = await sessionRow(session.id);
    expect(Number(closed.differenceCash)).toBe(-7500);

    // Sin motivo o sin banco/referencia: rechazado, nada cambia.
    const noReason = await call(
      `/sales/${saleId}/payments/${payment.id}/correct-method`,
      owner,
      { method: "transfer", bank: "Banreservas", reference: "43376075790" },
    );
    expect(noReason.status).toBe(400);
    const noRef = await call(
      `/sales/${saleId}/payments/${payment.id}/correct-method`,
      owner,
      { method: "transfer", reason: "QA: fue transferencia" },
    );
    expect(noRef.status).toBe(400);
    // Quien no es administración no puede.
    const denied = await call(
      `/sales/${saleId}/payments/${payment.id}/correct-method`,
      sellerToken,
      {
        method: "transfer",
        bank: "Banreservas",
        reference: "43376075790",
        reason: "QA: intento de la cajera",
      },
    );
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .method,
    ).toBe("cash");

    // La corrección real.
    const done = await ok(
      `/sales/${saleId}/payments/${payment.id}/correct-method`,
      owner,
      {
        method: "transfer",
        bank: "Banreservas",
        reference: "43376075790",
        reason: "QA: se pagó por transferencia Banreservas, no en efectivo",
      },
    );
    expect(done.method).toBe("transfer");
    const fixed = await db.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(fixed).toMatchObject({
      method: "transfer",
      status: "pending_verification",
      bank: "Banreservas",
      reference: "43376075790",
    });
    // La transferencia sin verificar no descuenta la deuda: vuelve a deber.
    const afterFix = await saleRow(saleId);
    expect(Number(afterFix.creditBalance)).toBe(7500);
    expect(afterFix.creditClosedAt).toBeNull();
    // La caja cerrada se recalculó: el efectivo ya no se esperaba.
    const recalculated = await sessionRow(session.id);
    expect(Number(recalculated.differenceCash)).toBe(0);
    expect(
      (await alertsOf(session.id)).some((a: any) =>
        a.key.endsWith(`:method:${payment.id}`),
      ),
    ).toBe(true);
    expect(
      await db.auditLog.count({
        where: { action: "payment_method_corrected", entityId: saleId },
      }),
    ).toBe(1);

    // Verificar la transferencia descuenta la deuda UNA sola vez.
    await ok(`/payments/${payment.id}/verify`, owner, {});
    expect(Number((await saleRow(saleId)).creditBalance)).toBe(0);
    expect((await saleRow(saleId)).creditClosedAt).not.toBeNull();
  });

  it("no corrige cobros ya verificados, rechazados ni entre métodos de deuda", async () => {
    const cod = await saleOf(cashierToken2, session2.id, 1000, [
      { method: "cod", amount: 1000 },
    ]);
    const saleId = cod.body.id;
    await ok(`/sales/${saleId}/installments`, cashierToken2, {
      offlineUuid: randomUUID(),
      cashSessionId: session2.id,
      amount: 1000,
      method: "card",
      cardLast4: "1234",
      approvalCode: "AP1",
    });
    const payment = await db.payment.findFirstOrThrow({
      where: { saleId, entryType: "installment" },
    });
    // Un cobro no pasa a crédito ni contraentrega.
    const toDebt = await call(
      `/sales/${saleId}/payments/${payment.id}/correct-method`,
      owner,
      { method: "cod", reason: "QA: no debe poderse" },
    );
    expect(toDebt.status).toBe(400);
    // Tarjeta -> efectivo sí (misma venta, mismo monto), sin mover la deuda.
    await ok(`/sales/${saleId}/payments/${payment.id}/correct-method`, owner, {
      method: "cash",
      reason: "QA: fue efectivo, no tarjeta",
    });
    expect(Number((await saleRow(saleId)).creditBalance)).toBe(0);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("ok");
  });
});

describe("2 · devolver a «por verificar» una transferencia verificada por error", () => {
  it("solo administración, con motivo; la caja cerrada se recalcula", async () => {
    const s = await saleOf(cashierToken2, session2.id, 700, [
      {
        method: "transfer",
        amount: 700,
        bank: "Banco QA",
        reference: "REF-" + tag,
      },
    ]);
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    const saleId = s.body.id;
    const payment = await db.payment.findFirstOrThrow({ where: { saleId } });
    await ok(`/payments/${payment.id}/verify`, owner, {});
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("ok");

    const noReason = await call(`/payments/${payment.id}/unverify`, owner, {});
    expect(noReason.status).toBe(400);
    const denied = await call(`/payments/${payment.id}/unverify`, sellerToken, {
      reason: "QA: intento de la cajera",
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);

    await ok(`/payments/${payment.id}/unverify`, owner, {
      reason: "QA: se verificó contra el depósito equivocado",
    });
    const back = await db.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(back.status).toBe("pending_verification");
    expect(back.verifiedAt ?? null).toBeNull();
    expect(
      await db.alert.count({
        where: { key: "transfer:" + payment.id, status: { not: "resolved" } },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: { action: "payment_unverified", entityId: payment.id },
      }),
    ).toBe(1);
    // Ya estaba por verificar: no hay nada que devolver.
    const again = await call(`/payments/${payment.id}/unverify`, owner, {
      reason: "QA: otra vez",
    });
    expect(again.status).toBe(400);
  });
});

describe("3 · mover un cobro a otra caja", () => {
  it("recalcula las dos cajas y deja motivo y bitácora", async () => {
    // Cobro de tarjeta de 2,850 registrado por error en la caja 2...
    const cod = await saleOf(cashierToken2, session2.id, 2600, [
      { method: "cod", amount: 2600 },
    ]);
    const saleId = cod.body.id;
    await ok(`/sales/${saleId}/installments`, cashierToken2, {
      offlineUuid: randomUUID(),
      cashSessionId: session2.id,
      amount: 2600,
      method: "card",
      cardLast4: "5678",
      approvalCode: "AP2",
    });
    const payment = await db.payment.findFirstOrThrow({
      where: { saleId, entryType: "installment" },
    });
    expect(payment.cashSessionId).toBe(session2.id);
    const cardBefore1 = Number((await sessionRow(session.id)).differenceCard);

    const noReason = await call(
      `/payments/${payment.id}/move-cash-session`,
      owner,
      {
        cashSessionId: session.id,
      },
    );
    expect(noReason.status).toBe(400);
    const denied = await call(
      `/payments/${payment.id}/move-cash-session`,
      sellerToken,
      { cashSessionId: session.id, reason: "QA: intento de la cajera" },
    );
    expect(denied.status).toBeGreaterThanOrEqual(400);
    // Misma caja: nada que mover.
    const same = await call(
      `/payments/${payment.id}/move-cash-session`,
      owner,
      {
        cashSessionId: session2.id,
        reason: "QA: misma caja",
      },
    );
    expect(same.status).toBe(400);
    // Caja inexistente.
    const ghost = await call(
      `/payments/${payment.id}/move-cash-session`,
      owner,
      {
        cashSessionId: randomUUID(),
        reason: "QA: caja que no existe",
      },
    );
    expect(ghost.status).toBeGreaterThanOrEqual(400);

    await ok(`/payments/${payment.id}/move-cash-session`, owner, {
      cashSessionId: session.id,
      reason: "QA: el voucher pertenece a la caja de la cajera 1",
    });
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .cashSessionId,
    ).toBe(session.id);
    // La caja 1 ya estaba cerrada: su tarjeta esperada subió y quedó avisada.
    const c1 = await sessionRow(session.id);
    expect(Number(c1.expectedCard)).toBeGreaterThanOrEqual(2600);
    expect(Number(c1.differenceCard)).not.toBe(cardBefore1);
    expect(
      (await alertsOf(session.id)).some((a: any) =>
        a.key.endsWith(`:move:${payment.id}`),
      ),
    ).toBe(true);
    expect(
      await db.auditLog.count({
        where: { action: "payment_cash_session_moved", entityId: payment.id },
      }),
    ).toBe(1);
  });
});

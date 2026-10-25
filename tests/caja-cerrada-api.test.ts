// Revisión pesada 25-oct, #4 y #6, contra la API real y PostgreSQL:
// - #4: descartar una venta sin conexión «con la mercancía entregada» registra
//   la venta REAL por la ruta normal con lo que el servidor guardó al
//   sincronizar (no lo que manda el navegador), o se rechaza sin mover nada.
// - #6: lo que cambia una caja ya cerrada (venta sin conexión, método
//   corregido, anulación) pide justificación, queda en la bitácora y deja una
//   alerta que sólo ve la dueña; si entra tarjeta sin lote, «falta lote».
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
const ip = "198.18.47." + ((Date.now() % 250) + 1);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const MANAGER_PIN = "234567"; // gerente del seed (apps/api/prisma/seed.ts)
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
  return { status: r.status, body: await r.json() };
}
async function ok(path: string, token: string, data?: unknown) {
  const r = await call(path, token, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function enroll(token: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA caja cerrada " + id.slice(0, 6),
    secret: "qa-cc-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}

let owner = "",
  manager = "",
  cashierToken = "",
  cashierId = "",
  customerId = "",
  productId = "",
  variantId = "";
let session: any;

const stock = async () =>
  Number(
    (await db.variant.findUniqueOrThrow({ where: { id: variantId } })).stock,
  );
const setStock = async (qty: number) => {
  const delta = qty - (await stock());
  if (delta)
    await ok("/inventory/adjustments", owner, {
      variantId,
      qty: delta,
      reason: "QA caja cerrada: existencias",
    });
};
const offlineSale = (extra: Record<string, unknown> = {}) => ({
  offlineUuid: randomUUID(),
  capturedAt: new Date().toISOString(),
  customerId,
  cashSessionId: session.id,
  items: [{ variantId, qty: 1, discountPercent: 0 }],
  globalDiscount: 0,
  expectedTotal: 1000,
  payments: [{ method: "cash", amount: 1000 }],
  ...extra,
});
// Lo que la caja del navegador manda: se altera para probar que no cuenta.
const browserDetail = {
  receiptNumber: "LOCAL-qa-cc",
  total: 5000,
  items: [{ name: "QA", variantId: "", qty: 2 }],
  payments: [{ method: "cash", amount: 5000 }],
};
const discard = (offlineUuid: string, token: string, extra = {}) =>
  call("/sales/offline-review/discard", token, {
    offlineUuid,
    reason: "QA: el cliente se llevó la mercancía",
    outcome: "delivered",
    detail: {
      ...browserDetail,
      items: [{ ...browserDetail.items[0], variantId }],
    },
    ...extra,
  });
const alertOpen = async (offlineUuid: string) =>
  (await db.alert.findUnique({ where: { key: "offline:" + offlineUuid } }))
    ?.status !== "resolved";

beforeAll(async () => {
  owner = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: demo,
    })
  ).accessToken;
  await enroll(owner);
  manager = (
    await ok("/auth/login", "", {
      email: "gerente@fitstore.demo",
      password: demo,
    })
  ).accessToken;
  await enroll(manager);
  const roles = await ok("/roles", owner);
  const email = `qa-cc-${tag}@example.test`;
  cashierId = (
    await ok("/users", owner, {
      name: "QA Cajera caja cerrada " + tag,
      email,
      password: "583907",
      pin: "135792",
      roleId: roles.find((r: any) => r.name === "seller").id,
    })
  ).id;
  cashierToken = (
    await ok("/auth/change-password", "", {
      login: email,
      currentPassword: "583907",
      newPassword: "649283",
      confirmPassword: "649283",
    })
  ).accessToken;
  await enroll(cashierToken);
  session = await ok("/cash-sessions/open", cashierToken, {
    openingAmount: 0,
  });
  customerId = (await ok("/customers", owner, { name: "QA CC " + tag })).id;
  const categories = await ok("/categories", owner);
  const product = await ok("/products", owner, {
    name: "QA caja cerrada " + tag,
    sku: "QA-CC-" + tag,
    categoryId: categories.find((c: any) => c.name === "Fajas").id,
    taxRate: 18,
    variants: [
      {
        sku: "QA-CCV-" + tag,
        barcode: "QA-CCB-" + tag,
        price: 1000,
        costAvg: 400,
      },
    ],
  });
  productId = product.id;
  variantId = product.variants[0].id;
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

describe("#4 · venta sin conexión descartada con la mercancía entregada", () => {
  it("registra la venta real (ITBIS, pago, inventario) con los datos del servidor, no con los del navegador", async () => {
    await setStock(0);
    const sale = offlineSale();
    const synced = await ok("/sales/sync", cashierToken, { sales: [sale] });
    expect(synced.results[0].status).toBe("conflict");
    await setStock(3);
    const movementsBefore = await db.cashMovement.count({
      where: { sessionId: session.id },
    });
    const done = await discard(sale.offlineUuid, cashierToken, {
      managerPin: MANAGER_PIN,
    });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    expect(done.body.sale?.number).toBeTruthy();
    const real = await db.sale.findUniqueOrThrow({
      where: { id: done.body.sale.id },
      include: { items: true, payments: true },
    });
    // Lo que guardó el servidor: 1 unidad y RD$ 1,000 (el navegador decía 2).
    expect(real).toMatchObject({
      status: "completed",
      sellerId: cashierId,
      cashSessionId: session.id,
      customerId,
    });
    expect(Number(real.total)).toBe(1000);
    expect(Number(real.taxTotal)).toBeGreaterThan(0);
    expect(real.items.map((i: any) => Number(i.qty))).toEqual([1]);
    expect(real.payments.map((p: any) => [p.method, Number(p.amount)])).toEqual(
      [["cash", 1000]],
    );
    expect(await stock()).toBe(2);
    // Sin ajuste de inventario ni entrada de caja aparte.
    expect(
      await db.inventoryMovement.count({
        where: { refId: sale.offlineUuid, type: "adjustment" },
      }),
    ).toBe(0);
    expect(
      await db.cashMovement.count({ where: { sessionId: session.id } }),
    ).toBe(movementsBefore);
    expect(await alertOpen(sale.offlineUuid)).toBe(false);
    // La copia que quedó en la cola del equipo ya no se registra otra vez.
    const again = await ok("/sales/sync", cashierToken, { sales: [sale] });
    expect(again.results[0]).toMatchObject({
      status: "conflict",
      discarded: true,
    });
    expect(await stock()).toBe(2);
  });

  it("si el pago guardado no cubre el precio de hoy, se rechaza y no se mueve nada", async () => {
    await setStock(0);
    const sale = offlineSale();
    await ok("/sales/sync", cashierToken, { sales: [sale] });
    await setStock(3);
    await db.variant.update({
      where: { id: variantId },
      data: { price: 1500 },
    });
    try {
      const done = await discard(sale.offlineUuid, cashierToken, {
        managerPin: MANAGER_PIN,
      });
      expect(done.status, JSON.stringify(done.body)).toBe(400);
      expect(await stock()).toBe(3);
      expect(await alertOpen(sale.offlineUuid)).toBe(true);
      expect(
        await db.auditLog.count({
          where: {
            action: "offline_sale_discarded",
            entityId: sale.offlineUuid,
          },
        }),
      ).toBe(0);
    } finally {
      await db.variant.update({
        where: { id: variantId },
        data: { price: 1000 },
      });
    }
  });

  it("un gerente no la registra en la caja de otra persona; sí puede descartarla como devuelta", async () => {
    await setStock(0);
    const sale = offlineSale();
    await ok("/sales/sync", cashierToken, { sales: [sale] });
    await setStock(3);
    const done = await discard(sale.offlineUuid, manager);
    expect(done.status, JSON.stringify(done.body)).toBe(400);
    expect(await stock()).toBe(3);
    expect(await alertOpen(sale.offlineUuid)).toBe(true);
    const returned = await discard(sale.offlineUuid, manager, {
      outcome: "returned",
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    expect(await stock()).toBe(3);
  });
});

describe("#6 · cambios en una caja ya cerrada", () => {
  it("venta sin conexión, método corregido y anulación: justificación, bitácora y alerta para la dueña; «falta lote» si entra tarjeta", async () => {
    await setStock(5);
    const online = await ok("/sales", cashierToken, {
      ...offlineSale(),
      capturedAt: undefined,
    });
    const late = offlineSale();
    const cash = (await ok("/cash-sessions", owner)).find(
      (c: any) => c.id === session.id,
    );
    // Sin tarjeta no se pide lote.
    await ok("/cash-sessions/" + session.id + "/close", owner, {
      countedCash: cash.expected.cash,
      countedCard: 0,
      countedTransfer: 0,
      delivered: 0,
    });
    // 1) La venta capturada antes del cierre no entra sola a la caja cerrada.
    const synced = await ok("/sales/sync", cashierToken, { sales: [late] });
    expect(synced.results[0].status).toBe("conflict");
    expect(synced.results[0].message).toMatch(/ya cerró/);
    let closed = await db.cashSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(Number(closed.differenceCash)).toBe(0);
    // Gerencia la registra desde la revisión, con su justificación.
    const done = await discard(late.offlineUuid, cashierToken, {
      managerPin: MANAGER_PIN,
      reason: "QA: se cobró antes del cierre y el internet no volvió",
    });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    closed = await db.cashSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(Number(closed.differenceCash)).toBe(-1000);
    const lateSale = await db.sale.findUniqueOrThrow({
      where: { id: done.body.sale.id },
    });
    const alerts = async () =>
      db.alert.findMany({
        where: { entityId: session.id, type: "cash_after_close" },
      });
    let found = await alerts();
    expect(found.map((a: any) => a.key)).toContain(
      `cash-after-close:${session.id}:${lateSale.id}`,
    );
    expect(found[0].message).toMatch(/se cobró antes del cierre/);
    expect(
      await db.auditLog.count({
        where: { action: "offline_after_close", entityId: session.id },
      }),
    ).toBe(1);

    // 2) Corregir el método con la caja cerrada: alerta y «falta lote».
    const payment = (
      await db.payment.findMany({ where: { saleId: online.id } })
    )[0];
    const noReason = await call(
      `/sales/${online.id}/payments/${payment.id}/correct-method`,
      owner,
      { method: "card" },
    );
    expect(noReason.status).toBe(400);
    await ok(
      `/sales/${online.id}/payments/${payment.id}/correct-method`,
      owner,
      { method: "card", reason: "QA: fue con tarjeta, se marcó efectivo" },
    );
    found = await alerts();
    const corrected = found.find(
      (a: any) =>
        a.key === `cash-after-close:${session.id}:method:${payment.id}`,
    );
    expect(corrected?.message).toMatch(/fue con tarjeta/);
    const batch = await db.alert.findUnique({
      where: { key: "card-batch-missing:" + session.id },
    });
    expect(batch).toMatchObject({ type: "card_batch_missing", status: "new" });
    expect(
      await db.auditLog.count({
        where: { action: "payment_method_corrected", entityId: online.id },
      }),
    ).toBe(1);

    // 3) Anular después del cierre: alerta con el motivo.
    await ok("/sales/" + online.id + "/void", owner, {
      reason: "QA: anulación después del cierre",
    });
    found = await alerts();
    expect(
      found.find(
        (a: any) =>
          a.key === `cash-after-close:${session.id}:void:${online.id}`,
      )?.message,
    ).toMatch(/anulación después del cierre/);
    const voidLog = await db.auditLog.findFirstOrThrow({
      where: { action: "void_after_close", entityId: session.id },
    });
    expect((voidLog.after as any).reason).toMatch(/anulación después/);

    // Las ve la dueña («*»); el gerente no.
    const ownerAlerts = await ok("/alerts?type=cash_after_close", owner);
    expect(ownerAlerts.some((a: any) => a.entityId === session.id)).toBe(true);
    const managerAlerts = await ok("/alerts?type=cash_after_close", manager);
    expect(managerAlerts.some((a: any) => a.entityId === session.id)).toBe(
      false,
    );
  });
});

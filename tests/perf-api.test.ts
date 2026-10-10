// Prueba de carga con un año de historial (rama claude/perf-apertura), contra
// la API compilada como tests/api.test.ts:
// - GET /cash-sessions: todas las cajas abiertas + las cerradas recientes, el
//   esperado de todas con consultas agrupadas (no tres consultas por caja) y
//   el cierre ciego intacto: la cajera nunca recibe el esperado.
// - La actividad de la sesión se escribe como mucho una vez por minuto.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cashExpected } from "../apps/api/src/cash";

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
const suffix = Date.now().toString(36);
const ip = "198.18.9." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "FitStore-QA-Perf-2026!";
const PASSWORD = "FitStore-QA-Perf-Definitiva-2026!";

async function request(path: string, as: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function ok(path: string, as: string, data?: unknown) {
  const r = await request(path, as, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let admin = "",
  manager = "",
  adminCash: any,
  customerId = "",
  variantId = "",
  productId = "";
const cashier = { id: "", token: "", cash: null as any };
const fakeSessionIds: string[] = [];

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA perf " + label + " " + suffix,
    secret: "qa-perf-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
  return id;
}
const sale = (token: string, cashId: string, payments: any[], total = 300) =>
  ok("/sales", token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: cashId,
    items: [{ variantId, qty: 1 }],
    payments,
    expectedTotal: total,
  });

beforeAll(async () => {
  const login = (email: string) =>
    ok("/auth/login", "", { email, password: DEMO }).then(
      (r: any) => r.accessToken,
    );
  admin = await login("admin@fitstore.demo");
  manager = await login("gerente@fitstore.demo");
  await terminal(admin, "dueña");
  customerId = (await ok("/customers", admin, { name: "QA perf " + suffix }))
    .id;
  const categoryId = (await ok("/categories", admin)).find(
    (c: any) => c.name === "Ropa deportiva",
  ).id;
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", admin, {
    name: "QA perf " + suffix,
    sku: "QAP-" + tag,
    categoryId,
    variants: [
      { sku: "QAP-V-" + tag, barcode: "QAP-B-" + tag, price: 300, costAvg: 10 },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", admin, {
    variantId,
    qty: 50,
    reason: "QA perf apertura",
  });
  adminCash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-perf-admin-" + suffix,
    openingAmount: 2000,
  });
  const roles = await ok("/roles", admin);
  const email = `qa-perf-${suffix}@example.test`;
  const user = await ok("/users", admin, {
    name: "QA perf cajera " + suffix,
    email,
    password: TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  const changed = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: TEMPORARY,
    newPassword: PASSWORD,
    confirmPassword: PASSWORD,
  });
  cashier.id = user.id;
  cashier.token = changed.accessToken;
  await terminal(cashier.token, "cajera");
  cashier.cash = await ok("/cash-sessions/open", cashier.token, {
    registerId: "qa-perf-cajera-" + suffix,
    openingAmount: 1000,
  });
  // Movimientos de dinero variados en las dos cajas.
  await sale(cashier.token, cashier.cash.id, [{ method: "cash", amount: 300 }]);
  const byCard = await sale(cashier.token, cashier.cash.id, [
    { method: "card", amount: 300, cardLast4: "4242", approvalCode: "QP1" },
  ]);
  await ok("/cash-sessions/" + cashier.cash.id + "/movements", cashier.token, {
    type: "in",
    amount: 150,
    reason: "QA perf cambio",
  });
  await ok("/cash-sessions/" + cashier.cash.id + "/movements", cashier.token, {
    type: "out",
    amount: 40,
    reason: "QA perf mensajero",
  });
  await sale(admin, adminCash.id, [{ method: "cash", amount: 300 }]);
  // Devolución en la caja de la administradora de una venta de la cajera.
  await ok("/returns", admin, {
    operationId: randomUUID(),
    saleId: byCard.id,
    cashSessionId: adminCash.id,
    reason: "QA perf devolución",
    refundMethod: "card",
    items: [{ saleItemId: byCard.items[0].id, qty: 1, restock: true }],
  });
}, 120000);

afterAll(async () => {
  if (fakeSessionIds.length)
    await db.cashSession.deleteMany({ where: { id: { in: fakeSessionIds } } });
  for (const [cash, token] of [
    [cashier.cash, admin],
    [adminCash, admin],
  ] as const)
    if (cash) {
      const listed = (await ok("/cash-sessions", token)).find(
        (s: any) => s.id === cash.id,
      );
      if (listed && !listed.closedAt)
        await request("/cash-sessions/" + cash.id + "/close", token, {
          countedCash: Math.max(0, listed.expected.cash),
          countedCard: Math.max(0, listed.expected.card),
          countedTransfer: Math.max(0, listed.expected.transfer),
          notes: "QA perf cierre",
        });
    }
  if (productId)
    await fetch(base + "/products/" + productId, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + admin,
      },
      body: JSON.stringify({ active: false }),
    });
  await db.$disconnect();
});

describe("GET /cash-sessions con historial", () => {
  it("gerencia: el esperado agrupado coincide con cashExpected en todas las cajas listadas", async () => {
    for (const token of [manager, admin]) {
      const list = await ok("/cash-sessions", token);
      expect(list.length).toBeGreaterThan(0);
      const mine = list.find((s: any) => s.id === cashier.cash.id);
      // 1000 de fondo + 300 en efectivo + 150 − 40; 300 en tarjeta.
      expect(mine.expected).toMatchObject({
        cash: 1410,
        card: 300,
        transfer: 0,
      });
      expect(mine.expected.movements).toHaveLength(2);
      // La devolución por tarjeta resta en la caja que la procesó.
      expect(
        list.find((s: any) => s.id === adminCash.id).expected,
      ).toMatchObject({ cash: 2300, card: -300, transfer: 0 });
      const rows = await db.cashSession.findMany({
        where: { id: { in: list.map((s: any) => s.id) } },
      });
      for (const s of list) {
        const row = rows.find((r: any) => r.id === s.id);
        const reference = await cashExpected(db, row);
        expect(
          {
            cash: s.expected.cash,
            card: s.expected.card,
            transfer: s.expected.transfer,
            movements: s.expected.movements.map((m: any) => m.id).sort(),
          },
          s.id,
        ).toEqual({
          cash: reference.cash,
          card: reference.card,
          transfer: reference.transfer,
          movements: reference.movements.map((m: any) => m.id).sort(),
        });
        // Mismo contrato que antes: nombre del equipo y campos de caja.
        expect(s).toHaveProperty("registerName");
        expect(s).toHaveProperty("expectedCash");
        expect(s).toHaveProperty("differences");
      }
    }
  });

  it("cajera: sólo sus cajas y nunca el esperado (cierre ciego)", async () => {
    const list = await ok("/cash-sessions", cashier.token);
    expect(list.map((s: any) => s.id)).toContain(cashier.cash.id);
    for (const s of list) {
      expect(s.userId).toBe(cashier.id);
      for (const key of [
        "expected",
        "expectedCash",
        "expectedCard",
        "expectedTransfer",
        "difference",
        "differenceCash",
        "differenceCard",
        "differenceTransfer",
        "differences",
      ])
        expect(s, key).not.toHaveProperty(key);
    }
    const own = list.find((s: any) => s.id === cashier.cash.id);
    expect(own.registerName).toBe("QA perf cajera " + suffix);
  });

  it("lista todas las abiertas aunque haya más de 100 cerradas más nuevas, y como mucho 100 cerradas", async () => {
    const day = 86400000;
    // Una caja abierta olvidada hace tres años (de otra persona) y 101
    // cerradas de la cajera de hace dos.
    const forgotten = randomUUID();
    fakeSessionIds.push(forgotten);
    const closed = Array.from({ length: 101 }, (_, i) => ({
      id: randomUUID(),
      registerId: "qa-perf-hist-" + suffix,
      userId: cashier.id,
      openingAmount: 0,
      openedAt: new Date(Date.now() - 730 * day + i * 60000),
      closedAt: new Date(Date.now() - 730 * day + i * 60000 + 3600000),
      expectedCash: 0,
      countedCash: 0,
      branchId: "main",
    }));
    fakeSessionIds.push(...closed.map((c) => c.id));
    await db.cashSession.createMany({
      data: [
        {
          id: forgotten,
          registerId: "qa-perf-olvidada-" + suffix,
          // Una sola caja abierta por persona: la olvidada es de otra.
          userId: randomUUID(),
          openingAmount: 0,
          openedAt: new Date(Date.now() - 1095 * day),
          branchId: "main",
        },
        ...closed,
      ],
    });
    for (const token of [cashier.token, manager]) {
      const list = await ok("/cash-sessions", token);
      const ids = list.map((s: any) => s.id);
      if (token === manager) expect(ids).toContain(forgotten);
      else expect(ids).not.toContain(forgotten);
      expect(ids).toContain(cashier.cash.id);
      expect(list.filter((s: any) => s.closedAt).length).toBeLessThanOrEqual(
        100,
      );
      // Orden: apertura más reciente primero, como antes.
      const opened = list.map((s: any) => new Date(s.openedAt).getTime());
      expect(opened).toEqual([...opened].sort((a, b) => b - a));
    }
    await db.cashSession.deleteMany({ where: { id: { in: fakeSessionIds } } });
    fakeSessionIds.length = 0;
  });
});

describe("Actividad de sesión", () => {
  it("una petición no reescribe la actividad reciente; pasada un minuto, sí", async () => {
    const me = await ok("/auth/me", cashier.token);
    expect(me.id).toBe(cashier.id);
    const sessions = await db.authSession.findMany({
      where: { userId: cashier.id },
    });
    expect(sessions.length).toBeGreaterThan(0);
    const recent = new Date(Date.now() - 10_000);
    await db.authSession.updateMany({
      where: { userId: cashier.id },
      data: { lastActivityAt: recent },
    });
    await ok("/auth/me", cashier.token);
    await ok("/cash-sessions", cashier.token);
    for (const s of await db.authSession.findMany({
      where: { userId: cashier.id },
    }))
      expect(s.lastActivityAt.getTime()).toBe(recent.getTime());
    const old = new Date(Date.now() - 120_000);
    await db.authSession.updateMany({
      where: { userId: cashier.id },
      data: { lastActivityAt: old },
    });
    const before = Date.now();
    await ok("/auth/me", cashier.token);
    const touched = await db.authSession.findMany({
      where: { userId: cashier.id },
    });
    expect(
      touched.some((s: any) => s.lastActivityAt.getTime() >= before - 1000),
    ).toBe(true);
  });
});

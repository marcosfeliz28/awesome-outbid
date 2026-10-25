// Pago en dólares (dueña, 25-oct). Contra la API real: el cliente paga en
// US$ en efectivo, la venta guarda el equivalente en pesos a la tasa de
// Configuración y el cuadre espera esos dólares en la gaveta de US$, no en la
// de pesos. Una diferencia en dólares pide justificación y PIN como en pesos.
import { conClave } from "./setup/con-clave";
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
const suffix = Date.now().toString(36);
const ip = "198.18.11." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const CASHIER_TEMPORARY = "583904";
const CASHIER_PASSWORD = "739205";
const STRONG_TEMPORARY = "FitStore-QA-Dolar-2026!";
const STRONG_PASSWORD = "FitStore-QA-Dolar-Definitiva-2026!";
const MANAGER_PIN = "864209";
const RATE = 61.4158;

async function request(
  path: string,
  as: string,
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined
      ? {}
      : { body: JSON.stringify(conClave(path, data)) }),
  });
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* texto */
  }
  return { status: r.status, body };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let owner = "",
  cajera = "",
  customerId = "",
  variantId = "",
  productId = "",
  settingsBefore: any = null;
const created: string[] = [];
const T1 = randomUUID();

async function enroll(token: string, id: string, name: string) {
  const t = await ok("/terminals/register", token, {
    id,
    name,
    secret: "qa-dolar-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}
async function person(label: string, role: string, pin: string) {
  const roles = await ok("/roles", owner);
  const email = `qa-dolar-${label}-${suffix}@example.test`;
  const seller = role === "seller";
  const temporary = seller ? CASHIER_TEMPORARY : STRONG_TEMPORARY;
  const password = seller ? CASHIER_PASSWORD : STRONG_PASSWORD;
  const user = await ok("/users", owner, {
    name: `QA dólar ${label} ${suffix}`,
    email,
    password: temporary,
    pin,
    roleId: roles.find((r: any) => r.name === role).id,
  });
  created.push(user.id);
  return (
    await ok("/auth/change-password", "", {
      login: email,
      currentPassword: temporary,
      newPassword: password,
      confirmPassword: password,
    })
  ).accessToken as string;
}
const setRate = (usdRate: number | null) =>
  ok("/settings", owner, { ...settingsBefore, usdRate }, "PUT");
const openCash = () =>
  ok("/cash-sessions/open", cajera, {
    openingAmount: 0,
    openingNote: "QA: fondo de la prueba de dólares",
    managerPin: MANAGER_PIN,
  });
const sale = (cashSessionId: string, payments: unknown[]) =>
  request("/sales", cajera, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId,
    items: [{ variantId, qty: 1 }],
    payments,
    expectedTotal: 2500,
  });
const close = (id: string, body: Record<string, unknown>) =>
  request("/cash-sessions/" + id + "/close", cajera, {
    countedCard: 0,
    countedTransfer: 0,
    notes: "QA cierre con dólares",
    ...body,
  });
// US$ 40 a 61.4158 = RD$ 2,456.632 → 2,456.63 (al centavo).
const usd = (amountUsd: number, amount: number, usdRate = RATE) => ({
  method: "cash",
  currency: "USD",
  amountUsd,
  usdRate,
  amount,
});

beforeAll(async () => {
  owner = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await enroll(owner, randomUUID(), "QA dueña dólares " + suffix);
  const { logo: _logo, ...settings } = await ok("/settings", owner);
  void _logo;
  settingsBefore = settings;
  await setRate(RATE);
  customerId = (await ok("/customers", owner, { name: "QA dólar " + suffix }))
    .id;
  const cats = await ok("/categories", owner);
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA dólar " + suffix,
    sku: "QUS-" + tag,
    categoryId: cats.find((c: any) => c.name === "Suplementos").id,
    taxRate: 0,
    variants: [
      {
        sku: "QUS-V-" + tag,
        barcode: "QUS-B-" + tag,
        price: 2500,
        costAvg: 1000,
      },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", owner, {
    variantId,
    qty: 50,
    reason: "QA pago en dólares",
    lotNumber: "QUS-" + tag,
    expiryDate: new Date(Date.now() + 300 * 86400000).toISOString(),
  });
  cajera = await person("cajera", "seller", "792461");
  await person("gerente", "manager", MANAGER_PIN);
  await enroll(cajera, T1, "Caja dólares " + suffix);
}, 120000);

afterAll(async () => {
  if (settingsBefore)
    await request(
      "/settings",
      owner,
      { ...settingsBefore, usdRate: settingsBefore.usdRate ?? null },
      "PUT",
    );
  const open = (await request("/cash-sessions", owner)).body;
  for (const s of Array.isArray(open) ? open : [])
    if (!s.closedAt && created.includes(s.userId))
      await request("/cash-sessions/" + s.id + "/close", owner, {
        countedCash: 0,
        countedCard: 0,
        countedTransfer: 0,
        notes: "Cierre de limpieza de la prueba de dólares",
        differenceReason: "QA: cierre de limpieza de la prueba",
      });
  if (productId)
    await request("/products/" + productId, owner, { active: false }, "PATCH");
  for (const id of created)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("pago en dólares en efectivo", () => {
  it("(a) RD$ 2,500 pagado con US$ 40 + pesos: el cuadre espera US$ 40 y no los pesos", async () => {
    const cash = await openCash();
    // US$ 40 = RD$ 2,456.63; el cliente da RD$ 100 más y recibe RD$ 56.63.
    const r = await sale(cash.id, [
      usd(40, 2456.63),
      { method: "cash", amount: 100 },
    ]);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const rows = await db.payment.findMany({
      where: { saleId: r.body.id },
      orderBy: { createdAt: "asc" },
    });
    const dollar = rows.find((p: any) => p.currency === "USD");
    expect(dollar).toBeTruthy();
    expect(Number(dollar.amountUsd)).toBe(40);
    expect(Number(dollar.usdRate)).toBe(RATE);
    expect(Number(dollar.tendered)).toBe(2456.63);
    // La venta suma RD$ 2,500 en pesos: totales y reportes no cambian.
    expect(
      rows.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    ).toBeCloseTo(2500, 2);
    // En la gaveta de pesos: 100 − 56.63 de cambio = 43.37.
    const closed = await close(cash.id, {
      countedCash: 43.37,
      countedUsd: 40,
      delivered: 43.37,
    });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    const cuadre = await ok("/cash-sessions/" + cash.id + "/cuadre", owner);
    expect(cuadre.foreign.usd).toMatchObject({
      expected: 40,
      counted: 40,
      difference: 0,
    });
    expect(cuadre.cashCheck).toMatchObject({ expected: 43.37, difference: 0 });
    expect(cuadre.descuadre).toBeNull();
    // Cierre ciego: la cajera no recibe lo esperado en dólares.
    const own = await ok("/cash-sessions/" + cash.id + "/cuadre", cajera);
    expect(own.foreign.usd.expected).toBeUndefined();
    expect(own.foreign.usd.counted).toBe(40);
  });

  it("(b) declarar US$ 58.30 sin ventas en dólares pide justificación y PIN", async () => {
    const cash = await openCash();
    const r = await sale(cash.id, [{ method: "cash", amount: 2500 }]);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const body = { countedCash: 2500, countedUsd: 58.3, delivered: 2500 };
    const noPin = await close(cash.id, body);
    expect(noPin.status).toBe(400);
    expect(JSON.stringify(noPin.body)).toMatch(/dólares/i);
    const noReason = await close(cash.id, { ...body, managerPin: MANAGER_PIN });
    expect(noReason.status).toBe(400);
    expect(JSON.stringify(noReason.body)).toMatch(/justificación/i);
    const done = await close(cash.id, {
      ...body,
      managerPin: MANAGER_PIN,
      differenceReason: "QA: dólares que no son de ventas del turno",
    });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    const cuadre = await ok("/cash-sessions/" + cash.id + "/cuadre", owner);
    expect(cuadre.foreign.usd).toMatchObject({
      expected: 0,
      counted: 58.3,
      difference: 58.3,
    });
    expect(cuadre.descuadre).toMatchObject({ usd: 58.3, cash: 0 });
    expect(cuadre.descuadre.usdApprovedBy).toBeTruthy();
  });

  it("(c) venta mixta US$ + tarjeta", async () => {
    const cash = await openCash();
    // US$ 20 = RD$ 1,228.32; el resto, RD$ 1,271.68, con tarjeta.
    const r = await sale(cash.id, [
      usd(20, 1228.32),
      {
        method: "card",
        amount: 1271.68,
        cardLast4: "4242",
        approvalCode: "QA-USD-" + suffix,
      },
    ]);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const closed = await close(cash.id, {
      countedCash: 0,
      countedCard: 1271.68,
      countedUsd: 20,
      delivered: 0,
      batchNumber: "QA-LOTE-1",
    });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    const cuadre = await ok("/cash-sessions/" + cash.id + "/cuadre", owner);
    expect(cuadre.foreign.usd).toMatchObject({ expected: 20, difference: 0 });
    expect(cuadre.salesByMethod.card).toBe(1271.68);
    expect(cuadre.cashCheck).toMatchObject({ expected: 0, difference: 0 });
    expect(cuadre.descuadre).toBeNull();
  });

  it("(d) sin tasa configurada o con otra tasa, el pago en dólares se rechaza", async () => {
    const cash = await openCash();
    const changed = await sale(cash.id, [
      usd(40, 2400, 60),
      { method: "cash", amount: 100 },
    ]);
    expect(changed.status).toBe(400);
    expect(JSON.stringify(changed.body)).toMatch(/tasa del dólar cambió/i);
    await setRate(null);
    try {
      const r = await sale(cash.id, [
        usd(40, 2456.63),
        { method: "cash", amount: 100 },
      ]);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toMatch(/tasa del dólar/i);
    } finally {
      await setRate(RATE);
    }
    const closed = await close(cash.id, { countedCash: 0, delivered: 0 });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
  });
});

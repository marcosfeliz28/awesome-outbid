// Dueña (25-oct): la aprobación con PIN de gerente siempre es de OTRA persona.
// Contra la API real: un gerente no aprueba con su propio PIN un descuento
// (venta a crédito sobre el umbral), el descuadre de su propia caja ni el
// efectivo «Recibido por la dueña»; con el PIN de otro gerente sí.
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
const ip = "198.18.31." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const PASSWORD = "FitStore-QA-PinOtra-2026!";
const PIN_A = "271828";
const PIN_B = "314159";
const SELF = /otra persona con permiso/;

async function request(
  path: string,
  as: string,
  data?: unknown,
  method?: string,
) {
  const r = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
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

type Person = { id: string; token: string; cash: any };
let owner = "",
  customerId = "",
  variantId = "",
  productId = "",
  originalSettings: any;
let a: Person, b: Person;
const created: string[] = [];

async function person(label: string, pin: string): Promise<Person> {
  const roles = await ok("/roles", owner);
  const email = `qa-pinotra-${label}-${suffix}@example.test`;
  const user = await ok("/users", owner, {
    name: `QA PIN ${label} ${suffix}`,
    email,
    password: PASSWORD + "t",
    pin,
    roleId: roles.find((r: any) => r.name === "manager").id,
  });
  created.push(user.id);
  const token = (
    await ok("/auth/change-password", "", {
      login: email,
      currentPassword: PASSWORD + "t",
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    })
  ).accessToken;
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA PIN " + label + " " + suffix,
    secret: "qa-pinotra-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
  const cash = await ok("/cash-sessions/open", token, {
    openingAmount: 1000,
    openingNote: "QA: fondo de la prueba",
  });
  return { id: user.id, token, cash };
}
const futureDay = new Date(Date.now() + 15 * 86400000).toISOString();

beforeAll(async () => {
  owner = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  const id = randomUUID();
  const t = await ok("/terminals/register", owner, {
    id,
    name: "QA PIN dueña " + suffix,
    secret: "qa-pinotra-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
  originalSettings = await ok("/settings", owner);
  // Crédito sobre RD$ 100 exige PIN a todos (también a gerencia).
  await ok(
    "/settings",
    owner,
    {
      ...originalSettings,
      allowCreditSales: true,
      creditApprovalThreshold: 100,
    },
    "PUT",
  );
  customerId = (
    await ok("/customers", owner, { name: "QA PIN otra " + suffix })
  ).id;
  const cats = await ok("/categories", owner);
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA PIN otra " + suffix,
    sku: "QPO-" + tag,
    categoryId: cats.find((c: any) => c.name === "Fajas").id,
    taxRate: 0,
    variants: [
      { sku: "QPO-V-" + tag, barcode: "QPO-B-" + tag, price: 100, costAvg: 40 },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", owner, {
    variantId,
    qty: 100,
    reason: "QA PIN otra",
  });
  a = await person("a", PIN_A);
  b = await person("b", PIN_B);
}, 180000);

afterAll(async () => {
  for (const who of [a, b].filter(Boolean))
    await request("/cash-sessions/" + who.cash.id + "/close", owner, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de PIN",
      differenceReason: "QA: cierre de limpieza de la prueba",
    });
  if (originalSettings)
    await request("/settings", owner, originalSettings, "PUT");
  if (productId)
    await request("/products/" + productId, owner, { active: false }, "PATCH");
  for (const id of created)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("PIN de gerente: siempre de otra persona (dueña, 25-oct)", () => {
  it("descuento del 50 % a crédito: el PIN propio no aprueba; el de otro gerente sí", async () => {
    const sell = (managerPin: string) =>
      request("/sales", a.token, {
        offlineUuid: randomUUID(),
        customerId,
        cashSessionId: a.cash.id,
        items: [{ variantId, qty: 4 }],
        globalDiscount: 50,
        discountReason: "QA: descuento con aprobación",
        payments: [{ method: "credit", amount: 200 }],
        creditDueDate: futureDay,
        expectedTotal: 200,
        managerPin,
      });
    const own = await sell(PIN_A);
    expect(own.status, JSON.stringify(own.body)).toBe(400);
    expect(own.body.message).toMatch(SELF);
    // Cuenta como intento fallido: el aviso no da intentos gratis.
    const attempt = await db.authAttempt.findUnique({
      where: { key: "approval:" + a.id },
    });
    expect(attempt.failedAttempts).toBe(1);
    const other = await sell(PIN_B);
    expect(other.status, JSON.stringify(other.body)).toBe(201);
    const row = await db.sale.findUnique({ where: { id: other.body.id } });
    expect(row.discountApprovedBy).toBe(b.id);
    expect(row.discountRule).toBe("manager_pin");
  });

  it("descuento sobre el límite en efectivo: el gerente no se lo aprueba solo", async () => {
    const sell = (managerPin?: string) =>
      request("/sales", a.token, {
        offlineUuid: randomUUID(),
        customerId,
        cashSessionId: a.cash.id,
        items: [{ variantId, qty: 1 }],
        globalDiscount: 50,
        discountReason: "QA: descuento de gerente",
        payments: [{ method: "cash", amount: 50 }],
        expectedTotal: 50,
        ...(managerPin ? { managerPin } : {}),
      });
    expect((await sell()).status).toBe(400);
    const own = await sell(PIN_A);
    expect(own.status, JSON.stringify(own.body)).toBe(400);
    expect(own.body.message).toMatch(SELF);
    const other = await sell(PIN_B);
    expect(other.status, JSON.stringify(other.body)).toBe(201);
    const row = await db.sale.findUnique({ where: { id: other.body.id } });
    expect(row.discountApprovedBy).toBe(b.id);
  });

  it("vale de caja en su propia caja: el gerente no cubre su faltante solo", async () => {
    const close = (managerPin?: string) =>
      request("/cash-sessions/" + b.cash.id + "/close", b.token, {
        countedCash: 900,
        countedCard: 0,
        countedTransfer: 0,
        vouchers: 100,
        notes: "QA: vale de caja de prueba",
        ...(managerPin ? { managerPin } : {}),
      });
    expect((await close()).status).toBe(400);
    const own = await close(PIN_B);
    expect(own.status, JSON.stringify(own.body)).toBe(400);
    expect(own.body.message).toMatch(SELF);
    const other = await close(PIN_A);
    expect(other.status, JSON.stringify(other.body)).toBe(201);
  });

  it("efectivo «Recibido por la dueña»: el PIN propio no aprueba; el de otro gerente sí", async () => {
    const s = (
      await ok("/sales", a.token, {
        offlineUuid: randomUUID(),
        customerId,
        cashSessionId: a.cash.id,
        items: [{ variantId, qty: 1 }],
        payments: [{ method: "cod", amount: 100 }],
        expectedTotal: 100,
      })
    ).id;
    const collect = (managerPin: string) =>
      request("/sales/" + s + "/credit-collections", a.token, {
        operationId: randomUUID(),
        cashSessionId: a.cash.id,
        managerPin,
        lines: [{ method: "cash", amount: 100, ownerConfirmed: true }],
      });
    const own = await collect(PIN_A);
    expect(own.status, JSON.stringify(own.body)).toBe(400);
    expect(own.body.message).toMatch(SELF);
    const other = await collect(PIN_B);
    expect(other.status, JSON.stringify(other.body)).toBeLessThan(300);
    const payment = await db.payment.findFirst({
      where: { saleId: s, entryType: "installment" },
    });
    expect(payment.receivedById).toBe(b.id);
  });

  it("descuadre al cerrar su propia caja: sin PIN o con el propio no cierra; con el de otro gerente sí", async () => {
    const close = (managerPin?: string) =>
      request("/cash-sessions/" + a.cash.id + "/close", a.token, {
        countedCash: 1150,
        countedCard: 0,
        countedTransfer: 0,
        notes: "QA cierre con sobrante",
        differenceReason: "QA: sobrante de prueba en la gaveta",
        ...(managerPin ? { managerPin } : {}),
      });
    const none = await close();
    expect(none.status, JSON.stringify(none.body)).toBe(400);
    expect(none.body.message).toMatch(/no cuadra/);
    const own = await close(PIN_A);
    expect(own.status, JSON.stringify(own.body)).toBe(400);
    expect(own.body.message).toMatch(SELF);
    const other = await close(PIN_B);
    expect(other.status, JSON.stringify(other.body)).toBe(201);
    const row = await db.cashSession.findUnique({ where: { id: a.cash.id } });
    expect((row.closeDetails as any).cashApprovedBy).toBe(b.id);
  });
});

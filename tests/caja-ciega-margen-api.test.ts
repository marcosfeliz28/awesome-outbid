// Revisión pesada del 25-oct (#5, #7, #8, #9, #10), contra la API real:
// #5 el cierre ciego no se adivina reintentando; #7 la devolución en efectivo
// desde la caja abierta de otra persona pide otra aprobación; #8 una sola
// fórmula de margen (precio − costo)/precio sin restar ITBIS; #9 «Corregir
// método de pago» ajusta el incentivo; #10 una venta sin envío no lleva
// mensajero.
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
const ip = "198.18.32." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const PASSWORD = "FitStore-QA-CajaCiega-2026!";
const PIN_M = "161803";
const PIN_C1 = "141421";
const PIN_C2 = "173205";

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
  categoryId = "",
  variantId = "",
  originalSettings: any;
let manager: Person, c1: Person, c2: Person;
const products: string[] = [];
const created: string[] = [];

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA caja ciega " + label + " " + suffix,
    secret: "qa-cajaciega-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}
async function person(
  label: string,
  role: string,
  pin: string,
): Promise<Person> {
  const roles = await ok("/roles", owner);
  const email = `qa-cajaciega-${label}-${suffix}@example.test`;
  // La contraseña de una cajera son 6 números.
  const [temporary, password] =
    role === "seller" ? ["739205", "583904"] : [PASSWORD + "t", PASSWORD];
  const user = await ok("/users", owner, {
    name: `QA Caja ${label} ${suffix}`,
    email,
    password: temporary,
    pin,
    roleId: roles.find((r: any) => r.name === role).id,
  });
  created.push(user.id);
  const token = (
    await ok("/auth/change-password", "", {
      login: email,
      currentPassword: temporary,
      newPassword: password,
      confirmPassword: password,
    })
  ).accessToken;
  await terminal(token, label);
  const cash = await ok("/cash-sessions/open", token, {
    openingAmount: 1000,
    openingNote: "QA: fondo de la prueba",
  });
  return { id: user.id, token, cash };
}
async function product(price: number, cost: number, taxRate: number) {
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA caja ciega " + tag + " " + suffix,
    sku: "QCC-" + tag,
    categoryId,
    taxRate,
    variants: [
      { sku: "QCC-V-" + tag, barcode: "QCC-B-" + tag, price, costAvg: cost },
    ],
  });
  products.push(p.id);
  await ok("/inventory/adjustments", owner, {
    variantId: p.variants[0].id,
    qty: 50,
    reason: "QA caja ciega",
  });
  return p;
}
const sell = (
  who: { token: string; cash: any },
  payments: any[],
  extra: Record<string, unknown> = {},
  item = variantId,
) =>
  ok("/sales", who.token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: who.cash.id,
    items: [{ variantId: item, qty: 1 }],
    payments,
    ...extra,
  });

beforeAll(async () => {
  const login = await ok("/auth/login", "", {
    email: "admin@fitstore.demo",
    password: DEMO,
  });
  owner = login.accessToken;
  await terminal(owner, "dueña");
  originalSettings = await ok("/settings", owner);
  // Sin PIN por umbral en la contraentrega de estas pruebas.
  await ok(
    "/settings",
    owner,
    { ...originalSettings, creditApprovalThreshold: 100000 },
    "PUT",
  );
  customerId = (
    await ok("/customers", owner, { name: "QA caja ciega " + suffix })
  ).id;
  categoryId = (await ok("/categories", owner)).find(
    (c: any) => c.name === "Fajas",
  ).id;
  variantId = (await product(100, 40, 0)).variants[0].id;
  manager = await person("gerente", "manager", PIN_M);
  c1 = await person("cajera1", "seller", PIN_C1);
  c2 = await person("cajera2", "seller", PIN_C2);
}, 180000);

afterAll(async () => {
  for (const who of [manager, c2].filter(Boolean))
    await request("/cash-sessions/" + who.cash.id + "/close", owner, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de caja ciega",
      differenceReason: "QA: cierre de limpieza de la prueba",
    });
  if (originalSettings)
    await request("/settings", owner, originalSettings, "PUT");
  for (const id of products)
    await request("/products/" + id, owner, { active: false }, "PATCH");
  for (const id of created)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("#5 cierre ciego: no se adivina reintentando", () => {
  it("después de 2 intentos que no cuadran, cerrar pide justificación y PIN de otra persona, aunque el conteo cuadre", async () => {
    const close = (countedCash: number, extra: Record<string, unknown> = {}) =>
      request("/cash-sessions/" + c1.cash.id + "/close", c1.token, {
        countedCash,
        countedCard: 0,
        countedTransfer: 0,
        notes: "",
        ...extra,
      });
    await sell(c1, [{ method: "cash", amount: 100 }]);
    for (const counted of [900, 950]) {
      const r = await close(counted);
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      expect(r.body.message).toMatch(/caja no cuadra con el sistema/);
    }
    // Tercer intento con el monto exacto (fondo 1000 + venta 100) y con otro:
    // la misma respuesta, así no revela cuál era el bueno.
    const exact = await close(1100);
    const wrong = await close(1200);
    expect(exact.status, JSON.stringify(exact.body)).toBe(400);
    expect(wrong.status).toBe(400);
    expect(exact.body.message).toMatch(/2 intentos/);
    expect(exact.body.message).toBe(wrong.body.message);
    expect(exact.body.message).not.toMatch(/\d{3,}/);
    const counter = await db.authAttempt.findUnique({
      where: { key: "cash-close:" + c1.cash.id },
    });
    expect(counter.failedAttempts).toBeGreaterThanOrEqual(2);
    // Con PIN pero sin justificación tampoco.
    const noReason = await close(1100, { managerPin: PIN_M });
    expect(noReason.status).toBe(400);
    expect(noReason.body.message).toMatch(/justificación/);
    // La cajera no se aprueba con su propio PIN.
    const own = await close(1100, {
      managerPin: PIN_C1,
      differenceReason: "QA: conté mal dos veces la gaveta",
    });
    expect(own.status).toBe(400);
    const done = await close(1100, {
      managerPin: PIN_M,
      differenceReason: "QA: conté mal dos veces la gaveta",
    });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    const row = await db.cashSession.findUnique({ where: { id: c1.cash.id } });
    expect(
      (row.closeDetails as any).failedCloseAttempts,
    ).toBeGreaterThanOrEqual(2);
    expect((row.closeDetails as any).attemptsApprovedBy).toBe(manager.id);
    expect((row.closeDetails as any).differenceReason).toMatch(/conté mal/);
  });
});

describe("#7 devolución en efectivo desde la caja de otra persona", () => {
  it("el gerente necesita el PIN de otra persona (la dueña de la caja sirve); el suyo no", async () => {
    const sale = await sell(c2, [{ method: "cash", amount: 100 }]);
    const back = (managerPin?: string) =>
      request("/returns", manager.token, {
        saleId: sale.id,
        cashSessionId: c2.cash.id,
        reason: "QA devolución desde otra caja",
        refundMethod: "cash",
        items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
        ...(managerPin ? { managerPin } : {}),
      });
    const none = await back();
    expect(none.status, JSON.stringify(none.body)).toBe(400);
    expect(none.body.message).toMatch(/caja es de otra persona/);
    const own = await back(PIN_M);
    expect(own.status).toBe(400);
    expect(own.body.message).toMatch(/otra persona con permiso/);
    const cashier = await back(PIN_C2);
    expect(cashier.status, JSON.stringify(cashier.body)).toBe(201);
    const log = await db.auditLog.findFirst({
      where: { action: "return", entityId: sale.id },
    });
    expect((log?.after as any)?.refundApprovedBy).toBe(c2.id);
  });

  it("la dueña («*») y la devolución desde la propia caja no piden PIN", async () => {
    const sale = await sell(c2, [{ method: "cash", amount: 100 }]);
    const r = await request("/returns", owner, {
      saleId: sale.id,
      cashSessionId: c2.cash.id,
      reason: "QA devolución de la dueña",
      refundMethod: "cash",
      items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const mine = await sell(manager, [{ method: "cash", amount: 100 }]);
    const own = await request("/returns", manager.token, {
      saleId: mine.id,
      cashSessionId: manager.cash.id,
      reason: "QA devolución en la caja propia",
      refundMethod: "cash",
      items: [{ saleItemId: mine.items[0].id, qty: 1, restock: true }],
    });
    expect(own.status, JSON.stringify(own.body)).toBe(201);
  });
});

describe("#8 margen: (precio − costo)/precio sin restar ITBIS", () => {
  it("tablero, utilidad por producto y alerta usan la misma fórmula", async () => {
    // Precio 1,180 con ITBIS 18 %, costo 900: margen de la dueña 23.73 %
    // (restando el ITBIS saldría 10 %).
    const p = await product(1180, 900, 18);
    const sale = await sell(
      manager,
      [{ method: "cash", amount: 1180 }],
      {},
      p.variants[0].id,
    );
    const day = "2020-01-15";
    await db.sale.update({
      where: { id: sale.id },
      data: { createdAt: new Date(day + "T16:00:00Z") },
    });
    const dash = await ok(`/dashboard/summary?from=${day}&to=${day}`, owner);
    expect(dash.margin).toBe(23.73);
    const report = await ok(`/reports/profit?from=${day}&to=${day}`, owner);
    const row = report.rows.find((r: any) => r.Producto === p.name);
    expect(row.Margen).toBe(23.73);
    await ok("/alerts/evaluate", owner, {});
    const alert = await db.alert.findUnique({
      where: { key: "margin:" + p.variants[0].id },
    });
    expect(alert?.status ?? "resolved").toBe("resolved");
  });
});

describe("#9 corregir método de pago ajusta el incentivo", () => {
  const earned = async (saleId: string) =>
    (await db.incentiveEntry.findMany({ where: { saleId } })).reduce(
      (s: number, e: any) => s + Number(e.amount),
      0,
    );
  it("efectivo → contraentrega deja el incentivo para el cobro; de vuelta a efectivo lo paga", async () => {
    const sale = await sell(manager, [{ method: "cash", amount: 100 }]);
    const full = await earned(sale.id);
    expect(full).toBeGreaterThan(0);
    const payment = await db.payment.findFirst({ where: { saleId: sale.id } });
    const correct = (method: string) =>
      ok(`/sales/${sale.id}/payments/${payment.id}/correct-method`, owner, {
        method,
        reason: "QA: método mal marcado",
      });
    await correct("cod");
    expect(await earned(sale.id)).toBe(0);
    expect(
      (await db.sale.findUnique({ where: { id: sale.id } }))
        .incentiveOnCollection,
    ).toBe(true);
    await correct("cash");
    expect(await earned(sale.id)).toBe(full);
  });
  it("contraentrega → efectivo paga el incentivo, y una devolución después lo descuenta", async () => {
    const sale = await sell(manager, [{ method: "cod", amount: 100 }]);
    expect(await earned(sale.id)).toBe(0);
    const payment = await db.payment.findFirst({ where: { saleId: sale.id } });
    await ok(`/sales/${sale.id}/payments/${payment.id}/correct-method`, owner, {
      method: "cash",
      reason: "QA: era efectivo",
    });
    expect(await earned(sale.id)).toBeGreaterThan(0);
    await ok("/returns", manager.token, {
      saleId: sale.id,
      cashSessionId: manager.cash.id,
      reason: "QA devolución después de corregir",
      refundMethod: "credit_note",
      items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    });
    expect(await earned(sale.id)).toBe(0);
  });
});

describe("#10 «Addison» sólo en ventas con envío", () => {
  it("una venta sin envío no guarda mensajero y la API ignora el nombre cuando no hay envío", async () => {
    const sale = await sell(manager, [{ method: "cash", amount: 100 }]);
    const row = await db.sale.findUnique({ where: { id: sale.id } });
    expect(row.courierName).toBeNull();
    // Ventas viejas con «Addison» y envío 0 (los datos no se tocan): la API
    // no las muestra como de mensajero.
    await db.sale.update({
      where: { id: sale.id },
      data: { courierName: "Addison" },
    });
    const list = await ok("/sales?search=" + sale.number, owner);
    const found = (list.items ?? list.data ?? list).find(
      (s: any) => s.id === sale.id,
    );
    expect(found.courierName).toBeNull();
    const withFee = await sell(
      manager,
      [
        {
          method: "card",
          amount: 100,
          cardLast4: "4242",
          approvalCode: "QA-ENVIO",
        },
      ],
      {
        courierFee: 150,
      },
    );
    expect(
      (await db.sale.findUnique({ where: { id: withFee.id } })).courierName,
    ).toBe("Addison");
  });
});

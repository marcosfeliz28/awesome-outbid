// Desglose del mes (T32): contra la API real y la base de pruebas con el seed.
// La suma de los cobros por método (efectivo, tarjeta, transferencia) debe ser igual a la
// venta bruta del período, con las devoluciones descontadas por la misma regla que «revenue»
// (D-05). Se crean una venta y una devolución en efectivo, y una venta y una devolución por
// transferencia, en el mismo mes.
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
const ip = "198.18.96." + ((Date.now() % 250) + 1);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const range = "from=2026-10-01&to=2026-10-31";

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
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* texto */
  }
  return { status: r.status, body };
}

let token = "";
let cashSessionId = "";
let customerId = "";
let variantId = "";
let price = 0;

beforeAll(async () => {
  token = (
    await call("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: demo,
    })
  ).body.accessToken;
  const id = randomUUID();
  const reg = await call("/terminals/register", token, {
    id,
    name: "QA desglose " + id.slice(0, 6),
    secret: "qa-desglose-" + id,
  });
  if (reg.body.status === "pending")
    await call("/terminals/" + id + "/approve", token, {});
  // Una sola caja abierta por persona: se cierra la que dejó una prueba anterior.
  await db.cashSession.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });
  cashSessionId = (
    await call("/cash-sessions/open", token, { openingAmount: 0 })
  ).body.id;
  customerId = (
    await call("/customers", token, { name: "QA desglose " + id.slice(0, 6) })
  ).body.id;
  const product = (await call("/products", token)).body.items.find(
    (x: any) => x.variants?.length && x.active,
  );
  variantId = product.variants[0].id;
  price = Number(product.variants[0].price);
}, 120000);

async function sale(method: "cash" | "transfer", qty = 2) {
  const body: any = {
    offlineUuid: randomUUID(),
    capturedAt: new Date().toISOString(),
    customerId,
    cashSessionId,
    items: [{ variantId, qty, discountPercent: 0 }],
    globalDiscount: 0,
    payments: [
      method === "cash"
        ? { method: "cash", amount: price * qty }
        : {
            method: "transfer",
            amount: price * qty,
            bank: "Banco QA",
            reference: "QA-DESG-" + randomUUID().slice(0, 8),
          },
    ],
  };
  const r = await call("/sales", token, body);
  expect(r.status).toBe(201);
  return r.body;
}

async function refund(saleBody: any, method: "cash" | "transfer") {
  if (method === "transfer") {
    const pid = (
      await db.payment.findFirstOrThrow({
        where: { saleId: saleBody.id, method: "transfer" },
      })
    ).id;
    expect((await call("/payments/" + pid + "/verify", token, {})).status).toBe(
      201,
    );
  }
  const r = await call("/returns", token, {
    operationId: randomUUID(),
    saleId: saleBody.id,
    cashSessionId,
    reason: "QA desglose " + method,
    refundMethod: method,
    items: [
      {
        saleItemId: saleBody.items[0].id,
        qty: 1,
        restock: true,
        opened: false,
      },
    ],
  });
  expect(r.status).toBe(201);
  return r.body;
}

afterAll(async () => {
  await db.$disconnect();
});

describe("desglose del mes: cobros = venta bruta con devoluciones (D-05)", () => {
  it("cuadra por método después de ventas y devoluciones en efectivo y transferencia", async () => {
    const before = (await call("/dashboard/breakdown?" + range, token)).body;
    const cash = await sale("cash");
    await refund(cash, "cash");
    const tr = await sale("transfer");
    await refund(tr, "transfer");
    const bd = (await call("/dashboard/breakdown?" + range, token)).body;
    const sum = bd.payments.reduce((a: number, p: any) => a + p.amount, 0);
    // Una devolución de una unidad resta el precio de una unidad: 2 vendidas − 1 devuelta.
    expect(bd.revenue - before.revenue).toBe(price * 2);
    expect(sum).toBe(bd.revenue);
    const sm = (await call("/dashboard/summary?" + range, token)).body;
    const smSum = sm.payments.reduce((a: number, p: any) => a + p.amount, 0);
    expect(smSum).toBe(sm.revenue);
  });
});

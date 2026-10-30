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
const now = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const range = `from=${now.slice(0, 8)}01&to=${now}`;
const byMethod = (bd: any) => {
  const m: Record<string, number> = {};
  for (const p of bd.payments) m[p.method] = (m[p.method] ?? 0) + p.amount;
  return m;
};

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
  // La variante con más existencia: las corridas repetidas en la misma base no la agotan.
  const v = await db.variant.findFirstOrThrow({
    where: { active: true, product: { active: true } },
    orderBy: { stock: "desc" },
  });
  variantId = v.id;
  price = Number(v.price);
}, 120000);

async function sale(
  method: "cash" | "transfer" | "credit",
  qty = 2,
  bank = "Banco QA",
) {
  const body: any = {
    offlineUuid: randomUUID(),
    capturedAt: new Date().toISOString(),
    customerId,
    cashSessionId,
    items: [{ variantId, qty, discountPercent: 0 }],
    globalDiscount: 0,
    ...(method === "credit" ? { managerPin: "234567" } : {}),
    payments: [
      method === "cash"
        ? { method: "cash", amount: price * qty }
        : method === "credit"
          ? { method: "cod", amount: price * qty }
          : {
              method: "transfer",
              amount: price * qty,
              bank,
              reference: "QA-DESG-" + randomUUID().slice(0, 8),
            },
    ],
  };
  const r = await call("/sales", token, body);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
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
    // El resumen no trae «sin cobro registrado» (ventas sin pago que dejan otras corridas).
    const sm = (await call("/dashboard/summary?" + range, token)).body;
    const smSum = sm.payments.reduce((a: number, p: any) => a + p.amount, 0);
    expect(sm.revenue - smSum).toBeCloseTo(byMethod(bd).unrecorded ?? 0, 1);
  });

  it("incluye lo no cobrado: crédito, transferencia sin verificar y sin cobro; la identidad cuadra", async () => {
    const before = (await call("/dashboard/breakdown?" + range, token)).body;
    const b0 = byMethod(before);
    await sale("credit");
    const tr = await sale("transfer"); // queda pending_verification
    const cash = await sale("cash", 3);
    await refund(cash, "cash");
    // Venta sin fila de pago (importada): se quitan sus cobros en la base.
    const orphan = await sale("cash", 1);
    await db.payment.deleteMany({ where: { saleId: orphan.id } });
    const bd = (await call("/dashboard/breakdown?" + range, token)).body;
    const b1 = byMethod(bd);
    const delta = (k: string) => (b1[k] ?? 0) - (b0[k] ?? 0);
    expect(delta("credit")).toBeCloseTo(price * 2, 1);
    expect(delta("transfer_pending")).toBeCloseTo(price * 2, 1);
    expect(delta("unrecorded")).toBeCloseTo(price, 1);
    expect(delta("cash")).toBeCloseTo(price * 2, 1); // 3 vendidas − 1 devuelta
    // Identidad: todos los renglones juntos = venta bruta del mes (API de totales).
    const sum = bd.payments.reduce((a: number, p: any) => a + p.amount, 0);
    expect(sum).toBeCloseTo(bd.revenue, 1);
    expect(bd.revenue - before.revenue).toBeCloseTo(price * 7, 1);
    void tr;
  });

  it("separa los cobros por banco sin romper la identidad (transferencias de otros bancos)", async () => {
    const byBank = (bd: any) => {
      const m: Record<string, number> = {};
      for (const p of bd.payments)
        if (p.bank) m[p.bank] = (m[p.bank] ?? 0) + p.amount;
      return m;
    };
    const tag = randomUUID().slice(0, 6);
    const before = (await call("/dashboard/breakdown?" + range, token)).body;
    await sale("transfer", 2, "Banco A " + tag);
    await sale("transfer", 1, "Banco A " + tag);
    await sale("transfer", 3, "Banco B " + tag);
    const bd = (await call("/dashboard/breakdown?" + range, token)).body;
    const [b0, b1] = [byBank(before), byBank(bd)];
    expect(b1["Banco A " + tag]).toBeCloseTo(price * 3, 1);
    expect(b1["Banco B " + tag]).toBeCloseTo(price * 3, 1);
    // Los bancos juntos suman lo que subió la transferencia (por verificar) en el método.
    const m0 = byMethod(before),
      m1 = byMethod(bd);
    const bankDelta = Object.keys(b1).reduce(
      (a, k) => a + (b1[k] - (b0[k] ?? 0)),
      0,
    );
    expect(bankDelta).toBeCloseTo(
      (m1.transfer ?? 0) -
        (m0.transfer ?? 0) +
        ((m1.transfer_pending ?? 0) - (m0.transfer_pending ?? 0)),
      1,
    );
    const sum = bd.payments.reduce((a: number, p: any) => a + p.amount, 0);
    expect(sum).toBeCloseTo(bd.revenue, 1);
  });
});

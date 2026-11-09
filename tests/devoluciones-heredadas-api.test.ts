// Devoluciones heredadas (SaleReturn con items vacío): el dashboard descuenta su costo y su
// total; /reports/profit debe restarlos también (fila «Devoluciones sin detalle») para que
// costo y utilidad cuadren entre dashboard e informe. Contra la API real y la base de pruebas.
// Se compara la BRECHA dashboard − informe antes y después de cada caso (no depende de lo que
// dejen otras pruebas el mismo día).
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
const ip = "198.18.97." + ((Date.now() % 250) + 1);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const range = `?from=${today}&to=${today}`;
const suffix = Date.now().toString(36);

async function call(path: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

let token = "";
let cashSessionId = "";
let customerId = "";
let adminId = "";
let variant: any;

beforeAll(async () => {
  token = (
    await call("/auth/login", {
      email: "admin@fitstore.demo",
      password: demo,
    })
  ).body.accessToken;
  adminId = (
    await db.user.findFirstOrThrow({ where: { email: "admin@fitstore.demo" } })
  ).id;
  const id = randomUUID();
  const reg = await call("/terminals/register", {
    id,
    name: "QA heredadas " + id.slice(0, 6),
    secret: "qa-heredadas-" + id,
  });
  if (reg.body.status === "pending")
    await call("/terminals/" + id + "/approve", {});
  // Una sola caja abierta por persona: se cierra la que dejó una prueba anterior.
  await db.cashSession.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });
  cashSessionId = (
    await call("/cash-sessions/open", {
      openingAmount: 0,
      openingNote: "QA: fondo de la prueba",
    })
  ).body.id;
  customerId = (
    await call("/customers", { name: "QA heredadas " + id.slice(0, 6) })
  ).body.id;
  variant = await db.variant.findFirstOrThrow({
    where: { active: true, product: { active: true } },
    orderBy: { stock: "desc" },
  });
}, 120000);

afterAll(async () => {
  // Las devoluciones fabricadas aquí se borran: no deben descuadrar otras pruebas del día.
  await db.saleReturn.deleteMany({
    where: { number: { startsWith: "NC-HER-" + suffix } },
  });
  await db.cashSession.update({
    where: { id: cashSessionId },
    data: { closedAt: new Date() },
  });
  await db.$disconnect();
});

async function sale() {
  const price = Number(variant.price);
  const r = await call("/sales", {
    offlineUuid: randomUUID(),
    capturedAt: new Date().toISOString(),
    customerId,
    cashSessionId,
    items: [{ variantId: variant.id, qty: 1, discountPercent: 0 }],
    globalDiscount: 0,
    payments: [{ method: "cash", amount: price }],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}

// Devolución heredada de la venta completa: antes de la corrección por línea, sólo totales y
// items vacío. Lleva el total, el ITBIS y el costo de su venta, como una devolución real.
let n = 0;
async function legacyReturn(saleBody: any) {
  const s = await db.sale.findUniqueOrThrow({ where: { id: saleBody.id } });
  await db.saleReturn.create({
    data: {
      saleId: s.id,
      number: `NC-HER-${suffix}-${n++}`,
      reason: "Heredada",
      total: s.total,
      taxTotal: s.taxTotal,
      costTotal: s.costTotal,
      refundAmount: s.total,
      refundMethod: "cash",
      cashSessionId,
      userId: adminId,
      items: [],
    },
  });
  return { total: Number(s.total), cost: Number(s.costTotal) };
}

async function lineReturn(saleBody: any) {
  const r = await call("/returns", {
    operationId: randomUUID(),
    saleId: saleBody.id,
    cashSessionId,
    reason: "QA heredadas por línea",
    refundMethod: "cash",
    items: [
      {
        saleItemId: saleBody.items[0].id,
        qty: 1,
        restock: true,
        opened: false,
      },
    ],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
}

// Brecha dashboard − informe (costo y utilidad) y la fila de heredadas del informe.
async function snapshot() {
  const dash = (await call("/dashboard/summary" + range)).body;
  const rows: any[] = (await call("/reports/profit" + range)).body.rows;
  const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k]), 0);
  const legacy = rows.find((r) => r.Producto === "Devoluciones sin detalle");
  return {
    gapCost: dash.costTotal - sum("Costo"),
    gapProfit: dash.grossProfit - sum("Utilidad"),
    legacy: { Ventas: legacy?.Ventas ?? 0, Costo: legacy?.Costo ?? 0 },
  };
}

describe("utilidad por producto vs dashboard con devoluciones heredadas", () => {
  it("sin devoluciones heredadas nuevas: la brecha y la fila no cambian", async () => {
    const before = await snapshot();
    await lineReturn(await sale());
    const after = await snapshot();
    expect(after.gapCost).toBeCloseTo(before.gapCost, 1);
    expect(after.gapProfit).toBeCloseTo(before.gapProfit, 1);
    expect(after.legacy).toEqual(before.legacy);
  });

  it("2 devoluciones heredadas: el informe las resta y la brecha no crece", async () => {
    const before = await snapshot();
    const a = await legacyReturn(await sale());
    const b = await legacyReturn(await sale());
    const after = await snapshot();
    // La fila de heredadas baja exactamente lo devuelto (ventas con ITBIS y costo).
    expect(after.legacy.Ventas - before.legacy.Ventas).toBeCloseTo(
      -(a.total + b.total),
      1,
    );
    expect(after.legacy.Costo - before.legacy.Costo).toBeCloseTo(
      -(a.cost + b.cost),
      1,
    );
    // Y el dashboard y el informe siguen cuadrando como antes.
    expect(after.gapCost).toBeCloseTo(before.gapCost, 1);
    expect(after.gapProfit).toBeCloseTo(before.gapProfit, 1);
  });

  it("mixto: una heredada y una devolución por líneas cuadran juntas", async () => {
    const before = await snapshot();
    const a = await legacyReturn(await sale());
    await lineReturn(await sale());
    const after = await snapshot();
    expect(after.legacy.Costo - before.legacy.Costo).toBeCloseTo(-a.cost, 1);
    expect(after.gapCost).toBeCloseTo(before.gapCost, 1);
    expect(after.gapProfit).toBeCloseTo(before.gapProfit, 1);
  });
});

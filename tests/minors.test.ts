// Regresiones de los «menores» de la cola (COLA_HALLAZGOS_NEXORA y
// AUDITORIA_FINAL_DINERO D-06 a D-08). Corre contra la API compilada, como
// tests/api.test.ts, con su propia caja, equipo y productos.
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
const ExcelJS = requireApi("exceljs");
const db = new PrismaClient();

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "192.0.2." + ((Date.now() % 250) + 1);
let token = "";
let customerId = "";
let categoryId = "";
let cash: any;
const productIds: string[] = [];
const foreignCategoryIds: string[] = [];

async function request(path: string, data?: unknown, method?: string) {
  const r = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function ok(path: string, data?: unknown, method?: string) {
  const r = await request(path, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function product(label: string, price = 100, stock = 20) {
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", {
    name: "QA menores " + label + " " + suffix,
    sku: "QAM-" + tag,
    categoryId,
    variants: [
      { sku: "QAM-V-" + tag, barcode: "QAM-B-" + tag, price, costAvg: 10 },
    ],
  });
  productIds.push(p.id);
  if (stock)
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: stock,
      reason: "QA apertura menores",
    });
  return p.variants[0];
}
const sale = (variantId: string, total: number, payments: any[], extra = {}) =>
  ok("/sales", {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: cash.id,
    items: [{ variantId, qty: 1 }],
    payments,
    expectedTotal: total,
    ...extra,
  });
const expectedCash = async () =>
  (await ok("/cash-sessions")).find((s: any) => s.id === cash.id).expected;
async function importCatalog(rows: unknown[][], format?: (ws: any) => void) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Productos");
  ws.addRow(["Nombre", "SKU", "ID categoría", "Código", "Precio", "Costo"]);
  rows.forEach((r) => ws.addRow(r));
  format?.(ws);
  const form = new FormData();
  form.set("file", new Blob([await wb.xlsx.writeBuffer()]), "productos.xlsx");
  const r = await fetch(base + "/products/import", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "X-Forwarded-For": ip },
    body: form,
  });
  return { status: r.status, body: await r.json() };
}

beforeAll(async () => {
  token = (
    await ok("/auth/login", {
      email: "admin@fitstore.demo",
      password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
    })
  ).accessToken;
  const id = randomUUID();
  const t = await ok("/terminals/register", {
    id,
    name: "QA menores " + suffix,
    secret: "qa-secret-" + id,
  });
  if (t.status === "pending") await ok("/terminals/" + id + "/approve", {});
  customerId = (await ok("/customers", { name: "QA menores " + suffix })).id;
  categoryId = (await ok("/categories")).find(
    (c: any) => c.name === "Ropa deportiva",
  ).id;
  cash = await ok("/cash-sessions/open", {
    registerId: "qa-menores-" + suffix,
    openingAmount: 0,
  });
});
afterAll(async () => {
  if (cash) {
    const e = await expectedCash();
    await request("/cash-sessions/" + cash.id + "/close", {
      countedCash: Math.max(0, e.cash),
      countedCard: Math.max(0, e.card),
      countedTransfer: Math.max(0, e.transfer),
      notes: "Cierre de pruebas menores",
    });
  }
  for (const id of productIds)
    await request("/products/" + id, { active: false }, "PATCH");
  if (foreignCategoryIds.length)
    await db.category.deleteMany({ where: { id: { in: foreignCategoryIds } } });
  await db.$disconnect();
});

describe("Menores de la cola", () => {
  it("1: una merma o devolución a proveedor con cantidad positiva es un 400 y no suma stock", async () => {
    const v = await product("merma", 100, 10);
    for (const type of ["waste", "supplier_return"]) {
      const r = await request("/inventory/adjustments", {
        variantId: v.id,
        qty: 3,
        reason: "QA merma con signo equivocado",
        type,
      });
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/negativa/);
    }
    expect(
      Number((await ok("/products/" + v.productId)).variants[0].stock),
    ).toBe(10);
    // Con el signo correcto sigue funcionando; el ajuste libre admite ambos.
    await ok("/inventory/adjustments", {
      variantId: v.id,
      qty: -2,
      reason: "QA merma correcta",
      type: "waste",
    });
    await ok("/inventory/adjustments", {
      variantId: v.id,
      qty: 1,
      reason: "QA ajuste positivo",
    });
    expect(
      Number((await ok("/products/" + v.productId)).variants[0].stock),
    ).toBe(9);
  });

  it("2: el importador rechaza una categoría de otra sucursal o inexistente", async () => {
    const foreign = await db.category.create({
      data: { name: "QA otra sucursal " + suffix, branchId: "otra-" + suffix },
    });
    foreignCategoryIds.push(foreign.id);
    for (const cat of [foreign.id, randomUUID()]) {
      const tag = randomUUID().slice(0, 8);
      const r = await importCatalog([
        [
          "QA importado ajeno " + tag,
          "QAI-" + tag,
          cat,
          "QAI-B-" + tag,
          50,
          20,
        ],
      ]);
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/categoría/i);
      expect(await db.product.count({ where: { sku: "QAI-" + tag } })).toBe(0);
    }
    // POST /products aplica la misma regla.
    const tag = randomUUID().slice(0, 8);
    const r = await request("/products", {
      name: "QA ajeno " + tag,
      sku: "QAJ-" + tag,
      categoryId: foreign.id,
      variants: [
        { sku: "QAJ-V-" + tag, barcode: "QAJ-B-" + tag, price: 1, costAvg: 1 },
      ],
    });
    expect(r.status).toBe(400);
  });
});

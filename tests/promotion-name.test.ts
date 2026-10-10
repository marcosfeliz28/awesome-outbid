// G15 · La promoción automática aplicada queda con su nombre en la línea de la
// venta, y el recibo PDF la nombra. Corre contra la API compilada, como
// tests/minors.test.ts, con su propia caja, equipo, producto y promoción.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

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
const ip = "192.0.2." + ((Date.now() % 250) + 1);
let token = "";
let cash: any;
let categoryId = "";
let customerId = "";
const productIds: string[] = [];
const promotionIds: string[] = [];

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
async function product(label: string, price = 1000) {
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", {
    name: "QA G15 " + label + " " + suffix,
    sku: "QAG15-" + tag,
    categoryId,
    variants: [
      { sku: "QAG15-V-" + tag, barcode: "QAG15-B-" + tag, price, costAvg: 10 },
    ],
  });
  productIds.push(p.id);
  await ok("/inventory/adjustments", {
    variantId: p.variants[0].id,
    qty: 10,
    reason: "QA G15",
  });
  return p;
}
// Texto real del PDF (PDFKit escribe cadenas hexadecimales en streams).
function pdfText(pdf: Buffer) {
  const raw = pdf.toString("latin1");
  const text: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const dictionary = raw.slice(Math.max(0, match.index! - 250), match.index);
    let content = Buffer.from(match[1], "latin1");
    if (dictionary.includes("/FlateDecode")) {
      try {
        content = inflateSync(content);
      } catch {
        continue;
      }
    }
    for (const hex of content.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      text.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return text.join("");
}

beforeAll(async () => {
  const auth = await ok("/auth/login", {
    email: "admin@fitstore.demo",
    password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
  });
  token = auth.accessToken;
  const id = randomUUID();
  const t = await ok("/terminals/register", {
    id,
    name: "QA G15 " + suffix,
    secret: "qa-secret-" + id,
  });
  if (t.status === "pending") await ok("/terminals/" + id + "/approve", {});
  customerId = (await ok("/customers", { name: "QA G15 " + suffix })).id;
  categoryId = (await ok("/categories")).find(
    (c: any) => c.name === "Ropa deportiva",
  ).id;
  // Una caja de esta cuenta abierta en otro equipo (de otra corrida) impide
  // cobrar desde este: se cierra con lo esperado, como en las pruebas E2E.
  for (const open of (await ok("/cash-sessions")).filter(
    (s: any) => s.userId === auth.user.id && !s.closedAt,
  ))
    await ok("/cash-sessions/" + open.id + "/close", {
      countedCash: Math.max(0, open.expected.cash),
      countedCard: Math.max(0, open.expected.card),
      countedTransfer: Math.max(0, open.expected.transfer),
      notes: "Cierre previo de pruebas G15",
    });
  cash = await ok("/cash-sessions/open", {
    registerId: "qa-g15-" + suffix,
    openingAmount: 0,
  });
});
afterAll(async () => {
  if (cash) {
    const e = (await ok("/cash-sessions")).find(
      (s: any) => s.id === cash.id,
    ).expected;
    await request("/cash-sessions/" + cash.id + "/close", {
      countedCash: Math.max(0, e.cash),
      countedCard: Math.max(0, e.card),
      countedTransfer: Math.max(0, e.transfer),
      notes: "Cierre de pruebas G15",
    });
  }
  if (promotionIds.length)
    await db.promotion.updateMany({
      where: { id: { in: promotionIds } },
      data: { active: false },
    });
  for (const id of productIds)
    await request("/products/" + id, { active: false }, "PATCH");
  await db.$disconnect();
});

describe("G15 · promoción aplicada en la venta", () => {
  it("guarda el nombre de la promoción en la línea y el recibo PDF la nombra", async () => {
    const promoted = await product("con promoción");
    const plain = await product("sin promoción");
    const name = "Semana fit G15 " + suffix;
    const now = Date.now();
    const promo = await ok("/promotions", {
      name,
      type: "percent",
      value: 20,
      startsAt: new Date(now - 3600_000).toISOString(),
      endsAt: new Date(now + 3600_000).toISOString(),
      scope: { productId: promoted.id },
    });
    promotionIds.push(promo.id);
    // 1000 con 20 % = 800; la otra línea va sin descuento.
    const sale = await ok("/sales", {
      offlineUuid: randomUUID(),
      customerId,
      cashSessionId: cash.id,
      items: [
        { variantId: promoted.variants[0].id, qty: 1, discountPercent: 0 },
        { variantId: plain.variants[0].id, qty: 1, discountPercent: 0 },
      ],
      globalDiscount: 0,
      payments: [{ method: "cash", amount: 1800 }],
      expectedTotal: 1800,
    });
    const line = (variantId: string) =>
      sale.items.find((i: any) => i.variantId === variantId);
    expect(line(promoted.variants[0].id).promotionName).toBe(name);
    expect(line(plain.variants[0].id).promotionName ?? null).toBeNull();
    const rows = await db.saleItem.findMany({ where: { saleId: sale.id } });
    expect(
      rows.find((r: any) => r.variantId === promoted.variants[0].id)
        .promotionName,
    ).toBe(name);

    const pdf = await fetch(base + "/sales/" + sale.id + "/receipt.pdf", {
      headers: { Authorization: "Bearer " + token, "X-Forwarded-For": ip },
    });
    expect(pdf.status).toBe(200);
    const text = pdfText(Buffer.from(await pdf.arrayBuffer()));
    expect(text).toContain("Promoción: " + name);
    expect(text.match(/Promoción:/g)).toHaveLength(1);
  });

  it("si el descuento manual es mayor que la promoción, la línea no la nombra", async () => {
    const p = await product("manual mayor");
    const promo = await ok("/promotions", {
      name: "Promo menor G15 " + suffix,
      type: "percent",
      value: 5,
      startsAt: new Date(Date.now() - 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 3600_000).toISOString(),
      scope: { productId: p.id },
    });
    promotionIds.push(promo.id);
    const sale = await ok("/sales", {
      offlineUuid: randomUUID(),
      customerId,
      cashSessionId: cash.id,
      items: [{ variantId: p.variants[0].id, qty: 1, discountPercent: 10 }],
      globalDiscount: 0,
      discountReason: "QA G15 descuento manual",
      payments: [{ method: "cash", amount: 900 }],
      expectedTotal: 900,
    });
    expect(sale.items[0].promotionName ?? null).toBeNull();
  });
});

// CPC-2 · Al cerrar una caja con ventas en tarjeta se exige el lote del
// verifón; sin ventas en tarjeta no se pide nada. Contra la API real. Cada
// caso abre su propia caja con la dueña (administrador demo).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const ip = "198.18.8." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const suffix = Date.now().toString(36);

async function request(path: string, data?: unknown, token = owner) {
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
async function ok(path: string, data?: unknown, token = owner) {
  const r = await request(path, data, token);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let owner = "",
  customerId = "",
  variantId = "";

// Abre una caja, vende (en efectivo o con tarjeta) y devuelve el cuerpo base del cierre.
async function sessionWith(method: "cash" | "card") {
  const cash = await ok("/cash-sessions/open", {
    openingAmount: 0,
    openingNote: "QA: fondo de la prueba",
  });
  await ok("/sales", {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: cash.id,
    items: [{ variantId, qty: 1 }],
    payments: [
      {
        method,
        amount: 100,
        ...(method === "card"
          ? { cardLast4: "4242", approvalCode: "QA-" + suffix }
          : {}),
      },
    ],
    expectedTotal: 100,
  });
  return {
    id: cash.id as string,
    close: {
      countedCash: method === "cash" ? 100 : 0,
      countedCard: method === "card" ? 100 : 0,
      countedTransfer: 0,
      notes: "QA cierre lote",
    },
  };
}

beforeAll(async () => {
  owner = (
    await ok(
      "/auth/login",
      { email: "admin@fitstore.demo", password: DEMO },
      "",
    )
  ).accessToken;
  const terminal = randomUUID();
  const t = await ok("/terminals/register", {
    id: terminal,
    name: "QA lote " + suffix,
    secret: "qa-lote-" + terminal,
  });
  if (t.status === "pending")
    await ok("/terminals/" + terminal + "/approve", {});
  customerId = (await ok("/customers", { name: "QA lote " + suffix })).id;
  const cats = await ok("/categories");
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", {
    name: "QA lote " + suffix,
    sku: "QLV-" + tag,
    categoryId: cats[0].id,
    taxRate: 0,
    variants: [
      { sku: "QLV-V-" + tag, barcode: "QLV-B-" + tag, price: 100, costAvg: 40 },
    ],
  });
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", {
    variantId,
    qty: 50,
    reason: "QA lote verifón",
    lotNumber: "QLV-" + tag,
    expiryDate: new Date(Date.now() + 300 * 86400000).toISOString(),
  });
}, 120000);

afterAll(async () => {
  const open = (await request("/cash-sessions")).body;
  for (const s of Array.isArray(open)
    ? open.filter((x: any) => !x.closedAt)
    : [])
    await request("/cash-sessions/" + s.id + "/close", {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Limpieza de la prueba del lote",
      batchNumber: "QA-LIMPIEZA",
      differenceReason: "QA: cierre de limpieza de la prueba",
    });
}, 60000);

describe("CPC-2 · lote del verifón al cerrar caja", () => {
  it("sin ventas con tarjeta no se pide lote", async () => {
    const s = await sessionWith("cash");
    const r = await request("/cash-sessions/" + s.id + "/close", s.close);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const cuadre = await ok("/cash-sessions/" + s.id + "/cuadre");
    expect(cuadre.cardBatch).toBeNull();
  });

  it("con ventas con tarjeta y sin lote responde 400 en español", async () => {
    const s = await sessionWith("card");
    const r = await request("/cash-sessions/" + s.id + "/close", s.close);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("número de lote del verifón");
    // Un lote en blanco tampoco vale.
    const blank = await request("/cash-sessions/" + s.id + "/close", {
      ...s.close,
      batchNumber: "   ",
    });
    expect(blank.status).toBe(400);
    // Deja la caja cerrada para el caso siguiente (una sola caja por persona).
    const done = await request("/cash-sessions/" + s.id + "/close", {
      ...s.close,
      batchNumber: "000122",
    });
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  });

  it("con el lote cierra y el lote sale en el cuadre", async () => {
    const s = await sessionWith("card");
    const r = await request("/cash-sessions/" + s.id + "/close", {
      ...s.close,
      batchNumber: " 000123 ",
    });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const cuadre = await ok("/cash-sessions/" + s.id + "/cuadre");
    expect(cuadre.cardBatch).toEqual({ number: "000123", hasPhoto: false });
  });
});

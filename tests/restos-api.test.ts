// Restos de la auditoría 06 v2 contra la API real:
// - D-B6: vender o mover dinero en una caja recién cerrada dice «La caja ya
//   está cerrada» (409) en vez de «El registro no existe.» (404).
// - D-B11: GET /credit-notes pagina con cursor (y no carga todas las
//   devoluciones de la sucursal).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.6." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";

async function request(path: string, token: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    next: r.headers.get("x-next-cursor"),
  };
}
async function ok(path: string, token: string, data?: unknown) {
  const r = await request(path, token, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let admin = "",
  customerId = "",
  variantId = "",
  cash: any;

const sale = (payments: any[] = [{ method: "cash", amount: 300 }]) =>
  request("/sales", admin, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: cash.id,
    items: [{ variantId, qty: 1 }],
    payments,
    expectedTotal: 300,
  });

beforeAll(async () => {
  admin = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  const terminalId = randomUUID();
  const t = await ok("/terminals/register", admin, {
    id: terminalId,
    name: "QA restos " + suffix,
    secret: "qa-restos-" + terminalId,
  });
  if (t.status === "pending")
    await ok("/terminals/" + terminalId + "/approve", admin, {});
  customerId = (await ok("/customers", admin, { name: "QA restos " + suffix }))
    .id;
  const categoryId = (await ok("/categories", admin)).find(
    (c: any) => c.name === "Ropa deportiva",
  ).id;
  const tag = randomUUID().slice(0, 8);
  const product = await ok("/products", admin, {
    name: "QA restos " + suffix,
    sku: "QAR-" + tag,
    categoryId,
    variants: [
      { sku: "QAR-V-" + tag, barcode: "QAR-B-" + tag, price: 300, costAvg: 10 },
    ],
  });
  variantId = product.variants[0].id;
  await ok("/inventory/adjustments", admin, {
    variantId,
    qty: 50,
    reason: "QA restos",
  });
  cash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-restos-" + suffix,
    openingAmount: 1000,
  });
}, 60000);

afterAll(async () => {
  const listed = (await ok("/cash-sessions", admin)).find(
    (s: any) => s.id === cash?.id,
  );
  if (listed && !listed.closedAt)
    await request("/cash-sessions/" + cash.id + "/close", admin, {
      countedCash: Math.max(0, listed.expected.cash),
      countedCard: Math.max(0, listed.expected.card),
      countedTransfer: Math.max(0, listed.expected.transfer),
      notes: "QA restos",
    });
});

describe("D-B11 · GET /credit-notes paginado", () => {
  it("devuelve páginas con cursor, sin repetir notas, más recientes primero", async () => {
    const returned: string[] = [];
    for (let i = 0; i < 3; i++) {
      const sold = await sale();
      expect(sold.status).toBe(201);
      const r = await ok("/returns", admin, {
        saleId: sold.body.id,
        cashSessionId: cash.id,
        reason: "QA restos nota " + i,
        refundMethod: "credit_note",
        items: [{ saleItemId: sold.body.items[0].id, qty: 1, restock: true }],
      });
      returned.push(r.id);
    }
    const query = "/credit-notes?customerId=" + customerId;
    const all = await request(query, admin);
    expect(all.status).toBe(200);
    expect(all.body.map((n: any) => n.returnId)).toEqual(returned.reverse());
    expect(all.next).toBeNull();
    expect(all.body[0].number).toMatch(/^NC-/);
    expect(all.body[0].redemptionCode).toBeTruthy();
    expect(all.body[0].saleReturn).toBeUndefined();
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Awaited<ReturnType<typeof request>> = await request(
        query + "&limit=1" + (cursor ? "&cursor=" + cursor : ""),
        admin,
      );
      expect(page.status).toBe(200);
      expect(page.body).toHaveLength(1);
      seen.push(page.body[0].id);
      cursor = page.next;
      pages++;
    } while (cursor && pages < 10);
    expect(seen).toEqual(all.body.map((n: any) => n.id));
    expect(pages).toBe(3);
    expect((await request(query + "&limit=0", admin)).status).toBe(400);
    expect((await request(query + "&cursor=no", admin)).status).toBe(400);
  });
});

describe("D-B6 · caja recién cerrada", () => {
  it("una venta o un movimiento dicen «La caja ya está cerrada» (409), no 404", async () => {
    const listed = (await ok("/cash-sessions", admin)).find(
      (s: any) => s.id === cash.id,
    );
    await ok("/cash-sessions/" + cash.id + "/close", admin, {
      countedCash: Math.max(0, listed.expected.cash),
      countedCard: Math.max(0, listed.expected.card),
      countedTransfer: Math.max(0, listed.expected.transfer),
      notes: "QA restos cierre",
    });
    const late = await sale();
    expect(late.status).toBe(409);
    expect(late.body.message).toMatch(/La caja ya está cerrada/);
    const movement = await request(
      "/cash-sessions/" + cash.id + "/movements",
      admin,
      { type: "in", amount: 10, reason: "QA restos tardío" },
    );
    expect(movement.status).toBe(409);
    expect(movement.body.message).toMatch(/La caja ya está cerrada/);
    // Un id que no existe sigue siendo 404.
    const missing = await request(
      "/cash-sessions/" + randomUUID() + "/movements",
      admin,
      { type: "in", amount: 10, reason: "QA restos inexistente" },
    );
    expect(missing.status).toBe(404);
  });
});

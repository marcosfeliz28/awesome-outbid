// W9 · Pruebas que matan mutaciones de dinero que sobrevivían (auditoría 07 v2,
// §2.3), contra la API real: tolerancia del total esperado, tarjeta con un solo
// dato, descuento mayor que la línea, UUID de otra cajera, las cinco
// promociones, plazo de devolución por defecto, lote vencido y producto dañado
// que no vuelven al stock, abono mayor que la deuda al verificar, anulación con
// reembolso sin efectivo y cierre de caja con conteo inconsistente. Cada caso
// nombra la mutación (S02…) que debe matar. Todas las fechas son relativas a
// hoy.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PROMOTION_CASES } from "./fixtures/promociones";

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
const ip = "198.18.19." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "FitStore-QA-W9-2026!";
const PASSWORD = "FitStore-QA-W9-Definitiva-2026!";
const CASHIER_TEMPORARY = "739205";
const CASHIER_PASSWORD = "583904";
const DAY = 86400000;

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
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* binario o texto */
  }
  return { status: r.status, body };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

type Actor = { id: string; token: string; cash: any; name: string };
let owner = "",
  customerId = "",
  plain: { productId: string; variantId: string }, // RD$ 100, sin impuesto
  originalSettings: any;
const people: Actor[] = [];
const productIds: string[] = [];
const promotionIds: string[] = [];

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA W9 " + label + " " + suffix,
    secret: "qa-w9-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}
async function person(
  label: string,
  role: "seller" | "admin",
  opening: number | null = 0,
): Promise<Actor> {
  const roles = await ok("/roles", owner);
  const email = `qa-w9-${label}-${suffix}@example.test`;
  const name = `QA W9 ${label} ${suffix}`;
  const temporaryPassword = role === "seller" ? CASHIER_TEMPORARY : TEMPORARY;
  const newPassword = role === "seller" ? CASHIER_PASSWORD : PASSWORD;
  const user = await ok("/users", owner, {
    name,
    email,
    password: temporaryPassword,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === role).id,
  });
  const login = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: temporaryPassword,
    newPassword,
    confirmPassword: newPassword,
  });
  await terminal(login.accessToken, label);
  const cash =
    opening === null
      ? null
      : await ok("/cash-sessions/open", login.accessToken, {
          registerId: "qa-w9-" + label + "-" + suffix,
          openingAmount: opening,
        });
  const actor = { id: user.id, token: login.accessToken, cash, name };
  people.push(actor);
  return actor;
}
async function product(
  label: string,
  price: number,
  category = "Fajas",
  stock = 100,
  lot?: { number: string; expiryDate: string },
) {
  const cats = await ok("/categories", owner);
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA W9 " + label + " " + suffix,
    sku: "QAW9-" + tag,
    categoryId: cats.find((c: any) => c.name === category).id,
    taxRate: 0,
    variants: [
      {
        sku: "QAW9-V-" + tag,
        barcode: "QAW9-B-" + tag,
        price,
        costAvg: 10,
      },
    ],
  });
  productIds.push(p.id);
  await ok("/inventory/adjustments", owner, {
    variantId: p.variants[0].id,
    qty: stock,
    reason: "QA W9",
    ...(lot ? { lotNumber: lot.number, expiryDate: lot.expiryDate } : {}),
  });
  return { productId: p.id as string, variantId: p.variants[0].id as string };
}
const sale = (
  who: Actor,
  items: any[],
  payments: any[],
  extra: Record<string, unknown> = {},
) =>
  request("/sales", who.token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: who.cash.id,
    items,
    payments,
    ...extra,
  });
const cashSale = (who: Actor, variantId: string, qty = 1, price = 100) =>
  sale(who, [{ variantId, qty }], [{ method: "cash", amount: price * qty }], {
    expectedTotal: price * qty,
  });
const closeCash = (who: Actor, counted: number) =>
  request("/cash-sessions/" + who.cash.id + "/close", who.token, {
    countedCash: counted,
    countedCard: 0,
    countedTransfer: 0,
    notes: "",
  });

beforeAll(async () => {
  owner = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await terminal(owner, "dueña");
  originalSettings = await ok("/settings", owner);
  await ok(
    "/settings",
    owner,
    {
      ...originalSettings,
      allowCreditSales: true,
      creditApprovalThreshold: 1000000,
      receivableShiftLimit: 1000000,
    },
    "PUT",
  );
  customerId = (await ok("/customers", owner, { name: "QA W9 " + suffix })).id;
  plain = await product("base", 100);
}, 120000);

afterAll(async () => {
  for (const who of people)
    if (who.cash) {
      const listed = (await ok("/cash-sessions", owner)).find(
        (s: any) => s.id === who.cash.id,
      );
      if (listed && !listed.closedAt)
        await request("/cash-sessions/" + who.cash.id + "/close", owner, {
          countedCash: Math.max(0, listed.expected.cash),
          countedCard: Math.max(0, listed.expected.card),
          countedTransfer: Math.max(0, listed.expected.transfer),
          notes: "Cierre de pruebas W9",
        });
    }
  if (promotionIds.length)
    await db.promotion.updateMany({
      where: { id: { in: promotionIds } },
      data: { active: false },
    });
  // La aprobación con PIN recorre con bcrypt a todos los gerentes activos: las
  // personas de esta prueba (administradoras) se desactivan al terminar para
  // no volver lentas las pruebas siguientes.
  for (const who of people)
    await request("/users/" + who.id, owner, { active: false }, "PATCH");
  if (originalSettings)
    await request("/settings", owner, originalSettings, "PUT");
  for (const id of productIds)
    await request("/products/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("Cobro: reglas de la venta", () => {
  it("S02 · el total esperado tolera centavos, no medio peso", async () => {
    const adm = await person("tolerancia", "admin");
    const item = [{ variantId: plain.variantId, qty: 1 }];
    const pay = [{ method: "cash", amount: 100 }];
    for (const wrong of [100.5, 99.5, 101]) {
      const r = await sale(adm, item, pay, { expectedTotal: wrong });
      expect(r.status, "esperado " + wrong).toBe(400);
      expect(r.body.message).toMatch(/precios o promociones cambiaron/i);
    }
    const exact = await sale(adm, item, pay, { expectedTotal: 100 });
    expect(exact.status).toBe(201);
    // Medio centavo de diferencia (redondeo de la caja) sigue pasando.
    const cent = await sale(adm, item, pay, { expectedTotal: 100.005 });
    expect(cent.status).toBe(201);
  });

  it("S03 · una tarjeta exige los últimos 4 dígitos Y el código de aprobación", async () => {
    const adm = await person("tarjeta", "admin");
    const item = [{ variantId: plain.variantId, qty: 1 }];
    const only = async (card: Record<string, string>) =>
      sale(adm, item, [{ method: "card", amount: 100, ...card }], {
        expectedTotal: 100,
      });
    for (const card of [
      { cardLast4: "4242" },
      { approvalCode: "APR-123" },
    ] as const) {
      const r = await only(card);
      expect(r.status, JSON.stringify(card)).toBe(400);
      expect(r.body.message).toMatch(/últimos 4 dígitos y la aprobación/);
    }
    expect(
      (await only({ cardLast4: "4242", approvalCode: "APR-123" })).status,
    ).toBe(201);
  });

  it("S19 · un descuento por monto mayor que la línea se rechaza aunque otra línea lo compense", async () => {
    const adm = await person("descuento", "admin");
    const offlineUuid = randomUUID();
    const r = await request("/sales", adm.token, {
      offlineUuid,
      customerId,
      cashSessionId: adm.cash.id,
      items: [
        { variantId: plain.variantId, qty: 1, discountAmount: 150 },
        { variantId: plain.variantId, qty: 3 },
      ],
      discountReason: "QA W9 descuento mayor que la línea",
      payments: [{ method: "cash", amount: 250 }],
      expectedTotal: 250,
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/descuento por monto supera el importe/i);
    expect(await db.sale.count({ where: { offlineUuid } })).toBe(0);
  });

  it("S14 · reenviar el UUID de la venta de otra cajera da 403; la dueña de la venta recibe la misma", async () => {
    const ana = await person("uuid-ana", "seller");
    const beto = await person("uuid-beto", "seller");
    const offlineUuid = randomUUID();
    const body = (who: Actor) => ({
      offlineUuid,
      customerId,
      cashSessionId: who.cash.id,
      items: [{ variantId: plain.variantId, qty: 1 }],
      payments: [{ method: "cash", amount: 100 }],
      expectedTotal: 100,
    });
    const first = await request("/sales", ana.token, body(ana));
    expect(first.status).toBe(201);
    const again = await request("/sales", ana.token, body(ana));
    expect(again.body.id).toBe(first.body.id);
    const stolen = await request("/sales", beto.token, body(beto));
    expect(stolen.status).toBe(403);
    expect(JSON.stringify(stolen.body)).not.toContain(first.body.number);
    expect(await db.sale.count({ where: { offlineUuid } })).toBe(1);
  });
});

describe("Promociones de los cinco tipos (API; la caja y la cola offline calculan lo mismo)", () => {
  for (const c of PROMOTION_CASES)
    it(`S16/S17 · ${c.type}: ${c.qty} × RD$ ${c.price} cuestan RD$ ${c.total}`, async () => {
      const adm = await person("promo-" + c.id, "admin");
      const p = await product("promo " + c.id, c.price);
      const promo = await ok("/promotions", owner, {
        name: "QA W9 " + c.id + " " + suffix,
        type: c.type,
        value: c.value,
        startsAt: new Date(Date.now() - 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 3600_000).toISOString(),
        scope: { productId: p.productId, ...(c.scope ?? {}) },
      });
      promotionIds.push(promo.id);
      const gross = c.price * c.qty;
      const item = [{ variantId: p.variantId, qty: c.qty }];
      // Con el total sin promoción, el servidor dice que los precios cambiaron:
      // la promoción sí se aplicó.
      const stale = await sale(adm, item, [{ method: "cash", amount: gross }], {
        expectedTotal: gross,
      });
      expect(stale.status).toBe(400);
      expect(stale.body.message).toMatch(/precios o promociones cambiaron/i);
      const done = await sale(
        adm,
        item,
        [{ method: "cash", amount: c.total }],
        {
          expectedTotal: c.total,
        },
      );
      expect(done.status, JSON.stringify(done.body)).toBe(201);
      expect(Number(done.body.total)).toBe(c.total);
    });
});

describe("Devoluciones, anulación y abonos", () => {
  const returnOf = (
    who: Actor,
    created: any,
    extra: Record<string, unknown> = {},
    refundMethod = "credit_note",
  ) =>
    request("/returns", who.token, {
      saleId: created.id,
      cashSessionId: who.cash.id,
      reason: "QA W9 devolución",
      refundMethod,
      items: [
        { saleItemId: created.items[0].id, qty: 1, restock: true, ...extra },
      ],
    });

  it("S06 · sin returnDays en Ajustes el plazo de devolución es de 30 días", async () => {
    const adm = await person("plazo", "admin");
    const stored = await db.settings.findUniqueOrThrow({
      where: { id: "main" },
    });
    const { returnDays: _removed, ...withoutReturnDays } = stored.data as any;
    void _removed;
    await db.settings.update({
      where: { id: "main" },
      data: { data: withoutReturnDays },
    });
    try {
      const old = (await cashSale(adm, plain.variantId)).body;
      await db.sale.update({
        where: { id: old.id },
        data: { createdAt: new Date(Date.now() - 31 * DAY) },
      });
      const late = await returnOf(adm, old);
      expect(late.status).toBe(400);
      expect(late.body.message).toMatch(/plazo de devolución/);
      const recent = (await cashSale(adm, plain.variantId)).body;
      await db.sale.update({
        where: { id: recent.id },
        data: { createdAt: new Date(Date.now() - 29 * DAY) },
      });
      expect((await returnOf(adm, recent)).status).toBe(201);
    } finally {
      await db.settings.update({
        where: { id: "main" },
        data: { data: stored.data },
      });
    }
  });

  it("S08 · el lote que venció después de la venta no vuelve al stock", async () => {
    const adm = await person("lote", "admin");
    const p = await product("lote", 100, "Suplementos", 10, {
      number: "W9-" + suffix,
      expiryDate: new Date(Date.now() + 40 * DAY).toISOString(),
    });
    const sold = (await cashSale(adm, p.variantId)).body;
    expect(sold.id).toBeTruthy();
    const lots = await db.lot.findMany({ where: { variantId: p.variantId } });
    expect(lots).toHaveLength(1);
    const before = Number(
      (await db.lot.findUniqueOrThrow({ where: { id: lots[0].id } })).qty,
    );
    await db.lot.update({
      where: { id: lots[0].id },
      data: { expiryDate: new Date(Date.now() - 2 * DAY) },
    });
    const r = await returnOf(adm, sold);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/lote ya venció/);
    expect(
      Number(
        (await db.lot.findUniqueOrThrow({ where: { id: lots[0].id } })).qty,
      ),
    ).toBe(before);
    // Como merma sí se registra.
    expect((await returnOf(adm, sold, { restock: false })).status).toBe(201);
  });

  it("S09 · un producto dañado no vuelve al stock vendible; como merma sí se devuelve", async () => {
    const adm = await person("danado", "admin");
    const sold = (await cashSale(adm, plain.variantId)).body;
    const stock = async () =>
      Number(
        (await db.variant.findUniqueOrThrow({ where: { id: plain.variantId } }))
          .stock,
      );
    const before = await stock();
    const r = await returnOf(adm, sold, { damaged: true });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/abierto o dañado no puede volver al stock/);
    expect(await stock()).toBe(before);
    expect(
      (await returnOf(adm, sold, { damaged: true, restock: false })).status,
    ).toBe(201);
  });

  it("S13 · verificar un abono que ya no cabe en la deuda es un 400 y la deuda no queda negativa", async () => {
    const adm = await person("abono", "admin");
    const credit = (
      await sale(
        adm,
        [{ variantId: plain.variantId, qty: 3 }],
        [{ method: "cod", amount: 300 }],
        { expectedTotal: 300 },
      )
    ).body;
    expect(Number(credit.creditBalance)).toBe(300);
    const collected = await request(
      "/sales/" + credit.id + "/credit-collections",
      adm.token,
      {
        operationId: randomUUID(),
        cashSessionId: adm.cash.id,
        lines: [
          {
            method: "transfer",
            amount: 200,
            bank: "Banco QA",
            reference: "W9",
          },
        ],
      },
    );
    expect(collected.status, JSON.stringify(collected.body)).toBe(201);
    const paymentId = collected.body.payments[0].id;
    // Datos heredados: la deuda quedó por debajo del abono pendiente.
    await db.sale.update({
      where: { id: credit.id },
      data: { creditBalance: 100 },
    });
    const r = await request(
      "/payments/" + paymentId + "/verify",
      adm.token,
      {},
    );
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/supera la deuda pendiente/);
    const after = await db.sale.findUniqueOrThrow({ where: { id: credit.id } });
    expect(Number(after.creditBalance)).toBe(100);
    const payment = await db.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    expect(payment.status).toBe("pending_verification");
  });

  it("S20 · anular una venta en efectivo de una caja cerrada exige efectivo en la caja de quien anula", async () => {
    const ana = await person("anula-ana", "seller");
    const poor = await person("anula-pobre", "admin", 0);
    const sold = (await cashSale(ana, plain.variantId)).body;
    expect((await closeCash(ana, 100)).status).toBe(201);
    const refused = await request("/sales/" + sold.id + "/void", poor.token, {
      reason: "QA W9 anulación sin efectivo",
    });
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(
      /No hay suficiente efectivo en tu caja/,
    );
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sold.id } })).status,
    ).toBe("completed");
    // Con efectivo en su caja la misma anulación procede.
    await ok("/cash-sessions/" + poor.cash.id + "/movements", poor.token, {
      type: "in",
      amount: 100,
      reason: "QA W9 fondo para reembolsar",
    });
    const voided = await request("/sales/" + sold.id + "/void", poor.token, {
      reason: "QA W9 anulación con efectivo",
    });
    expect(voided.status, JSON.stringify(voided.body)).toBeLessThan(300);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sold.id } })).status,
    ).toBe("voided");
  });
});

describe("Incentivos", () => {
  it("I06 · anular una venta de una categoría sin tarifa (monto 0) igual reversa las unidades", async () => {
    const adm = await person("incentivo", "admin");
    const ropa = await product("ropa sin tarifa", 100, "Ropa deportiva");
    const sold = (await cashSale(adm, ropa.variantId, 2)).body;
    const rows = () =>
      db.incentiveEntry
        .findMany({ where: { saleId: sold.id }, orderBy: { kind: "asc" } })
        .then((list: any[]) =>
          list.map((e) => [e.kind, Number(e.qty), Number(e.amount)]),
        );
    expect(await rows()).toEqual([["sale", 2, 0]]);
    await ok("/sales/" + sold.id + "/void", adm.token, {
      reason: "QA W9 anulación sin tarifa",
    });
    expect(await rows()).toEqual([
      ["sale", 2, 0],
      ["void", -2, 0],
    ]);
  });
});

describe("Cierre de caja", () => {
  it("C10 · el efectivo contado debe coincidir con el conteo por denominaciones", async () => {
    const adm = await person("cierre", "admin", 100);
    const body = {
      denominations: { "100": 1 },
      countedCard: 0,
      countedTransfer: 0,
      notes: "",
    };
    const wrong = await request(
      "/cash-sessions/" + adm.cash.id + "/close",
      adm.token,
      { ...body, countedCash: 90 },
    );
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/no coincide con el conteo/);
    expect(
      (await db.cashSession.findUniqueOrThrow({ where: { id: adm.cash.id } }))
        .closedAt,
    ).toBeNull();
    const right = await request(
      "/cash-sessions/" + adm.cash.id + "/close",
      adm.token,
      { ...body, countedCash: 100 },
    );
    expect(right.status, JSON.stringify(right.body)).toBe(201);
  });
});

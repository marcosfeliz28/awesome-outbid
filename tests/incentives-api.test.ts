// INC: incentivos por cajera contra la API compilada (como tests/api.test.ts):
// atribución por persona, categorías mezcladas, venta mayorista, idempotencia
// offline, devolución parcial, anulación, privacidad por rol, tarifas que no
// alteran lo ganado y cierre de mes inmutable y reproducible. El cálculo puro
// está en tests/incentives-calc.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  businessMonth,
  nextMonth,
  summarize,
} from "../apps/api/src/incentives";

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
const ip = "198.18.7." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "FitStore-QA-Inc-2026!";
const PASSWORD = "FitStore-QA-Inc-Definitiva-2026!";

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
  return { status: r.status, body, type: r.headers.get("content-type") };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let admin = "",
  manager = "",
  customerId = "",
  adminCash: any;
const month = businessMonth();
type Cashier = { id: string; token: string; cash: any; name: string };
let ana: Cashier, luz: Cashier;
const v: Record<string, string> = {};
let qaCategoryId = "";
const productIds: string[] = [];

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA incentivos " + label + " " + suffix,
    secret: "qa-inc-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
}
async function cashier(label: string): Promise<Cashier> {
  const roles = await ok("/roles", admin);
  const email = `qa-inc-${label}-${suffix}@example.test`;
  const name = `QA ${label} ${suffix}`;
  const user = await ok("/users", admin, {
    name,
    email,
    password: TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  const login = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: TEMPORARY,
    newPassword: PASSWORD,
    confirmPassword: PASSWORD,
  });
  await terminal(login.accessToken, label);
  const cash = await ok("/cash-sessions/open", login.accessToken, {
    registerId: "qa-inc-" + label + "-" + suffix,
    openingAmount: 0,
  });
  return { id: user.id, token: login.accessToken, cash, name };
}
async function product(categoryName: string, key: string, lot: boolean) {
  const categoryId =
    categoryName === "QA"
      ? qaCategoryId
      : (await ok("/categories", admin)).find(
          (c: any) => c.name === categoryName,
        ).id;
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", admin, {
    name: `QA incentivo ${key} ${suffix}`,
    sku: "QAI-" + tag,
    categoryId,
    taxRate: 0,
    variants: [
      { sku: "QAI-V-" + tag, barcode: "QAI-B-" + tag, price: 100, costAvg: 40 },
    ],
  });
  productIds.push(p.id);
  await ok("/inventory/adjustments", admin, {
    variantId: p.variants[0].id,
    qty: 200,
    reason: "QA incentivos",
    ...(lot
      ? {
          lotNumber: "QA-INC-" + tag,
          expiryDate: new Date(Date.now() + 300 * 86400000).toISOString(),
        }
      : {}),
  });
  v[key] = p.variants[0].id;
}
const body = (
  who: Cashier,
  items: [string, number][],
  extra: Record<string, unknown> = {},
) => {
  const total = items.reduce((sum, [, qty]) => sum + qty * 100, 0);
  return {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: who.cash.id,
    items: items.map(([key, qty]) => ({ variantId: v[key], qty })),
    payments: [{ method: "cash", amount: total }],
    expectedTotal: total,
    ...extra,
  };
};
const sell = (who: Cashier, items: [string, number][], extra = {}) =>
  ok("/sales", who.token, body(who, items, extra));
const mine = (who: Cashier, query = "") =>
  ok("/incentives/me" + query, who.token);
const entries = (saleId: string) =>
  db.incentiveEntry.findMany({ where: { saleId }, orderBy: { kind: "asc" } });
const sumOf = (rows: any[]) =>
  Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
const reportRow = async (who: Cashier, as = admin, period = month) =>
  (await ok("/incentives?month=" + period, as)).rows.find(
    (r: any) => r.userId === who.id,
  );

beforeAll(async () => {
  const login = (email: string) =>
    ok("/auth/login", "", { email, password: DEMO }).then(
      (r: any) => r.accessToken,
    );
  admin = await login("admin@fitstore.demo");
  manager = await login("gerente@fitstore.demo");
  await terminal(admin, "dueña");
  customerId = (
    await ok("/customers", admin, { name: "QA incentivos " + suffix })
  ).id;
  qaCategoryId = (
    await ok("/categories", admin, { name: "QA Incentivos " + suffix })
  ).id;
  await product("Suplementos", "sup", true);
  await product("Fajas", "faja", false);
  await product("Maquillaje", "maq", true);
  await product("Ropa deportiva", "ropa", false);
  await product("QA", "qa", false);
  adminCash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-inc-admin-" + suffix,
    openingAmount: 5000,
  });
  ana = await cashier("ana");
  luz = await cashier("luz");
}, 120000);

afterAll(async () => {
  for (const who of [ana, luz].filter(Boolean))
    await request("/cash-sessions/" + who.cash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de incentivos",
    });
  if (adminCash)
    await request("/cash-sessions/" + adminCash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de incentivos",
    });
  for (const id of productIds)
    await request("/products/" + id, admin, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("INC · incentivos por cajera", () => {
  it("tarifas por defecto según el nombre de la categoría real", async () => {
    const rates = await ok("/incentives/rates", admin);
    const byName = (name: string) => rates.find((r: any) => r.name === name);
    for (const [name, amount] of [
      ["Suplementos", 50],
      ["Fajas", 50],
      ["Maquillaje", 25],
      ["Ropa deportiva", 0],
    ] as const) {
      expect(byName(name).defaultAmount, name).toBe(amount);
      if (byName(name).isDefault)
        expect(byName(name).amount, name).toBe(amount);
    }
  });

  it("venta con categorías mezcladas: cada línea guarda su instantánea a nombre de la cajera", async () => {
    const before = (await mine(ana)).row?.net ?? 0;
    const sale = await sell(ana, [
      ["sup", 2],
      ["faja", 1],
      ["maq", 1],
      ["ropa", 1],
    ]);
    const rows = await entries(sale.id);
    expect(rows.every((e: any) => e.userId === ana.id)).toBe(true);
    expect(rows.every((e: any) => e.kind === "sale" && !e.wholesale)).toBe(
      true,
    );
    expect(
      Object.fromEntries(
        rows.map((e: any) => [e.categoryName, Number(e.amount)]),
      ),
    ).toEqual({
      Suplementos: 100,
      Fajas: 50,
      Maquillaje: 25,
      "Ropa deportiva": 0,
    });
    expect(
      rows.find((e: any) => e.categoryName === "Suplementos").rateAtSale,
    ).toBeDefined();
    const after = (await mine(ana)).row;
    expect(after.net).toBeCloseTo(before + 175, 2);
    expect(after.units).toEqual(
      expect.arrayContaining([
        { category: "Suplementos", sold: 2, returned: 0 },
      ]),
    );
  });

  it("venta al por mayor: mismo total, incentivo a la mitad y queda en la bitácora", async () => {
    const normal = await sell(ana, [["sup", 1]]);
    const before = (await mine(ana)).row;
    const wholesale = await sell(ana, [["sup", 1]], { wholesale: true });
    expect(Number(wholesale.total)).toBe(Number(normal.total));
    expect(sumOf(await entries(wholesale.id))).toBe(25);
    expect(
      (await db.sale.findUnique({ where: { id: wholesale.id } })).wholesale,
    ).toBe(true);
    const after = (await mine(ana)).row;
    expect(after.net).toBeCloseTo(before.net + 25, 2);
    expect(after.wholesaleSales).toBe(before.wholesaleSales + 1);
    const log = await db.auditLog.findFirst({
      where: { action: "wholesale_marked", entityId: wholesale.id },
    });
    expect(log?.userId).toBe(ana.id);
    // Control de abuso: la gerencia ve cuántas marcó cada cajera.
    expect((await reportRow(ana, manager)).wholesaleSales).toBe(
      after.wholesaleSales,
    );
  });

  it("idempotencia: reintentos en línea y offline con el mismo UUID no duplican el incentivo", async () => {
    const online = body(ana, [["faja", 2]], { wholesale: true });
    const first = await ok("/sales", ana.token, online);
    const again = await ok("/sales", ana.token, online);
    expect(again.id).toBe(first.id);
    expect(await entries(first.id)).toHaveLength(1);
    expect(sumOf(await entries(first.id))).toBe(50);

    const offline = {
      ...body(ana, [["maq", 2]], { wholesale: true }),
      // Dentro del horario de la caja de Ana (abierta en beforeAll).
      capturedAt: new Date(
        Math.min(Date.now(), Date.parse(ana.cash.openedAt) + 1000),
      ).toISOString(),
    };
    const synced = [];
    for (let n = 0; n < 2; n++) {
      const result = await ok("/sales/sync", ana.token, { sales: [offline] });
      expect(result.results[0].status).toBe("synced");
      synced.push(result.results[0].sale.id);
    }
    expect(synced[0]).toBe(synced[1]);
    const rows = await entries(synced[0]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(25);
    expect(rows[0].wholesale).toBe(true);
  });

  it("devolución parcial: reverso proporcional por unidades devueltas", async () => {
    const sale = await sell(luz, [
      ["sup", 3],
      ["faja", 1],
    ]);
    const before = (await mine(luz)).row.net;
    const supLine = sale.items.find((i: any) => i.variantId === v.sup);
    const operationId = randomUUID();
    const returned = {
      operationId,
      saleId: sale.id,
      cashSessionId: adminCash.id,
      reason: "QA devolución parcial de incentivos",
      refundMethod: "credit_note",
      items: [{ saleItemId: supLine.id, qty: 1, restock: true }],
    };
    const done = await ok("/returns", admin, returned);
    // Reintento con la misma clave: no duplica el reverso.
    await ok("/returns", admin, returned);
    const reversal = (await entries(sale.id)).filter(
      (e: any) => e.kind === "return",
    );
    expect(reversal).toHaveLength(1);
    expect(reversal[0]).toMatchObject({
      refId: done.id,
      userId: luz.id,
      categoryName: "Suplementos",
    });
    expect(Number(reversal[0].amount)).toBe(-50);
    expect(Number(reversal[0].qty)).toBe(-1);
    const after = (await mine(luz)).row;
    expect(after.net).toBeCloseTo(before - 50, 2);
    expect(after.deductions).toBeLessThanOrEqual(-50);
  });

  it("anulación: revierte todo lo que queda de la venta", async () => {
    const sale = await sell(luz, [["sup", 1]], { wholesale: true });
    const before = (await mine(luz)).row.net;
    await ok("/sales/" + sale.id + "/void", admin, {
      reason: "QA anulación de incentivos",
    });
    const rows = await entries(sale.id);
    expect(sumOf(rows)).toBe(0);
    expect(rows.find((e: any) => e.kind === "void")).toMatchObject({
      refId: sale.id,
      userId: luz.id,
    });
    expect((await mine(luz)).row.net).toBeCloseTo(before - 25, 2);
  });

  it("contraentrega: se incluye y se marca «por cobrar»", async () => {
    const before = (await mine(luz)).row.pendingCollection;
    await sell(luz, [["faja", 1]], {
      payments: [{ method: "cod", amount: 100 }],
      managerPin: "123456",
    });
    expect((await mine(luz)).row.pendingCollection).toBeCloseTo(before + 50, 2);
  });

  it("privacidad por rol: la cajera sólo ve lo suyo; gerencia y administración ven a todas", async () => {
    for (const path of [
      "/incentives?month=" + month,
      "/incentives/rates",
      "/incentives/export.xlsx?month=" + month,
      `/incentives/receipt.pdf?month=${month}&userId=${luz.id}`,
    ])
      expect((await request(path, ana.token)).status, path).toBe(403);
    expect(
      (await request("/incentives/close", ana.token, { month })).status,
    ).toBe(403);
    expect(
      (await request("/incentives/rates", ana.token, { rates: [] }, "PUT"))
        .status,
    ).toBe(403);
    // Pedir a otra persona por parámetro no sirve: siempre devuelve lo propio.
    const own = await mine(ana, "?userId=" + luz.id);
    expect(own.row.userId).toBe(ana.id);
    expect(JSON.stringify(own)).not.toContain(luz.id);
    expect(JSON.stringify(own)).not.toContain(luz.name);

    const forManager = await ok("/incentives?month=" + month, manager);
    const ids = forManager.rows.map((r: any) => r.userId);
    expect(ids).toEqual(expect.arrayContaining([ana.id, luz.id]));
    expect(JSON.stringify(forManager)).not.toMatch(/cost|costo|profit/i);
    // Gerencia ve, la administración configura y cierra.
    expect(
      (await request("/incentives/rates", manager, { rates: [] }, "PUT"))
        .status,
    ).toBe(403);
    expect(
      (await request("/incentives/close", manager, { month })).status,
    ).toBe(403);
    const forAdmin = await ok("/incentives?month=" + month, admin);
    expect(forAdmin.rows.map((r: any) => r.userId)).toEqual(
      expect.arrayContaining([ana.id, luz.id]),
    );
    const xlsx = await fetch(base + "/incentives/export.xlsx?month=" + month, {
      headers: { Authorization: "Bearer " + manager, "X-Forwarded-For": ip },
    });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get("content-type")).toContain("spreadsheetml");
    const pdf = await fetch(
      `${base}/incentives/receipt.pdf?month=${month}&userId=${ana.id}`,
      { headers: { Authorization: "Bearer " + admin, "X-Forwarded-For": ip } },
    );
    expect(pdf.status).toBe(200);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });

  it("cambiar una tarifa no altera lo ya ganado", async () => {
    await ok(
      "/incentives/rates",
      admin,
      { rates: [{ categoryId: qaCategoryId, amount: 40 }] },
      "PUT",
    );
    const first = await sell(luz, [["qa", 2]]);
    expect(sumOf(await entries(first.id))).toBe(80);
    const rates = await ok(
      "/incentives/rates",
      admin,
      { rates: [{ categoryId: qaCategoryId, amount: 10 }] },
      "PUT",
    );
    expect(rates.find((r: any) => r.categoryId === qaCategoryId)).toMatchObject(
      { amount: 10, isDefault: false },
    );
    expect(sumOf(await entries(first.id))).toBe(80);
    expect(Number((await entries(first.id))[0].rateAtSale)).toBe(40);
    const second = await sell(luz, [["qa", 2]], { wholesale: true });
    expect(sumOf(await entries(second.id))).toBe(10);
    expect(
      await db.auditLog.count({ where: { action: "incentive_rates" } }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("cierre de mes inmutable y reproducible; lo tardío cae en el mes abierto siguiente", async () => {
    // Un mes pasado propio de esta corrida: se mueve allí una venta de Ana.
    const n = Date.now();
    const past = `${2001 + (n % 20)}-${String((Math.floor(n / 20) % 12) + 1).padStart(2, "0")}`;
    const old = await sell(ana, [
      ["sup", 2],
      ["maq", 2],
    ]);
    await db.incentiveEntry.updateMany({
      where: { saleId: old.id },
      data: { period: past, originPeriod: past },
    });
    const live = await ok("/incentives?month=" + past, admin);
    expect(live.closed).toBeNull();
    const closed = await ok("/incentives/close", admin, { month: past });
    expect(closed.closed.closedByName).toBeTruthy();
    const row = closed.rows.find((r: any) => r.userId === ana.id);
    expect(row).toMatchObject({ gross: 150, deductions: 0, net: 150 });
    const liveRow = live.rows.find((r: any) => r.userId === ana.id);
    expect([liveRow.gross, liveRow.net, liveRow.units]).toEqual([
      row.gross,
      row.net,
      row.units,
    ]);
    // Cerrar otra vez no se permite.
    expect(
      (await request("/incentives/close", admin, { month: past })).status,
    ).toBe(409);
    // Una devolución posterior de esa venta cuenta en el mes abierto, con nota.
    const supLine = old.items.find((i: any) => i.variantId === v.sup);
    await ok("/returns", admin, {
      operationId: randomUUID(),
      saleId: old.id,
      cashSessionId: adminCash.id,
      reason: "QA devolución de un mes cerrado",
      refundMethod: "credit_note",
      items: [{ saleItemId: supLine.id, qty: 1, restock: true }],
    });
    const reversal = (await entries(old.id)).find(
      (e: any) => e.kind === "return",
    );
    expect(reversal.period).toBe(month);
    expect(reversal.originPeriod).toBe(past);
    expect(reversal.note).toContain(past);
    expect((await reportRow(ana)).priorDeductions).toBeLessThanOrEqual(-50);
    // El cierre no cambió y se reproduce desde las entradas del mes.
    const again = await ok("/incentives?month=" + past, admin);
    expect(again.rows).toEqual(closed.rows);
    const settlement = await db.incentiveSettlement.findMany({
      where: { period: past },
    });
    const recomputed = summarize(
      await db.incentiveEntry.findMany({ where: { period: past } }),
    );
    for (const s of settlement) {
      const r = recomputed.find((x) => x.userId === s.userId)!;
      expect([r.gross, r.deductions, r.net, r.wholesaleSales]).toEqual([
        Number(s.gross),
        Number(s.deductions),
        Number(s.net),
        s.wholesaleSales,
      ]);
      expect(r.units).toEqual(s.units);
    }
    // La cajera ve su cuadre cerrado, sólo el suyo.
    const own = await mine(ana, "?month=" + past);
    expect(own.closed).toBe(true);
    expect(own.row.net).toBe(150);
  });

  it("una venta de un mes ya cerrado cuenta en el siguiente mes abierto, con nota", async () => {
    // Cierre del mes actual sólo durante esta prueba (base de pruebas).
    const already = await db.incentivePeriodClose.findUnique({
      where: { branchId_period: { branchId: "main", period: month } },
    });
    expect(already).toBeNull();
    await ok("/incentives/close", admin, { month });
    try {
      const sale = await sell(luz, [["faja", 1]]);
      const [row] = await entries(sale.id);
      expect(row.period).toBe(nextMonth(month));
      expect(row.originPeriod).toBe(month);
      expect(row.note).toContain("después del cierre");
      // La cajera ve el mes donde cuentan sus ventas nuevas.
      const own = await mine(luz);
      expect(own.closed).toBe(false);
      expect(own.row.net).toBe(50);
      expect((await ok("/incentives?month=" + month, admin)).openPeriod).toBe(
        nextMonth(month),
      );
    } finally {
      await db.incentiveSettlement.deleteMany({ where: { period: month } });
      await db.incentivePeriodClose.deleteMany({ where: { period: month } });
    }
  });
});

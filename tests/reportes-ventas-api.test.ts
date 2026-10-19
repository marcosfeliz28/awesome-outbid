// Reportes 40 · grupo Ventas contra la API: se crean ventas conocidas (con una
// devolución parcial) en una categoría, dos marcas y un cliente propios, y cada
// reporte debe sumar exactamente esa venta neta (antes/después, porque los
// reportes son de toda la sucursal). Además, todos cuadran entre sí y ninguno
// muestra costo ni margen.
import { conClave } from "./setup/con-clave";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.9." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";

async function request(path: string, as: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined
      ? {}
      : { body: JSON.stringify(conClave(path, data)) }),
  });
  const type = r.headers.get("content-type") ?? "";
  const body = type.includes("json") ? await r.json() : await r.arrayBuffer();
  return { status: r.status, body, type };
}
async function ok(path: string, as: string, data?: unknown) {
  const r = await request(path, as, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body as any;
}

// Día de negocio de hoy (Santo Domingo, UTC-4).
const today = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
const NAMES = [
  "ventas-por-hora",
  "ventas-por-dia-semana",
  "ventas-mes-anterior",
  "ventas-mes-ano-anterior",
  "ticket-promedio",
  "unidades-por-factura",
  "ranking-cajeras",
  "top-clientes",
  "ventas-categoria-mes",
  "ventas-por-marca",
];
const report = async (name: string): Promise<any[]> =>
  (await ok(`/reports/${name}?from=${today}&to=${today}`, admin)).rows;
const all = async () =>
  Object.fromEntries(
    await Promise.all(NAMES.map(async (n) => [n, await report(n)] as const)),
  );
const net = (rows: any[]) =>
  Math.round(rows.reduce((a, r) => a + r["Ventas netas"], 0) * 100) / 100;
const invoices = (rows: any[]) => rows.reduce((a, r) => a + r.Facturas, 0);

let admin = "",
  cash: any,
  customer = "",
  category = "";
const brandA = "QA Marca A " + suffix,
  brandB = "QA Marca B " + suffix;
const variant: Record<string, string> = {};
let before: Record<string, any[]>, after: Record<string, any[]>;

async function product(key: string, brand: string, price: number) {
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", admin, {
    name: `QA reporte ventas ${key} ${suffix}`,
    sku: "QAV-" + tag,
    categoryId: category,
    brand,
    taxRate: 0,
    variants: [
      {
        sku: "QAV-V-" + tag,
        barcode: "QAV-B-" + tag,
        price,
        costAvg: price / 2,
      },
    ],
  });
  await ok("/inventory/adjustments", admin, {
    variantId: p.variants[0].id,
    qty: 50,
    reason: "QA reportes de ventas",
  });
  variant[key] = p.variants[0].id;
}
const PRICE: Record<string, number> = { a: 1000, b: 500 };
const sell = (items: [string, number][]) => {
  const total = items.reduce((s, [k, q]) => s + PRICE[k] * q, 0);
  return ok("/sales", admin, {
    offlineUuid: randomUUID(),
    customerId: customer,
    cashSessionId: cash.id,
    items: items.map(([k, qty]) => ({ variantId: variant[k], qty })),
    payments: [{ method: "cash", amount: total }],
    expectedTotal: total,
  });
};

beforeAll(async () => {
  admin = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  const id = randomUUID();
  const t = await ok("/terminals/register", admin, {
    id,
    name: "QA reportes ventas " + suffix,
    secret: "qa-rv-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
  cash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-rv-" + suffix,
    openingAmount: 0,
  });
  customer = (await ok("/customers", admin, { name: "QA ventas " + suffix }))
    .id;
  category = (await ok("/categories", admin, { name: "QA Ventas " + suffix }))
    .id;
  await product("a", brandA, PRICE.a);
  await product("b", brandB, PRICE.b);
  before = await all();
  // 2000 + 2000 + (1500 − 500 devuelto) = 5000 netos en 3 facturas, 7 unidades.
  await sell([["a", 2]]);
  await sell([
    ["a", 1],
    ["b", 2],
  ]);
  const third = await sell([["b", 3]]);
  await ok("/returns", admin, {
    saleId: third.id,
    cashSessionId: cash.id,
    reason: "QA devolución en reportes de ventas",
    refundMethod: "cash",
    items: [{ saleItemId: third.items[0].id, qty: 1, restock: true }],
  });
  after = await all();
}, 120000);

afterAll(async () => {
  if (cash)
    await request("/cash-sessions/" + cash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de reportes de ventas",
    });
});

const delta = (name: string, pick: (rows: any[]) => number) =>
  Math.round((pick(after[name]) - pick(before[name])) * 100) / 100;

describe("Reportes · Ventas", () => {
  it("aparecen en la lista del menú, en el grupo Ventas", async () => {
    const list = await ok("/reportes", admin);
    for (const name of NAMES)
      expect(list.find((r: any) => r.name === name)?.group, name).toBe(
        "Ventas",
      );
  });

  it("ningún reporte de ventas muestra costo, ganancia ni margen", () => {
    for (const name of NAMES)
      for (const row of after[name])
        for (const key of Object.keys(row))
          expect(key, name).not.toMatch(/costo|ganancia|margen|utilidad/i);
  });

  it("por hora y por día de la semana suman la venta neta creada", () => {
    for (const name of ["ventas-por-hora", "ventas-por-dia-semana"]) {
      expect(delta(name, net), name).toBe(5000);
      expect(delta(name, invoices), name).toBe(3);
      const pct = after[name].reduce((a, r) => a + r["% del total"], 0);
      expect(Math.abs(pct - 100), name).toBeLessThan(1);
    }
  });

  it("mes contra mes anterior y contra el año anterior: el mes de «to» sube 5000", () => {
    for (const name of ["ventas-mes-anterior", "ventas-mes-ano-anterior"]) {
      expect(after[name]).toHaveLength(2);
      expect(after[name][0].Mes).toContain(today.slice(0, 4));
      expect(
        delta(name, (r) => r[0]["Ventas netas"]),
        name,
      ).toBe(5000);
      expect(
        delta(name, (r) => r[0].Facturas),
        name,
      ).toBe(3);
      expect(
        delta(name, (r) => r[1]["Ventas netas"]),
        name,
      ).toBe(0);
    }
  });

  it("ticket promedio: el día y el mes suben 3 facturas y 5000", () => {
    const day = (rows: any[]) => rows.find((r) => r.Período === today) ?? {};
    const month = (rows: any[]) => rows.find((r) => r.Tipo === "Mes") ?? {};
    for (const pick of [day, month]) {
      expect(
        delta("ticket-promedio", (r) => pick(r)["Ventas netas"] ?? 0),
      ).toBe(5000);
      expect(delta("ticket-promedio", (r) => pick(r).Facturas ?? 0)).toBe(3);
    }
    const d = day(after["ticket-promedio"]);
    expect(d["Ticket promedio"]).toBeCloseTo(d["Ventas netas"] / d.Facturas, 1);
  });

  it("unidades por factura: 2, 3 y 2 unidades netas", () => {
    const bucket = (label: string) => (rows: any[]) =>
      rows.find((r) => r.Unidades === label)?.Facturas ?? 0;
    expect(delta("unidades-por-factura", bucket("2"))).toBe(2);
    expect(delta("unidades-por-factura", bucket("3"))).toBe(1);
    const totalRow = (rows: any[]) => rows[rows.length - 1];
    expect(totalRow(after["unidades-por-factura"]).Unidades).toMatch(
      /^Promedio/,
    );
    expect(delta("unidades-por-factura", (r) => totalRow(r).Facturas)).toBe(3);
    expect(
      delta("unidades-por-factura", (r) => totalRow(r)["Ventas netas"]),
    ).toBe(5000);
  });

  it("ranking de cajeras y top clientes", () => {
    expect(delta("ranking-cajeras", net)).toBe(5000);
    expect(delta("ranking-cajeras", invoices)).toBe(3);
    const mine = after["top-clientes"].find(
      (r) => r.Cliente === "QA ventas " + suffix,
    );
    expect(mine).toMatchObject({ Facturas: 3, "Ventas netas": 5000 });
  });

  it("por categoría y por marca, con la devolución descontada", () => {
    const cat = after["ventas-categoria-mes"].find(
      (r) => r.Categoría === "QA Ventas " + suffix,
    );
    expect(cat).toMatchObject({
      Facturas: 3,
      Unidades: 7,
      "Ventas netas": 5000,
    });
    const brand = (name: string) =>
      after["ventas-por-marca"].find((r) => r.Marca === name);
    expect(brand(brandA)).toMatchObject({
      Facturas: 2,
      Unidades: 3,
      "Ventas netas": 3000,
    });
    expect(brand(brandB)).toMatchObject({
      Facturas: 2,
      Unidades: 4,
      "Ventas netas": 2000,
    });
  });

  it("todos los reportes del rango cuadran entre sí", () => {
    // Cada fila se redondea a centavos: entre agrupaciones puede variar poco.
    const total = net(after["ventas-por-hora"]);
    const days = after["ticket-promedio"].filter((r) => r.Tipo === "Día");
    for (const rows of [
      after["ventas-por-dia-semana"],
      after["ranking-cajeras"],
      after["ventas-categoria-mes"],
      after["ventas-por-marca"],
      days,
    ])
      expect(Math.abs(net(rows) - total)).toBeLessThan(1);
  });

  it("se descargan en Excel y PDF", async () => {
    for (const [format, type] of [
      ["xlsx", "spreadsheetml"],
      ["pdf", "application/pdf"],
    ]) {
      const r = await request(
        `/reports/ventas-por-hora?from=${today}&to=${today}&format=${format}`,
        admin,
      );
      expect(r.status, format).toBe(200);
      expect(r.type, format).toContain(type);
      expect((r.body as ArrayBuffer).byteLength, format).toBeGreaterThan(500);
    }
  });
});

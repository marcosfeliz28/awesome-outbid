// Reportes 27-34 (Inventario) contra la API compilada, como
// tests/incentives-api.test.ts: productos propios con entradas, traspasos
// Casa↔Tienda, ventas y salidas conocidas; cada reporte cuadra con ellos.
import { conClave } from "./setup/con-clave";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.9." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "739205";
const PASSWORD = "583904";
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const inDays = (n: number) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });

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
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* binario */
  }
  return { status: r.status, body, type: r.headers.get("content-type") };
}
async function ok(path: string, as: string, data?: unknown) {
  const r = await request(path, as, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let admin = "",
  seller = "",
  sellerCash: any,
  categoryName = "";
const v: Record<string, { id: string; sku: string; productId: string }> = {};
const report = (name: string, query = `from=${today}&to=${today}`) =>
  ok(`/reports/${name}?${query}`, admin);
const mine = (rows: any[], key: string) =>
  rows.find((r) => r.SKU === v[key].sku);
const terminal = async (token: string) => {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA inventario " + suffix + " " + id.slice(0, 4),
    secret: "qa-inv-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
};
const adjust = (key: string, qty: number, reason: string, extra = {}) =>
  ok("/inventory/adjustments", admin, {
    variantId: v[key].id,
    qty,
    reason,
    ...extra,
  });
const losses = async () =>
  Object.fromEntries(
    (await report("perdidas-conteo")).rows
      .filter((r: any) => r.Mes === today.slice(0, 7))
      .map((r: any) => [r.Tipo, r]),
  );

let lossesBefore: any;
beforeAll(async () => {
  admin = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await terminal(admin);
  categoryName = "QA Inventario " + suffix;
  const categoryId = (await ok("/categories", admin, { name: categoryName }))
    .id;
  for (const [key, minStock] of [
    ["a", 0],
    ["b", 5],
    ["c", 0],
  ] as const) {
    const tag = randomUUID().slice(0, 8);
    const p = await ok("/products", admin, {
      name: `QA inventario ${key} ${suffix}`,
      sku: "QAR-" + tag,
      categoryId,
      taxRate: 0,
      minStock,
      variants: [
        {
          sku: "QAR-V-" + tag,
          barcode: "QAR-B-" + tag,
          price: 100,
          costAvg: 40,
        },
      ],
    });
    v[key] = { id: p.variants[0].id, sku: "QAR-V-" + tag, productId: p.id };
  }
  const warehouses = await ok("/inventory/warehouses", admin);
  const store = warehouses.find((w: any) => w.kind === "store").id;
  const home = warehouses.find((w: any) => w.kind === "home").id;
  await adjust("a", 50, "Entrada QA");
  await adjust("b", 3, "Entrada QA");
  await adjust("c", 10, "Entrada QA");
  const transfer = (fromId: string, toId: string, qty: number) =>
    ok("/inventory/transfers", admin, {
      operationId: randomUUID(),
      fromId,
      toId,
      reason: "Traspaso QA",
      lines: [{ variantId: v.a.id, qty }],
    });
  await transfer(store, home, 20);
  await transfer(home, store, 5);

  // Vendedora: vende y no ve costos.
  const roles = await ok("/roles", admin);
  const email = `qa-inv-${suffix}@example.test`;
  await ok("/users", admin, {
    name: "QA inventario " + suffix,
    email,
    password: TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  seller = (
    await ok("/auth/change-password", "", {
      login: email,
      currentPassword: TEMPORARY,
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    })
  ).accessToken;
  await terminal(seller);
  sellerCash = await ok("/cash-sessions/open", seller, {
    registerId: "qa-inv-" + suffix,
    openingAmount: 0,
  });
  const customerId = (
    await ok("/customers", admin, { name: "QA inventario " + suffix })
  ).id;
  await ok("/sales", seller, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: sellerCash.id,
    items: [
      { variantId: v.a.id, qty: 6 },
      { variantId: v.b.id, qty: 3 },
    ],
    payments: [{ method: "cash", amount: 900 }],
    expectedTotal: 900,
  });

  lossesBefore = await losses();
  await adjust("a", -2, "Conteo QA: faltaban");
  await adjust("a", -1, "Merma QA rota", { type: "waste" });
}, 120000);

afterAll(async () => {
  if (sellerCash)
    await request("/cash-sessions/" + sellerCash.id + "/close", seller, {
      countedCash: 900,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de reportes de inventario",
    });
  for (const key of Object.keys(v))
    await fetch(base + "/products/" + v[key].productId, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + admin,
      },
      body: JSON.stringify({ active: false }),
    });
}, 60000);

// A: +50 Tienda, 20 a Casa, 5 de vuelta, vende 6, -2 conteo, -1 merma →
// Tienda 26, Casa 15. B: +3, vende 3 → agotado. C: +10, nunca vendido.
describe("Reportes de inventario (27-34)", () => {
  it("27 rotación: vendidas ÷ stock promedio del período", async () => {
    const a = mine((await report("rotacion-producto")).rows, "a");
    expect(a).toMatchObject({
      Vendidas: 6,
      "Stock inicial": 0,
      "Stock final": 41,
      "Stock promedio": 20.5,
      Rotación: 0.29,
    });
  });

  it("28 días restantes: stock total ÷ venta diaria", async () => {
    const rows = (await report("dias-inventario")).rows;
    expect(mine(rows, "a")).toMatchObject({
      Tienda: 26,
      Casa: 15,
      "Stock total": 41,
      "Venta diaria": 6,
      "Días restantes": 6,
    });
    expect(mine(rows, "b")["Días restantes"]).toBe(0);
    expect(mine(rows, "c")).toBeUndefined();
    // En 10 días la venta diaria es la décima parte.
    const ten = mine(
      (await report("dias-inventario", `from=${inDays(-9)}&to=${today}`)).rows,
      "a",
    );
    expect(ten).toMatchObject({ "Venta diaria": 0.6, "Días restantes": 68 });
  });

  it("29 sin movimiento: tramos según los días sin vender al cierre", async () => {
    const now = (await report("sin-movimiento")).rows;
    expect(mine(now, "c")).toBeUndefined();
    const later = (
      await report("sin-movimiento", `from=${today}&to=${inDays(45)}`)
    ).rows;
    expect(mine(later, "c")).toMatchObject({
      Tienda: 10,
      "Última venta": "Nunca",
      Tramo: "30-59 días",
    });
    expect(mine(later, "a")).toMatchObject({
      "Última venta": today,
      Casa: 15,
      Tramo: "30-59 días",
    });
    expect(mine(later, "b")).toBeUndefined(); // sin existencia
    const far = (
      await report("sin-movimiento", `from=${today}&to=${inDays(95)}`)
    ).rows;
    expect(mine(far, "c").Tramo).toBe("90+ días");
  });

  it("30 bajo el mínimo: Tienda ≤ mínimo del producto", async () => {
    const rows = (await report("bajo-minimo")).rows;
    expect(mine(rows, "b")).toMatchObject({ Tienda: 0, Mínimo: 5, Faltan: 5 });
    expect(mine(rows, "a")).toBeUndefined();
  });

  it("31 valor por categoría y almacén, a costo", async () => {
    const rows = (await report("valor-inventario-almacen")).rows.filter(
      (r: any) => r.Categoría === categoryName,
    );
    const by = Object.fromEntries(rows.map((r: any) => [r.Almacén, r]));
    // Tienda: A 26 + C 10 (B en 0 no suma); Casa: A 15. Costo 40.
    expect(by.Tienda).toMatchObject({ Unidades: 36, "Valor a costo": 1440 });
    expect(by.Casa).toMatchObject({ Unidades: 15, "Valor a costo": 600 });
  });

  it("32 pérdidas del mes: corrección de conteo aparte de la salida real", async () => {
    const after = await losses();
    const delta = (tipo: string, field: string) =>
      (after[tipo]?.[field] ?? 0) - (lossesBefore[tipo]?.[field] ?? 0);
    expect(delta("Corrección de conteo", "Unidades")).toBe(2);
    expect(delta("Corrección de conteo", "Valor a costo")).toBe(80);
    expect(delta("Salida real", "Unidades")).toBe(1);
    expect(delta("Salida real", "Valor a costo")).toBe(40);
  });

  it("33 traspasos: fecha, producto, cantidad, dirección y usuario", async () => {
    const rows = (await report("traspasos")).rows.filter(
      (r: any) => r.SKU === v.a.sku,
    );
    expect(
      rows.map((r: any) => [r.Cantidad, r.Dirección, r.Usuario]).sort(),
    ).toEqual(
      [
        [20, "Tienda → Casa", rows[0].Usuario],
        [5, "Casa → Tienda", rows[0].Usuario],
      ].sort(),
    );
    expect(rows[0].Usuario).toBeTruthy();
    expect(rows[0].Fecha.slice(0, 10)).toBe(today);
  });

  it("34 agotados con ventas recientes", async () => {
    const rows = (await report("agotados-con-ventas")).rows;
    expect(mine(rows, "b")).toMatchObject({
      Tienda: 0,
      "Vendidas en el período": 3,
      "Última venta": today,
    });
    expect(mine(rows, "a")).toBeUndefined();
  });

  it("la vendedora no ve los reportes con costo; Excel y PDF salen", async () => {
    for (const name of ["valor-inventario-almacen", "perdidas-conteo"])
      expect(
        (await request(`/reports/${name}?from=${today}&to=${today}`, seller))
          .status,
      ).toBe(403);
    const list = await ok("/reportes", admin);
    expect(list.filter((r: any) => r.group === "Inventario")).toHaveLength(8);
    for (const format of ["xlsx", "pdf"]) {
      const r = await request(
        `/reports/valor-inventario-almacen?format=${format}`,
        admin,
      );
      expect(r.status).toBe(200);
      expect(r.type).toContain(format === "pdf" ? "pdf" : "spreadsheet");
    }
  });
});

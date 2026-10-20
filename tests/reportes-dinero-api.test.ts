// Reportes 40 · grupo «Dinero» contra la API (como tests/incentives-api.test.ts):
// con ventas conocidas de hoy, cada reporte cuadra con lo que se creó. Los
// reportes que no se pueden filtrar por los datos de la prueba se comparan
// antes/después.
import { conClave } from "./setup/con-clave";
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
const suffix = Date.now().toString(36);
const ip = "198.18.8." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "739205";
const PASSWORD = "583904";
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const month = today.slice(0, 7);
const courier = "QA Mensajero " + suffix;
const voidReason = "QA anulación dinero " + suffix;

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
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
const report = async (name: string): Promise<any[]> =>
  (await ok(`/reports/${name}?from=${today}&to=${today}`, admin)).rows;

let admin = "",
  customerId = "",
  categoryName = "",
  productId = "",
  productName = "",
  variantId = "",
  adminCash: any;
type Cashier = { id: string; token: string; cash: any; name: string };
let ana: Cashier, luz: Cashier, eva: Cashier;
const before: Record<string, any[]> = {};

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA dinero " + label + " " + suffix,
    secret: "qa-din-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
}
async function cashier(label: string): Promise<Cashier> {
  const roles = await ok("/roles", admin);
  const email = `qa-din-${label}-${suffix}@example.test`;
  const name = `QA dinero ${label} ${suffix}`;
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
    registerId: "qa-din-" + label + "-" + suffix,
    openingAmount: 0,
  });
  return { id: user.id, token: login.accessToken, cash, name };
}
const PAYMENT_DATA: Record<string, object> = {
  transfer: { bank: "QA banco " + suffix, reference: "QA-DIN-" + suffix },
  card: { cardLast4: "4242", approvalCode: "QA-DIN" },
};
// Precio 100, sin ITBIS. `discount` en pesos sobre la línea.
const sell = (
  who: Cashier,
  qty: number,
  method: string,
  extra: Record<string, unknown> = {},
  discount = 0,
) => {
  const total = qty * 100 - discount;
  return ok("/sales", who.token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: who.cash.id,
    items: [
      { variantId, qty, ...(discount ? { discountAmount: discount } : {}) },
    ],
    payments: [{ method, amount: total, ...PAYMENT_DATA[method] }],
    expectedTotal: total,
    ...(discount ? { discountReason: "QA descuento dinero" } : {}),
    ...extra,
  });
};
const pick = (rows: any[], key: string, value: string) =>
  rows.find((r) => r[key] === value);
const delta = (name: string, key: string, value: string, col: string) =>
  Math.round(
    (Number(pick(after[name], key, value)?.[col] ?? 0) -
      Number(pick(before[name], key, value)?.[col] ?? 0)) *
      100,
  ) / 100;
const after: Record<string, any[]> = {};

beforeAll(async () => {
  admin = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await terminal(admin, "dueña");
  customerId = (await ok("/customers", admin, { name: "QA dinero " + suffix }))
    .id;
  categoryName = "QA Dinero " + suffix;
  const categoryId = (await ok("/categories", admin, { name: categoryName }))
    .id;
  const tag = randomUUID().slice(0, 8);
  productName = "QA dinero producto " + suffix;
  const p = await ok("/products", admin, {
    name: productName,
    sku: "QAD-" + tag,
    categoryId,
    taxRate: 0,
    variants: [
      { sku: "QAD-V-" + tag, barcode: "QAD-B-" + tag, price: 100, costAvg: 40 },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", admin, {
    variantId,
    qty: 100,
    reason: "QA reportes dinero",
  });
  adminCash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-din-admin-" + suffix,
    openingAmount: 5000,
  });
  ana = await cashier("ana");
  luz = await cashier("luz");
  eva = await cashier("eva");
  for (const name of ["formas-pago-mes", "por-mayor-detalle"])
    before[name] = await report(name);

  // Ana: descuento del 20 % con PIN de gerente, transferencia y tarjeta con
  // envío, contraentrega, una al por mayor y una que se anula.
  await sell(ana, 2, "cash", { managerPin: "123456" }, 40);
  await sell(ana, 1, "transfer", { courierFee: 50, courierName: courier });
  const card = await sell(ana, 1, "card", {
    courierFee: 30,
    courierName: courier,
  });
  await db.sale.update({
    where: { id: card.id },
    data: { courierPaidAt: new Date() },
  });
  await sell(ana, 1, "cod", { managerPin: "123456" });
  await sell(ana, 1, "cash", { wholesale: true });
  const voided = await sell(ana, 1, "cash");
  await ok("/sales/" + voided.id + "/void", admin, { reason: voidReason });
  // Luz: descuento del 5 % dentro de su límite (lo aprueba ella) y una
  // venta que se devuelve completa en efectivo.
  await sell(luz, 2, "cash", {}, 10);
  const back = await sell(luz, 1, "cash");
  await ok("/returns", admin, {
    saleId: back.id,
    cashSessionId: adminCash.id,
    reason: "QA devolución dinero",
    refundMethod: "cash",
    items: [{ saleItemId: back.items[0].id, qty: 1, restock: true }],
  });
  // Eva cierra con 25 de sobrante en efectivo.
  await ok("/cash-sessions/" + eva.cash.id + "/close", admin, {
    countedCash: 25,
    countedCard: 0,
    countedTransfer: 0,
    notes: "QA sobrante dinero",
  });
  eva.cash = null;
  for (const name of ["formas-pago-mes", "por-mayor-detalle"])
    after[name] = await report(name);
}, 180000);

afterAll(async () => {
  for (const who of [ana, luz, eva].filter((w) => w?.cash))
    await request("/cash-sessions/" + who.cash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de reportes dinero",
    });
  if (adminCash)
    await request("/cash-sessions/" + adminCash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de reportes dinero",
    });
  if (productId)
    await request("/products/" + productId, admin, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("Reportes 40 · Dinero", () => {
  it("aparecen en la lista de reportes del grupo Dinero", async () => {
    const list = await ok("/reportes", admin);
    const names = list
      .filter((r: any) => r.group === "Dinero")
      .map((r: any) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "formas-pago-mes",
        "formas-pago-categoria",
        "descuentos-cajera",
        "por-mayor-detalle",
        "envios-mensajero",
        "diferencias-cuadre",
        "anulaciones",
        "devoluciones-producto",
        "entradas-cuenta",
      ]),
    );
  });

  it("Configuración guarda cuentas y terminales; sin la clave se conservan", async () => {
    const original = await ok("/settings", admin);
    try {
      const accounts = ["Popular MacGen ···3620", "BHD MacGen ···0015"];
      await ok(
        "/settings",
        admin,
        {
          ...original,
          transferAccounts: accounts,
          cardTerminals: ["Verifone QA"],
        },
        "PUT",
      );
      const saved = await ok("/settings", admin);
      expect(saved.transferAccounts).toEqual(accounts);
      expect(saved.cardTerminals).toEqual(["Verifone QA"]);
      // Un cliente viejo que no envía las listas no las borra.
      const { transferAccounts: _a, cardTerminals: _t, ...older } = saved;
      await ok("/settings", admin, older, "PUT");
      expect((await ok("/settings", admin)).transferAccounts).toEqual(accounts);
    } finally {
      await ok("/settings", admin, original, "PUT");
    }
  });

  it("entradas por cuenta: la transferencia sale en su cuenta y el efectivo en Caja", async () => {
    const rows = await report("entradas-cuenta");
    const bank = rows.filter(
      (r) => r["Cuenta / terminal"] === "QA banco " + suffix,
    );
    expect(bank).toHaveLength(1);
    expect(bank[0].Forma).toBe("Transferencia");
    expect(bank[0].Monto).toBe(100);
    expect(bank[0].Cobros).toBe(1);
    expect(
      rows.some(
        (r) => r.Forma === "Efectivo" && r["Cuenta / terminal"] === "Caja",
      ),
    ).toBe(true);
  });

  it("formas de pago por mes: venta neta por forma, menos la devolución en efectivo", () => {
    const d = (col: string) => delta("formas-pago-mes", "Mes", month, col);
    expect(d("Efectivo")).toBe(450); // 160 + 100 + 190 + 100 − 100
    expect(d("Transferencia")).toBe(100);
    expect(d("Tarjeta")).toBe(100);
    expect(d("Crédito/contraentrega")).toBe(100);
    expect(d("Total")).toBe(750);
    const row = pick(after["formas-pago-mes"], "Mes", month);
    const sum = [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Crédito/contraentrega",
      "Otros",
    ].reduce((a, k) => a + row[k], 0);
    expect(sum).toBeCloseTo(row.Total, 1);
  });

  it("formas de pago por categoría: la categoría de la prueba cuadra con sus pagos", async () => {
    const row = (await report("formas-pago-categoria")).find(
      (r) => r.Categoría === categoryName,
    );
    expect(row).toMatchObject({
      Mes: month,
      Efectivo: 450,
      Transferencia: 100,
      Tarjeta: 100,
      "Crédito/contraentrega": 100,
      Otros: 0,
      Total: 750,
      "% Efectivo": 60,
      "% Tarjeta": 13.3,
    });
  });

  it("descuentos por cajera: monto, % de sus ventas netas y autoaprobados", async () => {
    const rows = await report("descuentos-cajera");
    expect(pick(rows, "Cajera", ana.name)).toEqual({
      Cajera: ana.name,
      "Facturas con descuento": 1,
      "Descuento total": 40,
      "Ventas netas": 560,
      "% de sus ventas": 7.1,
      "Aprobados por ella misma": 0,
    });
    expect(pick(rows, "Cajera", luz.name)).toEqual({
      Cajera: luz.name,
      "Facturas con descuento": 1,
      "Descuento total": 10,
      "Ventas netas": 190,
      "% de sus ventas": 5.3,
      "Aprobados por ella misma": 1,
    });
    expect(pick(rows, "Cajera", eva.name)).toBeUndefined();
  });

  it("por mayor vs detalle", () => {
    const d = (tipo: string, col: string) =>
      delta("por-mayor-detalle", "Tipo", tipo, col);
    expect(d("Por mayor", "Facturas")).toBe(1);
    expect(d("Por mayor", "Neto")).toBe(100);
    expect(d("Detalle", "Facturas")).toBe(6);
    expect(d("Detalle", "Ventas")).toBe(750);
    expect(d("Detalle", "Devoluciones")).toBe(100);
    expect(d("Detalle", "Neto")).toBe(650);
    const shares = after["por-mayor-detalle"].reduce(
      (a, r) => a + r["% del total"],
      0,
    );
    expect(shares).toBeCloseTo(100, 0);
  });

  it("envíos del mensajero: pagado y pendiente", async () => {
    expect(
      pick(await report("envios-mensajero"), "Mensajero", courier),
    ).toEqual({
      Mensajero: courier,
      Envíos: 2,
      "Monto de envíos": 80,
      Pagados: 1,
      "Monto pagado": 30,
      Pendientes: 1,
      "Monto pendiente": 50,
    });
  });

  it("diferencias de cuadre por cajera", async () => {
    expect(
      pick(await report("diferencias-cuadre"), "Cajera", eva.name),
    ).toEqual({
      Cajera: eva.name,
      "Cajas cerradas": 1,
      "Diferencia efectivo": 25,
      "Diferencia tarjeta": 0,
      "Diferencia transferencia": 0,
      "Diferencia total": 25,
      "Cajas con faltante": 0,
      "Cajas con sobrante": 1,
    });
  });

  it("anulaciones por cajera y motivo", async () => {
    const rows = (await report("anulaciones")).filter(
      (r) => r.Cajera === ana.name,
    );
    expect(rows).toEqual([
      { Cajera: ana.name, Motivo: voidReason, Anuladas: 1, Monto: 100 },
    ]);
  });

  it("devoluciones por producto", async () => {
    expect(
      pick(await report("devoluciones-producto"), "Producto", productName),
    ).toMatchObject({ Devoluciones: 1, Unidades: 1, Monto: 100 });
  });

  it("se descarga en Excel y PDF", async () => {
    for (const [format, type] of [
      ["xlsx", "spreadsheetml"],
      ["pdf", "application/pdf"],
    ]) {
      const r = await request(
        `/reports/formas-pago-mes?from=${today}&to=${today}&format=${format}`,
        admin,
      );
      expect(r.status, format).toBe(200);
      expect(r.type, format).toContain(type);
    }
  });

  it("la cajera no ve los reportes de dinero", async () => {
    for (const name of ["formas-pago-mes", "diferencias-cuadre"])
      expect(
        (await request(`/reports/${name}?from=${today}&to=${today}`, ana.token))
          .status,
      ).toBe(403);
  });
});

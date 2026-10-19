// Reportes 35–40 (Clientes y crédito) contra la API real: antigüedad de
// créditos/contraentregas, deuda por cliente, clientes nuevos, frecuencia,
// inactivos y cobros por mes. Clientes, ventas y cobros propios; fechas de
// venta corridas en la base para fijar la antigüedad. Sólo API y base locales.
import { conClave } from "./setup/con-clave";
import { requireLocalTargets } from "./setup/integration-api";
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
requireLocalTargets();
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.11." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "FitStore-QA-RepCli-2026!";
const PASSWORD = "FitStore-QA-RepCli-Definitiva-2026!";

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

type Actor = { id: string; token: string; cash: any };
let owner = "",
  variantId = "",
  productId = "",
  originalSettings: any,
  admin: Actor,
  viewer = "";
const createdUsers: string[] = [];
let roleId = "";

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await request("/terminals/register", token, {
    id,
    name: "QA rep clientes " + label + " " + suffix,
    secret: "qa-repcli-" + id,
  });
  if (t.body?.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}
async function person(label: string, role: { id: string }, withCash: boolean) {
  const email = `qa-repcli-${label}-${suffix}@example.test`;
  const user = await ok("/users", owner, {
    name: `QA ${label} ${suffix}`,
    email,
    password: TEMPORARY,
    pin: "246813",
    roleId: role.id,
  });
  createdUsers.push(user.id);
  const login = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: TEMPORARY,
    newPassword: PASSWORD,
    confirmPassword: PASSWORD,
  });
  await terminal(login.accessToken, label);
  const cash = withCash
    ? await ok("/cash-sessions/open", login.accessToken, {
        registerId: "qa-repcli-" + label + "-" + suffix,
        openingAmount: 0,
      })
    : null;
  return { id: user.id, token: login.accessToken, cash } as Actor;
}

const bizDay = (daysAgo: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
  }).format(new Date(Date.now() - daysAgo * 86400000));
const today = bizDay(0);
const report = (name: string, from: string, to = today, as = owner) =>
  ok(`/reports/${name}?from=${from}&to=${to}`, as).then((r: any) => r.rows);

const customers: Record<"a" | "b" | "c", { id: string; name: string }> =
  {} as any;
const PHONE = "8095551234";
const sold: Record<string, string> = {};
async function sell(
  key: string,
  customer: "a" | "b" | "c",
  total: number,
  method: string,
  daysAgo: number,
) {
  const sale = await ok("/sales", admin.token, {
    offlineUuid: randomUUID(),
    customerId: customers[customer].id,
    cashSessionId: admin.cash.id,
    items: [{ variantId, qty: total / 100 }],
    payments: [{ method, amount: total }],
    expectedTotal: total,
  });
  sold[key] = sale.id;
  // La antigüedad sale de la fecha de la venta: se corre en la base.
  if (daysAgo)
    await db.sale.update({
      where: { id: sale.id },
      data: { createdAt: new Date(Date.now() - daysAgo * 86400000) },
    });
  return sale;
}

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
  for (const k of ["a", "b", "c"] as const) {
    const name = `QA repcli ${k} ${suffix}`;
    customers[k] = {
      id: (await ok("/customers", owner, { name, phone: PHONE })).id,
      name,
    };
  }
  const cats = await ok("/categories", owner);
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA repcli prod " + suffix,
    sku: "QARC-" + tag,
    categoryId: cats.find((c: any) => c.name === "Fajas").id,
    taxRate: 0,
    variants: [
      {
        sku: "QARC-V-" + tag,
        barcode: "QARC-B-" + tag,
        price: 100,
        costAvg: 40,
      },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", owner, {
    variantId,
    qty: 100,
    reason: "QA reportes clientes",
  });
  const roles = await ok("/roles", owner);
  admin = await person(
    "admin",
    roles.find((r: any) => r.name === "admin"),
    true,
  );
  // Rol que sólo ve reportes: no puede ver datos personales del cliente.
  roleId = (
    await db.role.create({
      data: { name: "qa-repcli-" + suffix, permissions: ["reports:read"] },
    })
  ).id;
  viewer = (await person("lectora", { id: roleId }, false)).token;

  // a: hoy 200 (cobra 50 en efectivo) y hace 20 días 300 (transferencia de
  // 30 sin verificar); b: hace 45 días 400 y hace 90 días 500; c: contado
  // hace 100 días (inactivo).
  await sell("a0", "a", 200, "cod", 0);
  await sell("a20", "a", 300, "cod", 20);
  await sell("b45", "b", 400, "cod", 45);
  await sell("b90", "b", 500, "cod", 90);
  await sell("c100", "c", 100, "cash", 100);
  await ok("/sales/" + sold.a0 + "/credit-collections", admin.token, {
    operationId: randomUUID(),
    cashSessionId: admin.cash.id,
    lines: [{ method: "cash", amount: 50 }],
  });
  await ok("/sales/" + sold.a20 + "/cod-collections", admin.token, {
    offlineUuid: randomUUID(),
    cashSessionId: admin.cash.id,
    amount: 30,
    method: "transfer",
    bank: "Banco QA",
    reference: "REF-" + tag,
  });
}, 180000);

afterAll(async () => {
  if (admin?.cash)
    await request("/cash-sessions/" + admin.cash.id + "/close", owner, {
      countedCash: 50,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de reportes de clientes",
    });
  if (originalSettings)
    await request("/settings", owner, originalSettings, "PUT");
  if (productId)
    await request("/products/" + productId, owner, { active: false }, "PATCH");
  for (const id of createdUsers)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

const mine = (rows: any[]) =>
  rows.filter((r) => String(r.Cliente ?? "").endsWith(suffix));

describe("Reportes · Clientes y crédito", () => {
  it("aparecen en la lista de reportes", async () => {
    const names = (await ok("/reportes", owner)).map((r: any) => r.name);
    for (const name of [
      "creditos-por-antiguedad",
      "clientes-con-mas-deuda",
      "clientes-nuevos-por-mes",
      "frecuencia-de-compra",
      "clientes-inactivos",
      "cobros-por-mes",
    ])
      expect(names).toContain(name);
  });

  it("35 · antigüedad: tramos por días y el resumen cuadra con el detalle", async () => {
    const rows = await report("creditos-por-antiguedad", bizDay(30));
    const detail = mine(rows);
    const by = Object.fromEntries(detail.map((r: any) => [r.Factura, r]));
    const numbers = await db.sale.findMany({
      where: { id: { in: Object.values(sold) } },
      select: { id: true, number: true, creditBalance: true },
    });
    const n = (k: string) => numbers.find((s: any) => s.id === sold[k]);
    expect(by[n("a0").number]).toMatchObject({
      Tramo: "0-15 días",
      Tipo: "Contraentrega",
      Días: 0,
      Saldo: 150,
    });
    // La transferencia sin verificar no descuenta el saldo.
    expect(by[n("a20").number]).toMatchObject({
      Tramo: "16-30 días",
      Saldo: 300,
    });
    expect(by[n("b45").number]).toMatchObject({
      Tramo: "31-60 días",
      Saldo: 400,
    });
    expect(by[n("b90").number]).toMatchObject({
      Tramo: "Más de 60 días",
      Saldo: 500,
    });
    expect(by[n("c100").number]).toBeUndefined();
    // Cada saldo coincide con la base, y cada resumen con su detalle completo.
    for (const k of ["a0", "a20", "b45", "b90"])
      expect(by[n(k).number].Saldo).toBe(Number(n(k).creditBalance));
    for (const s of rows.filter((r: any) => r.Factura === "Resumen")) {
      const d = rows.filter(
        (r: any) => r.Factura !== "Resumen" && r.Tramo === s.Tramo,
      );
      expect(s.Facturas).toBe(d.length);
      expect(s.Saldo).toBeCloseTo(
        d.reduce((t: number, r: any) => t + r.Saldo, 0),
        2,
      );
    }
  });

  it("36 · clientes con más deuda", async () => {
    const rows = mine(await report("clientes-con-mas-deuda", bizDay(30)));
    const by = Object.fromEntries(rows.map((r: any) => [r.Cliente, r]));
    expect(by[customers.b.name]).toMatchObject({
      "Facturas abiertas": 2,
      Deuda: 900,
      "Días de la más antigua": 90,
    });
    expect(by[customers.a.name]).toMatchObject({
      "Facturas abiertas": 2,
      Deuda: 450,
    });
    expect(by[customers.c.name]).toBeUndefined();
    expect(rows.indexOf(by[customers.b.name])).toBeLessThan(
      rows.indexOf(by[customers.a.name]),
    );
    expect(by[customers.a.name].Teléfono).toBe(PHONE);
  });

  it("37 · clientes nuevos por mes cuadra con la base", async () => {
    const rows = await report("clientes-nuevos-por-mes", today);
    expect(rows).toHaveLength(1);
    const expected = await db.customer.count({
      where: {
        branchId: "main",
        createdAt: {
          gte: new Date(today + "T00:00:00-04:00"),
          lte: new Date(today + "T23:59:59.999-04:00"),
        },
      },
    });
    expect(rows[0]["Clientes nuevos"]).toBe(expected);
    expect(rows[0]["Clientes nuevos"]).toBeGreaterThanOrEqual(3);
    expect(rows[0]["Ya compraron"]).toBeGreaterThanOrEqual(3);
  });

  it("38 · frecuencia de compra", async () => {
    const rows = mine(await report("frecuencia-de-compra", bizDay(30)));
    const by = Object.fromEntries(rows.map((r: any) => [r.Cliente, r]));
    expect(by[customers.a.name]).toMatchObject({
      Compras: 2,
      "Ventas netas": 500,
      "Promedio de días entre compras": 20,
      "Última compra": today,
    });
    expect(by[customers.b.name]).toBeUndefined();
    const wide = mine(await report("frecuencia-de-compra", bizDay(120)));
    const b = wide.find((r: any) => r.Cliente === customers.b.name);
    expect(b).toMatchObject({
      Compras: 2,
      "Ventas netas": 900,
      "Promedio de días entre compras": 45,
      "Última compra": bizDay(45),
    });
  });

  it("39 · inactivos: compró antes y no en los últimos 60 días", async () => {
    const rows = mine(await report("clientes-inactivos", bizDay(30)));
    expect(rows.map((r: any) => r.Cliente)).toEqual([customers.c.name]);
    expect(rows[0]).toMatchObject({
      "Días sin comprar": 100,
      "Última compra": bizDay(100),
      Compras: 1,
      "Ventas netas": 100,
    });
  });

  it("40 · cobros por mes: sólo abonos verificados, cuadra con la base", async () => {
    const rows = await report("cobros-por-mes", today);
    const window = {
      gte: new Date(today + "T00:00:00-04:00"),
      lte: new Date(today + "T23:59:59.999-04:00"),
    };
    const sums = await db.payment.groupBy({
      by: ["method"],
      where: {
        entryType: "installment",
        status: "ok",
        createdAt: window,
        sale: { branchId: "main" },
      },
      _sum: { amount: true },
      _count: true,
    });
    const label: Record<string, string> = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
    };
    expect(rows).toHaveLength(sums.length);
    for (const s of sums) {
      const row = rows.find(
        (r: any) => r["Forma de pago"] === (label[s.method] ?? s.method),
      );
      expect(row).toMatchObject({
        Mes: today.slice(0, 7),
        Cobros: s._count,
        Monto: Number(s._sum.amount),
      });
    }
    const cash = rows.find((r: any) => r["Forma de pago"] === "Efectivo");
    expect(cash.Monto).toBeGreaterThanOrEqual(50);
    // La transferencia de 30 quedó por verificar: no es dinero cobrado.
    const pending = await db.payment.findFirst({
      where: { saleId: sold.a20, entryType: "installment" },
    });
    expect(pending.status).toBe("pending_verification");
    // Ni el pago original de las ventas (entryType sale) entra.
    expect(rows.reduce((t: number, r: any) => t + r.Monto, 0)).toBeCloseTo(
      sums.reduce((t: number, s: any) => t + Number(s._sum.amount), 0),
      2,
    );
  });

  it("privacidad: quien no ve datos personales recibe el teléfono enmascarado", async () => {
    const rows = mine(
      await report("clientes-con-mas-deuda", bizDay(30), today, viewer),
    );
    const a = rows.find((r: any) => r.Cliente === customers.a.name);
    expect(a.Teléfono).toBe("•••••••234");
    expect(JSON.stringify(rows)).not.toContain(PHONE);
  });

  it("Excel y PDF", async () => {
    for (const format of ["xlsx", "pdf"]) {
      const r = await fetch(
        `${base}/reports/creditos-por-antiguedad?from=${bizDay(30)}&to=${today}&format=${format}`,
        {
          headers: { Authorization: "Bearer " + owner, "X-Forwarded-For": ip },
        },
      );
      expect(r.status).toBe(200);
      const buffer = Buffer.from(await r.arrayBuffer());
      expect(
        buffer.subarray(0, format === "pdf" ? 5 : 2).toString("ascii"),
      ).toBe(format === "pdf" ? "%PDF-" : "PK");
    }
  });
});

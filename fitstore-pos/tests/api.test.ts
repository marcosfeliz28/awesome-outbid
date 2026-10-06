import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: new URL("../.env", import.meta.url).pathname,
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const fixtureDb = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
let token = "",
  ownerToken = "",
  sellerToken = "";
let supplierId = "",
  session: any,
  sellerSession: any,
  supplement: any,
  clothing: any,
  sale: any;
const actors: any[] = [],
  products: any[] = [];
const suffix = Date.now().toString(36);
const testIp = "192.0.2." + ((Date.now() % 250) + 1);
const authIp = "203.0.113." + ((Date.now() % 250) + 1);
const rateIp = "198.51.100." + ((Date.now() % 250) + 1);
async function request(
  path: string,
  data?: unknown,
  as = token,
  method = data === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": testIp,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
async function ok(path: string, data?: unknown, as = token, method?: string) {
  const r = await request(path, data, as, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
const input = (id: string, total: number, s = session) => ({
  offlineUuid: randomUUID(),
  cashSessionId: s.id,
  items: [{ variantId: id, qty: 1 }],
  payments: [{ method: "cash", amount: total }],
  expectedTotal: total,
});
// Ronda 4: toda operación de stock o caja exige un equipo aprobado.
const secretOf = (id: string) => "qa-secret-" + id;
const tokenTerminal = new Map<string, string>();
async function registerTerminal(as: string, id: string, name: string) {
  const t = await ok(
    "/terminals/register",
    { id, name, secret: secretOf(id) },
    as,
  );
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", {}, ownerToken);
  tokenTerminal.set(as, id);
  return id;
}
const enroll = (as: string, name = "QA equipo " + randomUUID().slice(0, 6)) =>
  registerTerminal(as, randomUUID(), name);
beforeAll(async () => {
  ownerToken = token = (
    await ok(
      "/auth/login",
      {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      },
      "",
    )
  ).accessToken;
  await enroll(ownerToken, "QA dueño");
  const roles = await ok("/roles");
  for (const role of ["admin", "seller", "manager"]) {
    const u = await ok("/users", {
      name: "QA " + role + " " + suffix,
      email: `qa-${role}-${suffix}@example.test`,
      password: "FitStore-QA-2026!",
      pin: role === "manager" ? "987654" : "876543",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    actors.push(u);
    const auth = await ok(
      "/auth/login",
      { email: u.email, password: "FitStore-QA-2026!" },
      "",
    );
    await enroll(auth.accessToken, "QA " + role);
    if (role === "admin") token = auth.accessToken;
    if (role === "seller") sellerToken = auth.accessToken;
  }
  const cats = await ok("/categories");
  supplierId = (await ok("/suppliers"))[0].id;
  supplement = await ok("/products", {
    name: "QA Proteína " + suffix,
    sku: "QA-S-" + suffix,
    categoryId: cats.find((c: any) => c.name === "Suplementos").id,
    variants: [
      {
        sku: "QA-SV-" + suffix,
        barcode: "QA-SB-" + suffix,
        costAvg: 100,
        price: 236,
      },
    ],
  });
  products.push(supplement);
  clothing = await ok("/products", {
    name: "QA Legging " + suffix,
    sku: "QA-C-" + suffix,
    categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
    variants: [
      {
        sku: "QA-CV-" + suffix,
        barcode: "QA-CB-" + suffix,
        costAvg: 40,
        price: 118,
        attributes: { talla: "M", color: "Negro" },
      },
    ],
  });
  products.push(clothing);
  for (const [lot, days] of [
    ["QA-B", 90],
    ["QA-A", 45],
  ] as const)
    await ok("/inventory/adjustments", {
      variantId: supplement.variants[0].id,
      qty: 5,
      reason: "QA lote",
      lotNumber: lot,
      expiryDate: new Date(Date.now() + days * 86400000).toISOString(),
    });
  await ok("/inventory/adjustments", {
    variantId: clothing.variants[0].id,
    qty: 10,
    reason: "QA apertura",
  });
  session = await ok("/cash-sessions/open", {
    registerId: "qa-admin-" + suffix,
    openingAmount: 500,
  });
  sellerSession = await ok(
    "/cash-sessions/open",
    { registerId: "qa-seller-" + suffix, openingAmount: 100 },
    sellerToken,
  );
});
afterAll(async () => {
  for (const [s, t] of [
    [session, token],
    [sellerSession, sellerToken],
  ])
    if (s) {
      const current = (await ok("/cash-sessions", undefined, t)).find(
        (i: any) => i.id === s.id,
      );
      if (!current.closedAt)
        await ok(
          "/cash-sessions/" + s.id + "/close",
          {
            countedCash: Math.max(0, current.expected.cash),
            countedCard: Math.max(0, current.expected.card),
            countedTransfer: Math.max(0, current.expected.transfer),
            notes: "Cierre de pruebas",
          },
          t,
        );
    }
  for (const p of products)
    await request("/products/" + p.id, { active: false }, ownerToken, "PATCH");
  for (const u of actors)
    await request("/users/" + u.id, { active: false }, ownerToken, "PATCH");
});
describe("Aceptación financiera y permisos", () => {
  it("requiere sesión y el vendedor nunca recibe costos", async () => {
    expect((await request("/products", undefined, "")).status).toBe(401);
    const catalog = JSON.stringify(
      await ok("/products", undefined, sellerToken),
    );
    expect(catalog).not.toContain("costAvg");
    expect(catalog).not.toContain('"cost"');
    expect(
      JSON.stringify(await ok("/inventory/movements", undefined, sellerToken)),
    ).not.toContain("unitCost");
    expect(
      (await request("/dashboard/summary", undefined, sellerToken)).status,
    ).toBe(403);
    expect((await request("/users", undefined, sellerToken)).status).toBe(403);
  });
  it("vende proteína y legging con FEFO y pago dividido", async () => {
    sale = await ok("/sales", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      items: [
        { variantId: supplement.variants[0].id, qty: 1 },
        { variantId: clothing.variants[0].id, qty: 1 },
      ],
      payments: [
        { method: "cash", amount: 250 },
        {
          method: "card",
          amount: 150,
          cardLast4: "4242",
          approvalCode: "QA-001",
        },
      ],
      expectedTotal: 354,
    });
    expect(Number(sale.total)).toBe(354);
    expect(Number(sale.taxTotal)).toBe(54);
    expect(Number(sale.costTotal)).toBe(140);
    expect(
      Number(sale.payments.find((p: any) => p.method === "cash").change),
    ).toBe(46);
    const p = await ok("/products/" + supplement.id);
    expect(Number(p.variants[0].stock)).toBe(9);
    expect(
      Number(p.variants[0].lots.find((l: any) => l.lotNumber === "QA-A").qty),
    ).toBe(4);
    expect(
      Number(p.variants[0].lots.find((l: any) => l.lotNumber === "QA-B").qty),
    ).toBe(5);
  });
  it("rechaza pagos y stock inválidos sin crear huecos ni movimientos", async () => {
    const before = (await ok("/sales"))[0].number;
    const valid = input(clothing.variants[0].id, 118);
    expect(
      (
        await request("/sales", {
          ...valid,
          payments: [{ method: "cash", amount: 1 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/sales", {
          ...valid,
          payments: [
            {
              method: "card",
              amount: 200,
              cardLast4: "4242",
              approvalCode: "QA",
            },
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/sales", {
          ...valid,
          items: [{ variantId: clothing.variants[0].id, qty: 1000 }],
          payments: [{ method: "cash", amount: 118000 }],
          expectedTotal: 118000,
        })
      ).status,
    ).toBe(400);
    expect((await ok("/sales"))[0].number).toBe(before);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(9);
  });
  it("es idempotente ante peticiones concurrentes y sync", async () => {
    const payload = input(clothing.variants[0].id, 118);
    const [a, b] = await Promise.all([
      ok("/sales", payload),
      ok("/sales", payload),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(8);
    expect(
      (await ok("/sales/sync", { sales: [payload] })).results[0].sale.id,
    ).toBe(a.id);
    expect(
      (
        await request("/sales", {
          ...payload,
          payments: [{ method: "cash", amount: 200 }],
        })
      ).status,
    ).toBe(400);
  });
  it("25% requiere PIN del gerente y queda auditado", async () => {
    const payload = {
      ...input(clothing.variants[0].id, 88.5, sellerSession),
      items: [
        { variantId: clothing.variants[0].id, qty: 1, discountPercent: 25 },
      ],
    };
    expect((await request("/sales", payload, sellerToken)).status).toBe(400);
    const r = await ok(
      "/sales",
      { ...payload, managerPin: "987654" },
      sellerToken,
    );
    expect(Number(r.total)).toBe(88.5);
    expect(JSON.stringify(r)).not.toContain("unitCost");
    expect(
      (await ok("/audit-log")).some(
        (a: any) => a.action === "discount_approved" && a.entityId === r.id,
      ),
    ).toBe(true);
  });
  it("prorratea flete, recalcula promedio y conserva costo histórico", async () => {
    const po = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: supplement.variants[0].id, qty: 3, unitCost: 150 }],
    });
    await ok("/purchase-orders/" + po.id + "/receive", {
      freight: 30,
      items: [
        {
          itemId: po.items[0].id,
          qty: 3,
          lotNumber: "QA-C",
          expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
        },
      ],
    });
    const p = await ok("/products/" + supplement.id);
    expect(Number(p.variants[0].stock)).toBe(12);
    expect(Number(p.variants[0].costAvg)).toBe(115);
    const sold = (await ok("/sales")).find((s: any) => s.id === sale.id);
    expect(
      Number(
        sold.items.find((i: any) => i.variantId === supplement.variants[0].id)
          .unitCost,
      ),
    ).toBe(100);
  });
  it("protege devoluciones abiertas y repetidas", async () => {
    const line = sale.items.find(
      (i: any) => i.variantId === supplement.variants[0].id,
    );
    const payload = {
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA devolución",
      refundMethod: "cash",
      items: [{ saleItemId: line.id, qty: 1, restock: true, opened: true }],
    };
    expect((await request("/returns", payload)).status).toBe(400);
    const fixed = {
      ...payload,
      items: [{ saleItemId: line.id, qty: 1, restock: true, opened: false }],
    };
    expect(Number((await ok("/returns", fixed)).total)).toBe(236);
    expect((await request("/returns", fixed)).status).toBe(400);
    expect(
      (
        await request("/sales/" + sale.id + "/void", {
          reason: "QA anular",
          cashSessionId: session.id,
        })
      ).status,
    ).toBe(400);
  });
  it("evalúa vencimiento, rotación y presupuesto", async () => {
    expect(
      (await ok("/promotions/clearance-candidates")).some(
        (c: any) => c.daysIdle >= 60,
      ),
    ).toBe(true);
    const alerts = await ok("/alerts");
    expect(alerts.some((a: any) => a.type === "expiring")).toBe(true);
    expect(
      (await ok("/alerts?type=expense_budget")).some(
        (a: any) => a.type === "expense_budget",
      ),
    ).toBe(true);
  });
  it("conserva conflictos offline sin stock negativo", async () => {
    const payload = {
      ...input(clothing.variants[0].id, 118000),
      items: [{ variantId: clothing.variants[0].id, qty: 1000 }],
    };
    expect(
      (await ok("/sales/sync", { sales: [payload] })).results[0].status,
    ).toBe("conflict");
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBeGreaterThanOrEqual(0);
    expect(
      (await ok("/alerts?entityId=" + payload.offlineUuid)).some(
        (a: any) => a.entityId === payload.offlineUuid,
      ),
    ).toBe(true);
  });
  it("exporta los 17 reportes, PDF y Excel", async () => {
    for (const name of [
      "sales",
      "monthly-consumption",
      "profit",
      "inventory-value",
      "kardex",
      "low-stock",
      "no-movement",
      "expiring",
      "abc",
      "expenses",
      "income-statement",
      "cash",
      "by-seller",
      "by-payment",
      "returns-discounts",
      "customers",
      "purchases",
    ])
      expect(Array.isArray((await ok("/reports/" + name)).rows)).toBe(true);
    for (const [path, magic] of [
      ["/sales/" + sale.id + "/receipt.pdf", "%PDF"],
      ["/reports/sales?format=pdf", "%PDF"],
      ["/reports/sales?format=xlsx", "PK"],
      ["/catalog-template.xlsx", "PK"],
    ]) {
      const r = await fetch(base + path, {
        headers: { Authorization: "Bearer " + token },
      });
      expect(r.ok).toBe(true);
      expect(
        Buffer.from(await r.arrayBuffer())
          .subarray(0, magic.length)
          .toString(),
      ).toBe(magic);
    }
  });
  it("calcula arqueo por método aunque se compensen diferencias", async () => {
    const s = (await ok("/cash-sessions")).find(
      (s: any) => s.id === session.id,
    );
    const r = await ok("/cash-sessions/" + s.id + "/close", {
      countedCash: s.expected.cash + 10,
      countedCard: s.expected.card - 10,
      countedTransfer: s.expected.transfer,
    });
    expect(Number(r.difference)).toBe(0);
    expect(r.differences.cash).toBe(10);
    expect(r.differences.card).toBe(-10);
    expect(
      (await request("/sales", input(clothing.variants[0].id, 118))).status,
    ).toBe(404);
  });
});

describe("Regresiones de Claude", () => {
  beforeAll(async () => {
    session = await ok("/cash-sessions/open", {
      registerId: "qa-regression-" + suffix,
      openingAmount: 500,
    });
  });
  it("1 y 2: diez PIN concurrentes bloquean solo al solicitante y contraseña no los reinicia", async () => {
    const target = actors.find((u) => u.email.includes("qa-manager"));
    try {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          request(
            "/auth/pin",
            { userId: target.id, pin: "000000" },
            sellerToken,
          ),
        ),
      );
      expect(
        (
          await request(
            "/auth/pin",
            { userId: target.id, pin: "987654" },
            sellerToken,
          )
        ).body.message,
      ).toMatch(/bloquead/i);
      expect(
        (
          await request(
            "/auth/login",
            { email: target.email, password: "FitStore-QA-2026!" },
            "",
          )
        ).status,
      ).toBe(201);
      expect((await request("/auth/me", undefined, sellerToken)).status).toBe(
        200,
      );
      expect(
        (
          await request(
            "/auth/pin",
            { userId: target.id, pin: "987654" },
            sellerToken,
          )
        ).body.message,
      ).toMatch(/bloquead/i);
    } finally {
      await fixtureDb.user.update({
        where: { id: target.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }
  });
  it("3: rechaza ajustes vencidos y acepta el día dominicano vigente", async () => {
    const r = await request("/inventory/adjustments", {
      variantId: supplement.variants[0].id,
      qty: 1,
      reason: "QA vencimiento",
      lotNumber: "QA-EXPIRED",
      expiryDate: "2000-01-01T12:00:00.000Z",
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/vencid/i);
  });
  it("4: stock sin lote convive con lotes; conteo no destruye la trazabilidad", async () => {
    const id = clothing.variants[0].id;
    await ok("/inventory/adjustments", {
      variantId: id,
      qty: 10,
      reason: "QA sin lote",
    });
    await ok("/inventory/adjustments", {
      variantId: id,
      qty: 1,
      reason: "QA con lote",
      lotNumber: "QA-OPTIONAL",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const p = await ok("/products/" + clothing.id);
    expect(p.variants[0].lots.some((l) => l.lotNumber === "QA-OPTIONAL")).toBe(
      true,
    );
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: 0 }],
    });
    expect(
      (await request("/inventory/counts/" + count.id + "/apply", {})).status,
    ).toBe(400);
    const sold = await ok("/sales", {
      ...input(id, 236),
      items: [{ variantId: id, qty: 2 }],
    });
    expect(Number(sold.total)).toBe(236);
  });
  it("5: gerente cierra caja ajena; diferencias compensadas persisten y se auditan", async () => {
    const c = (await ok("/cash-sessions", undefined, sellerToken)).find(
      (s) => s.id === sellerSession.id,
    );
    const r = await request("/cash-sessions/" + c.id + "/close", {
      countedCash: c.expected.cash - 10,
      countedCard: c.expected.card + 10,
      countedTransfer: c.expected.transfer,
    });
    expect(r.status).toBe(201);
    const closed = (await ok("/cash-sessions")).find((s) => s.id === c.id);
    expect(Number(closed.differenceCash)).toBe(-10);
    expect(Number(closed.differenceCard)).toBe(10);
    expect(
      (await ok("/audit-log")).some(
        (a) => a.entityId === c.id && a.action === "close_difference",
      ),
    ).toBe(true);
  });
  it("6: producción rechaza secretos de ejemplo o repetidos antes de conectar", () => {
    for (const secret of [
      "replace-with-a-random-secret-of-at-least-32-characters",
      "a".repeat(64),
      "0123456789abcdef".repeat(4),
    ]) {
      const c = spawnSync(process.execPath, ["dist/main.js"], {
        cwd: new URL("../apps/api", import.meta.url),
        env: {
          ...process.env,
          NODE_ENV: "production",
          JWT_SECRET: secret,
          DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/invalid",
        },
        timeout: 4000,
        encoding: "utf8",
      });
      expect(c.status).toBe(1);
      expect(c.stderr).toContain("JWT_SECRET");
      expect(c.stderr).not.toContain("Prisma");
    }
  });
  it("7: conflicto offline devuelve español seguro", async () => {
    const r = await ok("/sales/sync", { sales: [input(randomUUID(), 118)] });
    expect(r.results[0].status).toBe("conflict");
    expect(r.results[0].message).not.toMatch(
      /Prisma|findFirst|Invocation|Record|\.ts:/i,
    );
    expect(r.results[0].message).toMatch(/registro|operación|existe/i);
  });
  it("8: pagos del reporte compras pertenecen al mismo rango", async () => {
    const r = await ok("/reports/purchases?from=2000-01-01&to=2000-01-02");
    expect(r.rows.every((row) => row.Pagado === 0 && row.Compras === 0)).toBe(
      true,
    );
  });
  it("9: consumo agrupa por mes dominicano al cruzar medianoche UTC", async () => {
    const s = await ok("/sales", input(clothing.variants[0].id, 118));
    await fixtureDb.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date("2026-09-01T02:00:00Z") },
    });
    const r = await ok(
      "/reports/monthly-consumption?from=2026-08-31&to=2026-09-01",
    );
    expect(
      r.rows.some((row) => row.Mes_Producto === "2026-08 · " + clothing.name),
    ).toBe(true);
  });
  it("10: utilidad conserva costo de devolución sin reingreso", async () => {
    const s = await ok("/sales", input(clothing.variants[0].id, 118));
    await ok("/returns", {
      saleId: s.id,
      cashSessionId: session.id,
      reason: "QA dañado",
      refundMethod: "cash",
      items: [
        { saleItemId: s.items[0].id, qty: 1, restock: false, damaged: true },
      ],
    });
    const r = await ok("/reports/profit");
    const lines = await fixtureDb.saleItem.findMany({
      where: {
        variantId: clothing.variants[0].id,
        sale: {
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
          status: "completed",
        },
      },
    });
    expect(r.rows.find((row) => row.Producto === clothing.name).Costo).toBe(
      lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.unitCost), 0),
    );
  });
  it("11: reintentar venta aprobada no requiere de nuevo PIN", async () => {
    const prev = (await ok("/sales", undefined, sellerToken)).find(
      (s) => Number(s.discountTotal) > 0,
    );
    expect(
      (
        await request(
          "/sales",
          {
            offlineUuid: prev.offlineUuid,
            cashSessionId: sellerSession.id,
            items: [
              {
                variantId: clothing.variants[0].id,
                qty: 1,
                discountPercent: 25,
              },
            ],
            payments: [{ method: "cash", amount: 88.5 }],
            expectedTotal: 88.5,
          },
          sellerToken,
        )
      ).status,
    ).toBe(201);
  });
  it("12: índice parcial impide apertura concurrente de terminal", async () => {
    const manager = actors.find((u) => u.email.includes("qa-manager"));
    const auth = await ok(
      "/auth/login",
      { email: manager.email, password: "FitStore-QA-2026!" },
      "",
    );
    // Con equipos, la caja usa el equipo de la sesión: dos usuarios en el
    // mismo equipo no pueden tener cajas abiertas a la vez.
    await registerTerminal(
      auth.accessToken,
      session.registerId,
      "QA compartido",
    );
    expect(
      (
        await request(
          "/cash-sessions/open",
          { registerId: session.registerId, openingAmount: 0 },
          auth.accessToken,
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      await fixtureDb.cashSession.count({
        where: { registerId: session.registerId, closedAt: null },
      }),
    ).toBe(1);
  });
});
afterAll(async () => {
  await fixtureDb.$disconnect();
});

describe("Seguridad, offline y funciones completadas", () => {
  async function loginRaw(user: any, password = "FitStore-QA-2026!") {
    return fetch(base + "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": authIp,
      },
      body: JSON.stringify({ email: user.email, password }),
    });
  }
  async function newUser(role = "seller") {
    const roles = await ok("/roles");
    const user = await ok("/users", {
      name: "QA extensión",
      email: randomUUID() + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "876543",
      roleId: roles.find((r) => r.name === role).id,
    });
    actors.push(user);
    return user;
  }
  it("1: contraseñas concurrentes incrementan atómicamente y bloquean tras cinco", async () => {
    const u = await newUser();
    await Promise.all(
      Array.from({ length: 10 }, () => loginRaw(u, "incorrecta")),
    );
    const r = await loginRaw(u);
    expect(r.status).toBe(400);
    expect((await r.json()).message).toMatch(/bloquead/i);
    const stored = await fixtureDb.user.findUnique({ where: { id: u.id } });
    expect(stored.failedAttempts).toBe(5);
  });
  it("1–2: PIN de gerente tiene contador propio sin cerrar sesión del vendedor", async () => {
    sellerSession = await ok(
      "/cash-sessions/open",
      { registerId: "qa-approval-" + suffix, openingAmount: 0 },
      sellerToken,
    );
    const payload = () => ({
      ...input(clothing.variants[0].id, 88.5, sellerSession),
      items: [
        { variantId: clothing.variants[0].id, qty: 1, discountPercent: 25 },
      ],
      managerPin: "000000",
    });
    const errors = await Promise.all(
      Array.from({ length: 10 }, () =>
        request("/sales", payload(), sellerToken),
      ),
    );
    expect(errors.every((r) => r.status === 400)).toBe(true);
    expect(
      (
        await request(
          "/sales",
          { ...payload(), managerPin: "987654" },
          sellerToken,
        )
      ).body.message,
    ).toMatch(/bloquead/i);
    expect((await request("/auth/me", undefined, sellerToken)).status).toBe(
      200,
    );
  });
  it("1: limita ventas detrás del proxy y separa direcciones IP", async () => {
    const send = (ip: string) =>
      fetch(base + "/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
          "X-Forwarded-For": ip,
        },
        body: "{}",
      });
    const results = [];
    for (let n = 0; n < 121; n++) results.push((await send(rateIp)).status);
    expect(results.slice(0, 120).every((n) => n === 400)).toBe(true);
    expect(results[120]).toBe(429);
    expect((await send("198.18.0.10")).status).toBe(400);
  });
  it("3 y 9: lote vencido según Santo Domingo no se vende ni se recibe", async () => {
    const p = await ok("/products", {
      name: "QA vencimiento SD " + suffix,
      sku: "QA-SD-" + suffix,
      categoryId: supplement.categoryId,
      variants: [
        {
          sku: "QA-SDV-" + suffix,
          barcode: "QA-SDB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(p);
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: 1,
      reason: "QA vencimiento",
      lotNumber: "QA-BOUNDARY",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const day = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    await fixtureDb.lot.updateMany({
      where: { variantId: p.variants[0].id },
      data: { expiryDate: new Date(day + "T02:00:00Z") },
    });
    expect((await request("/sales", input(p.variants[0].id, 118))).status).toBe(
      400,
    );
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: p.variants[0].id, qty: 1, unitCost: 10 }],
    });
    expect(
      (
        await request("/purchase-orders/" + order.id + "/receive", {
          items: [
            {
              itemId: order.items[0].id,
              qty: 1,
              lotNumber: "QA-EXPIRED",
              expiryDate: "2000-01-01T12:00:00.000Z",
            },
          ],
        })
      ).status,
    ).toBe(400);
  });
  it("4: diez unidades sin lote más una con lote permiten vender dos", async () => {
    const id = clothing.variants[0].id;
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: 10 }],
    });
    await ok("/inventory/counts/" + count.id + "/apply", {});
    await ok("/inventory/adjustments", {
      variantId: id,
      qty: 1,
      reason: "QA lote opcional",
      lotNumber: "QA-MIXED",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const sold = await ok("/sales", {
      ...input(id, 236),
      items: [{ variantId: id, qty: 2 }],
    });
    expect(Number(sold.total)).toBe(236);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(9);
  });
  it("7: sincroniza en caja cerrada dentro de su horario y audita el reajuste", async () => {
    const cash = (await ok("/cash-sessions")).find((c) => c.id === session.id);
    const capturedAt = new Date().toISOString();
    const payload = { ...input(clothing.variants[0].id, 118), capturedAt };
    await ok("/cash-sessions/" + cash.id + "/close", {
      countedCash: cash.expected.cash,
      countedCard: cash.expected.card,
      countedTransfer: cash.expected.transfer,
    });
    expect((await request("/sales", payload)).status).toBe(404);
    const synced = await ok("/sales/sync", { sales: [payload] });
    expect(synced.results[0].status).toBe("synced");
    const adjusted = (await ok("/cash-sessions")).find((c) => c.id === cash.id);
    expect(Number(adjusted.differenceCash)).toBe(-118);
    expect(
      (await ok("/audit-log")).some(
        (a) => a.action === "offline_after_close" && a.entityId === cash.id,
      ),
    ).toBe(true);
    const outside = await ok("/sales/sync", {
      sales: [
        {
          ...payload,
          offlineUuid: randomUUID(),
          capturedAt: new Date(
            +new Date(adjusted.closedAt) + 1000,
          ).toISOString(),
        },
      ],
    });
    expect(outside.results[0].status).toBe("conflict");
    session = await ok("/cash-sessions/open", {
      registerId: "qa-extra-" + suffix,
      openingAmount: 500,
    });
  });
  it("8: pago actual no se resta en reporte de otro período", async () => {
    const payment = await fixtureDb.supplierPayment.create({
      data: {
        supplierId,
        amount: 123,
        method: "cash",
        createdBy: "QA temporal",
        branchId: "main",
      },
    });
    try {
      const r = await ok("/reports/purchases?from=2000-01-01&to=2000-01-02");
      expect(r.rows.every((row) => row.Pagado === 0)).toBe(true);
    } finally {
      await fixtureDb.supplierPayment.delete({ where: { id: payment.id } });
    }
  });
  it("descuento por monto recalcula impuesto y queda auditado", async () => {
    const s = await ok("/sales", {
      ...input(clothing.variants[0].id, 100),
      items: [
        { variantId: clothing.variants[0].id, qty: 1, discountAmount: 18 },
      ],
    });
    expect(Number(s.total)).toBe(100);
    expect(Number(s.discountTotal)).toBe(18);
    expect(Number(s.taxTotal)).toBe(15.25);
    expect(
      (await ok("/audit-log")).some(
        (a) => a.action === "discount_approved" && a.entityId === s.id,
      ),
    ).toBe(true);
    expect(
      (
        await request("/sales", {
          ...input(clothing.variants[0].id, 0),
          items: [
            { variantId: clothing.variants[0].id, qty: 1, discountAmount: 119 },
          ],
        })
      ).status,
    ).toBe(400);
  });
  it("nota de crédito se consume una sola vez con saldo protegido", async () => {
    const customer = await ok("/customers", { name: "QA notas " + suffix });
    const sold = await ok("/sales", {
      ...input(clothing.variants[0].id, 118),
      customerId: customer.id,
    });
    const returned = await ok("/returns", {
      saleId: sold.id,
      cashSessionId: session.id,
      reason: "QA nota",
      refundMethod: "credit_note",
      items: [{ saleItemId: sold.items[0].id, qty: 1, restock: true }],
    });
    const note = (await ok("/credit-notes")).find(
      (n) => n.returnId === returned.id,
    );
    const payment = {
      method: "credit_note",
      amount: 118,
      creditNoteId: note.id,
    };
    const payload = {
      ...input(clothing.variants[0].id, 118),
      customerId: customer.id,
      payments: [payment],
      managerPin: "987654",
    };
    const [a, b] = await Promise.all([
      ok("/sales", payload),
      ok("/sales", payload),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      Number(
        (await fixtureDb.creditNote.findUnique({ where: { id: note.id } }))
          .balance,
      ),
    ).toBe(0);
    expect(
      (await request("/sales", { ...payload, offlineUuid: randomUUID() }))
        .status,
    ).toBe(400);
    await ok("/sales/" + a.id + "/void", {
      reason: "QA restaurar nota",
      cashSessionId: session.id,
    });
    expect(
      Number(
        (await fixtureDb.creditNote.findUnique({ where: { id: note.id } }))
          .balance,
      ),
    ).toBe(118);
  });
  it("venta a crédito admite abonos idempotentes en caja posterior", async () => {
    const settings = await ok("/settings");
    await ok(
      "/settings",
      { ...settings, allowCreditSales: true },
      token,
      "PUT",
    );
    try {
      const customer = await ok("/customers", {
        name: "QA crédito " + suffix,
        creditLimit: 500,
      });
      const sold = await ok("/sales", {
        ...input(clothing.variants[0].id, 118),
        customerId: customer.id,
        creditDueDate: "2030-01-01T12:00:00.000Z",
        payments: [{ method: "credit", amount: 118 }],
      });
      expect(Number(sold.creditBalance)).toBe(118);
      const before = (await ok("/cash-sessions")).find(
        (c) => c.id === session.id,
      ).expected.cash;
      const payload = {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        method: "cash",
        amount: 50,
      };
      const [a, b] = await Promise.all([
        ok("/sales/" + sold.id + "/installments", payload),
        ok("/sales/" + sold.id + "/installments", payload),
      ]);
      expect(a.id).toBe(b.id);
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(68);
      expect(
        (await ok("/cash-sessions")).find((c) => c.id === session.id).expected
          .cash,
      ).toBe(before + 50);
      expect(
        (
          await request("/sales/" + sold.id + "/installments", {
            ...payload,
            offlineUuid: randomUUID(),
            amount: 69,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await request("/sales/" + sold.id + "/void", {
            cashSessionId: session.id,
            reason: "QA abonos",
          })
        ).status,
      ).toBe(400);
      const returned = await ok("/returns", {
        saleId: sold.id,
        cashSessionId: session.id,
        reason: "QA devolución crédito",
        refundMethod: "cash",
        items: [{ saleItemId: sold.items[0].id, qty: 1, restock: true }],
      });
      expect(Number(returned.refundAmount)).toBe(50);
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(0);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("cambiar PIN o contraseña revoca refresh y acceso anteriores", async () => {
    for (const change of [
      { pin: "123456" },
      { password: "FitStore-New-QA-2026!" },
    ]) {
      const u = await newUser();
      const r = await loginRaw(u);
      const logged = await r.json();
      const cookie = r.headers.get("set-cookie")!.split(";")[0];
      await ok("/users/" + u.id, change, token, "PATCH");
      expect(
        (await request("/auth/me", undefined, logged.accessToken)).status,
      ).toBe(401);
      const refreshed = await fetch(base + "/auth/refresh", {
        method: "POST",
        headers: { Cookie: cookie, "X-Forwarded-For": authIp },
      });
      expect(refreshed.status).toBe(400);
      expect(
        await fixtureDb.refreshToken.count({ where: { userId: u.id } }),
      ).toBe(0);
    }
  });
  it("sessionTimeoutMinutes se aplica en API y respuesta de sesión", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, sessionTimeoutMinutes: 1 },
        token,
        "PUT",
      );
      const u = await newUser();
      const r = await loginRaw(u);
      const logged = await r.json();
      expect(logged.user.sessionTimeoutMinutes).toBe(1);
      await fixtureDb.authSession.updateMany({
        where: { userId: u.id },
        data: { lastActivityAt: new Date(Date.now() - 61000) },
      });
      expect(
        (await request("/auth/me", undefined, logged.accessToken)).status,
      ).toBe(401);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("stock negativo optativo conserva advertencia y prohíbe saltarse lotes", async () => {
    const settings = await ok("/settings");
    try {
      const p = await ok("/products", {
        name: "QA negativo " + suffix,
        sku: "QA-N-" + suffix,
        categoryId: clothing.categoryId,
        variants: [
          {
            sku: "QA-NV-" + suffix,
            barcode: "QA-NB-" + suffix,
            costAvg: 10,
            price: 118,
          },
        ],
      });
      products.push(p);
      expect(
        (await request("/sales", input(p.variants[0].id, 118))).status,
      ).toBe(400);
      await ok(
        "/settings",
        { ...settings, allowNegativeStock: true },
        token,
        "PUT",
      );
      await ok("/sales", input(p.variants[0].id, 118));
      expect(Number((await ok("/products/" + p.id)).variants[0].stock)).toBe(
        -1,
      );
      expect(
        (await ok("/alerts")).some(
          (a) => a.type === "negative_stock" && a.entityId === p.variants[0].id,
        ),
      ).toBe(true);
      await ok("/inventory/adjustments", {
        variantId: p.variants[0].id,
        qty: 1,
        reason: "QA conciliar stock",
      });
      expect(
        (
          await request("/sales", {
            ...input(supplement.variants[0].id, 236000),
            items: [{ variantId: supplement.variants[0].id, qty: 1000 }],
          })
        ).status,
      ).toBe(400);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("alerta efectivo aunque tarjeta lo compense", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, cashDifferenceLimit: 1 },
        token,
        "PUT",
      );
      const current = (await ok("/cash-sessions")).find(
        (c) => c.id === sellerSession.id,
      );
      const closed = await ok("/cash-sessions/" + current.id + "/close", {
        countedCash: current.expected.cash + 10,
        countedCard: current.expected.card,
        countedTransfer: current.expected.transfer,
      });
      expect(Number(closed.differenceCash)).toBe(10);
      expect(
        (await ok("/alerts")).some(
          (a) => a.type === "cash_difference" && a.entityId === closed.id,
        ),
      ).toBe(true);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("NCF preparado conserva solicitud sin emitir un comprobante fiscal", async () => {
    const settings = await ok("/settings");
    try {
      await ok("/settings", { ...settings, ncfMode: "prepared" }, token, "PUT");
      expect(
        (
          await request("/sales", {
            ...input(clothing.variants[0].id, 118),
            ncfType: "B01",
          })
        ).status,
      ).toBe(400);
      const sold = await ok("/sales", {
        ...input(clothing.variants[0].id, 118),
        ncfType: "B01",
        recipientLegalId: "123456789",
      });
      expect(sold.ncfType).toBe("B01");
      expect(sold.ncf).toBeNull();
      expect(sold.fiscalStatus).toBe("not_issued");
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("dashboard incluye mapa dominicano y comparación del año anterior", async () => {
    const before = await ok("/dashboard/summary?from=2026-08-31&to=2026-09-01");
    const s = await ok("/sales", input(clothing.variants[0].id, 118));
    await fixtureDb.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date("2025-08-31T22:00:00Z") },
    });
    const r = await ok("/dashboard/summary?from=2026-08-31&to=2026-09-01");
    expect(r.previousYearRevenue).toBe(before.previousYearRevenue + 118);
    expect(r.yearOverYear).not.toBeNull();
    expect(r.peakHours.some((row) => row.day === 1 && row.hour === 22)).toBe(
      true,
    );
    expect(r.daily.some((row) => row.day === "2026-08-31")).toBe(true);
  });
});

describe("Alertas de negocio y consistencia contable", () => {
  it("baja venta compara mes anterior con promedio de tres meses y cuenta descuentos diarios", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        {
          ...settings,
          lowSalesDropPercent: 50,
          unusualDiscountCount: 1,
          unusualDiscountPercent: 25,
        },
        token,
        "PUT",
      );
      const p = await ok("/products", {
        name: "QA alertas " + suffix,
        sku: "QA-A-" + suffix,
        categoryId: clothing.categoryId,
        variants: [
          {
            sku: "QA-AV-" + suffix,
            barcode: "QA-AB-" + suffix,
            costAvg: 10,
            price: 118,
          },
        ],
      });
      products.push(p);
      await ok("/inventory/adjustments", {
        variantId: p.variants[0].id,
        qty: 3,
        reason: "QA historial alertas",
      });
      const historical = await ok("/sales", input(p.variants[0].id, 118));
      const month = new Date(
        new Date()
          .toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" })
          .slice(0, 8) + "01T12:00:00-04:00",
      );
      month.setUTCMonth(month.getUTCMonth() - 2);
      await fixtureDb.sale.update({
        where: { id: historical.id },
        data: { createdAt: month },
      });
      const discounted = await ok("/sales", {
        ...input(p.variants[0].id, 88.5),
        items: [{ variantId: p.variants[0].id, qty: 1, discountPercent: 25 }],
      });
      const alerts = await ok("/alerts");
      expect(
        alerts.some(
          (a) => a.type === "low_sales" && a.entityId === p.variants[0].id,
        ),
      ).toBe(true);
      expect(
        alerts.some(
          (a) => a.type === "unusual_discount" && a.entityId === discounted.id,
        ),
      ).toBe(true);
      expect(
        alerts.some(
          (a) => a.type === "unusual_discount" && a.entityId === actors[0].id,
        ),
      ).toBe(true);
      expect(
        (await ok("/promotions/clearance-candidates")).some(
          (c) => c.variantId === p.variants[0].id && c.lowSales,
        ),
      ).toBe(true);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("devolución del período resta costo solo cuando reingresa y cuadra con dashboard", async () => {
    const sold = await ok("/sales", input(clothing.variants[0].id, 118));
    const yesterday = new Date(Date.now() - 86400000);
    await fixtureDb.sale.update({
      where: { id: sold.id },
      data: { createdAt: yesterday },
    });
    await ok("/returns", {
      saleId: sold.id,
      cashSessionId: session.id,
      reason: "QA costo de período",
      refundMethod: "cash",
      items: [{ saleItemId: sold.items[0].id, qty: 1, restock: false }],
    });
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    const range = "?from=" + today + "&to=" + today;
    const dashboard = await ok("/dashboard/summary" + range);
    const report = await ok("/reports/profit" + range);
    expect(
      Math.abs(
        report.rows.reduce((sum, r) => sum + r.Costo, 0) - dashboard.costTotal,
      ),
    ).toBeLessThanOrEqual(0.02);
    expect(
      Math.abs(
        report.rows.reduce((sum, r) => sum + r.Utilidad, 0) -
          dashboard.grossProfit,
      ),
    ).toBeLessThanOrEqual(0.02);
  });
});

describe("Ronda 2 de Claude", () => {
  let variant: any, caller: any, callerToken: string, callerCash: any;
  beforeAll(async () => {
    variant = await ok("/products", {
      name: "QA ronda 2 " + suffix,
      sku: "QA-R2-" + suffix,
      categoryId: clothing.categoryId,
      variants: [
        {
          sku: "QA-R2V-" + suffix,
          barcode: "QA-R2B-" + suffix,
          costAvg: 40,
          price: 118,
        },
      ],
    });
    products.push(variant);
    await ok("/inventory/adjustments", {
      variantId: variant.variants[0].id,
      qty: 20,
      reason: "QA ronda 2",
    });
    const roles = await ok("/roles");
    caller = await ok("/users", {
      name: "QA R2 vendedor",
      email: randomUUID() + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "876543",
      roleId: roles.find((r) => r.name === "seller").id,
    });
    actors.push(caller);
    callerToken = (
      await ok(
        "/auth/login",
        { email: caller.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    await enroll(callerToken, "QA R2");
    callerCash = await ok(
      "/cash-sessions/open",
      { registerId: "qa-r2-" + suffix, openingAmount: 0 },
      callerToken,
    );
  });
  afterAll(async () => {
    if (callerCash) {
      const c = (await ok("/cash-sessions", undefined, callerToken)).find(
        (c) => c.id === callerCash.id,
      );
      if (!c.closedAt)
        await ok(
          "/cash-sessions/" + c.id + "/close",
          {
            countedCash: c.expected.cash,
            countedCard: c.expected.card,
            countedTransfer: c.expected.transfer,
          },
          callerToken,
        );
    }
  });
  const payload = (s = session) => input(variant.variants[0].id, 118, s);
  async function note(customerId?: string) {
    const sold = await ok("/sales", {
      ...payload(),
      ...(customerId ? { customerId } : {}),
    });
    const returned = await ok("/returns", {
      saleId: sold.id,
      cashSessionId: session.id,
      reason: "QA código nota",
      refundMethod: "credit_note",
      items: [{ saleItemId: sold.items[0].id, qty: 1, restock: true }],
    });
    return (await ok("/credit-notes")).find((n) => n.returnId === returned.id);
  }
  it("1: notas requieren prueba de posesión o gerente, no se divulgan códigos y cada uso se audita", async () => {
    const customer = await ok("/customers", { name: "QA nota R2 " + suffix });
    const named = await note(customer.id);
    expect(await ok("/credit-notes", undefined, callerToken)).toEqual([]);
    const selected = await ok(
      "/credit-notes?customerId=" + customer.id,
      undefined,
      callerToken,
    );
    expect(selected.some((n) => n.id === named.id)).toBe(true);
    expect(JSON.stringify(selected)).not.toContain(named.redemptionCode);
    const pay = {
      ...payload(callerCash),
      customerId: customer.id,
      payments: [
        { method: "credit_note", amount: 118, creditNoteId: named.id },
      ],
    };
    expect((await request("/sales", pay, callerToken)).status).toBe(400);
    expect(
      (
        await request(
          "/sales",
          {
            ...pay,
            payments: [{ ...pay.payments[0], creditNoteCode: "0".repeat(32) }],
          },
          callerToken,
        )
      ).status,
    ).toBe(400);
    const sold = await ok(
      "/sales",
      {
        ...pay,
        payments: [
          { ...pay.payments[0], creditNoteCode: named.redemptionCode },
        ],
      },
      callerToken,
    );
    expect(
      (await ok("/audit-log")).some(
        (a) =>
          a.action === "credit_note_used" &&
          a.entityId === named.id &&
          a.after.saleId === sold.id,
      ),
    ).toBe(true);
    const approved = await note(customer.id);
    await ok(
      "/sales",
      {
        ...pay,
        offlineUuid: randomUUID(),
        managerPin: "987654",
        payments: [
          { method: "credit_note", amount: 118, creditNoteId: approved.id },
        ],
      },
      callerToken,
    );
    const anonymous = await note();
    const anonPay = {
      ...payload(callerCash),
      payments: [
        { method: "credit_note", amount: 118, creditNoteId: anonymous.id },
      ],
    };
    expect(
      (
        await request(
          "/sales",
          { ...anonPay, managerPin: "987654" },
          callerToken,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await ok(
          "/credit-notes?customerId=" + customer.id,
          undefined,
          callerToken,
        )
      ).some((n) => n.id === anonymous.id),
    ).toBe(false);
    const found = await ok(
      "/credit-notes?code=" + anonymous.redemptionCode,
      undefined,
      callerToken,
    );
    expect(found.map((n) => n.id)).toEqual([anonymous.id]);
    await ok(
      "/sales",
      {
        ...anonPay,
        payments: [
          { ...anonPay.payments[0], creditNoteCode: anonymous.redemptionCode },
        ],
      },
      callerToken,
    );
    const pdf = await fetch(
      base + "/returns/" + anonymous.returnId + "/credit-note.pdf",
      { headers: { Authorization: "Bearer " + token } },
    );
    expect(pdf.ok).toBe(true);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });
  it("2: límite del cliente atómico y PIN por umbral, sólo gerente puede cambiar el límite", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, allowCreditSales: true, creditApprovalThreshold: 50 },
        token,
        "PUT",
      );
      const customer = await ok("/customers", {
        name: "QA límite R2 " + suffix,
        creditLimit: 236,
      });
      expect(
        (
          await request(
            "/customers/" + customer.id,
            { creditLimit: 9999 },
            callerToken,
            "PATCH",
          )
        ).status,
      ).toBe(400);
      const credit = {
        ...payload(callerCash),
        customerId: customer.id,
        creditDueDate: "2030-01-01T12:00:00.000Z",
        payments: [{ method: "credit", amount: 118 }],
      };
      expect((await request("/sales", credit, callerToken)).status).toBe(400);
      const first = await ok(
        "/sales",
        { ...credit, managerPin: "987654" },
        callerToken,
      );
      expect(
        (await ok("/audit-log")).some(
          (a) => a.action === "credit_approved" && a.entityId === first.id,
        ),
      ).toBe(true);
      const [a, b] = await Promise.all([
        request("/sales", {
          ...credit,
          cashSessionId: session.id,
          managerPin: "987654",
          offlineUuid: randomUUID(),
        }),
        request("/sales", {
          ...credit,
          cashSessionId: session.id,
          managerPin: "987654",
          offlineUuid: randomUUID(),
        }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 400]);
      const total = await fixtureDb.sale.aggregate({
        where: { customerId: customer.id, status: "completed" },
        _sum: { creditBalance: true },
      });
      expect(Number(total._sum.creditBalance)).toBe(236);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("3: transferencia pendiente no reduce deuda ni caja; verificación concurrente aplica una sola vez", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, allowCreditSales: true },
        token,
        "PUT",
      );
      const customer = await ok("/customers", {
        name: "QA abono R2 " + suffix,
        creditLimit: 500,
      });
      const sold = await ok("/sales", {
        ...payload(),
        customerId: customer.id,
        creditDueDate: "2030-01-01T12:00:00.000Z",
        payments: [{ method: "credit", amount: 118 }],
      });
      const expected = (await ok("/cash-sessions")).find(
        (c) => c.id === session.id,
      ).expected.transfer;
      const pending = await ok("/sales/" + sold.id + "/installments", {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        method: "transfer",
        amount: 50,
        bank: "QA banco",
        reference: "QA-R2",
      });
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(118);
      expect(
        (await ok("/cash-sessions")).find((c) => c.id === session.id).expected
          .transfer,
      ).toBe(expected);
      expect(
        (
          await request("/sales/" + sold.id + "/installments", {
            offlineUuid: randomUUID(),
            cashSessionId: session.id,
            method: "cash",
            amount: 69,
          })
        ).status,
      ).toBe(400);
      await Promise.all([
        ok("/payments/" + pending.id + "/verify", {}),
        ok("/payments/" + pending.id + "/verify", {}),
      ]);
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(68);
      expect(
        (await ok("/cash-sessions")).find((c) => c.id === session.id).expected
          .transfer,
      ).toBe(expected + 50);
      expect(
        await fixtureDb.auditLog.count({
          where: { entityId: pending.id, action: "verify" },
        }),
      ).toBe(1);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("4: offline máximo 48 horas y fecha anterior auditada", async () => {
    const old = await fixtureDb.cashSession.create({
      data: {
        registerId: "qa-old-" + suffix,
        userId: actors[0].id,
        branchId: "main",
        openingAmount: 0,
        openedAt: new Date(Date.now() - 72 * 3600000),
        closedAt: new Date(Date.now() - 70 * 3600000),
      },
    });
    const rejected = await ok("/sales/sync", {
      sales: [
        {
          ...payload(old),
          capturedAt: new Date(Date.now() - 71 * 3600000).toISOString(),
        },
      ],
    });
    expect(rejected.results[0].status).toBe("conflict");
    expect(rejected.results[0].message).toMatch(/48 horas/);
    const accepted = await ok("/sales/sync", {
      sales: [
        { ...payload(), capturedAt: new Date(Date.now() - 1000).toISOString() },
      ],
    });
    expect(accepted.results[0].status).toBe("synced");
    expect(
      (await ok("/audit-log")).some(
        (a) =>
          a.action === "offline_backdated" &&
          a.entityId === accepted.results[0].sale.id,
      ),
    ).toBe(true);
  });
  it("5: Compose sólo publica nginx y descarta IP suministrada por cliente", async () => {
    const { readFile } = await import("node:fs/promises");
    const compose = await readFile(
      new URL("../compose.yaml", import.meta.url),
      "utf8",
    );
    const api = compose.split("  api:\n")[1].split("  web:\n")[0];
    expect(api).not.toMatch(/^ {4}ports:/m);
    expect(api).toContain('"3001"');
    expect(compose.match(/^ {4}ports:/gm)).toHaveLength(1);
    const nginx = await readFile(
      new URL("../deploy/nginx.conf", import.meta.url),
      "utf8",
    );
    expect(nginx).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
  });
});

describe("Ronda 3 · tiempo real y mercancía", () => {
  let terminalId: string,
    warehouseToken: string,
    warehouseTerminal: string,
    product: any,
    lotProduct: any;
  const streams: AbortController[] = [];
  beforeAll(async () => {
    terminalId = tokenTerminal.get(token)!;
    await registerTerminal(token, terminalId, "Caja QA R3");
    const cats = await ok("/categories");
    product = await ok("/products", {
      name: "QA Mercancía R3 " + suffix,
      sku: "R3-P-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R3-V-" + suffix,
          barcode: "R3-B-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(product);
    lotProduct = await ok("/products", {
      name: "QA Lote R3 " + suffix,
      sku: "R3-LP-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Suplementos").id,
      variants: [
        {
          sku: "R3-LV-" + suffix,
          barcode: "R3-LB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(lotProduct);
    const role = (await ok("/roles")).find((r: any) => r.name === "warehouse");
    const u = await ok("/users", {
      name: "QA almacén R3",
      email: "r3-warehouse-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "834521",
      roleId: role.id,
    });
    actors.push(u);
    warehouseToken = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    warehouseTerminal = randomUUID();
    await registerTerminal(
      warehouseToken,
      warehouseTerminal,
      "Celular almacén QA",
    );
  });
  afterAll(() => {
    for (const s of streams) s.abort();
  });
  const goods = (extra: any = {}) => ({
    id: randomUUID(),
    direction: "entry",
    items: [{ variantId: product.variants[0].id, qty: 2, unitCost: 10 }],
    ...extra,
  });
  async function stream(as: string) {
    const controller = new AbortController();
    streams.push(controller);
    const response = await fetch(base + "/events", {
      headers: { Authorization: "Bearer " + as },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const events: { type: string; data: any; at: number }[] = [];
    const reader = response.body!.getReader();
    let buf = "";
    const decoder = new TextDecoder();
    const reading = (async () => {
      try {
        for (;;) {
          const r = await reader.read();
          if (r.done) return;
          buf += decoder.decode(r.value, { stream: true });
          let end;
          while ((end = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, end);
            buf = buf.slice(end + 2);
            const type = frame
              .split("\n")
              .find((l) => l.startsWith("event:"))
              ?.slice(6)
              .trim();
            const text = frame
              .split("\n")
              .find((l) => l.startsWith("data:"))
              ?.slice(5)
              .trim();
            if (type && text)
              events.push({ type, data: JSON.parse(text), at: Date.now() });
          }
        }
      } catch {
        /* abort de limpieza */
      }
    })();
    await waitFor(() => events.some((e) => e.type === "ready"));
    return { events, controller, reading };
  }
  async function waitFor(fn: () => boolean, ms = 2000) {
    const until = Date.now() + ms;
    while (!fn()) {
      if (Date.now() > until)
        throw new Error("Evento no recibido dentro del plazo");
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  it("SSE autentica, filtra sucursal y no comunica operaciones revertidas", async () => {
    expect((await request("/events", undefined, "")).status).toBe(401);
    const s = await stream(token);
    const before = await fixtureDb.realtimeEvent.count();
    await fixtureDb
      .$transaction(async (tx: any) => {
        await tx.variant.update({
          where: { id: product.variants[0].id },
          data: { stock: 100 },
        });
        throw new Error("rollback");
      })
      .catch(() => {});
    expect(await fixtureDb.realtimeEvent.count()).toBe(before);
    const foreign = await fixtureDb.realtimeEvent.create({
      data: {
        branchId: "other-branch",
        type: "stock.changed",
        data: { variantId: "foreign", qtyOnHand: 99 },
      },
    });
    const alert = await fixtureDb.alert.create({
      data: {
        key: "r3-alert-" + suffix,
        type: "stock",
        severity: "low",
        entityId: product.id,
        message: "QA",
        branchId: "main",
      },
    });
    await waitFor(() =>
      s.events.some(
        (e) => e.type === "alert.created" && e.data.id === alert.id,
      ),
    );
    expect(s.events.some((e) => e.data.variantId === "foreign")).toBe(false);
    await fixtureDb.realtimeEvent.delete({ where: { id: foreign.id } });
    s.controller.abort();
  });
  it("tres cajas venden stock 5 y las tres reciben el saldo confirmado en menos de 2 segundos", async () => {
    const auths: string[] = [],
      cashes: any[] = [];
    for (let i = 0; i < 3; i++) {
      const role = (await ok("/roles")).find((r: any) => r.name === "admin");
      const u = await ok("/users", {
        name: "QA SSE " + i,
        email: `sse-${i}-${suffix}@example.test`,
        password: "FitStore-QA-2026!",
        pin: "234567",
        roleId: role.id,
      });
      actors.push(u);
      const t = (
        await ok(
          "/auth/login",
          { email: u.email, password: "FitStore-QA-2026!" },
          "",
        )
      ).accessToken;
      auths.push(t);
      await registerTerminal(t, randomUUID(), "Caja SSE " + i);
      cashes.push(await ok("/cash-sessions/open", { openingAmount: 0 }, t));
    }
    const p = await ok("/products", {
      name: "QA SSE cinco " + suffix,
      sku: "R3-SSE-" + suffix,
      categoryId: product.categoryId,
      variants: [
        {
          sku: "R3-SSEV-" + suffix,
          barcode: "R3-SSEB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(p);
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: 5,
      reason: "QA SSE stock cinco",
    });
    const opened = await Promise.all(auths.map((t) => stream(t)));
    const started = Date.now();
    const results = await Promise.all(
      auths.map((t, i) =>
        request(
          "/sales",
          {
            offlineUuid: randomUUID(),
            cashSessionId: cashes[i].id,
            items: [{ variantId: p.variants[0].id, qty: 2 }],
            payments: [{ method: "cash", amount: 236 }],
          },
          t,
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 400]);
    expect(Number((await ok("/products/" + p.id)).variants[0].stock)).toBe(1);
    for (const s of opened) {
      await waitFor(
        () =>
          s.events.some(
            (e) =>
              e.type === "stock.changed" &&
              e.data.variantId === p.variants[0].id &&
              e.data.qtyOnHand === 1,
          ),
        Math.max(1, 2000 - (Date.now() - started)),
      );
      expect(
        s.events.find(
          (e) =>
            e.data.variantId === p.variants[0].id && e.data.qtyOnHand === 1,
        )!.at - started,
      ).toBeLessThan(2000);
      s.controller.abort();
    }
    for (let i = 0; i < 3; i++) {
      const c = (await ok("/cash-sessions", undefined, auths[i])).find(
        (c: any) => c.id === cashes[i].id,
      );
      await ok(
        "/cash-sessions/" + c.id + "/close",
        {
          countedCash: c.expected.cash,
          countedCard: 0,
          countedTransfer: 0,
          notes: "QA SSE cierre",
        },
        auths[i],
      );
    }
  });
  it("equipos muestran actividad y caja, renombrar y revocar invalida sesiones", async () => {
    const t = (await ok("/terminals")).find((t: any) => t.id === terminalId);
    expect(t.connected).toBe(true);
    expect(t.openCash.id).toBe(session.id);
    await ok("/terminals/" + terminalId + "/rename", { name: "Laptop QA R3" });
    expect(
      (await ok("/terminals")).find((t: any) => t.id === terminalId).name,
    ).toBe("Laptop QA R3");
    expect((await request("/terminals", undefined, sellerToken)).status).toBe(
      403,
    );
    const u = actors.find((u) => u.email.startsWith("sse-0-"));
    const as = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    const id = randomUUID();
    await registerTerminal(as, id, "Revocar QA");
    await ok("/terminals/" + id + "/revoke", {});
    expect((await request("/inventory/stock", undefined, as)).status).toBe(401);
    expect(
      (
        await request("/terminals/register", {
          id,
          name: "Intento reactivar",
          secret: secretOf(id),
        })
      ).status,
    ).toBe(400);
  });
  it("entradas idempotentes con promedio, kardex y usuario/equipo; vendedor bloqueado y almacén sin ganancia", async () => {
    const op = goods({ freight: 4 });
    const before = Number(
      (await ok("/products/" + product.id)).variants[0].stock,
    );
    const [a, b] = await Promise.all([
      ok("/merchandise/operations", op, warehouseToken),
      ok("/merchandise/operations", op, warehouseToken),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.receiptId).toBeTruthy();
    const v = (await ok("/products/" + product.id)).variants[0];
    expect(Number(v.stock)).toBe(before + 2);
    expect(Number(v.costAvg)).toBe(12);
    expect(
      (
        await request(
          "/merchandise/operations",
          { ...op, items: [{ ...op.items[0], qty: 3 }] },
          warehouseToken,
        )
      ).status,
    ).toBe(400);
    const audit = (await ok("/audit-log")).find(
      (a: any) => a.action === "merchandise_entry" && a.entityId === op.id,
    );
    expect(audit.terminalId).toBe(warehouseTerminal);
    expect(audit.userId).toBe(
      actors.find((u) => u.email.startsWith("r3-warehouse-")).id,
    );
    expect(audit.createdAt).toBeTruthy();
    expect(
      (await ok("/inventory/movements?variantId=" + v.id)).filter(
        (m: any) => m.refId === a.receiptId,
      ),
    ).toHaveLength(1);
    for (const path of [
      "/merchandise/options",
      "/merchandise/profiles/" + supplierId,
    ])
      expect((await request(path, undefined, sellerToken)).status).toBe(403);
    expect(
      (await request("/merchandise/operations", goods(), sellerToken)).status,
    ).toBe(403);
    expect(
      JSON.stringify(await ok("/inventory/stock", undefined, warehouseToken)),
    ).not.toContain("grossProfit");
    expect(
      (await request("/dashboard/summary", undefined, warehouseToken)).status,
    ).toBe(403);
  });
  it("salidas requieren motivo y existencias; todos los motivos quedan auditados", async () => {
    await ok(
      "/merchandise/operations",
      goods({
        items: [{ variantId: product.variants[0].id, qty: 10, unitCost: 12 }],
      }),
    );
    expect(
      (await request("/merchandise/operations", goods({ direction: "exit" })))
        .status,
    ).toBe(400);
    for (const reason of [
      "merma",
      "dañado",
      "vencido",
      "muestra",
      "uso interno",
      "devolución a proveedor",
    ]) {
      const op = goods({
        direction: "exit",
        reason,
        items: [{ variantId: product.variants[0].id, qty: 1, unitCost: 12 }],
      });
      await ok("/merchandise/operations", op, warehouseToken);
      expect(
        (await ok("/audit-log")).some(
          (a: any) =>
            a.entityId === op.id &&
            a.action === "merchandise_exit" &&
            a.terminalId === warehouseTerminal,
        ),
      ).toBe(true);
    }
    expect(
      (
        await request(
          "/merchandise/operations",
          goods({
            direction: "exit",
            reason: "merma",
            items: [
              { variantId: product.variants[0].id, qty: 999, unitCost: 12 },
            ],
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("lotes y vencimiento obligatorios, salida de lote vencido y creación rápida atómica", async () => {
    const item = { variantId: lotProduct.variants[0].id, qty: 2, unitCost: 10 };
    expect(
      (await request("/merchandise/operations", goods({ items: [item] })))
        .status,
    ).toBe(400);
    const date = new Date(Date.now() + 86400000 * 60).toISOString();
    await ok(
      "/merchandise/operations",
      goods({ items: [{ ...item, lotNumber: "R3 lote", expiryDate: date }] }),
    );
    const lot = (await ok("/products/" + lotProduct.id)).variants[0].lots.find(
      (l: any) => l.lotNumber === "R3 lote",
    );
    await fixtureDb.lot.update({
      where: { id: lot.id },
      data: { expiryDate: new Date(Date.now() - 86400000 * 2) },
    });
    const out = await ok(
      "/merchandise/operations",
      goods({
        direction: "exit",
        reason: "vencido",
        items: [{ ...item, qty: 1, lotId: lot.id }],
      }),
    );
    expect(out.id).toBeTruthy();
    const quick = {
      name: "QA rápido " + suffix,
      categoryId: product.categoryId,
      barcode: "R3-QUICK-" + suffix,
      price: 118,
      cost: 20,
      variant: "Única",
    };
    const result = await ok(
      "/merchandise/operations",
      goods({ items: [{ quick, qty: 3, unitCost: 20 }] }),
      warehouseToken,
    );
    const v = await fixtureDb.variant.findUnique({
      where: { id: result.variantIds[0] },
      include: { product: true },
    });
    products.push(v.product);
    expect(Number(v.stock)).toBe(3);
  });
  async function upload(csv: string, as = token) {
    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "factura.csv");
    form.set("supplierId", supplierId);
    form.set(
      "mapping",
      JSON.stringify({
        code: "codigo",
        description: "descripcion",
        qty: "cantidad",
        unitCost: "costo",
      }),
    );
    form.set("total", "36");
    const r = await fetch(base + "/merchandise/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + as },
      body: form,
    });
    return { status: r.status, body: await r.json() };
  }
  it("CSV: revisión sin stock, mapeo guardado, total validado, recepción, comprobante y equivalencia", async () => {
    const before = Number(
      (await ok("/products/" + product.id)).variants[0].stock,
    );
    const imported = await upload(
      `codigo,descripcion,cantidad,costo\nR3-B-${suffix},Producto reconocido,2,15\nCOD-PROV-R3,${product.name},1,2\n`,
    );
    expect(imported.status).toBe(201);
    const d = imported.body;
    expect(d.lines[0].confidence).toBe(1);
    expect(d.lines[1].variantId).toBe(product.variants[0].id);
    expect(
      Number((await ok("/products/" + product.id)).variants[0].stock),
    ).toBe(before);
    expect((await ok("/merchandise/profiles/" + supplierId)).mapping.qty).toBe(
      "cantidad",
    );
    const op = goods({
      draftId: d.id,
      supplierId,
      items: d.lines.map((l: any) => ({
        variantId: l.variantId,
        qty: l.qty,
        unitCost: l.unitCost,
        supplierCode: l.code,
      })),
      freight: 4,
    });
    const saved = await ok("/merchandise/operations", op);
    expect(saved.attachmentId).toBe(d.attachmentId);
    expect(
      Number((await ok("/products/" + product.id)).variants[0].stock),
    ).toBe(before + 3);
    const attachment = await fetch(
      base + "/merchandise/attachments/" + d.attachmentId,
      { headers: { Authorization: "Bearer " + token } },
    );
    expect(attachment.status).toBe(200);
    expect(await attachment.text()).toContain("codigo");
    expect(
      (await request("/merchandise/operations", { ...op, id: randomUUID() }))
        .status,
    ).toBe(400);
    const second = await upload(
      "codigo,descripcion,cantidad,costo\nCOD-PROV-R3,Sin parecido,1,1\n",
    );
    expect(second.body.lines[0].confidence).toBe(1);
    expect(second.body.lines[0].variantId).toBe(product.variants[0].id);
    expect(
      (
        await upload(
          "codigo,descripcion,cantidad,costo\nunknown,Otro producto,1,1\n",
          sellerToken,
        )
      ).status,
    ).toBe(403);
  });
  it("factura con total distinto se rechaza hasta revisión explícita; línea sin pareja exige resolución", async () => {
    const d = (
      await upload(
        "codigo,descripcion,cantidad,costo\nNO-EXISTE,SIN-PAREJA-XYZ,1,1\n",
      )
    ).body;
    expect(d.lines[0].variantId).toBeNull();
    const op = goods({
      draftId: d.id,
      supplierId,
      items: [{ variantId: product.variants[0].id, qty: 1, unitCost: 1 }],
    });
    expect((await request("/merchandise/operations", op)).status).toBe(400);
    await ok("/merchandise/operations", { ...op, acknowledgeMismatch: true });
    expect(
      (await fixtureDb.invoiceDraft.findUnique({ where: { id: d.id } }))
        .confirmedOperationId,
    ).toBe(op.id);
  });
  it("entrada con orden respeta cantidades pendientes y no duplica recepciones", async () => {
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: product.variants[0].id, qty: 2, unitCost: 10 }],
    });
    const op = goods({
      orderId: order.id,
      supplierId,
      items: [
        {
          variantId: product.variants[0].id,
          itemId: order.items[0].id,
          qty: 2,
          unitCost: 10,
        },
      ],
    });
    await ok("/merchandise/operations", op);
    expect(
      (await fixtureDb.purchaseOrder.findUnique({ where: { id: order.id } }))
        .status,
    ).toBe("received");
    expect(
      (await request("/merchandise/operations", { ...op, id: randomUUID() }))
        .status,
    ).toBe(400);
  });
  it("SSE comunica recepción, devolución, anulación y conteo confirmados", async () => {
    const s = await stream(token),
      id = product.variants[0].id;
    const current = () => fixtureDb.variant.findUnique({ where: { id } });
    const waitStock = async (start: number, qty: number) => {
      await waitFor(() =>
        s.events
          .slice(start)
          .some(
            (e) =>
              e.type === "stock.changed" &&
              e.data.variantId === id &&
              e.data.qtyOnHand === qty,
          ),
      );
    };
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: id, qty: 2, unitCost: 10 }],
    });
    let from = s.events.length;
    let qty = Number((await current()).stock) + 2;
    await ok("/purchase-orders/" + order.id + "/receive", {
      items: [{ itemId: order.items[0].id, qty: 2 }],
    });
    await waitStock(from, qty);
    const sale = await ok("/sales", input(id, 118));
    from = s.events.length;
    qty = Number((await current()).stock) + 1;
    await ok("/returns", {
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA eventos devolución",
      refundMethod: "cash",
      items: [
        { saleItemId: sale.items[0].id, qty: 1, restock: true, opened: false },
      ],
    });
    await waitStock(from, qty);
    const second = await ok("/sales", input(id, 118));
    from = s.events.length;
    qty = Number((await current()).stock) + 1;
    await ok("/sales/" + second.id + "/void", {
      reason: "QA eventos anulación",
      cashSessionId: session.id,
    });
    await waitStock(from, qty);
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: qty + 1 }],
    });
    from = s.events.length;
    await ok("/inventory/counts/" + count.id + "/apply", {});
    await waitStock(from, qty + 1);
    s.controller.abort();
  });
  it("eventos se publican en orden de commit aunque las transacciones empiecen al revés", async () => {
    const s = await stream(token);
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      ready = new Promise<void>((r) => (started = r));
    const slow = fixtureDb.$transaction(async (tx: any) => {
      await tx.variant.update({
        where: { id: product.variants[0].id },
        data: { stock: { increment: 1 } },
      });
      started();
      await gate;
    });
    await ready;
    await fixtureDb.$transaction(async (tx: any) => {
      await tx.variant.update({
        where: { id: lotProduct.variants[0].id },
        data: { stock: { increment: 1 } },
      });
    });
    await waitFor(() =>
      s.events.some((e) => e.data.variantId === lotProduct.variants[0].id),
    );
    release();
    await slow;
    await waitFor(() =>
      s.events.some((e) => e.data.variantId === product.variants[0].id),
    );
    const ids = s.events
      .filter((e) => e.type === "stock.changed")
      .map((e) => e.data.variantId);
    expect(ids.indexOf(lotProduct.variants[0].id)).toBeLessThan(
      ids.indexOf(product.variants[0].id),
    );
    s.controller.abort();
  });
  it("nginx mantiene SSE sin buffering y sólo publica el proxy", async () => {
    const { readFile } = await import("node:fs/promises");
    const config = await readFile(
      new URL("../deploy/nginx.conf", import.meta.url),
      "utf8",
    );
    expect(config).toContain("location = /api/events");
    expect(config).toContain("proxy_buffering off;");
    expect(config).toContain("proxy_read_timeout 75s;");
  });
});
describe("Ronda 4 · Claude: caja y equipos", () => {
  let product: any,
    seller: any,
    manager: any,
    sellerA: string,
    sellerB: string,
    managerToken: string,
    cash: any;
  const terminalA = randomUUID(),
    terminalB = randomUUID(),
    terminalM = randomUUID();
  const login = async (email: string) =>
    (await ok("/auth/login", { email, password: "FitStore-QA-2026!" }, ""))
      .accessToken as string;
  beforeAll(async () => {
    const cats = await ok("/categories");
    product = await ok("/products", {
      name: "QA R4 caja " + suffix,
      sku: "R4-C-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R4-CV-" + suffix,
          barcode: "R4-CB-" + suffix,
          costAvg: 40,
          price: 118,
        },
      ],
    });
    products.push(product);
    await ok("/inventory/adjustments", {
      variantId: product.variants[0].id,
      qty: 10,
      reason: "QA ronda 4",
    });
    const roles = await ok("/roles");
    seller = await ok("/users", {
      name: "QA R4 vendedora",
      email: "r4-seller-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "640531",
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    manager = await ok("/users", {
      name: "QA R4 gerente",
      email: "r4-manager-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "730142",
      roleId: roles.find((r: any) => r.name === "manager").id,
    });
    actors.push(seller, manager);
    sellerA = await login(seller.email);
    await registerTerminal(sellerA, terminalA, "Caja 1 QA");
    cash = await ok(
      "/cash-sessions/open",
      { openingAmount: 200, registerId: "Caja 1 QA" },
      sellerA,
    );
    sellerB = await login(seller.email);
    await registerTerminal(sellerB, terminalB, "Laptop 2 QA");
    managerToken = await login(manager.email);
    await registerTerminal(managerToken, terminalM, "PC gerencia QA");
  });
  const sale = (as: string) =>
    request("/sales", input(product.variants[0].id, 118, cash), as);
  it("la caja queda asignada al equipo y muestra su nombre", async () => {
    expect(cash.registerId).toBe(terminalA);
    const listed = (await ok("/cash-sessions", undefined, sellerB)).find(
      (s: any) => s.id === cash.id,
    );
    expect(listed.registerName).toBe("Caja 1 QA");
  });
  it("vender desde otro equipo explica dónde está la caja (409, no 403)", async () => {
    const r = await sale(sellerB);
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("«Caja 1 QA»");
    expect((await sale(sellerA)).status).toBe(201);
  });
  it("trasladar exige PIN de gerente al vendedor y queda en bitácora", async () => {
    const path = "/cash-sessions/" + cash.id + "/transfer";
    expect((await request(path, {}, sellerB)).status).toBe(400);
    expect(
      (await request(path, { managerPin: "000000" }, sellerB)).status,
    ).toBe(400);
    const moved = await ok(path, { managerPin: "730142" }, sellerB);
    expect(moved.registerId).toBe(terminalB);
    expect(moved.registerName).toBe("Laptop 2 QA");
    expect((await sale(sellerB)).status).toBe(201);
    const old = await sale(sellerA);
    expect(old.status).toBe(409);
    expect(old.body.message).toContain("«Laptop 2 QA»");
    const log = await ok("/audit-log");
    const entry = log.find(
      (a: any) => a.entityId === cash.id && a.action === "cash_transferred",
    );
    expect(entry).toBeTruthy();
  });
  it("otro usuario no puede trasladar una caja ajena", async () => {
    const r = await request(
      "/cash-sessions/" + cash.id + "/transfer",
      {},
      managerToken,
    );
    expect(r.status).toBe(403);
  });
  it("el gerente cierra la caja de una vendedora desde su propio equipo", async () => {
    const current = (await ok("/cash-sessions", undefined, managerToken)).find(
      (s: any) => s.id === cash.id,
    );
    const r = await request(
      "/cash-sessions/" + cash.id + "/close",
      {
        countedCash: current.expected.cash,
        countedCard: current.expected.card,
        countedTransfer: current.expected.transfer,
        notes: "Cierre por gerencia QA",
      },
      managerToken,
    );
    expect(r.status).toBe(201);
  });
  it("la dueña puede cerrar su caja desde cualquier equipo", async () => {
    const own = await ok(
      "/cash-sessions/open",
      { openingAmount: 50, registerId: "Laptop 2 QA" },
      sellerB,
    );
    const r = await request(
      "/cash-sessions/" + own.id + "/close",
      { countedCash: 50, countedCard: 0, countedTransfer: 0 },
      sellerA,
    );
    expect(r.status).toBe(201);
  });
});
describe("Ronda 4 · auditoría de ChatGPT y propia", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[], clothingVariant: any, supplementVariant: any;
  const newProduct = async (name: string, category: string) => {
    const p = await ok("/products", {
      name: name + " " + suffix,
      sku: "R4A-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === category).id,
      variants: [
        {
          sku: "R4AV-" + randomUUID().slice(0, 8),
          barcode: "R4AB-" + randomUUID().slice(0, 8),
          costAvg: 40,
          price: 118,
        },
      ],
    });
    products.push(p);
    return p.variants[0];
  };
  const newUserToken = async (role: string, pin = "612345") => {
    const roles = await ok("/roles");
    const u = await ok("/users", {
      name: "QA R4 " + role,
      email: "r4a-" + role + "-" + randomUUID().slice(0, 6) + "@example.test",
      password: "FitStore-QA-2026!",
      pin,
      roleId: roles.find((r: any) => r.name === role).id,
    });
    actors.push(u);
    const auth = await ok(
      "/auth/login",
      { email: u.email, password: "FitStore-QA-2026!" },
      "",
    );
    return { user: u, token: auth.accessToken as string };
  };
  const stockOf = async (variantId: string) =>
    Number(
      (await fixtureDb.variant.findUnique({ where: { id: variantId } })).stock,
    );
  beforeAll(async () => {
    cats = await ok("/categories");
    clothingVariant = await newProduct("QA R4 ropa", "Ropa deportiva");
    supplementVariant = await newProduct("QA R4 suplemento", "Suplementos");
  });
  it("P1 compras: entrada sin orden se reporta una vez; orden no se duplica; fechas aplican", async () => {
    const supplier = await ok("/suppliers", {
      name: "QA Proveedor R4 " + suffix,
    });
    const report = async (from = today, to = today) =>
      (await ok(`/reports/purchases?from=${from}&to=${to}`)).rows.find(
        (r: any) => r.Proveedor === supplier.name,
      );
    const entry = {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      freight: 4,
      items: [{ variantId: clothingVariant.id, qty: 2, unitCost: 15 }],
    };
    await ok("/merchandise/operations", entry);
    expect(await report()).toMatchObject({ Compras: 34, Pendiente: 34 });
    // Repetir el UUID no crea otra recepción ni cambia el importe.
    await ok("/merchandise/operations", entry);
    expect(await report()).toMatchObject({ Compras: 34 });
    expect(
      await fixtureDb.goodsReceipt.count({ where: { operationId: entry.id } }),
    ).toBe(1);
    // Una compra con orden cuenta por la orden; su recepción no se suma otra vez.
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: clothingVariant.id, qty: 1, unitCost: 50 }],
    });
    await ok("/purchase-orders/" + order.id + "/receive", {
      items: [{ itemId: order.items[0].id, qty: 1 }],
    });
    expect(await report()).toMatchObject({ Compras: 84, Pendiente: 84 });
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 34,
      method: "transfer",
    });
    expect(await report()).toMatchObject({ Pagado: 34, Pendiente: 50 });
    expect(await report("2020-01-01", "2020-01-31")).toMatchObject({
      Compras: 0,
      Pagado: 0,
    });
  });
  it("P1 equipos: sin equipo, pendiente o revocado no mueve stock ni caja; aprobado sí y la bitácora guarda el equipo", async () => {
    const wh = await newUserToken("warehouse");
    const adjust = (as: string) =>
      request(
        "/inventory/adjustments",
        { variantId: clothingVariant.id, qty: 1, reason: "QA equipo R4" },
        as,
      );
    const goods = (as: string) =>
      request(
        "/merchandise/operations",
        {
          id: randomUUID(),
          direction: "entry",
          items: [{ variantId: clothingVariant.id, qty: 1, unitCost: 10 }],
        },
        as,
      );
    const before = await stockOf(clothingVariant.id);
    for (const r of [await adjust(wh.token), await goods(wh.token)]) {
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("TERMINAL_REQUIRED");
    }
    const seller = await newUserToken("seller");
    expect(
      (await request("/cash-sessions/open", { openingAmount: 0 }, seller.token))
        .body.code,
    ).toBe("TERMINAL_REQUIRED");
    // Equipo nuevo de almacén: queda pendiente y sigue sin operar.
    const device = randomUUID();
    const registered = await ok(
      "/terminals/register",
      { id: device, name: "Celular R4", secret: secretOf(device) },
      wh.token,
    );
    expect(registered.status).toBe("pending");
    expect((await adjust(wh.token)).body.code).toBe("TERMINAL_PENDING");
    // Otro dispositivo no puede reclamar ese equipo sin su secreto.
    expect(
      (
        await request(
          "/terminals/register",
          { id: device, name: "Intruso", secret: "otro-secreto-qa-0000" },
          seller.token,
        )
      ).status,
    ).toBe(403);
    // Aprobación en el equipo con PIN de gerente.
    expect(
      (
        await request(
          "/terminals/" + device + "/approve-with-pin",
          { managerPin: "000000" },
          wh.token,
        )
      ).status,
    ).toBe(400);
    const approved = await ok(
      "/terminals/" + device + "/approve-with-pin",
      { managerPin: "987654" },
      wh.token,
    );
    expect(approved.status).toBe("approved");
    expect((await adjust(wh.token)).status).toBe(201);
    expect(await stockOf(clothingVariant.id)).toBe(before + 1);
    const logged = await fixtureDb.auditLog.findFirst({
      where: { entityId: clothingVariant.id, userId: wh.user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(logged.terminalId).toBe(device);
    // Revocar: la sesión cae, el mismo equipo no vuelve y uno nuevo espera aprobación.
    await ok("/terminals/" + device + "/revoke", {}, ownerToken);
    expect((await adjust(wh.token)).status).toBe(401);
    const again = (
      await ok(
        "/auth/login",
        { email: wh.user.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    expect((await adjust(again)).body.code).toBe("TERMINAL_REQUIRED");
    expect(
      (
        await request(
          "/terminals/register",
          { id: device, name: "Reintento", secret: secretOf(device) },
          again,
        )
      ).status,
    ).toBe(400);
    const other = randomUUID();
    await ok(
      "/terminals/register",
      { id: other, name: "Otro celular", secret: secretOf(other) },
      again,
    );
    expect((await adjust(again)).body.code).toBe("TERMINAL_PENDING");
    expect(await stockOf(clothingVariant.id)).toBe(before + 1);
  });
  it("P2 lotes: lotId inventado, ajeno o de otra variante se rechaza sin cambios; el número de lote queda coherente", async () => {
    const expiry = new Date(Date.now() + 200 * 86400000).toISOString();
    const lotNumber = "R4-L-" + suffix;
    const valid = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      items: [
        {
          variantId: supplementVariant.id,
          qty: 3,
          unitCost: 20,
          lotNumber,
          expiryDate: expiry,
        },
      ],
    });
    const lot = await fixtureDb.lot.findUnique({
      where: {
        variantId_lotNumber: { variantId: supplementVariant.id, lotNumber },
      },
    });
    expect(Number(lot.qty)).toBe(3);
    expect(await stockOf(supplementVariant.id)).toBe(3);
    const movement = await fixtureDb.inventoryMovement.findFirst({
      where: { refId: valid.receiptId, variantId: supplementVariant.id },
    });
    expect(movement.lotId).toBe(lot.id);
    const beforeClothing = await stockOf(clothingVariant.id);
    const receiptsBefore = await fixtureDb.goodsReceipt.count();
    for (const lotId of [randomUUID(), lot.id]) {
      const r = await request("/merchandise/operations", {
        id: randomUUID(),
        direction: "entry",
        items: [{ variantId: clothingVariant.id, qty: 1, unitCost: 10, lotId }],
      });
      expect(r.status).toBe(400);
    }
    expect(await stockOf(clothingVariant.id)).toBe(beforeClothing);
    expect(await fixtureDb.goodsReceipt.count()).toBe(receiptsBefore);
    expect(
      Number((await fixtureDb.lot.findUnique({ where: { id: lot.id } })).qty),
    ).toBe(3);
    // Integridad referencial: el kardex no acepta un lote inexistente.
    await expect(
      fixtureDb.inventoryMovement.create({
        data: {
          variantId: clothingVariant.id,
          lotId: randomUUID(),
          type: "adjustment",
          qty: 0,
          unitCost: 0,
          balanceAfter: 0,
          reason: "QA FK",
          userId: "qa",
        },
      }),
    ).rejects.toThrow();
  });
  it("almacén: producto rápido queda inactivo con alerta; cantidades finas se rechazan; kardex usa el costo recibido", async () => {
    const wh = await newUserToken("warehouse");
    await registerTerminal(wh.token, randomUUID(), "Almacén R4");
    const quick = await ok(
      "/merchandise/operations",
      {
        id: randomUUID(),
        direction: "entry",
        items: [
          {
            quick: {
              name: "QA rápido R4 " + suffix,
              categoryId: cats.find((c: any) => c.name === "Accesorios de gym")
                .id,
              price: 1,
              cost: 2500,
              barcode: "R4Q-" + suffix,
              variant: "Única",
            },
            qty: 1,
            unitCost: 2500,
          },
        ],
      },
      wh.token,
    );
    const created = await fixtureDb.variant.findUnique({
      where: { id: quick.variantIds[0] },
      include: { product: true },
    });
    expect(created.product.active).toBe(false);
    expect(
      await fixtureDb.alert.count({
        where: { key: "new-product:" + created.productId },
      }),
    ).toBe(1);
    const tiny = await request(
      "/merchandise/operations",
      {
        id: randomUUID(),
        direction: "entry",
        items: [{ variantId: clothingVariant.id, qty: 0.0004, unitCost: 1e6 }],
      },
      wh.token,
    );
    expect(tiny.status).toBe(400);
    // 2 a 15 + flete 4 => costo recibido 17 por unidad (no el nuevo promedio).
    const entry = await ok(
      "/merchandise/operations",
      {
        id: randomUUID(),
        direction: "entry",
        freight: 4,
        items: [{ variantId: clothingVariant.id, qty: 2, unitCost: 15 }],
      },
      wh.token,
    );
    const m = await fixtureDb.inventoryMovement.findFirst({
      where: { refId: entry.receiptId },
    });
    expect(Number(m.unitCost)).toBe(17);
  });
  it("SSE: como máximo dos conexiones por sesión", async () => {
    const controllers: AbortController[] = [];
    const open = async () => {
      const c = new AbortController();
      controllers.push(c);
      return fetch(base + "/events", {
        headers: { Authorization: "Bearer " + token },
        signal: c.signal,
      });
    };
    try {
      expect((await open()).status).toBe(200);
      expect((await open()).status).toBe(200);
      expect((await open()).status).toBe(429);
    } finally {
      for (const c of controllers) c.abort();
    }
  });
  it("importación: archivos grandes se rechazan sin leerlos", async () => {
    const upload = async (content: string) => {
      const form = new FormData();
      form.set("file", new Blob([content], { type: "text/csv" }), "f.csv");
      form.set(
        "mapping",
        JSON.stringify({
          code: "codigo",
          description: "descripcion",
          qty: "cantidad",
          unitCost: "costo",
        }),
      );
      const started = Date.now();
      const r = await fetch(base + "/merchandise/import", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "X-Forwarded-For": testIp,
        },
        body: form,
      });
      return {
        status: r.status,
        body: await r.json(),
        ms: Date.now() - started,
      };
    };
    const header = "codigo,descripcion,cantidad,costo\n";
    const big = await upload(header + "A,Producto,1,10\n".repeat(80000));
    expect(big.status).toBe(400);
    expect(big.body.message).toContain("1 MB");
    expect(big.ms).toBeLessThan(3000);
    const many = await upload(header + "A,Producto,1,10\n".repeat(1500));
    expect(many.status).toBe(400);
    expect(many.body.message).toContain("1000 filas");
  });
});

describe("Auditoría ronda 4 de ChatGPT", () => {
  it("P1: una caída abrupta del cliente libera su conexión de tiempo real", async () => {
    const { request: httpRequest } = await import("node:http");
    const url = new URL(base + "/events");
    const openRaw = () =>
      new Promise<{ status: number; drop: () => void }>((resolve, reject) => {
        const req = httpRequest(
          {
            host: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: { Authorization: "Bearer " + token },
          },
          (res) =>
            resolve({ status: res.statusCode!, drop: () => req.destroy() }),
        );
        req.on("error", () => {});
        req.on("error", reject);
        req.end();
      });
    const first = await openRaw();
    const second = await openRaw();
    expect([first.status, second.status]).toEqual([200, 200]);
    expect((await openRaw()).status).toBe(429);
    // Caída abrupta: se destruye el socket sin cerrar el flujo SSE.
    first.drop();
    second.drop();
    await new Promise((r) => setTimeout(r, 300));
    const again = [await openRaw(), await openRaw()];
    expect(again.map((c) => c.status)).toEqual([200, 200]);
    for (const c of again) c.drop();
  });
  it("P2: el kardex tiene índice por lote (migración y base de datos)", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../apps/api/prisma/migrations/202610050002_lot_index/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain(
      'CREATE INDEX "InventoryMovement_lotId_idx" ON "InventoryMovement"("lotId")',
    );
    const rows: any[] = await fixtureDb.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'InventoryMovement' AND indexname = 'InventoryMovement_lotId_idx'`;
    expect(rows.length).toBe(1);
  });
});
// Ronda 6: regresiones exigidas por la auditoría R4 de ChatGPT
// (docs/AUDITORIA_RONDA4.md). Corren igual con tsx y con node dist/main.js.
describe("Ronda 6 · auditoría R4 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[], variant: any;
  const newVariant = async (name: string) => {
    const p = await ok("/products", {
      name: name + " " + suffix,
      sku: "R6-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R6V-" + randomUUID().slice(0, 8),
          barcode: "R6B-" + randomUUID().slice(0, 8),
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(p);
    return p.variants[0];
  };
  const newUser = async (role: string) => {
    const roles = await ok("/roles");
    const u = await ok("/users", {
      name: "QA R6 " + role + " " + randomUUID().slice(0, 4),
      email: "r6-" + role + "-" + randomUUID().slice(0, 6) + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "612345",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    actors.push(u);
    const auth = await ok(
      "/auth/login",
      { email: u.email, password: "FitStore-QA-2026!" },
      "",
    );
    return { user: u, token: auth.accessToken as string };
  };
  const sessionIdOf = (jwt: string) =>
    JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sid;
  // Ejecuta el SQL exacto de la migración de la ronda 6 (es re-ejecutable).
  const runRound6Sql = async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../apps/api/prisma/migrations/202610060001_round6_audit/migration.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(/;\s*\n/).map((s) => s.trim()))
      if (statement) await fixtureDb.$executeRawUnsafe(statement);
  };
  const purchases = async (supplier: string, from = today, to = today) =>
    (await ok(`/reports/purchases?from=${from}&to=${to}`)).rows.find(
      (r: any) => r.Proveedor === supplier,
    );
  const adjust = (as: string) =>
    request(
      "/inventory/adjustments",
      { variantId: variant.id, qty: 1, reason: "QA equipo R6" },
      as,
    );
  beforeAll(async () => {
    cats = await ok("/categories");
    variant = await newVariant("QA R6 base");
  });

  it("R4-01: un equipo R3 migrado no se puede reclamar ni operar sin aprobación del gerente", async () => {
    const original = await newUser("warehouse");
    const intruder = await newUser("warehouse");
    // Estado exacto tras la migración R4: aprobado, sin secreto ni creador.
    const legacyTerminal = async () => {
      const id = randomUUID();
      await fixtureDb.terminal.create({
        data: {
          id,
          name: "Equipo R3 " + id.slice(0, 4),
          branchId: "main",
          approvedAt: new Date(),
          lastUserId: original.user.id,
        },
      });
      return id;
    };
    const legacy = await legacyTerminal(),
      second = await legacyTerminal(),
      unclaimed = await legacyTerminal();
    // Sesión heredada ya enlazada a ese ID (como la dejaba la ronda 3).
    await fixtureDb.authSession.update({
      where: { id: sessionIdOf(original.token) },
      data: { terminalId: legacy },
    });
    await runRound6Sql();
    await runRound6Sql();
    for (const id of [legacy, second, unclaimed]) {
      const t = await fixtureDb.terminal.findUnique({ where: { id } });
      expect(t).toMatchObject({ legacy: true, approvedAt: null });
    }
    // La sesión heredada ya no opera.
    const heir = await adjust(original.token);
    expect(heir.status).toBe(403);
    expect(heir.body.code).toBe("TERMINAL_PENDING");
    // Otro usuario con el ID conocido y un secreto nuevo: queda pendiente.
    const claim = await ok(
      "/terminals/register",
      { id: legacy, name: "Intruso", secret: "intruso-secreto-" + legacy },
      intruder.token,
    );
    expect(claim).toMatchObject({ status: "pending", approvedBy: null });
    expect(claim.secretHash).toBeUndefined();
    const blocked = await adjust(intruder.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("TERMINAL_PENDING");
    expect(
      await fixtureDb.auditLog.count({
        where: { entityId: legacy, action: "terminal_legacy_claimed" },
      }),
    ).toBe(1);
    // El gerente lo ve como equipo anterior reclamado por esa persona.
    const listed = (await ok("/terminals", undefined, ownerToken)).find(
      (t: any) => t.id === legacy,
    );
    expect(listed).toMatchObject({
      legacy: true,
      status: "pending",
      identified: true,
      createdByName: intruder.user.name,
    });
    // Revocarlo deja fuera al intruso; un revocado no se vuelve a reclamar.
    await ok("/terminals/" + legacy + "/revoke", {}, ownerToken);
    expect((await adjust(intruder.token)).status).toBe(401);
    expect(
      (
        await request(
          "/terminals/register",
          { id: legacy, name: "Otra vez", secret: "x".repeat(20) },
          original.token,
        )
      ).status,
    ).toBe(401);
    // Flujo autorizado: el dueño reclama el segundo y el gerente lo aprueba.
    const relog = await ok(
      "/auth/login",
      { email: original.user.email, password: "FitStore-QA-2026!" },
      "",
    );
    const mine = await ok(
      "/terminals/register",
      { id: second, name: "Mi equipo", secret: "propio-secreto-" + second },
      relog.accessToken,
    );
    expect(mine.status).toBe("pending");
    expect((await adjust(relog.accessToken)).status).toBe(403);
    await ok("/terminals/" + second + "/approve", {}, ownerToken);
    expect((await adjust(relog.accessToken)).status).toBe(201);
    // Un equipo anterior que nunca se identificó no se puede aprobar.
    const early = await request(
      "/terminals/" + unclaimed + "/approve",
      {},
      ownerToken,
    );
    expect(early.status).toBe(400);
    expect(
      (await fixtureDb.terminal.findUnique({ where: { id: unclaimed } }))
        .approvedAt,
    ).toBeNull();
    // Un gerente que reclama un equipo anterior lo aprueba él mismo, auditado.
    const manager = await newUser("manager");
    const managed = await legacyTerminal();
    await runRound6Sql();
    const byManager = await ok(
      "/terminals/register",
      { id: managed, name: "Caja anterior", secret: "gerente-" + managed },
      manager.token,
    );
    expect(byManager).toMatchObject({
      status: "approved",
      approvedBy: manager.user.id,
    });
  });

  it("R4-02: la compra R3 sin orden se recupera de la bitácora; reparación idempotente", async () => {
    const supplier = await ok("/suppliers", { name: "QA R6 legado " + suffix });
    const entry = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      freight: 4,
      items: [{ variantId: variant.id, qty: 2, unitCost: 15 }],
    });
    const ambiguous = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      items: [{ variantId: variant.id, qty: 1, unitCost: 7 }],
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: variant.id, qty: 1, unitCost: 50 }],
    });
    await ok("/purchase-orders/" + order.id + "/receive", {
      items: [{ itemId: order.items[0].id, qty: 1 }],
    });
    const orderReceipt = await fixtureDb.goodsReceipt.findFirstOrThrow({
      where: { orderId: order.id },
    });
    const ids = [entry.receiptId, ambiguous.receiptId, orderReceipt.id];
    // Estado de una base R3: la recepción no guardaba proveedor ni total.
    await fixtureDb.goodsReceipt.updateMany({
      where: { id: { in: ids } },
      data: {
        supplierId: null,
        total: null,
        attachmentId: null,
        operationId: null,
      },
    });
    // Evidencia ambigua: dos entradas de bitácora para la misma operación.
    const log = await fixtureDb.auditLog.findFirstOrThrow({
      where: { entityId: ambiguous.id, action: "merchandise_entry" },
    });
    await fixtureDb.auditLog.create({
      data: {
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        after: { ...(log.after as any), supplierId: randomUUID() },
        branchId: log.branchId,
      },
    });
    // Antes de reparar: la recepción de la orden no tiene total y las de
    // Mercancía ni siquiera proveedor.
    expect(await purchases(supplier.name)).toMatchObject({
      Compras: 0,
      Sin_conciliar: 1,
    });
    const orphans = async () =>
      (await purchases("Recepciones sin proveedor (conciliar)"))
        ?.Sin_conciliar ?? 0;
    const orphanBefore = await orphans();
    expect(orphanBefore).toBeGreaterThanOrEqual(2);
    const count = await fixtureDb.goodsReceipt.count();
    await runRound6Sql();
    await runRound6Sql();
    expect(await fixtureDb.goodsReceipt.count()).toBe(count);
    const restored = await fixtureDb.goodsReceipt.findUnique({
      where: { id: entry.receiptId },
    });
    expect(restored).toMatchObject({
      supplierId: supplier.id,
      operationId: entry.id,
    });
    expect(Number(restored.total)).toBe(34);
    const fromOrder = await fixtureDb.goodsReceipt.findUnique({
      where: { id: orderReceipt.id },
    });
    expect(fromOrder.supplierId).toBe(supplier.id);
    expect(Number(fromOrder.total)).toBe(50);
    // Lo ambiguo no se inventa: queda para conciliación explícita.
    expect(
      await fixtureDb.goodsReceipt.findUnique({
        where: { id: ambiguous.receiptId },
      }),
    ).toMatchObject({ supplierId: null, total: null, operationId: null });
    expect(await purchases(supplier.name)).toMatchObject({
      Ordenado: 50,
      Compras: 84,
      Pendiente: 84,
      Sin_conciliar: 0,
    });
    // La recuperada sale de "sin proveedor"; la ambigua sigue ahí.
    expect(await orphans()).toBe(orphanBefore - 1);
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 84,
      method: "transfer",
    });
    expect(await purchases(supplier.name)).toMatchObject({
      Pagado: 84,
      Pendiente: 0,
    });
    expect(
      await purchases(supplier.name, "2020-01-01", "2020-01-31"),
    ).toMatchObject({ Compras: 0, Pagado: 0, Sin_conciliar: 0 });
  });

  it("R4-03: cantidades fuera de precisión dan 400 en todas las rutas y no tocan costo, stock ni kardex", async () => {
    const v = await newVariant("QA R6 precisión");
    await ok("/inventory/adjustments", {
      variantId: v.id,
      qty: 1,
      reason: "QA apertura R6",
    });
    const supplier = await ok("/suppliers", {
      name: "QA R6 precisión " + suffix,
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: v.id, qty: 1, unitCost: 1000000 }],
    });
    const snapshot = async () => {
      const row = await fixtureDb.variant.findUnique({ where: { id: v.id } });
      const item = await fixtureDb.purchaseItem.findUnique({
        where: { id: order.items[0].id },
      });
      return {
        stock: Number(row.stock),
        cost: Number(row.costAvg),
        received: Number(item.receivedQty),
        receipts: await fixtureDb.goodsReceipt.count({
          where: { orderId: order.id },
        }),
        kardex: await fixtureDb.inventoryMovement.count({
          where: { variantId: v.id },
        }),
        lots: await fixtureDb.lot.count({ where: { variantId: v.id } }),
      };
    };
    const before = await snapshot();
    expect(before).toMatchObject({ stock: 1, cost: 10 });
    for (const qty of [0.0004, 1.0001]) {
      const r = await request("/purchase-orders/" + order.id + "/receive", {
        items: [{ itemId: order.items[0].id, qty, lotNumber: "R6-L" }],
      });
      expect(r.status, String(qty)).toBe(400);
      expect(r.body.message).toMatch(/cantidad/);
    }
    expect(await snapshot()).toEqual(before);
    const fine = [
      () =>
        request("/merchandise/operations", {
          id: randomUUID(),
          direction: "entry",
          items: [{ variantId: v.id, qty: 0.0004, unitCost: 5 }],
        }),
      () =>
        request("/inventory/adjustments", {
          variantId: v.id,
          qty: 0.0004,
          reason: "QA fino",
        }),
      () =>
        request("/inventory/adjustments", {
          variantId: v.id,
          qty: -1.0001,
          reason: "QA fino",
        }),
      () =>
        request("/inventory/counts", {
          items: [{ variantId: v.id, counted: 1.0001 }],
        }),
      () =>
        request("/purchase-orders", {
          supplierId: supplier.id,
          items: [{ variantId: v.id, qty: 0.0004, unitCost: 5 }],
        }),
      () =>
        request("/sales", {
          ...input(v.id, 118),
          items: [{ variantId: v.id, qty: 0.0004 }],
        }),
      () =>
        request("/returns", {
          saleId: randomUUID(),
          cashSessionId: session.id,
          reason: "QA precisión",
          refundMethod: "cash",
          items: [{ saleItemId: randomUUID(), qty: 0.0004, restock: true }],
        }),
    ];
    for (const call of fine) {
      const r = await call();
      expect(r.status, JSON.stringify(r.body)).toBe(400);
    }
    expect(await snapshot()).toEqual(before);
    // 0.001 es válido y conserva cantidad y costo contable.
    await ok("/purchase-orders/" + order.id + "/receive", {
      items: [{ itemId: order.items[0].id, qty: 0.001 }],
    });
    const after = await snapshot();
    expect(after.stock).toBe(1.001);
    expect(after.received).toBe(0.001);
    expect(after.receipts).toBe(1);
    expect(after.kardex).toBe(before.kardex + 1);
    // (1 × 10 + 0.001 × 1 000 000) / 1.001
    expect(after.cost).toBeCloseTo(1008.99, 2);
    const receipt = await fixtureDb.goodsReceipt.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(Number(receipt.total)).toBe(1000);
  });

  it("R4-04: la factura aceptada contra una orden fija la deuda; parciales, flete y reintento sin doble conteo", async () => {
    const supplier = await ok("/suppliers", {
      name: "QA R6 factura " + suffix,
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: variant.id, qty: 2, unitCost: 25 }],
    });
    const invoice = {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      orderId: order.id,
      invoiceTotal: 60,
      items: [
        {
          variantId: variant.id,
          itemId: order.items[0].id,
          qty: 2,
          unitCost: 30,
        },
      ],
    };
    await ok("/merchandise/operations", invoice);
    expect(await purchases(supplier.name)).toMatchObject({
      Ordenado: 50,
      Compras: 60,
      Pendiente: 60,
    });
    // Reintento con el mismo UUID: misma recepción, mismo importe.
    await ok("/merchandise/operations", invoice);
    expect(await purchases(supplier.name)).toMatchObject({ Compras: 60 });
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 60,
      method: "transfer",
    });
    expect(await purchases(supplier.name)).toMatchObject({
      Pagado: 60,
      Pendiente: 0,
    });
    // Parciales: 2 por la ruta de la orden (al costo de la orden) y 2 por
    // factura con otro costo, flete e impuestos.
    const partialSupplier = await ok("/suppliers", {
      name: "QA R6 parcial " + suffix,
    });
    const partial = await ok("/purchase-orders", {
      supplierId: partialSupplier.id,
      items: [{ variantId: variant.id, qty: 4, unitCost: 10 }],
    });
    await ok("/purchase-orders/" + partial.id + "/receive", {
      items: [{ itemId: partial.items[0].id, qty: 2 }],
    });
    expect(await purchases(partialSupplier.name)).toMatchObject({
      Ordenado: 40,
      Compras: 20,
    });
    await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId: partialSupplier.id,
      orderId: partial.id,
      freight: 3,
      taxes: 2,
      items: [
        {
          variantId: variant.id,
          itemId: partial.items[0].id,
          qty: 2,
          unitCost: 12,
        },
      ],
    });
    expect(await purchases(partialSupplier.name)).toMatchObject({
      Ordenado: 40,
      Compras: 49,
      Pendiente: 49,
    });
    expect(
      await purchases(partialSupplier.name, "2020-01-01", "2020-01-31"),
    ).toMatchObject({ Ordenado: 0, Compras: 0 });
  });

  it("R4-06: una ráfaga de conexiones SSE sobre una sesión acepta como máximo dos", async () => {
    const { request: httpRequest } = await import("node:http");
    const { token: sse } = await newUser("seller");
    const url = new URL(base + "/events");
    const open = () =>
      new Promise<{ status: number; drop: () => void }>((resolve) => {
        const req = httpRequest(
          {
            host: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: { Authorization: "Bearer " + sse },
          },
          (res) => {
            res.resume();
            resolve({ status: res.statusCode!, drop: () => req.destroy() });
          },
        );
        req.on("error", () => resolve({ status: 0, drop: () => {} }));
        req.end();
      });
    const burst = await Promise.all(Array.from({ length: 8 }, open));
    const statuses = burst.map((c) => c.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(2);
    expect(statuses.filter((s) => s === 429)).toHaveLength(6);
    burst.forEach((c) => c.drop());
    await new Promise((r) => setTimeout(r, 300));
    const again = await Promise.all([open(), open()]);
    expect(again.map((c) => c.status)).toEqual([200, 200]);
    again.forEach((c) => c.drop());
  });

  it("R4-08: ventas inválidas devuelven 400 con campos en español (también en la API compilada)", async () => {
    const empty = await request("/sales", {});
    expect(empty.status).toBe(400);
    expect(empty.body.message).toMatch(/^Revisa los campos: /);
    expect(empty.body.message).toMatch(/caja|línea|pago/);
    const discount = await request("/sales", {
      ...input(variant.id, 118),
      items: [{ variantId: variant.id, qty: 1, discountPercent: 150 }],
    });
    expect(discount.status).toBe(400);
    expect(discount.body.message).toMatch(/Revisa los campos/);
  });
});
// Ronda 7: regresiones exigidas por la auditoría R6 de ChatGPT
// (docs/AUDITORIA_RONDA6.md).
describe("Ronda 7 · auditoría R6 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[];
  const product = async (label: string, price: number, costAvg: number) => {
    const p = await ok("/products", {
      name: "QA R7 " + label + " " + suffix,
      sku: "R7-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      taxRate: 0,
      variants: [
        {
          sku: "R7V-" + randomUUID().slice(0, 8),
          barcode: "R7B-" + randomUUID().slice(0, 8),
          price,
          costAvg,
        },
      ],
    });
    products.push(p);
    return p.variants[0];
  };
  const runMigrationSql = async (dir: string) => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../apps/api/prisma/migrations/" + dir + "/migration.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(/;\s*\n/).map((s) => s.trim()))
      if (statement) await fixtureDb.$executeRawUnsafe(statement);
  };
  beforeAll(async () => {
    cats = await ok("/categories");
  });

  it("R6-01: un combo fraccionado se rechaza sin escrituras; 1 combo consume exactamente 0.4 y su devolución lo repone", async () => {
    const component = await product("componente", 12000, 10000);
    const combo = await product("combo", 5000, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 1,
      reason: "QA stock para combo",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.4 }],
    });
    const cashOf = async () =>
      (await ok("/cash-sessions")).find((s: any) => s.id === session.id)
        .expected;
    const snapshot = async () => ({
      stock: Number(
        (await fixtureDb.variant.findUnique({ where: { id: component.id } }))
          .stock,
      ),
      moves: await fixtureDb.inventoryMovement.count({
        where: { variantId: component.id },
      }),
      sales: await fixtureDb.saleItem.count({
        where: { variantId: combo.id },
      }),
      payments: await fixtureDb.payment.count({
        where: { sale: { cashSessionId: session.id } },
      }),
      cash: await cashOf(),
    });
    const before = await snapshot();
    // Reproducción exacta de ChatGPT: 0.001 combos, pago de 5.
    const fractional = {
      ...input(combo.id, 5),
      items: [{ variantId: combo.id, qty: 0.001 }],
    };
    const rejected = await request("/sales", fractional);
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toMatch(/unidades enteras/);
    expect(
      await fixtureDb.sale.count({
        where: { offlineUuid: fractional.offlineUuid },
      }),
    ).toBe(0);
    // Otra fracción con consumo representable (0.5 × 0.4 = 0.2) también se
    // rechaza: los combos se venden enteros.
    const half = await request("/sales", {
      ...input(combo.id, 2500),
      items: [{ variantId: combo.id, qty: 0.5 }],
    });
    expect(half.status).toBe(400);
    expect(await snapshot()).toEqual(before);
    // Una venta de 1 combo consume exactamente 0.4 con costo coherente.
    const sale = await ok("/sales", input(combo.id, 5000));
    expect(Number(sale.costTotal)).toBe(4000);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    expect(Number(item.unitCost)).toBe(4000);
    expect(item.stockAllocations).toEqual([
      expect.objectContaining({
        variantId: component.id,
        qty: 0.4,
        unitCost: 10000,
      }),
    ]);
    const move = await fixtureDb.inventoryMovement.findFirstOrThrow({
      where: { variantId: component.id, refId: sale.id, type: "sale" },
    });
    expect(Number(move.qty)).toBe(-0.4);
    expect(Number(move.balanceAfter)).toBe(0.6);
    // Devoluciones: media unidad de combo se rechaza; una entera repone 0.4.
    const returnBody = (qty: number) => ({
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA devolución combo",
      refundMethod: "credit_note",
      items: [{ saleItemId: item.id, qty, restock: true }],
    });
    const partial = await request("/returns", returnBody(0.5));
    expect(partial.status).toBe(400);
    expect(partial.body.message).toMatch(/unidades enteras/);
    await ok("/returns", returnBody(1));
    const restored = await fixtureDb.variant.findUnique({
      where: { id: component.id },
    });
    expect(Number(restored.stock)).toBe(1);
    expect(Number(restored.costAvg)).toBe(10000);
    const back = await fixtureDb.inventoryMovement.findFirstOrThrow({
      where: { variantId: component.id, refId: sale.id, type: "return" },
    });
    expect(Number(back.qty)).toBe(0.4);
  });

  it("revisión R7: costo de combos exacto en venta, devolución y reporte de utilidad", async () => {
    // 0.5 × 10.01 = 5.005 por combo: el costo por unidad se redondea, el de
    // las asignaciones no.
    const component = await product("costo fino", 30, 10.01);
    const combo = await product("combo costo fino", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 10,
      reason: "QA stock combo costo",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.5 }],
    });
    const sale = await ok("/sales", {
      ...input(combo.id, 200),
      items: [{ variantId: combo.id, qty: 10 }],
    });
    expect(Number(sale.costTotal)).toBe(50.05);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    const profit = async () =>
      (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Producto === "QA R7 combo costo fino " + suffix,
      );
    expect(await profit()).toMatchObject({ Costo: 50.05 });
    const back = async (qty: number) =>
      ok("/returns", {
        saleId: sale.id,
        cashSessionId: session.id,
        reason: "QA devolución costo",
        refundMethod: "credit_note",
        items: [{ saleItemId: item.id, qty, restock: true }],
      });
    const r1 = await back(3);
    const r2 = await back(7);
    // Las devoluciones suman exactamente el costo de la venta.
    expect(Number(r1.costTotal) + Number(r2.costTotal)).toBeCloseTo(50.05, 2);
    expect(await profit()).toMatchObject({ Costo: 0 });
    const restored = await fixtureDb.variant.findUnique({
      where: { id: component.id },
    });
    expect(Number(restored.stock)).toBe(10);
    expect(Number(restored.costAvg)).toBe(10.01);
  });

  it("revisión R7: una línea de combo fraccionada anterior se devuelve completa, no en partes", async () => {
    const component = await product("legado", 30, 10);
    const combo = await product("combo legado", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 2,
      reason: "QA stock combo legado",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.4 }],
    });
    const sale = await ok("/sales", input(combo.id, 20));
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    // Como la dejaba una venta anterior: 0.5 combos que consumieron 0.2 (el
    // costo de la venta se ajusta igual, para que los reportes cuadren).
    await fixtureDb.sale.update({
      where: { id: sale.id },
      data: { costTotal: 2 },
    });
    await fixtureDb.saleItem.update({
      where: { id: item.id },
      data: {
        qty: 0.5,
        stockAllocations: (item.stockAllocations as any[]).map((a) => ({
          ...a,
          qty: 0.2,
        })),
      },
    });
    const body = (qty: number) => ({
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA devolución legado",
      refundMethod: "credit_note",
      items: [{ saleItemId: item.id, qty, restock: true }],
    });
    expect((await request("/returns", body(0.3))).status).toBe(400);
    await ok("/returns", body(0.5));
    const move = await fixtureDb.inventoryMovement.findFirstOrThrow({
      where: { variantId: component.id, refId: sale.id, type: "return" },
    });
    expect(Number(move.qty)).toBe(0.2);
  });

  it("R6-03: la recuperación no concilia recepciones con líneas incompletas; la completa sigue en 55", async () => {
    const v = await product("recepción", 100, 25);
    const supplier = await ok("/suppliers", {
      name: "QA R7 recuperación " + suffix,
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: v.id, qty: 20, unitCost: 25 }],
    });
    const user = await fixtureDb.user.findFirstOrThrow();
    const legacyReceipt = (items: unknown, freight = 0, otherCosts = 0) =>
      fixtureDb.goodsReceipt.create({
        data: {
          orderId: order.id,
          freight,
          otherCosts,
          items,
          userId: user.id,
          branchId: "main",
        },
      });
    const incomplete = [
      await legacyReceipt([{ qty: 1, cost: 25 }, { qty: 1 }]),
      await legacyReceipt([{ qty: 1, cost: 25 }, { cost: 25 }]),
      await legacyReceipt([{ qty: 1, cost: 25 }, {}]),
      await legacyReceipt(["línea", { qty: 1, cost: 25 }]),
      await legacyReceipt([{ qty: 0, cost: 25 }]),
      await legacyReceipt([]),
    ];
    const complete = await legacyReceipt([{ qty: 2, cost: 25 }], 4, 1);
    // Base que ya aplicó la versión con el error: un total parcial de 25.
    const alreadyWrong = await legacyReceipt([
      { qty: 1, cost: 25 },
      { qty: 1 },
    ]);
    await fixtureDb.goodsReceipt.update({
      where: { id: alreadyWrong.id },
      data: { total: 25, supplierId: supplier.id },
    });
    for (let run = 0; run < 2; run++) {
      await runMigrationSql("202610060001_round6_audit");
      await runMigrationSql("202610070001_round7");
    }
    for (const r of [...incomplete, alreadyWrong]) {
      const row = await fixtureDb.goodsReceipt.findUnique({
        where: { id: r.id },
      });
      expect(row.total, JSON.stringify(r.items)).toBeNull();
    }
    const ok55 = await fixtureDb.goodsReceipt.findUnique({
      where: { id: complete.id },
    });
    expect(ok55.supplierId).toBe(supplier.id);
    expect(Number(ok55.total)).toBe(55);
    const report = async () =>
      (await ok(`/reports/purchases?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Proveedor === supplier.name,
      );
    expect(await report()).toMatchObject({
      Compras: 55,
      Pendiente: 55,
      Sin_conciliar: incomplete.length + 1,
    });
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 55,
      method: "transfer",
    });
    expect(await report()).toMatchObject({ Pagado: 55, Pendiente: 0 });
  });
});
// Ejecuta el importador real contra la misma base que la API.
const runImport = async (rows: unknown[][], ...flags: string[]) => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const ExcelJS = requireApi("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario 2026");
  ws.addRow([
    "ID",
    "DESCRIPCION",
    "REFERENCIA",
    "SUB-GRUPO DE ARTICULO",
    "EXISTENCIA",
    "COSTO",
    "PRECIO DETALLE",
  ]);
  rows.forEach((r) => ws.addRow(r));
  const file = join(mkdtempSync(join(tmpdir(), "r8-")), "inventario.xlsx");
  await wb.xlsx.writeFile(file);
  const run = spawnSync(
    new URL("../apps/api/node_modules/.bin/tsx", import.meta.url).pathname,
    ["scripts/import-inventario.ts", file, ...flags],
    {
      cwd: new URL("../apps/api", import.meta.url).pathname,
      env: process.env,
      encoding: "utf8",
    },
  );
  return { status: run.status, out: run.stdout + run.stderr };
};

// Ronda 8: regresiones exigidas por la auditoría R7 de ChatGPT
// (docs/AUDITORIA_RONDA7.md).
describe("Ronda 8 · auditoría R7 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  it("R7-01: un código que ya es de otro producto detiene la carga sin escribir", async () => {
    const code = "98765" + Date.now().toString().slice(-8);
    const a = await ok("/products", {
      name: "QA R8 existente " + suffix,
      sku: "R8A-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R8AV-" + randomUUID().slice(0, 8),
          barcode: code,
          price: 20,
          costAvg: 10,
        },
      ],
    });
    products.push(a);
    const before = await fixtureDb.variant.count();
    // Como el caso de ChatGPT: ID y referencia iguales al código de barras de A.
    const r1 = await runImport([
      [code, "QA R8 producto B", code, "Ropa deportiva", 2, 10, 20],
    ]);
    expect(r1.status).not.toBe(0);
    expect(r1.out).toMatch(new RegExp("el código " + code + " ya es de"));
    // REFERENCIA igual al SKU de A en una fila con otro ID.
    const r2 = await runImport([
      [
        "R8-" + suffix,
        "QA R8 producto C",
        a.variants[0].sku,
        "Ropa deportiva",
        1,
        10,
        20,
      ],
    ]);
    expect(r2.status).not.toBe(0);
    expect(r2.out).toMatch(/ya es de/);
    expect(await fixtureDb.variant.count()).toBe(before);
    expect(
      await fixtureDb.variant.findFirst({ where: { sku: code } }),
    ).toBeNull();
  });

  it("R7-03: una carga no apaga el lote obligatorio de una categoría sin pedirlo", async () => {
    const name = "QA R8 lotes " + suffix;
    const category = await ok("/categories", {
      name,
      requiresLot: true,
      requiresExpiry: true,
    });
    const id = "R8L-" + randomUUID().slice(0, 6);
    const r = await runImport([[id, "QA R8 con lote", id, name, 3, 10, 20]]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/exige lote o vencimiento/);
    expect(
      await fixtureDb.category.findUnique({ where: { id: category.id } }),
    ).toMatchObject({ requiresLot: true, requiresExpiry: true });
    expect(
      await fixtureDb.variant.findFirst({ where: { sku: id } }),
    ).toBeNull();
    // Pedido explícito: se desactiva y queda en la bitácora.
    const forced = await runImport(
      [[id, "QA R8 con lote", id, name, 3, 10, 20]],
      "--sin-lotes",
    );
    expect(forced.status, forced.out).toBe(0);
    expect(
      await fixtureDb.category.findUnique({ where: { id: category.id } }),
    ).toMatchObject({ requiresLot: false, requiresExpiry: false });
    expect(
      await fixtureDb.auditLog.count({
        where: {
          entityId: category.id,
          action: "category_lots_disabled_by_import",
        },
      }),
    ).toBe(1);
    // Una recarga de lo ya cargado no toca la categoría.
    await fixtureDb.category.update({
      where: { id: category.id },
      data: { requiresLot: true, requiresExpiry: true },
    });
    const again = await runImport([
      [id, "QA R8 con lote", id, name, 3, 10, 20],
    ]);
    expect(again.status, again.out).toBe(0);
    expect(again.out).toMatch(/1 ya cargados sin cambios/);
    expect(
      await fixtureDb.category.findUnique({ where: { id: category.id } }),
    ).toMatchObject({ requiresLot: true, requiresExpiry: true });
    const v = await fixtureDb.variant.findFirstOrThrow({ where: { sku: id } });
    await request(
      "/products/" + v.productId,
      { active: false },
      ownerToken,
      "PATCH",
    );
  });

  it("R7-04: el reporte de utilidad usa el costo registrado en cada devolución parcial", async () => {
    const product = async (label: string, price: number, costAvg: number) => {
      const p = await ok("/products", {
        name: "QA R8 " + label + " " + suffix,
        sku: "R8-" + randomUUID().slice(0, 8),
        categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
        taxRate: 0,
        variants: [
          {
            sku: "R8V-" + randomUUID().slice(0, 8),
            barcode: "R8B-" + randomUUID().slice(0, 8),
            price,
            costAvg,
          },
        ],
      });
      products.push(p);
      return p.variants[0];
    };
    const component = await product("comp parcial", 30, 10.01);
    const combo = await product("combo parcial", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 10,
      reason: "QA R8 stock",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.5 }],
    });
    const sale = await ok("/sales", {
      ...input(combo.id, 200),
      items: [{ variantId: combo.id, qty: 10 }],
    });
    expect(Number(sale.costTotal)).toBe(50.05);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    const profit = async () =>
      (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Producto === "QA R8 combo parcial " + suffix,
      ).Costo;
    const back = (qty: number) =>
      ok("/returns", {
        saleId: sale.id,
        cashSessionId: session.id,
        reason: "QA R8 devolución",
        refundMethod: "credit_note",
        items: [{ saleItemId: item.id, qty, restock: true }],
      });
    expect(await profit()).toBe(50.05);
    const first = await back(3);
    expect(Number(first.costTotal)).toBe(15.02);
    // El estado intermedio: 50.05 − 15.02 = 35.03.
    expect(await profit()).toBe(35.03);
    await back(7);
    expect(await profit()).toBe(0);
  });
});

// Ronda 9: regresiones exigidas por la auditoría R8 de ChatGPT
// (docs/AUDITORIA_RONDA8.md).
describe("Ronda 9 · auditoría R8 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const counts = async () => ({
    categories: await fixtureDb.category.count(),
    products: await fixtureDb.product.count(),
    variants: await fixtureDb.variant.count(),
    movements: await fixtureDb.inventoryMovement.count(),
  });

  it("R8-01: un código igual salvo mayúsculas al de otro producto detiene la carga", async () => {
    const tag = randomUUID().slice(0, 6).toUpperCase();
    const a = await ok("/products", {
      name: "QA R9 dueño " + suffix,
      sku: "R9A-" + tag,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "qa-case-owner-" + tag.toLowerCase(),
          barcode: "QA-R9-CASE" + tag,
          price: 20,
          costAvg: 10,
        },
      ],
    });
    products.push(a);
    const before = await counts();
    // Contra la base: el ID en minúsculas es el código de barras de A.
    const lower = "qa-r9-case" + tag.toLowerCase();
    const r1 = await runImport([
      [lower, "QA R9 producto B", lower, "Ropa deportiva", 2, 10, 20],
    ]);
    expect(r1.status).not.toBe(0);
    expect(r1.out).toMatch(/ya es de/);
    // Entre filas: la REFERENCIA de una fila es el ID de otra en mayúsculas.
    const r2 = await runImport([
      [
        "R9X-" + tag,
        "QA R9 fila A",
        "QA-R9-ROW" + tag,
        "Ropa deportiva",
        1,
        10,
        20,
      ],
      [
        "qa-r9-row" + tag.toLowerCase(),
        "QA R9 fila B",
        "",
        "Ropa deportiva",
        1,
        10,
        20,
      ],
    ]);
    expect(r2.status).not.toBe(0);
    expect(r2.out).toMatch(/es el ID de otra fila/);
    // IDs repetidos salvo mayúsculas.
    const r3 = await runImport([
      ["R9Y-" + tag, "QA R9 Y1", "", "Ropa deportiva", 1, 10, 20],
      ["r9y-" + tag.toLowerCase(), "QA R9 Y2", "", "Ropa deportiva", 1, 10, 20],
    ]);
    expect(r3.status).not.toBe(0);
    expect(r3.out).toMatch(/repetido/);
    expect(await counts()).toEqual(before);
  });

  it("R8-02: una devolución anterior a la ronda 8 se concilia con su costo contabilizado", async () => {
    const product = async (label: string, price: number, costAvg: number) => {
      const p = await ok("/products", {
        name: "QA R9 " + label + " " + suffix,
        sku: "R9-" + randomUUID().slice(0, 8),
        categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
        taxRate: 0,
        variants: [
          {
            sku: "R9V-" + randomUUID().slice(0, 8),
            barcode: "R9B-" + randomUUID().slice(0, 8),
            price,
            costAvg,
          },
        ],
      });
      products.push(p);
      return p.variants[0];
    };
    const component = await product("comp hist", 30, 10.01);
    const combo = await product("combo hist", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 10,
      reason: "QA R9 stock",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.5 }],
    });
    const sale = await ok("/sales", {
      ...input(combo.id, 200),
      items: [{ variantId: combo.id, qty: 10 }],
    });
    expect(Number(sale.costTotal)).toBe(50.05);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    const row = async () =>
      (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Producto === "QA R9 combo hist " + suffix,
      );
    const back = (qty: number) =>
      ok("/returns", {
        saleId: sale.id,
        cashSessionId: session.id,
        reason: "QA R9 devolución",
        refundMethod: "credit_note",
        items: [{ saleItemId: item.id, qty, restock: true }],
      });
    const first = await back(3);
    expect(Number(first.costTotal)).toBe(15.02);
    // Como la guardaba la ronda 7: líneas sin costo.
    const stored = await fixtureDb.saleReturn.findUniqueOrThrow({
      where: { id: first.id },
    });
    await fixtureDb.saleReturn.update({
      where: { id: first.id },
      data: {
        items: (stored.items as any[]).map(({ cost: _cost, ...p }) => p),
      },
    });
    expect((await row()).Costo).toBe(35.03);
    // Repetir la lectura no cambia nada.
    expect((await row()).Costo).toBe(35.03);
    await back(7);
    expect(await row()).toMatchObject({
      Ventas: 0,
      Costo: 0,
      Unidades: 0,
      Utilidad: 0,
    });
  });

  it("R8-03: una carga que se detiene en la validación no deja cambios", async () => {
    const lotName = "QA R9 lotes " + suffix;
    await ok("/categories", {
      name: lotName,
      requiresLot: true,
      requiresExpiry: true,
    });
    const tag = randomUUID().slice(0, 6);
    const before = await counts();
    const newCat = "QA R9 nueva " + suffix;
    const r1 = await runImport([
      ["R9N-" + tag, "QA R9 nueva", "", newCat, 1, 10, 20],
      ["R9L-" + tag, "QA R9 con lote", "", lotName, 1, 10, 20],
    ]);
    expect(r1.status).not.toBe(0);
    expect(r1.out).toMatch(/exige lote o vencimiento/);
    expect(
      await fixtureDb.category.findUnique({ where: { name: newCat } }),
    ).toBeNull();
    expect(await counts()).toEqual(before);
    // Precio fuera del límite de Decimal(14,2) en la segunda fila.
    const r2 = await runImport([
      ["R9P-" + tag, "QA R9 válido", "", "Ropa deportiva", 1, 10, 20],
      [
        "R9Q-" + tag,
        "QA R9 enorme",
        "",
        "Ropa deportiva",
        1,
        10,
        1000000000000,
      ],
    ]);
    expect(r2.status).not.toBe(0);
    expect(r2.out).toMatch(/máximo/);
    expect(await counts()).toEqual(before);
  });
});

// Ronda 9: hallazgos confirmados de la revisión adversarial de Claude
// (docs/validacion/ronda9-revision-adversarial.json). Un bloque por área.
// Área caja: ventas en espera (el resto de la caja se prueba en el navegador).
describe("Ronda 9 · revisión · caja", () => {
  it("R9-caja-4: la venta en espera guarda el descuento por monto, el global y el nombre, y sólo se recupera una vez", async () => {
    const cats = await ok("/categories");
    const p = await ok("/products", {
      name: "QA R9 caja espera " + suffix,
      sku: "R9CJ-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R9CJV-" + randomUUID().slice(0, 8),
          barcode: "R9CJB-" + randomUUID().slice(0, 8),
          price: 1500,
          costAvg: 700,
        },
      ],
    });
    products.push(p);
    const variantId = p.variants[0].id;
    // Más que el importe de la línea (2 × 1,500): se rechaza como en la venta.
    const tooMuch = await request("/quotes", {
      type: "held",
      items: [{ variantId, qty: 2, discountAmount: 3000.01 }],
    });
    expect(tooMuch.status).toBe(400);
    const held = await ok("/quotes", {
      type: "held",
      globalDiscount: 5,
      items: [
        {
          variantId,
          qty: 2,
          discountPercent: 0,
          discountAmount: 200,
          name: "QA R9 caja espera",
        },
      ],
    });
    const listed = (await ok("/quotes")).find((q: any) => q.id === held.id);
    expect(Number(listed.globalDiscount)).toBe(5);
    expect(listed.items[0]).toMatchObject({
      variantId,
      qty: 2,
      discountAmount: 200,
      name: "QA R9 caja espera",
    });
    // Dos clics a la vez: sólo uno recupera la venta (R9-caja-5).
    const both = await Promise.all([
      request("/quotes/" + held.id + "/convert", {}),
      request("/quotes/" + held.id + "/convert", {}),
    ]);
    expect(both.filter((r) => r.status < 400)).toHaveLength(1);
    expect((await ok("/quotes")).some((q: any) => q.id === held.id)).toBe(
      false,
    );
  });
});
// R9-REVISION: offline
// R9-REVISION: codigos
// Área dinero: devoluciones, costo contabilizado, abonos y reportes.
describe("Ronda 9 · revisión · dinero", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  const cents = (value: number) => Math.round(value * 100) / 100;
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const product = async (
    label: string,
    price: number,
    costAvg: number,
    stock = 0,
    taxRate = 0,
  ) => {
    const p = await ok("/products", {
      name: "QA R9D " + label + " " + suffix,
      sku: "R9D-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      taxRate,
      variants: [
        {
          sku: "R9DV-" + randomUUID().slice(0, 8),
          barcode: "R9DB-" + randomUUID().slice(0, 8),
          price,
          costAvg,
        },
      ],
    });
    products.push(p);
    if (stock)
      await ok("/inventory/adjustments", {
        variantId: p.variants[0].id,
        qty: stock,
        reason: "QA R9 dinero stock",
      });
    return p.variants[0];
  };
  const kit = async (label: string, componentId: string, qty: number) => {
    const v = await product(label, 20, 0);
    await ok("/kits", {
      kitVariantId: v.id,
      components: [{ componentVariantId: componentId, qty }],
    });
    return v;
  };
  // Se paga de más en efectivo: el cambio no afecta lo que se prueba.
  const sell = (items: { variantId: string; qty: number }[]) =>
    ok("/sales", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      items,
      payments: [{ method: "cash", amount: 10000 }],
    });
  const lineOf = (saleId: string, variantId: string) =>
    fixtureDb.saleItem.findFirstOrThrow({ where: { saleId, variantId } });
  const returnBody = (saleId: string, items: any[], refundMethod: string) => ({
    saleId,
    cashSessionId: session.id,
    reason: "QA R9 dinero devolución",
    refundMethod,
    items: items.map((i) => ({ restock: true, ...i })),
  });
  const giveBack = (
    saleId: string,
    items: any[],
    refundMethod = "credit_note",
  ) => ok("/returns", returnBody(saleId, items, refundMethod));
  const profitRow = async (label: string) =>
    (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
      (r: any) => r.Producto === "QA R9D " + label + " " + suffix,
    );
  const dashboard = (from = today, to = today) =>
    ok(`/dashboard/summary?from=${from}&to=${to}`);
  const expectedCash = async () =>
    (await ok("/cash-sessions")).find((c: any) => c.id === session.id).expected
      .cash;
  // Así guardaban las devoluciones las rondas 3 a 7: sin importes por línea.
  const asLegacyReturn = async (id: string, costTotal?: number) => {
    const stored = await fixtureDb.saleReturn.findUniqueOrThrow({
      where: { id },
    });
    await fixtureDb.saleReturn.update({
      where: { id },
      data: {
        items: (stored.items as any[]).map(
          ({ cost: _c, total: _t, tax: _x, ...p }) => p,
        ),
        ...(costTotal === undefined ? {} : { costTotal }),
      },
    });
  };
  const withCredit = async (run: () => Promise<void>) => {
    const settings = await ok("/settings");
    await ok(
      "/settings",
      {
        ...settings,
        allowCreditSales: true,
        creditApprovalThreshold: 100000,
      },
      token,
      "PUT",
    );
    try {
      await run();
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  };
  const creditCustomer = () =>
    ok("/customers", {
      name: "QA R9D crédito " + randomUUID().slice(0, 6),
      creditLimit: 100000,
    });
  const creditSale = (
    variantId: string,
    qty: number,
    amount: number,
    customerId: string,
  ) =>
    ok("/sales", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      items: [{ variantId, qty }],
      customerId,
      creditDueDate: "2030-01-01T12:00:00.000Z",
      payments: [{ method: "credit", amount }],
      expectedTotal: amount,
    });
  const installment = (saleId: string, method: string, amount: number) =>
    request("/sales/" + saleId + "/installments", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      method,
      amount,
      ...(method === "transfer"
        ? { bank: "QA Banco", reference: "QA-" + randomUUID().slice(0, 8) }
        : {}),
      ...(method === "card"
        ? { cardLast4: "4242", approvalCode: "QA-" + randomUUID().slice(0, 6) }
        : {}),
    });
  const balance = async (saleId: string) =>
    Number(
      (await fixtureDb.sale.findUniqueOrThrow({ where: { id: saleId } }))
        .creditBalance,
    );

  it("R9-dinero-1: la devolución que completa la línea descuenta el costo de la devolución histórica", async () => {
    const component = await product("comp hist", 30, 3.33, 10);
    const combo = await kit("combo hist", component.id, 0.5);
    const base = (await dashboard()).costTotal;
    const sale = await sell([{ variantId: combo.id, qty: 10 }]);
    expect(Number(sale.costTotal)).toBe(16.65);
    const line = await lineOf(sale.id, combo.id);
    expect(Number(line.unitCost)).toBe(1.67);
    // Venta anterior a la ronda 7: asignaciones sin "exact".
    await fixtureDb.saleItem.update({
      where: { id: line.id },
      data: {
        stockAllocations: (line.stockAllocations as any[]).map(
          ({ exact: _e, ...a }) => a,
        ),
      },
    });
    const first = await giveBack(sale.id, [{ saleItemId: line.id, qty: 5 }]);
    // Las rondas 3 a 7 contabilizaban unitCost × qty = 1.67 × 5.
    await asLegacyReturn(first.id, 8.35);
    const second = await giveBack(sale.id, [{ saleItemId: line.id, qty: 5 }]);
    expect(Number(second.costTotal)).toBe(8.3);
    expect(await profitRow("combo hist")).toMatchObject({
      Ventas: 0,
      Costo: 0,
      Unidades: 0,
      Utilidad: 0,
    });
    expect(cents((await dashboard()).costTotal - base)).toBe(0);

    // Varias líneas fraccionarias: las rondas 3 a 6 redondeaban la suma.
    const a = await product("frac A", 10, 0.49, 5);
    const b = await product("frac B", 10, 0.49, 5);
    const base2 = (await dashboard()).costTotal;
    const sale2 = await sell([
      { variantId: a.id, qty: 0.5 },
      { variantId: b.id, qty: 0.5 },
    ]);
    expect(Number(sale2.costTotal)).toBe(0.5);
    const la = await lineOf(sale2.id, a.id),
      lb = await lineOf(sale2.id, b.id);
    const old = await giveBack(sale2.id, [
      { saleItemId: la.id, qty: 0.25 },
      { saleItemId: lb.id, qty: 0.25 },
    ]);
    // money(0.49 × 0.25 × 2) = 0.25, no 0.12 + 0.12.
    await asLegacyReturn(old.id, 0.25);
    await giveBack(sale2.id, [
      { saleItemId: la.id, qty: 0.25 },
      { saleItemId: lb.id, qty: 0.25 },
    ]);
    expect(cents((await dashboard()).costTotal - base2)).toBe(0);
    expect((await profitRow("frac A")).Costo).toBe(0);
    expect((await profitRow("frac B")).Costo).toBe(0);
  });

  it("R9-dinero-2: devolver de una en una reembolsa exactamente lo cobrado y su ITBIS", async () => {
    const v = await product("parcial", 33.35, 10, 10, 18);
    const cashBefore = await expectedCash();
    const sale = await ok("/sales", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      items: [{ variantId: v.id, qty: 3 }],
      globalDiscount: 10,
      payments: [{ method: "cash", amount: 90.05 }],
      expectedTotal: 90.05,
    });
    expect(Number(sale.total)).toBe(90.05);
    expect(Number(sale.taxTotal)).toBe(13.74);
    // R9-dinero-11: el resumen de la venta cuadra.
    expect(cents(Number(sale.subtotal) - Number(sale.discountTotal))).toBe(
      90.05,
    );
    const line = await lineOf(sale.id, v.id);
    const back = [];
    for (let n = 0; n < 3; n++)
      back.push(
        await giveBack(sale.id, [{ saleItemId: line.id, qty: 1 }], "cash"),
      );
    const add = (field: string) =>
      cents(back.reduce((s, r) => s + Number(r[field]), 0));
    expect(add("refundAmount")).toBe(90.05);
    expect(add("total")).toBe(90.05);
    expect(add("taxTotal")).toBe(13.74);
    expect(await expectedCash()).toBe(cashBefore);
    expect(await profitRow("parcial")).toMatchObject({
      Ventas: 0,
      Costo: 0,
      Unidades: 0,
    });
  });

  it("R9-dinero-3: una venta a crédito con un abono por transferencia pendiente no se devuelve sin resolverlo", async () => {
    await withCredit(async () => {
      const customer = await creditCustomer();
      const v = await product("credito", 500, 100, 10);
      const ret = (saleId: string, saleItemId: string, qty: number) =>
        request("/returns", returnBody(saleId, [{ saleItemId, qty }], "cash"));
      // El cliente abonó todo por transferencia y devuelve todo.
      const s1 = await creditSale(v.id, 2, 1000, customer.id);
      const t1 = (await installment(s1.id, "transfer", 1000)).body;
      expect(t1.status).toBe("pending_verification");
      const blocked = await ret(s1.id, s1.items[0].id, 2);
      expect(blocked.status).toBe(400);
      expect(blocked.body.message).toMatch(/transferencia pendientes/);
      await ok("/payments/" + t1.id + "/verify", {});
      const r1 = await ret(s1.id, s1.items[0].id, 2);
      expect(r1.status).toBe(201);
      expect(Number(r1.body.refundAmount)).toBe(1000);
      // Abono pendiente de 600 y devolución de 500: el saldo quedaría en 500.
      const s2 = await creditSale(v.id, 2, 1000, customer.id);
      const t2 = (await installment(s2.id, "transfer", 600)).body;
      expect((await ret(s2.id, s2.items[0].id, 1)).status).toBe(400);
      // Una transferencia que no llegó se rechaza y deja de bloquear.
      await ok("/payments/" + t2.id + "/reject", {
        reason: "QA no llegó la transferencia",
      });
      expect((await request("/payments/" + t2.id + "/verify", {})).status).toBe(
        400,
      );
      const r2 = await ret(s2.id, s2.items[0].id, 1);
      expect(r2.status).toBe(201);
      expect(Number(r2.body.refundAmount)).toBe(0);
      expect(await balance(s2.id)).toBe(500);
      // Un abono pendiente que cabe en el saldo restante no bloquea.
      const s3 = await creditSale(v.id, 2, 1000, customer.id);
      const t3 = (await installment(s3.id, "transfer", 300)).body;
      const r3 = await ret(s3.id, s3.items[0].id, 1);
      expect(r3.status).toBe(201);
      expect(Number(r3.body.refundAmount)).toBe(0);
      await ok("/payments/" + t3.id + "/verify", {});
      expect(await balance(s3.id)).toBe(200);
    });
  });

  it("R9-dinero-4: anular una venta recalcula el costo promedio igual que una devolución", async () => {
    for (const direct of [true, false]) {
      const v = await product(direct ? "anula" : "anula comp", 150, 100, 10);
      const sold = direct ? v : await kit("anula combo", v.id, 1);
      const sale = await sell([{ variantId: sold.id, qty: 10 }]);
      const order = await ok("/purchase-orders", {
        supplierId,
        items: [{ variantId: v.id, qty: 10, unitCost: 200 }],
      });
      await ok("/purchase-orders/" + order.id + "/receive", {
        items: [{ itemId: order.items[0].id, qty: 10 }],
      });
      const variant = () =>
        fixtureDb.variant.findUniqueOrThrow({ where: { id: v.id } });
      expect(Number((await variant()).costAvg)).toBe(200);
      await ok("/sales/" + sale.id + "/void", {
        cashSessionId: session.id,
        reason: "QA R9 dinero anulación",
      });
      const after = await variant();
      expect(Number(after.stock)).toBe(20);
      expect(Number(after.costAvg)).toBe(150);
      const movement = await fixtureDb.inventoryMovement.findFirstOrThrow({
        where: { variantId: v.id, type: "void", refId: sale.id },
      });
      expect(Number(movement.unitCost)).toBe(100);
    }
  });

  it("R9-dinero-5: los importes de dinero aceptan como máximo 2 decimales", async () => {
    await withCredit(async () => {
      const customer = await creditCustomer();
      const v = await product("decimales", 100, 10, 10);
      const sold = await creditSale(v.id, 1, 100, customer.id);
      expect((await installment(sold.id, "cash", 1.005)).status).toBe(400);
      expect(await balance(sold.id)).toBe(100);
      const paid = await installment(sold.id, "cash", 1.01);
      expect(paid.status).toBe(201);
      expect(Number(paid.body.amount)).toBe(1.01);
      expect(await balance(sold.id)).toBe(98.99);
      expect(
        (
          await request("/sales", {
            ...input(v.id, 100),
            payments: [{ method: "cash", amount: 100.005 }],
          })
        ).status,
      ).toBe(400);
      // El descuento por monto no se guarda: sólo se vuelve porcentaje y la
      // línea se cobra redondeada; ver R9-dinero-5-pos.
    });
  });

  it("R9-dinero-5-pos: una venta sin conexión con un descuento de 3 decimales se sincroniza y una inválida no bloquea las demás", async () => {
    const v = await product("centavos caja", 100, 10, 10);
    const offline = (items: any[], amount: number, expectedTotal?: number) => ({
      offlineUuid: randomUUID(),
      capturedAt: new Date().toISOString(),
      cashSessionId: session.id,
      items,
      payments: [{ method: "cash", amount }],
      ...(expectedTotal === undefined ? {} : { expectedTotal }),
    });
    // La caja convierte el descuento por monto en porcentaje y redondea la
    // línea igual que la API: 100 − 1.004 = 98.996 → 99.00.
    const discounted = offline(
      [{ variantId: v.id, qty: 1, discountAmount: 1.004 }],
      99,
      99,
    );
    const wrongPayment = offline([{ variantId: v.id, qty: 1 }], 100.005);
    const plain = offline([{ variantId: v.id, qty: 1 }], 100, 100);
    const synced = await request("/sales/sync", {
      sales: [discounted, wrongPayment, plain],
    });
    expect(synced.status).toBe(201);
    expect(synced.body.results.map((r: any) => r.status)).toEqual([
      "synced",
      "conflict",
      "synced",
    ]);
    expect(synced.body.results[1].message).toMatch(/2 decimales/);
    expect(Number(synced.body.results[0].sale.total)).toBe(99);
    // El reintento de la misma venta devuelve la ya registrada.
    const again = await ok("/sales/sync", { sales: [discounted] });
    expect(again.results[0].sale.id).toBe(synced.body.results[0].sale.id);
    // En línea también se cobra.
    const online = await request("/sales", {
      ...input(v.id, 100),
      items: [{ variantId: v.id, qty: 1, discountAmount: 0.005 }],
    });
    expect(online.status).toBe(201);
    expect(Number(online.body.total)).toBe(100);
  });

  it("R9-dinero-6: el costo de una devolución de la ronda 7 se reconstruye por línea", async () => {
    const labels = ["r7 A", "r7 B", "r7 C"];
    const variants = [
      await product(labels[0], 10, 0.49, 2),
      await product(labels[1], 10, 0.59, 2),
      await product(labels[2], 10, 0.59, 2),
    ];
    const sale = await sell(variants.map((v) => ({ variantId: v.id, qty: 1 })));
    const lines = await Promise.all(variants.map((v) => lineOf(sale.id, v.id)));
    const first = await giveBack(
      sale.id,
      lines.map((l) => ({ saleItemId: l.id, qty: 0.01 })),
    );
    // La ronda 7 contabilizaba cada línea: 0.00 / 0.01 / 0.01.
    expect((first.items as any[]).map((p) => p.cost)).toEqual([0, 0.01, 0.01]);
    await asLegacyReturn(first.id);
    await giveBack(
      sale.id,
      lines.map((l) => ({ saleItemId: l.id, qty: 0.99 })),
    );
    for (const label of labels)
      expect(await profitRow(label)).toMatchObject({
        Ventas: 0,
        Costo: 0,
        Utilidad: 0,
      });
  });

  it("R9-dinero-7: el costo de una venta anterior a la ronda 7 final coincide en utilidad y dashboard", async () => {
    const component = await product("comp 7", 30, 3.33, 10);
    const k1 = await kit("kit7 A", component.id, 0.5);
    const k2 = await kit("kit7 B", component.id, 0.5);
    const base = (await dashboard()).costTotal;
    const sale = await sell([
      { variantId: k1.id, qty: 1 },
      { variantId: k2.id, qty: 1 },
    ]);
    expect(Number(sale.costTotal)).toBe(3.34);
    // Hasta la ronda 7 en curso: money(Σ costo exacto × qty).
    await fixtureDb.sale.update({
      where: { id: sale.id },
      data: { costTotal: 3.33 },
    });
    const reported = async () =>
      cents(
        (await profitRow("kit7 A")).Costo + (await profitRow("kit7 B")).Costo,
      );
    expect(await reported()).toBe(3.33);
    expect(cents((await dashboard()).costTotal - base)).toBe(3.33);
    const lines = [await lineOf(sale.id, k1.id), await lineOf(sale.id, k2.id)];
    const back = await giveBack(
      sale.id,
      lines.map((l) => ({ saleItemId: l.id, qty: 1 })),
    );
    expect(Number(back.costTotal)).toBe(3.33);
    expect((await profitRow("kit7 A")).Costo).toBe(0);
    expect((await profitRow("kit7 B")).Costo).toBe(0);
    expect(cents((await dashboard()).costTotal - base)).toBe(0);
  });

  it("R9-dinero-8: devoluciones y descuentos no muestra costos a quien no tiene profit:read", async () => {
    const role = await fixtureDb.role.create({
      data: { name: "qa-reportes-" + suffix, permissions: ["reports:read"] },
    });
    const u = await ok("/users", {
      name: "QA reportes " + suffix,
      email: `qa-reportes-${suffix}@example.test`,
      password: "FitStore-QA-2026!",
      pin: "765432",
      roleId: role.id,
    });
    actors.push(u);
    const viewer = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    const v = await product("sin costo", 50, 20, 2);
    const sale = await sell([{ variantId: v.id, qty: 1 }]);
    await giveBack(sale.id, [
      { saleItemId: (await lineOf(sale.id, v.id)).id, qty: 1 },
    ]);
    expect(
      (
        await request(
          `/reports/profit?from=${today}&to=${today}`,
          undefined,
          viewer,
        )
      ).status,
    ).toBe(403);
    const { rows } = await ok(
      `/reports/returns-discounts?from=${today}&to=${today}`,
      undefined,
      viewer,
    );
    const returns = rows.filter(
      (r: any) => r.Evento === "return" && r.Referencia === sale.id,
    );
    expect(returns.length).toBe(1);
    expect(returns[0].Detalle).toMatch(/NC-/);
    expect(rows.map((r: any) => r.Detalle).join("\n")).not.toMatch(
      /"(cost|costTotal|unitCost|costAvg)"/,
    );
  });

  it("R9-dinero-9: ventas por método no cuenta dos veces el crédito y muestra los cobros el día que entran", async () => {
    await withCredit(async () => {
      const customer = await creditCustomer();
      const v = await product("metodo", 500, 100, 10);
      const snapshot = async () => {
        const { rows } = await ok(
          `/reports/by-payment?from=${today}&to=${today}`,
        );
        const at = (method: string, column: string) =>
          rows.find((r: any) => r.Método === method)?.[column] ?? 0;
        const summary = await dashboard();
        return {
          creditSales: at("credit", "Ventas"),
          cashSales: at("cash", "Ventas"),
          cashCollected: at("cash", "Cobros_de_crédito"),
          cardCollected: at("card", "Cobros_de_crédito"),
          salesColumn: rows.reduce(
            (s: number, r: any) => s + (r.Ventas ?? 0),
            0,
          ),
          dashboardCash:
            summary.payments.find((p: any) => p.name === "cash")?.amount ?? 0,
          fees: summary.fees,
        };
      };
      const before = await snapshot();
      // Venta a crédito y abono en efectivo el mismo día.
      const sold = await creditSale(v.id, 1, 500, customer.id);
      expect((await installment(sold.id, "cash", 500)).status).toBe(201);
      // Abono con tarjeta hoy de una venta del mes pasado.
      const older = await creditSale(v.id, 1, 500, customer.id);
      await fixtureDb.sale.update({
        where: { id: older.id },
        data: { createdAt: new Date(Date.now() - 40 * 86400000) },
      });
      expect((await installment(older.id, "card", 200)).status).toBe(201);
      // Una transferencia sin verificar todavía no es un cobro.
      expect((await installment(older.id, "transfer", 100)).status).toBe(201);
      const after = await snapshot();
      const delta = (key: keyof typeof before) =>
        cents(after[key] - before[key]);
      expect(delta("creditSales")).toBe(500);
      expect(delta("cashSales")).toBe(0);
      expect(delta("salesColumn")).toBe(500);
      expect(delta("cashCollected")).toBe(500);
      expect(delta("cardCollected")).toBe(200);
      expect(delta("dashboardCash")).toBe(0);
      // Comisión de tarjeta del 2.5 % en el período del cobro.
      expect(delta("fees")).toBe(5);
    });
  });

  it("R9-dinero-10: la tendencia compara ingresos netos de devoluciones en ambos períodos", async () => {
    const v = await product("tendencia", 1000, 100, 10);
    // Un día sin otros datos (año 2000 a 2008, al azar para repetir la suite).
    const day = new Date(
      Date.UTC(2000, 0, 2) + Math.floor(Math.random() * 3000) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const previous = new Date(Date.parse(day + "T12:00:00-04:00") - 86400000);
    const current = new Date(day + "T12:00:00-04:00");
    const past = await sell([{ variantId: v.id, qty: 1 }]);
    const back = await giveBack(past.id, [
      { saleItemId: (await lineOf(past.id, v.id)).id, qty: 0.5 },
    ]);
    const now = await sell([{ variantId: v.id, qty: 0.5 }]);
    await fixtureDb.sale.update({
      where: { id: past.id },
      data: { createdAt: previous },
    });
    await fixtureDb.saleReturn.update({
      where: { id: back.id },
      data: { createdAt: previous },
    });
    await fixtureDb.sale.update({
      where: { id: now.id },
      data: { createdAt: current },
    });
    const summary = await dashboard(day, day);
    expect(summary.revenue).toBe(500);
    // Antes: 1000 − 500 = 500 de neto; ahora 500: sin variación.
    expect(summary.trend).toBe(0);
  });
});
// Área facturas: factura del proveedor (códigos, equivalencias, números) y
// recepción de órdenes de compra.
describe("Ronda 9 · revisión · facturas", () => {
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const product = async (label: string) => {
    const p = await ok("/products", {
      name: "QA R9F " + label + " " + suffix,
      sku: "R9F-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R9FV-" + randomUUID().slice(0, 8),
          barcode: "R9FB-" + randomUUID().slice(0, 8),
          price: 1500,
          costAvg: 1200,
        },
      ],
    });
    products.push(p);
    return p;
  };
  async function upload(csv: string) {
    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "factura.csv");
    form.set("supplierId", supplierId);
    form.set(
      "mapping",
      JSON.stringify({
        code: "codigo",
        description: "descripcion",
        qty: "cantidad",
        unitCost: "costo",
      }),
    );
    const r = await fetch(base + "/merchandise/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    const body = await r.json();
    if (r.status >= 400) throw new Error(r.status + " " + JSON.stringify(body));
    return body;
  }
  it("un código que tienen dos productos queda sin elegir (R9-facturas-1)", async () => {
    const a = await product("Faja chaleco");
    const c = await product("Faja chaleco premium");
    // La API de productos podría rechazar este cruce; se fuerza en la base,
    // como quedaron datos de rondas anteriores.
    await fixtureDb.variant.update({
      where: { id: c.variants[0].id },
      data: { sku: a.variants[0].barcode },
    });
    const draft = await upload(
      `codigo,descripcion,cantidad,costo\n${a.variants[0].barcode},Faja chaleco,2,700\n`,
    );
    expect(draft.lines[0]).toMatchObject({ variantId: null, confidence: 0 });
    expect(draft.lines[0].note).toMatch(/es de 2 productos/);
  });
  it("la equivalencia corregida del proveedor gana al código de la tienda (R9-facturas-2)", async () => {
    const iso = await product("ISO Fresa");
    const top = await product("Top Aurora Lila");
    const code = iso.variants[0].sku;
    const first = await upload(
      `codigo,descripcion,cantidad,costo\n${code},${top.name},1,5\n`,
    );
    // La descripción es de otro producto: no se elige el del código.
    expect(first.lines[0].variantId).toBeNull();
    expect(first.lines[0].productId).toBe(top.id);
    // La persona confirma el Top: se guarda la equivalencia del proveedor.
    await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      items: [
        {
          variantId: top.variants[0].id,
          qty: 1,
          unitCost: 5,
          supplierCode: code,
        },
      ],
    });
    const second = await upload(
      `codigo,descripcion,cantidad,costo\n${code},Sin parecido,1,5\n`,
    );
    expect(second.lines[0]).toMatchObject({
      variantId: top.variants[0].id,
      confidence: 1,
    });
  });
  it("un código de la tienda con la descripción de otra cosa o de otra variante no se elige (R9-facturas-2)", async () => {
    const iso = await product("ISO Fresa");
    // Un producto que la tienda no tiene, con un código que choca.
    const first = await upload(
      `codigo,descripcion,cantidad,costo\n${iso.variants[0].sku},Top Deportivo Zafiro Lila,1,5\n`,
    );
    expect(first.lines[0]).toMatchObject({
      variantId: null,
      productId: iso.id,
    });
    expect(first.lines[0].note).toMatch(/la descripción no coincide/);
    // El código de la talla S con una factura que dice talla L.
    const top = await ok("/products", {
      name: "QA R9F Top Tallas " + suffix,
      sku: "R9F-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: ["S", "M", "L"].map((talla) => ({
        sku: "R9FT-" + talla + "-" + randomUUID().slice(0, 8),
        barcode: "R9FTB-" + talla + "-" + randomUUID().slice(0, 8),
        price: 900,
        costAvg: 500,
        attributes: { talla },
      })),
    });
    products.push(top);
    const small = top.variants.find((v: any) => v.attributes.talla === "S");
    const second = await upload(
      `codigo,descripcion,cantidad,costo\n${small.sku},${top.name} talla L,1,5\n${small.sku},${top.name} talla S,1,5\n`,
    );
    expect(second.lines[0]).toMatchObject({
      variantId: null,
      productId: top.id,
    });
    expect(second.lines[0].note).toMatch(/S no coincide/);
    expect(second.lines[1].variantId).toBe(small.id);
  });
  it("CSV con «;»: «1.250» son 1250 y no 1.25 (R9-facturas-7)", async () => {
    const faja = await product("Faja Reloj de Arena Beige");
    const draft = await upload(
      `codigo;descripcion;cantidad;costo\n${faja.variants[0].sku};Faja Reloj de Arena Beige;2;"1.250"\n`,
    );
    expect(draft.lines[0]).toMatchObject({
      variantId: faja.variants[0].id,
      unitCost: 1250,
    });
  });
  it("reenviar la misma recepción de una orden no la duplica (R9-facturas-8)", async () => {
    const p = await product("Recepción idempotente");
    const variantId = p.variants[0].id;
    const stock = async () =>
      Number(
        (
          await fixtureDb.variant.findUniqueOrThrow({
            where: { id: variantId },
          })
        ).stock,
      );
    const start = await stock();
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 10, unitCost: 1000 }],
    });
    const body = {
      operationId: randomUUID(),
      freight: 40,
      items: [{ itemId: order.items[0].id, qty: 4 }],
    };
    const path = "/purchase-orders/" + order.id + "/receive";
    const once = await ok(path, body);
    // Se perdió la respuesta y la persona vuelve a pulsar Guardar.
    const again = await ok(path, body);
    expect(again.id).toBe(once.id);
    expect(await stock()).toBe(start + 4);
    const receipts = () =>
      fixtureDb.goodsReceipt.findMany({ where: { orderId: order.id } });
    expect(await receipts()).toHaveLength(1);
    expect(
      Number(
        (
          await fixtureDb.purchaseItem.findUniqueOrThrow({
            where: { id: order.items[0].id },
          })
        ).receivedQty,
      ),
    ).toBe(4);
    // El mismo id con otros datos se rechaza.
    const changed = await request(path, {
      ...body,
      items: [{ itemId: order.items[0].id, qty: 3 }],
    });
    expect(changed.status).toBe(400);
    expect(changed.body.message).toMatch(/datos distintos/);
    // Recibir el resto y reintentar: devuelve la misma recepción en vez de
    // «La orden ya fue recibida».
    const rest = {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 6 }],
    };
    const last = await ok(path, rest);
    expect((await ok(path, rest)).id).toBe(last.id);
    expect(await receipts()).toHaveLength(2);
    expect(await stock()).toBe(start + 10);
    // Dos envíos a la vez con el mismo id: una sola recepción.
    const other = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 5, unitCost: 1000 }],
    });
    const twice = {
      operationId: randomUUID(),
      items: [{ itemId: other.items[0].id, qty: 2 }],
    };
    await Promise.all([
      request("/purchase-orders/" + other.id + "/receive", twice),
      request("/purchase-orders/" + other.id + "/receive", twice),
    ]);
    expect(
      await fixtureDb.goodsReceipt.findMany({ where: { orderId: other.id } }),
    ).toHaveLength(1);
    expect(await stock()).toBe(start + 12);
  });
});
// R9-REVISION: importador
// R9-REVISION: seguridad

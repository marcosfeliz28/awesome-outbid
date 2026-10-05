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

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp, TENANT } from "./setup/product-pg-app";
import { createTenantWithOwner } from "../apps/api/src/registration";

// Dos funciones de la tienda traídas al producto (orden de Marcos, 21-nov),
// con PostgreSQL real y dos empresas: aviso de margen bajo en descuentos de
// cajera (decisión 4) y conteo de inventario ciego (dinero-12).
let t: Awaited<ReturnType<typeof startProductApp>>;
let other: string;
type Seat = { auth: string; userId: string };
let cashier: Seat, manager: Seat, otherOwner: Seat;
let category: string, customerId: string;

async function seat(
  tenantId: string,
  name: string,
  permissions: string[],
): Promise<Seat> {
  const [role, user, terminal, session] = [0, 0, 0, 0].map(() => randomUUID());
  await t.q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,$3,$4::text[],now())`,
    role,
    tenantId,
    name + " " + role.slice(0, 6),
    permissions,
  );
  await t.q(
    `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
     VALUES ($1::uuid,$2::uuid,$3,$4,'test-only','test-only',$5::uuid,'main',now())`,
    user,
    tenantId,
    name,
    `qa-${user}@example.invalid`,
    role,
  );
  await t.q(
    `INSERT INTO "Terminal" (id,"tenantId",name,"branchId","approvedAt","secretHash") VALUES ($1::uuid,$2::uuid,$3,'main',now(),'test-only')`,
    terminal,
    tenantId,
    "Caja " + name,
  );
  await t.q(
    `INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
    session,
    tenantId,
    user,
    terminal,
  );
  return { auth: t.sign(user, session, tenantId), userId: user };
}
const as = (s: Seat, method: "get" | "post", path: string, body?: unknown) => {
  const r = (t.http as any)[method]("/api" + path).set("Authorization", s.auth);
  return method === "post" ? r.send(body ?? {}) : r;
};
async function variant(cost: number, price: number, name: string) {
  const [product, v] = [randomUUID(), randomUUID()];
  await t.q(
    `INSERT INTO "Product" (id,"tenantId",name,sku,"categoryId","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,now())`,
    product,
    TENANT,
    name,
    "P-" + product,
    category,
  );
  await t.q(
    `INSERT INTO "Variant" (id,"tenantId","productId",sku,barcode,"costAvg",price,stock,"updatedAt")
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,50,now())`,
    v,
    TENANT,
    product,
    "V-" + v,
    "B-" + v,
    cost,
    price,
  );
  return v;
}
const cashOf = new Map<string, string>();
async function sell(
  s: Seat,
  variantId: string,
  total: number,
  extra: Record<string, unknown> = {},
) {
  if (!cashOf.has(s.userId)) {
    const r = await as(s, "post", "/cash-sessions/open", { openingAmount: 0 });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    cashOf.set(s.userId, r.body.id);
  }
  const { item, ...rest } = extra as any;
  const r = await as(s, "post", "/sales", {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: cashOf.get(s.userId),
    items: [{ variantId, qty: 1, ...(item ?? {}) }],
    payments: [{ method: "cash", amount: total, tendered: total }],
    ...rest,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}
const lowMarginAlert = async (saleId: string) =>
  (
    await t.q(
      `SELECT "tenantId"::text AS "tenantId", type, status, message FROM "Alert" WHERE key=$1`,
      "low-margin:" + saleId,
    )
  )[0];

beforeAll(async () => {
  t = await startProductApp("nexora_beneficios_21nov");
  // Dos cajas abiertas a la vez (cajera y gerente): plan con más de una.
  await t.q(`UPDATE "Tenant" SET plan='pro' WHERE id=$1::uuid`, TENANT);
  await t.q(
    `INSERT INTO "Settings" ("tenantId",id,data,"updatedAt") VALUES ($1::uuid,'main',$2::jsonb,now())
     ON CONFLICT ("tenantId",id) DO UPDATE SET data="Settings".data || EXCLUDED.data`,
    TENANT,
    JSON.stringify({ taxIncluded: true }),
  );
  other = (
    await t.db.$transaction((tx: any) =>
      createTenantWithOwner(
        tx,
        {
          slug: "otra-empresa",
          name: "Otra empresa",
          businessType: "retail",
          plan: "pro",
          status: "active",
        },
        {
          name: "Dueña otra",
          email: "otra@example.invalid",
          passwordHash: "x",
          pinHash: "x",
          verificationHash: "x",
          verificationExpiresAt: new Date(Date.now() + 86_400_000),
        },
      ),
    )
  ).id;
  cashier = await seat(TENANT, "Cajera prueba", [
    "sale:write",
    "cash:write",
    "inventory:write",
  ]);
  manager = await seat(TENANT, "Gerente prueba", [
    "sale:write",
    "sale:manage",
    "cash:write",
    "inventory:write",
    "alerts:write",
  ]);
  otherOwner = await seat(other, "Dueña otra empresa", ["*"]);
  category = randomUUID();
  await t.q(
    `INSERT INTO "Category" (id,"tenantId",name,"updatedAt") VALUES ($1::uuid,$2::uuid,'Fajas',now())`,
    category,
    TENANT,
  );
  customerId = randomUUID();
  await t.q(
    `INSERT INTO "Customer" (id,"tenantId",name,"updatedAt") VALUES ($1::uuid,$2::uuid,'Clienta 21nov',now())`,
    customerId,
    TENANT,
  );
}, 240_000);
afterAll(async () => {
  await t?.stop();
});

describe("Decisión 4 · descuento de cajera bajo el 15 % de margen", () => {
  it("se cobra normal, sin PIN ni cambio de precio, avisa a gerencia con el detalle y no se ve en otra empresa", async () => {
    // ANTES: sin aviso. Precio RD$ 100, costo RD$ 90, 10 % de descuento:
    // se cobran RD$ 90 → margen (90 − 90) ÷ 90 = 0 % < 15 %.
    const v = await variant(90, 100, "Faja");
    const sale = await sell(cashier, v, 90, {
      item: { discountPercent: 10 },
      discountReason: "Clienta frecuente",
    });
    expect(Number(sale.total)).toBe(90);
    const [price] = await t.q(
      `SELECT price FROM "Variant" WHERE id=$1::uuid`,
      v,
    );
    expect(Number(price.price)).toBe(100);
    const alert = await lowMarginAlert(sale.id);
    expect(alert).toMatchObject({
      tenantId: TENANT,
      type: "low_margin_discount",
    });
    for (const text of [
      sale.number,
      "Cajera prueba",
      "Faja",
      "precio RD$ 100.00",
      "cobrado RD$ 90.00",
      "costo RD$ 90.00",
      "margen 0 %",
    ])
      expect(alert.message).toContain(text);
    const [log] = await t.q(
      `SELECT "tenantId"::text AS "tenantId", after FROM "AuditLog" WHERE action='sale_low_margin_discount' AND "entityId"=$1`,
      sale.id,
    );
    expect(log.tenantId).toBe(TENANT);
    expect(log.after.saleMargin).toBe(0);
    // La gerencia lo ve (no es solo de la dueña) y la evaluación periódica
    // no lo da por resuelto.
    const seen = await as(manager, "get", "/alerts?type=low_margin_discount");
    expect(seen.status, JSON.stringify(seen.body)).toBe(200);
    expect(seen.body).toContainEqual(
      expect.objectContaining({ entityId: sale.id, status: "new" }),
    );
    // Otra empresa no lo ve.
    const foreign = await as(
      otherOwner,
      "get",
      "/alerts?type=low_margin_discount",
    );
    expect(foreign.status, JSON.stringify(foreign.body)).toBe(200);
    expect(foreign.body).toEqual([]);
  });

  it("sin costo cuenta como margen bajo; con margen suficiente o sin descuento no avisa", async () => {
    const noCost = await variant(0, 200, "Paleta");
    const a = await sell(cashier, noCost, 190, {
      item: { discountPercent: 5 },
      discountReason: "Clienta",
    });
    expect((await lowMarginAlert(a.id))?.message).toContain("sin costo");
    // Costo 50, precio 100, 10 %: (90 − 50) ÷ 90 = 44.44 % → sin aviso.
    const ok = await variant(50, 100, "Proteína");
    const b = await sell(cashier, ok, 90, {
      item: { discountPercent: 10 },
      discountReason: "Clienta",
    });
    expect(await lowMarginAlert(b.id)).toBeUndefined();
    // Sin descuento, aunque el margen sea bajo, no es un descuento de cajera.
    const thin = await variant(95, 100, "Agua");
    const c = await sell(cashier, thin, 100);
    expect(await lowMarginAlert(c.id)).toBeUndefined();
  });

  it("el descuento de gerencia no deja este aviso", async () => {
    const v = await variant(90, 100, "Faja gerencia");
    const sale = await sell(manager, v, 90, {
      item: { discountPercent: 10 },
      discountReason: "Gerencia",
    });
    expect(await lowMarginAlert(sale.id)).toBeUndefined();
  });
});

describe("Dinero-12 · conteo de inventario ciego", () => {
  it("quien cuenta no recibe el esperado; se guarda igual, la gerencia lo ve y otra empresa no ve el conteo", async () => {
    const v = await variant(10, 20, "Conteo");
    const counted = await as(cashier, "post", "/inventory/counts", {
      items: [{ variantId: v, counted: 47 }],
    });
    expect(counted.status, JSON.stringify(counted.body)).toBe(201);
    expect(counted.body.items[0]).not.toHaveProperty("expected");
    const [row] = await t.q(
      `SELECT "tenantId"::text AS "tenantId", items FROM "InventoryCount" WHERE id=$1::uuid`,
      counted.body.id,
    );
    expect(row.tenantId).toBe(TENANT);
    expect(row.items[0].expected).toBe(50);
    const list = await as(cashier, "get", "/inventory/counts");
    expect(list.status).toBe(200);
    const mine = list.body.find((c: any) => c.id === counted.body.id);
    expect(mine.items[0]).not.toHaveProperty("expected");
    const forManager = await as(manager, "get", "/inventory/counts");
    expect(
      forManager.body.find((c: any) => c.id === counted.body.id).items[0]
        .expected,
    ).toBe(50);
    const foreign = await as(otherOwner, "get", "/inventory/counts");
    expect(foreign.status, JSON.stringify(foreign.body)).toBe(200);
    expect(foreign.body).toEqual([]);
  });

  it("rechaza la misma variante repetida y no guarda nada", async () => {
    const v = await variant(10, 20, "Conteo repetido");
    const before = await t.q(`SELECT count(*)::int AS n FROM "InventoryCount"`);
    const r = await as(cashier, "post", "/inventory/counts", {
      items: [
        { variantId: v, counted: 3 },
        { variantId: v, counted: 4 },
      ],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.message).toMatch(/repetid/);
    const after = await t.q(`SELECT count(*)::int AS n FROM "InventoryCount"`);
    expect(after[0].n).toBe(before[0].n);
  });
});

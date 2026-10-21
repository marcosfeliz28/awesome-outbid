// Reportes de margen (19–26 de la orden del 18-oct) contra la API real:
// margen = (precio − costo)/precio sin restar ITBIS, neto de devoluciones; la
// venta con descuento que deja el margen bajo 15 % aparece; la cajera sin
// profit:read no los ve ni los abre.
import { conClave } from "./setup/con-clave";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.11." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "739205";
const PASSWORD = "583904";
const KEYS = [
  "margen-por-producto",
  "margen-por-categoria",
  "margen-por-marca",
  "margen-por-cajera",
  "ventas-margen-bajo",
  "utilidad-bruta-por-mes",
  "costo-vendido-vs-inventario",
  "precio-vendido-vs-lista",
];

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
  return { status: r.status, body, type: r.headers.get("content-type") };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santo_Domingo",
}).format(new Date());
const month = today.slice(0, 7);
const range = `from=${month}-01&to=${today}`;
const rows = async (key: string, as = admin) =>
  (await ok(`/reports/${key}?${range}`, as)).rows as any[];

type Person = { id: string; token: string; cash: any; name: string };
let admin = "",
  customerId = "",
  categoryName = "",
  adminCash: any,
  luz: Person,
  lowSale: any,
  monthBefore: any,
  coverBefore: any;
const brand = "QA Marca " + suffix;
const productIds: string[] = [];
const v: Record<string, { id: string; name: string; sku: string }> = {};

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA margen " + label + " " + suffix,
    secret: "qa-mar-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
}
async function product(
  key: string,
  categoryId: string,
  price: number,
  cost: number,
) {
  const tag = randomUUID().slice(0, 8);
  const name = `QA margen ${key} ${suffix}`;
  const p = await ok("/products", admin, {
    name,
    sku: "QAM-" + tag,
    categoryId,
    brand,
    taxRate: 0,
    variants: [
      {
        sku: "QAM-V-" + tag,
        barcode: "QAM-B-" + tag,
        price,
        costAvg: cost,
      },
    ],
  });
  productIds.push(p.id);
  await ok("/inventory/adjustments", admin, {
    variantId: p.variants[0].id,
    qty: 10,
    reason: "QA margen",
  });
  v[key] = { id: p.variants[0].id, name, sku: "QAM-V-" + tag };
}
const sell = (
  token: string,
  cashId: string,
  items: any[],
  total: number,
  extra = {},
) =>
  ok("/sales", token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: cashId,
    items,
    payments: [{ method: "cash", amount: total }],
    expectedTotal: total,
    ...extra,
  });

beforeAll(async () => {
  admin = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await terminal(admin, "dueña");
  // Línea base del mes antes de crear nada (otras suites dejan ventas).
  monthBefore = (await rows("utilidad-bruta-por-mes")).find(
    (r) => r.Mes === month,
  ) ?? { Facturas: 0, Venta: 0, Costo: 0, Utilidad: 0 };
  [coverBefore] = await rows("costo-vendido-vs-inventario");
  customerId = (await ok("/customers", admin, { name: "QA margen " + suffix }))
    .id;
  categoryName = "QA Margen " + suffix;
  const categoryId = (await ok("/categories", admin, { name: categoryName }))
    .id;
  await product("A", categoryId, 100, 60);
  await product("B", categoryId, 100, 80);
  adminCash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-mar-admin-" + suffix,
    openingAmount: 0,
  });
  const roles = await ok("/roles", admin);
  const email = `qa-mar-luz-${suffix}@example.test`;
  const user = await ok("/users", admin, {
    name: "QA Luz " + suffix,
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
  await terminal(login.accessToken, "luz");
  luz = {
    id: user.id,
    token: login.accessToken,
    name: "QA Luz " + suffix,
    cash: await ok("/cash-sessions/open", login.accessToken, {
      registerId: "qa-mar-luz-" + suffix,
      openingAmount: 0,
    }),
  };
  // Luz: 2 × A a 100 (costo 60) → 200 / 120, margen 40 %.
  await sell(luz.token, luz.cash.id, [{ variantId: v.A.id, qty: 2 }], 200);
  // Dueña: B a precio de lista (100 / 80, 20 %) y B con 10 de descuento
  // (90 / 80 → 11,1 %, bajo el mínimo).
  await sell(admin, adminCash.id, [{ variantId: v.B.id, qty: 1 }], 100);
  lowSale = await sell(
    admin,
    adminCash.id,
    [{ variantId: v.B.id, qty: 1, discountAmount: 10 }],
    90,
    { discountReason: "Descuento autorizado en pruebas" },
  );
}, 180000);

afterAll(async () => {
  for (const cash of [luz?.cash, adminCash].filter(Boolean))
    await request("/cash-sessions/" + cash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de margen",
      differenceReason: "QA: cierre de limpieza de la prueba",
    });
  for (const id of productIds)
    await request("/products/" + id, admin, { active: false }, "PATCH");
  if (luz) await request("/users/" + luz.id, admin, { active: false }, "PATCH");
}, 60000);

describe("Reportes de margen", () => {
  it("margen por producto, categoría y marca", async () => {
    const byProduct = await rows("margen-por-producto");
    expect(byProduct.find((r) => r.Producto === v.A.name)).toEqual({
      Producto: v.A.name,
      Unidades: 2,
      Venta: 200,
      Costo: 120,
      Utilidad: 80,
      "Margen %": 40,
    });
    expect(byProduct.find((r) => r.Producto === v.B.name)).toEqual({
      Producto: v.B.name,
      Unidades: 2,
      Venta: 190,
      Costo: 160,
      Utilidad: 30,
      "Margen %": 15.8,
    });
    const total = {
      Unidades: 4,
      Venta: 390,
      Costo: 280,
      Utilidad: 110,
      "Margen %": 28.2,
    };
    expect(
      (await rows("margen-por-categoria")).find(
        (r) => r["Categoría"] === categoryName,
      ),
    ).toEqual({ Categoría: categoryName, ...total });
    expect(
      (await rows("margen-por-marca")).find((r) => r.Marca === brand),
    ).toEqual({ Marca: brand, ...total });
  });

  it("margen por cajera", async () => {
    expect(
      (await rows("margen-por-cajera")).find((r) => r.Cajera === luz.name),
    ).toEqual({
      Cajera: luz.name,
      Unidades: 2,
      Venta: 200,
      Costo: 120,
      Utilidad: 80,
      "Margen %": 40,
    });
  });

  it("la venta con descuento bajo 15 % aparece; las otras no", async () => {
    const low = await rows("ventas-margen-bajo");
    const mine = low.find((r) => r.Factura === lowSale.number);
    expect(mine).toMatchObject({
      Total: 90,
      Costo: 80,
      Utilidad: 10,
      "Margen %": 11.1,
    });
    expect(mine.Fecha.slice(0, 10)).toBe(today);
    expect(low.every((r) => r["Margen %"] < 15)).toBe(true);
  });

  it("utilidad bruta del mes sube exactamente lo vendido", async () => {
    const now = (await rows("utilidad-bruta-por-mes")).find(
      (r) => r.Mes === month,
    );
    const delta = (k: string) =>
      Math.round((now[k] - monthBefore[k]) * 100) / 100;
    expect(delta("Facturas")).toBe(3);
    expect(delta("Venta")).toBe(390);
    expect(delta("Costo")).toBe(280);
    expect(delta("Utilidad")).toBe(110);
  });

  it("costo de lo vendido vs valor del inventario", async () => {
    const [now] = await rows("costo-vendido-vs-inventario");
    const delta = (k: string) =>
      Math.round((now[k] - coverBefore[k]) * 100) / 100;
    expect(delta("Costo de lo vendido")).toBe(280);
    // Entraron 10 × 60 + 10 × 80 y salieron 2 × 60 + 2 × 80.
    expect(delta("Valor del inventario (costo)")).toBe(1120);
    const cogs = now["Costo de lo vendido"],
      value = now["Valor del inventario (costo)"];
    expect(now["Costo vendido por día"]).toBeCloseTo(
      cogs / now["Días del período"],
      2,
    );
    expect(now["Inventario / costo vendido"]).toBeCloseTo(value / cogs, 2);
  });

  it("precio promedio vendido vs precio de lista", async () => {
    const list = await rows("precio-vendido-vs-lista");
    expect(list.find((r) => r.SKU === v.A.sku)).toMatchObject({
      Unidades: 2,
      "Precio promedio vendido": 100,
      "Precio de lista": 100,
      "Diferencia %": 0,
    });
    expect(list.find((r) => r.SKU === v.B.sku)).toMatchObject({
      Unidades: 2,
      "Precio promedio vendido": 95,
      "Precio de lista": 100,
      "Diferencia %": -5,
    });
  });

  it("Excel y PDF", async () => {
    for (const format of ["xlsx", "pdf"]) {
      const r = await request(
        `/reports/margen-por-producto?${range}&format=${format}`,
        admin,
      );
      expect(r.status, format).toBe(200);
      expect(r.type, format).toContain(
        format === "pdf" ? "application/pdf" : "spreadsheetml",
      );
    }
  });

  it("sin profit:read: 403 y fuera de la lista; la dueña sí", async () => {
    const adminList = (await ok("/reportes", admin)).map((r: any) => r.name);
    for (const key of KEYS) {
      expect(adminList, key).toContain(key);
      expect((await request(`/reports/${key}?${range}`, admin)).status).toBe(
        200,
      );
      expect(
        (await request(`/reports/${key}?${range}`, luz.token)).status,
        key,
      ).toBe(403);
    }
    // La cajera puede no tener reports:read; si ve la lista, sin margen.
    const list = await request("/reportes", luz.token);
    if (list.status === 200)
      expect(
        list.body.filter(
          (r: any) => KEYS.includes(r.name) || r.group === "Margen",
        ),
      ).toEqual([]);
    else expect(list.status).toBe(403);
  });
});

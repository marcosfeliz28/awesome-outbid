// GV Makeup Studio (20-oct): los servicios se venden sin existencia y la tasa
// del dólar del día recalcula los precios en dólares. Contra la API real.
import { conClave } from "./setup/con-clave";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyUsdRate, parseUsdRate, usdPrice } from "../apps/api/src/usd-rate";

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
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* texto */
  }
  return { status: r.status, body };
}
async function ok(path: string, as: string, data?: unknown) {
  const r = await request(path, as, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

let admin = "",
  customerId = "",
  categoryId = "",
  serviceVariant = "",
  cash: any;
const fakeBranch = "qa-usd-" + suffix;

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
    name: "QA GV " + suffix,
    secret: "qa-gv-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
  customerId = (await ok("/customers", admin, { name: "QA GV " + suffix })).id;
  categoryId = (await ok("/categories", admin, { name: "GV QA " + suffix })).id;
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", admin, {
    name: "QA maquillaje social " + suffix,
    sku: "QAGV-" + tag,
    categoryId,
    taxRate: 0,
    unit: "servicio",
    minStock: 0,
    variants: [
      {
        sku: "QAGV-V-" + tag,
        barcode: "QAGV-B-" + tag,
        price: 3500,
        costAvg: 0,
      },
    ],
  });
  expect(p.unit).toBe("servicio");
  serviceVariant = p.variants[0].id;
  cash = await ok("/cash-sessions/open", admin, {
    registerId: "qa-gv-" + suffix,
    openingAmount: 0,
  });
}, 120000);

afterAll(async () => {
  if (cash)
    await request("/cash-sessions/" + cash.id + "/close", admin, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas GV",
    });
  await db.variant.deleteMany({ where: { branchId: fakeBranch } });
  await db.product.deleteMany({ where: { branchId: fakeBranch } });
  await db.auditLog.deleteMany({ where: { branchId: fakeBranch } });
  await db.settings.deleteMany({ where: { id: fakeBranch } });
  await db.$disconnect();
}, 60000);

const stock = async () =>
  Number(
    (await db.variant.findUniqueOrThrow({ where: { id: serviceVariant } }))
      .stock,
  );

describe("GV · servicios sin existencia", () => {
  it("se vende sin existencia, no deja movimientos y la anulación no repone", async () => {
    expect(await stock()).toBe(0);
    const sale = await ok("/sales", admin, {
      offlineUuid: randomUUID(),
      customerId,
      cashSessionId: cash.id,
      items: [{ variantId: serviceVariant, qty: 2 }],
      payments: [{ method: "cash", amount: 7000 }],
      expectedTotal: 7000,
    });
    expect(Number(sale.total)).toBe(7000);
    expect(await stock()).toBe(0);
    expect(
      await db.inventoryMovement.count({
        where: { variantId: serviceVariant },
      }),
    ).toBe(0);
    // La categoría «GV …» cuenta como GV Makeup Studio en el reporte por empresa.
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    const rows = (
      await ok(`/reports/margen-por-empresa?from=${today}&to=${today}`, admin)
    ).rows;
    const gv = rows.find((r: any) => r.Empresa === "GV Makeup Studio");
    expect(gv?.Venta).toBeGreaterThanOrEqual(7000);
    await ok("/sales/" + sale.id + "/void", admin, {
      reason: "QA anulación servicio " + suffix,
    });
    expect(await stock()).toBe(0);
  });

  it("un producto normal sin existencia sigue sin poder venderse", async () => {
    const tag = randomUUID().slice(0, 8);
    const p = await ok("/products", admin, {
      name: "QA brochas " + suffix,
      sku: "QAGVP-" + tag,
      categoryId,
      taxRate: 0,
      variants: [
        {
          sku: "QAGVP-V-" + tag,
          barcode: "QAGVP-B-" + tag,
          price: 1000,
          costAvg: 400,
        },
      ],
    });
    const r = await request("/sales", admin, {
      offlineUuid: randomUUID(),
      customerId,
      cashSessionId: cash.id,
      items: [{ variantId: p.variants[0].id, qty: 1 }],
      payments: [{ method: "cash", amount: 1000 }],
      expectedTotal: 1000,
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GV · tasa del dólar del día", () => {
  it("lee la tasa DOP y rechaza valores absurdos", () => {
    expect(parseUsdRate({ rates: { DOP: 63.1234567 } })).toBe(63.1235);
    expect(() => parseUsdRate({ rates: { DOP: 0 } })).toThrow();
    expect(() => parseUsdRate({})).toThrow();
    expect(usdPrice(200, 63)).toBe(12600);
  });

  it("guarda la tasa y recalcula solo los precios en dólares", async () => {
    const product = await db.product.create({
      data: {
        name: "QA curso USD " + suffix,
        sku: "QAUSD-" + suffix,
        categoryId,
        unit: "servicio",
        branchId: fakeBranch,
        variants: {
          create: [
            {
              sku: "QAUSD-A-" + suffix,
              barcode: "QAUSD-A-" + suffix,
              price: 1,
              costAvg: 0,
              attributes: { usd: 200 },
              branchId: fakeBranch,
            },
            {
              sku: "QAUSD-B-" + suffix,
              barcode: "QAUSD-B-" + suffix,
              price: 4500,
              costAvg: 0,
              attributes: {},
              branchId: fakeBranch,
            },
          ],
        },
      },
      include: { variants: true },
    });
    const result = await applyUsdRate(db, fakeBranch, 63, "QA", "2026-10-20");
    expect(result.changed).toBe(1);
    const price = async (sku: string) =>
      Number((await db.variant.findFirstOrThrow({ where: { sku } })).price);
    expect(product.variants).toHaveLength(2);
    expect(await price("QAUSD-A-" + suffix)).toBe(12600);
    expect(await price("QAUSD-B-" + suffix)).toBe(4500);
    const settings = await db.settings.findUniqueOrThrow({
      where: { id: fakeBranch },
    });
    expect((settings.data as any).usdRate).toBe(63);
    expect((settings.data as any).usdRateDate).toBe("2026-10-20");
  });
});

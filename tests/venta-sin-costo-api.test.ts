// Venta sin costo (dueña, 8-nov): bloqueo en línea, excepciones (servicio y
// venta sin conexión ya cobrada), lista para administración y corrección del
// costo en la factura con PIN, motivo y bitácora. API y PostgreSQL reales.
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
const ip = "198.18.31." + ((Date.now() % 240) + 10);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const OWNER_PIN = "123456"; // admin del seed (apps/api/prisma/seed.ts)
const TEMPORARY_CASHIER_PASSWORD = "583907";
const FINAL_CASHIER_PASSWORD = "649283";
const NO_COST =
  "Este producto no tiene costo: pídele a la administración que lo complete";
const tag = Date.now().toString(36);

async function call(path: string, data?: unknown, token = "", method?: string) {
  const response = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
async function ok(path: string, data?: unknown, token = "", method?: string) {
  const r = await call(path, data, token, method);
  if (r.status >= 400)
    throw new Error(`${path}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
async function enroll(token: string, owner: string) {
  const id = randomUUID();
  const t = await ok(
    "/terminals/register",
    { id, name: "QA SC " + id.slice(0, 6), secret: "qa-sc-" + id },
    token,
  );
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", {}, owner);
}

let owner = "",
  manager = "",
  cashier = { token: "", id: "", session: null as any },
  customerId = "",
  noCost: any,
  withCost: any,
  service: any,
  settings: any,
  flagOffSaleId = "";
const userIds: string[] = [];
const productIds: string[] = [];

const sale = (variantId: string, price: number) => ({
  offlineUuid: randomUUID(),
  customerId,
  cashSessionId: cashier.session.id,
  items: [{ variantId, qty: 1 }],
  payments: [{ method: "cash", amount: price, tendered: price }],
  expectedTotal: price,
});

beforeAll(async () => {
  owner = (
    await ok("/auth/login", { email: "admin@fitstore.demo", password: demo })
  ).accessToken;
  await enroll(owner, owner);
  manager = (
    await ok("/auth/login", { email: "gerente@fitstore.demo", password: demo })
  ).accessToken;
  await enroll(manager, owner);
  const roles = await ok("/roles", undefined, owner);
  const email = `qa-sc-${tag}@example.test`;
  const user = await ok(
    "/users",
    {
      name: "QA Cajera SC",
      email,
      password: TEMPORARY_CASHIER_PASSWORD,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === "seller").id,
    },
    owner,
  );
  userIds.push(user.id);
  const login = await ok("/auth/change-password", {
    login: email,
    currentPassword: TEMPORARY_CASHIER_PASSWORD,
    newPassword: FINAL_CASHIER_PASSWORD,
    confirmPassword: FINAL_CASHIER_PASSWORD,
  });
  await enroll(login.accessToken, owner);
  cashier = {
    token: login.accessToken,
    id: login.user.id,
    session: await ok(
      "/cash-sessions/open",
      { openingAmount: 500, registerId: "qa-sc-" + tag },
      login.accessToken,
    ),
  };
  customerId = (await ok("/customers", { name: "QA cliente SC " + tag }, owner))
    .id;
  const categories = await ok("/categories", undefined, owner);
  const categoryId = categories.find((c: any) => c.name === "Fajas").id;
  const product = async (name: string, cost: number, unit = "unidad") => {
    const created = await ok(
      "/products",
      {
        name: `QA ${name} ${tag}`,
        sku: `QA-SC-${name}-${tag}`,
        categoryId,
        taxRate: 0,
        unit,
        variants: [
          {
            sku: `QA-SCV-${name}-${tag}`,
            barcode: `QA-SCB-${name}-${tag}`,
            price: 100,
            costAvg: cost,
          },
        ],
      },
      owner,
    );
    productIds.push(created.id);
    // El formulario puede exigir costo: el caso real (PRD-001) quedó en 0.
    await db.variant.update({
      where: { id: created.variants[0].id },
      data: { costAvg: cost },
    });
    if (unit !== "servicio")
      await ok(
        "/inventory/adjustments",
        { variantId: created.variants[0].id, qty: 10, reason: "QA SC" },
        owner,
      );
    return created.variants[0];
  };
  noCost = await product("brocha", 0);
  withCost = await product("faja", 40);
  service = await product("servicio", 0, "servicio");
  settings = await ok("/settings", undefined, owner);
  await ok("/settings", { ...settings, allowOfflineSales: true }, owner, "PUT");
}, 120_000);

afterAll(async () => {
  if (settings) await call("/settings", settings, owner, "PUT");
  await db.product
    .updateMany({ where: { id: { in: productIds } }, data: { active: false } })
    .catch(() => undefined);
  await db.user
    .updateMany({ where: { id: { in: userIds } }, data: { active: false } })
    .catch(() => undefined);
  await db.$disconnect();
});

describe("venta sin costo", () => {
  it("con la bandera apagada (por defecto) la venta sin costo pasa como hoy", async () => {
    expect(settings.blockZeroCostSales).toBe(false);
    const sold = await call("/sales", sale(noCost.id, 100), cashier.token);
    expect(sold.status).toBe(201);
    flagOffSaleId = sold.body.id;
    expect(
      await db.alert.count({
        where: { key: "zero-cost-sale:" + sold.body.id },
      }),
    ).toBe(0);
    // Se enciende la bandera; un guardado sin la clave (PWA vieja) la conserva.
    await ok(
      "/settings",
      { ...settings, allowOfflineSales: true, blockZeroCostSales: true },
      owner,
      "PUT",
    );
    const { blockZeroCostSales: omitted, ...older } = settings;
    void omitted;
    await ok("/settings", { ...older, allowOfflineSales: true }, owner, "PUT");
    expect((await ok("/settings", undefined, owner)).blockZeroCostSales).toBe(
      true,
    );
  });

  it("con la bandera encendida rechaza el producto sin costo con el mensaje exacto y no toca stock ni caja", async () => {
    const before = await db.variant.findUniqueOrThrow({
      where: { id: noCost.id },
    });
    const salesBefore = await db.sale.count({
      where: { cashSessionId: cashier.session.id },
    });
    const r = await call("/sales", sale(noCost.id, 100), cashier.token);
    expect(r.status).toBe(400);
    expect(r.body.message).toContain(NO_COST);
    expect(r.body.message).toContain("QA brocha");
    const after = await db.variant.findUniqueOrThrow({
      where: { id: noCost.id },
    });
    expect(Number(after.stock)).toBe(Number(before.stock));
    expect(
      await db.sale.count({ where: { cashSessionId: cashier.session.id } }),
    ).toBe(salesBefore);
  });

  it("vende normal con costo y el servicio sin inventario sí pasa con costo 0", async () => {
    expect(
      (await call("/sales", sale(withCost.id, 100), cashier.token)).status,
    ).toBe(201);
    expect(
      (await call("/sales", sale(service.id, 100), cashier.token)).status,
    ).toBe(201);
  });

  it("la lista es solo para quien ve costos y cuenta existencia por sucursal", async () => {
    const list = await ok("/inventory/without-cost", undefined, owner);
    const ids = list.items.map((i: any) => i.variantId);
    expect(ids).toContain(noCost.id);
    expect(ids).not.toContain(withCost.id);
    expect(ids).not.toContain(service.id);
    expect(list.items.find((i: any) => i.variantId === noCost.id).stock).toBe(
      9, // 10 de entrada menos la venta con la bandera apagada
    );
    expect(list.withStock).toBeLessThanOrEqual(list.total);
    expect(
      (await call("/inventory/without-cost", undefined, manager)).status,
    ).toBe(200);
    expect(
      (await call("/inventory/without-cost", undefined, cashier.token)).status,
    ).toBe(403);
    // Otra sucursal no aparece.
    await db.variant.update({
      where: { id: noCost.id },
      data: { branchId: "otra" },
    });
    try {
      const other = await ok("/inventory/without-cost", undefined, owner);
      expect(other.items.map((i: any) => i.variantId)).not.toContain(noCost.id);
    } finally {
      await db.variant.update({
        where: { id: noCost.id },
        data: { branchId: "main" },
      });
    }
  });

  it("sin conexión: la venta ya cobrada entra, queda marcada y se corrige con PIN, motivo y bitácora sin tocar la caja cerrada", async () => {
    // Con un servicio en la misma factura: su costo 0 no deja el aviso abierto.
    const offline = {
      ...sale(noCost.id, 200),
      items: [
        { variantId: noCost.id, qty: 1 },
        { variantId: service.id, qty: 1 },
      ],
    };
    const sync = await ok("/sales/sync", { sales: [offline] }, cashier.token);
    expect(sync.results[0].status).toBe("synced");
    const saved = await db.sale.findUniqueOrThrow({
      where: { offlineUuid: offline.offlineUuid },
      include: { items: true, payments: true },
    });
    expect(Number(saved.costTotal)).toBe(0);
    const alert = await db.alert.findUnique({
      where: { key: "zero-cost-sale:" + saved.id },
    });
    expect(alert).toMatchObject({ type: "zero_cost_sale", status: "new" });
    expect(
      await db.auditLog.count({
        where: { action: "sale_zero_cost_accepted", entityId: saved.id },
      }),
    ).toBe(1);

    // Se cierra la caja: su efectivo esperado no debe cambiar con el costo.
    await ok(
      "/cash-sessions/" + cashier.session.id + "/close",
      {
        countedCash: 1000,
        countedCard: 0,
        countedTransfer: 0,
        notes: "QA SC",
      },
      cashier.token,
    );
    const expected = async () =>
      (await ok("/cash-sessions", undefined, owner)).find(
        (s: any) => s.id === cashier.session.id,
      ).expected;
    const expectedBefore = await expected();

    const item = saved.items.find((i: any) => i.variantId === noCost.id)!;
    const path = `/sales/${saved.id}/items/${item.id}/cost`;
    const body = {
      unitCost: 35,
      expectedUnitCost: 0,
      operationId: randomUUID(),
      reason: "Costo de la factura del proveedor",
      managerPin: OWNER_PIN,
    };
    expect((await call(path, body, cashier.token)).status).toBe(403);
    expect((await call(path, body, manager)).status).toBe(403);
    expect((await call(path, { ...body, reason: "corto" }, owner)).status).toBe(
      400,
    );
    expect(
      (await call(path, { ...body, managerPin: undefined }, owner)).status,
    ).toBe(400);
    expect((await call(path, { ...body, unitCost: 0 }, owner)).status).toBe(
      400,
    );
    expect(
      (await call(path, { ...body, managerPin: "000001" }, owner)).status,
    ).toBeGreaterThanOrEqual(400);
    // Otra sucursal: no se encuentra.
    await db.sale.update({
      where: { id: saved.id },
      data: { branchId: "otra" },
    });
    try {
      expect((await call(path, body, owner)).status).toBe(400);
    } finally {
      await db.sale.update({
        where: { id: saved.id },
        data: { branchId: "main" },
      });
    }

    const fixed = await ok(path, body, owner);
    expect(fixed).toMatchObject({
      unitCostBefore: 0,
      unitCost: 35,
      costTotal: 35,
      profitChange: -35,
    });
    // Repetir la misma operación devuelve lo hecho sin duplicar la bitácora.
    expect(await ok(path, body, owner)).toMatchObject({
      unitCost: 35,
      profitChange: -35,
    });
    // Una línea ya costeada no se reescribe con un costo visto viejo.
    expect(
      (
        await call(
          path,
          { ...body, unitCost: 40, operationId: randomUUID() },
          owner,
        )
      ).status,
    ).toBe(409);
    // Tope de cordura sobre el precio de la línea (100).
    const fresh = { ...body, expectedUnitCost: 35 };
    expect(
      (
        await call(
          path,
          { ...fresh, unitCost: 600, operationId: randomUUID() },
          owner,
        )
      ).status,
    ).toBe(400);
    const above = await call(
      path,
      { ...fresh, unitCost: 150, operationId: randomUUID() },
      owner,
    );
    expect(above.status).toBe(400);
    expect(above.body.message).toContain("mayor que el precio");
    expect(
      await db.auditLog.count({
        where: { action: "sale_item_cost_corrected", entityId: saved.id },
      }),
    ).toBe(1);
    const after = await db.sale.findUniqueOrThrow({
      where: { id: saved.id },
      include: { items: true, payments: true },
    });
    expect(Number(after.costTotal)).toBe(35);
    const line = after.items.find((i: any) => i.id === item.id)!;
    expect(Number(line.unitCost)).toBe(35);
    expect((line.stockAllocations as any[])[0].unitCost).toBe(35);
    const kardex = await db.inventoryMovement.findMany({
      where: { refId: saved.id, variantId: noCost.id, type: "sale" },
    });
    expect(kardex.length).toBeGreaterThan(0);
    expect(kardex.every((m: any) => Number(m.unitCost) === 35)).toBe(true);
    expect(Number(after.total)).toBe(Number(saved.total));
    expect(
      after.payments.map((p: any) => [p.method, Number(p.amount)]),
    ).toEqual(saved.payments.map((p: any) => [p.method, Number(p.amount)]));
    expect(await expected()).toEqual(expectedBefore);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "sale_item_cost_corrected", entityId: saved.id },
    });
    expect(log.userId).toBeTruthy();
    expect(log.createdAt).toBeTruthy();
    expect(JSON.stringify(log)).toContain("Costo de la factura del proveedor");
    expect(
      (
        await db.alert.findUnique({
          where: { key: "zero-cost-sale:" + saved.id },
        })
      )?.status,
    ).toBe("resolved");
  });

  it("recálculo de costos: solo lectura, con el costo ya cargado propone el efecto por factura y total", async () => {
    // La dueña carga el costo de la variante (simulado).
    await db.variant.update({
      where: { id: noCost.id },
      data: { costAvg: 30 },
    });
    const path = "/reports/cost-recalc?variantId=" + noCost.id;
    expect((await call(path, undefined, cashier.token)).status).toBe(403);
    expect((await call(path, undefined, manager)).status).toBe(200);
    const report = await ok(path, undefined, owner);
    // La factura sin conexión ya corregida no aparece; la de bandera apagada sí.
    expect(report.sales.map((r: any) => r.saleId)).toEqual([flagOffSaleId]);
    expect(report.sales[0]).toMatchObject({
      hasReturns: false,
      total: 100,
      costTotal: 0,
      costTotalAfter: 30,
      profit: 100,
      profitAfter: 70,
      margin: 100,
      marginAfter: 70,
    });
    expect(report.sales[0].lines[0]).toMatchObject({
      unitCost: 0,
      proposedUnitCost: 30,
      costChange: 30,
      applicable: true,
    });
    expect(report.totals).toMatchObject({
      invoices: 1,
      total: 100,
      costTotalAfter: 30,
      marginAfter: 70,
    });
    // No aplica nada.
    const saved = await db.sale.findUniqueOrThrow({
      where: { id: flagOffSaleId },
    });
    expect(Number(saved.costTotal)).toBe(0);
    // Período sin ventas: vacío.
    const empty = await ok(path + "&from=2099-01-01", undefined, owner);
    expect(empty.totals.invoices).toBe(0);
    expect(
      (await call("/reports/cost-recalc?from=ayer", undefined, owner)).status,
    ).toBe(400);
    expect(
      (await call("/reports/cost-recalc?to=2026-13-45", undefined, owner))
        .status,
    ).toBe(400);
  });
});

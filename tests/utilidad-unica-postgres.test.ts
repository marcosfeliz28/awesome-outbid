import { afterAll, beforeAll, expect, it } from "vitest";
import { margin } from "../packages/shared/src/index";
import { startProductApp, TENANT } from "./setup/product-pg-app";

// A1 (prueba en vivo 26-oct): una sola fórmula de utilidad y margen, la de la
// dueña: (cobrado − costo) / cobrado, con el ITBIS incluido y sin restarlo.
// Agua 25 (costo 0), Refresco 50 (30) y Galletas 40 (25) = 115, ITBIS 17.54.
const SELLER = "30000000-0000-4000-8000-000000000002";
const SALE = "80000000-0000-4000-8000-0000000000a1";
const LINES = [
  { name: "Agua", price: 25, cost: 0, tax: 3.81 },
  { name: "Refresco", price: 50, cost: 30, tax: 7.63 },
  { name: "Galletas", price: 40, cost: 25, tax: 6.1 },
];
let t: Awaited<ReturnType<typeof startProductApp>>;
beforeAll(async () => {
  t = await startProductApp("nexora_utilidad_unica");
  const category = await t.db.category.create({
    data: { tenantId: TENANT, name: "Bebidas" },
  });
  await t.db.sale.create({
    data: {
      id: SALE,
      tenantId: TENANT,
      number: "A1-1",
      offlineUuid: SALE,
      sellerId: SELLER,
      status: "completed",
      subtotal: 97.46,
      discountTotal: 0,
      taxTotal: 17.54,
      total: 115,
      costTotal: 55,
    },
  });
  for (const l of LINES) {
    const product = await t.db.product.create({
      data: {
        tenantId: TENANT,
        name: l.name,
        sku: "A1-" + l.name,
        categoryId: category.id,
      },
    });
    const variant = await t.db.variant.create({
      data: {
        tenantId: TENANT,
        productId: product.id,
        sku: "A1-" + l.name,
        barcode: "A1" + l.name,
        costAvg: l.cost,
        price: l.price,
      },
    });
    await t.db.saleItem.create({
      data: {
        tenantId: TENANT,
        saleId: SALE,
        variantId: variant.id,
        qty: 1,
        unitPrice: l.price,
        unitCost: l.cost,
        discount: 0,
        tax: l.tax,
        lineTotal: l.price,
      },
    });
  }
}, 180_000);
afterAll(async () => {
  await t?.stop();
});

it("Utilidad por producto y Resumen dan 60.00 y 52.2 % sin restar ITBIS", async () => {
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  const q = `?from=${day}&to=${day}`;
  const report = await t.get("/reports/profit" + q);
  expect(report.status, JSON.stringify(report.body)).toBe(200);
  const by = Object.fromEntries(
    report.body.rows.map((r: any) => [r.Producto, r]),
  );
  expect(by.Agua).toMatchObject({
    Ventas: 25,
    Costo: 0,
    Utilidad: 25,
    Margen: 100,
  });
  expect(by.Refresco).toMatchObject({
    Ventas: 50,
    Costo: 30,
    Utilidad: 20,
    Margen: 40,
  });
  expect(by.Galletas).toMatchObject({
    Ventas: 40,
    Costo: 25,
    Utilidad: 15,
    Margen: 37.5,
  });

  const summary = await t.get("/dashboard/summary" + q);
  expect(summary.status, JSON.stringify(summary.body)).toBe(200);
  const profit = report.body.rows.reduce(
    (a: number, r: any) => a + r.Utilidad,
    0,
  );
  expect(summary.body.grossProfit).toBe(60);
  expect(Math.round(profit * 100) / 100).toBe(summary.body.grossProfit);
  // Sin gastos ni comisiones, la utilidad neta es la misma base: ventas con ITBIS.
  expect(summary.body.netProfit).toBe(60);
  expect(summary.body.margin).toBe(52.17);
  expect(margin(115, 55)).toBe(52.17);
});

it("la rentabilidad del cierre de caja usa la misma base: ventas con ITBIS − costo", async () => {
  // La venta va a una caja cerrada de la administradora (la del arnés, SELLER).
  const opened = new Date(Date.now() - 3_600_000);
  const session = await t.db.cashSession.create({
    data: {
      tenantId: TENANT,
      userId: SELLER,
      openingAmount: 0,
      openedAt: opened,
      closedAt: new Date(),
    },
  });
  await t.db.sale.update({
    where: { id: SALE },
    data: { cashSessionId: session.id },
  });
  const cuadre = await t.get(`/cash-sessions/${session.id}/cuadre`);
  expect(cuadre.status, JSON.stringify(cuadre.body)).toBe(200);
  const profit = cuadre.body.lines.find((l: any) => l.key === "profit");
  expect(profit?.value).toBe(60);
});

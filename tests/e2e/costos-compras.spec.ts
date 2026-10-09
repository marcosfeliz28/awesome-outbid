import { test, expect, ownerHeaders } from "./apoyo";
// Revisión F2 (lista blanca de safe): en Compras el almacén no ve importes de
// compra, sí ve las unidades dañadas y «Completar documento» no borra el
// ITBIS que no le llega. La administración sigue viendo totales.
async function receivedOrder(request: any) {
  const headers = await ownerHeaders(request);
  const cats = await (await request.get("/api/categories", { headers })).json();
  const supplier = (
    await (await request.get("/api/suppliers", { headers })).json()
  )[0];
  const suffix = Date.now().toString(36) + crypto.randomUUID().slice(0, 4);
  const product = await (
    await request.post("/api/products", {
      headers,
      data: {
        name: "E2E Costos " + suffix,
        sku: "E2E-CC-" + suffix,
        categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
        variants: [
          {
            sku: "E2E-CCV-" + suffix,
            barcode: "E2E-CCB-" + suffix,
            costAvg: 100,
            price: 236,
          },
        ],
      },
    })
  ).json();
  const order = await (
    await request.post("/api/purchase-orders", {
      headers,
      data: {
        supplierId: supplier.id,
        itbis: 54,
        items: [{ variantId: product.variants[0].id, qty: 3, unitCost: 100 }],
      },
    })
  ).json();
  const received = await request.post(
    "/api/purchase-orders/" + order.id + "/receive",
    {
      headers,
      data: {
        operationId: crypto.randomUUID(),
        itbis: 54,
        items: [
          {
            itemId: order.items[0].id,
            qty: 2,
            damagedQty: 1,
            damageReason: "Caja rota E2E",
          },
        ],
      },
    },
  );
  expect(received.ok()).toBe(true);
  return { headers, product, order, receipt: await received.json() };
}
async function loginAs(page: any, email: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  // El almacén entra directo a Mercancía; la administración, al tablero.
  await expect(
    page.getByRole("button", { name: "Compras", exact: true }),
  ).toBeVisible();
}
test("Rev F2: el almacén ve Compras sin importes ni NaN, con dañados, y no borra el ITBIS", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { headers, product, order, receipt } = await receivedOrder(request);
  await loginAs(page, "almacen@fitstore.demo");
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  const orderRow = page.locator("tr").filter({ hasText: order.number });
  await expect(orderRow).toBeVisible();
  await expect(orderRow).not.toContainText("NaN");
  await expect(orderRow).not.toContainText("300");
  await page.getByRole("button", { name: "Recepciones", exact: true }).click();
  const row = page
    .locator(".receipt-history li")
    .filter({ hasText: order.number });
  await expect(row).toContainText("2 unidades buenas · 1 dañada");
  await expect(row).not.toContainText("RD$");
  await row.getByRole("button", { name: "Ver" }).click();
  const dialog = page.getByRole("dialog", { name: "Comprobante de recepción" });
  await expect(dialog).toContainText(product.name);
  await expect(dialog).not.toContainText("ITBIS facturado");
  await dialog.getByRole("button", { name: "Completar documento" }).click();
  await dialog.getByLabel("Número de factura").fill("FAC-ALMACEN");
  await dialog.getByRole("button", { name: "Guardar documento" }).click();
  await expect(dialog).toContainText("FAC-ALMACEN");
  const saved = await (
    await request.get("/api/goods-receipts/" + receipt.id, { headers })
  ).json();
  expect(saved).toMatchObject({ supplierInvoice: "FAC-ALMACEN", itbis: 54 });
  expect(errors).toEqual([]);
  await request.patch("/api/products/" + product.id, {
    headers,
    data: { active: false },
  });
});
test("Rev F2: la administración sigue viendo totales e ITBIS en Compras", async ({
  page,
  request,
}) => {
  const { headers, product, order } = await receivedOrder(request);
  await loginAs(page, "admin@fitstore.demo");
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await expect(
    page.locator("tr").filter({ hasText: order.number }),
  ).toContainText("300.00");
  await page.getByRole("button", { name: "Recepciones", exact: true }).click();
  const row = page
    .locator(".receipt-history li")
    .filter({ hasText: order.number });
  await expect(row).toContainText("1 dañada");
  await expect(row).toContainText("200.00");
  await row.getByRole("button", { name: "Ver" }).click();
  const dialog = page.getByRole("dialog", { name: "Comprobante de recepción" });
  await expect(dialog).toContainText("ITBIS facturado");
  await expect(dialog).toContainText("100.00 c/u");
  await request.patch("/api/products/" + product.id, {
    headers,
    data: { active: false },
  });
});

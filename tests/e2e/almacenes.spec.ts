import { test, expect, ownerHeaders } from "./apoyo";
import { createRequire } from "node:module";
import { join } from "node:path";

const apiRequire = createRequire(join(process.cwd(), "apps/api/package.json"));
const ExcelJS = apiRequire("exceljs");

// La vista debe reflejar exactamente el movimiento que registró la API.
test("Casa se contabiliza por separado y el traspaso habilita stock en Tienda", async ({
  page,
  request,
}) => {
  const headers = await ownerHeaders(request);
  const suffix = crypto.randomUUID().slice(0, 8);
  const cats = await (await request.get("/api/categories", { headers })).json();
  const productResponse = await request.post("/api/products", {
    headers,
    data: {
      name: "E2E Almacén " + suffix,
      sku: "E2E-WH-P-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "E2E-WH-V-" + suffix,
          barcode: "E2E-WH-B-" + suffix,
          costAvg: 100,
          price: 250,
        },
      ],
    },
  });
  expect(productResponse.ok()).toBe(true);
  const product = await productResponse.json();
  const variantId = product.variants[0].id;
  const warehouses = await (
    await request.get("/api/inventory/warehouses", { headers })
  ).json();
  const home = warehouses.find((w: any) => w.kind === "home");
  const store = warehouses.find((w: any) => w.kind === "store");
  const adjustment = await request.post("/api/inventory/adjustments", {
    headers,
    data: {
      variantId,
      warehouseId: home.id,
      qty: 8,
      reason: "E2E levantamiento Casa",
    },
  });
  expect(adjustment.ok(), await adjustment.text()).toBe(true);
  const before = await (
    await request.get("/api/inventory/stock", { headers })
  ).json();
  const rowBefore = before.find((v: any) => v.id === variantId);
  expect(Number(rowBefore.stock)).toBe(0);
  expect(Number(rowBefore.homeStock)).toBe(8);
  const move = await request.post("/api/inventory/transfers", {
    headers,
    data: {
      operationId: crypto.randomUUID(),
      fromId: home.id,
      toId: store.id,
      reason: "E2E llevar al local",
      lines: [{ variantId, qty: 3 }],
    },
  });
  expect(move.ok(), await move.text()).toBe(true);
  const refused = await request.post("/api/inventory/transfers", {
    headers,
    data: {
      operationId: crypto.randomUUID(),
      fromId: home.id,
      toId: store.id,
      reason: "Cantidad imposible",
      lines: [{ variantId, qty: 999999999 }],
    },
  });
  expect(refused.status()).toBe(400);
  const warehouseLogin = await request.post("/api/auth/login", {
    data: { email: "almacen@fitstore.demo", password: "FitStore-Demo-2026!" },
  });
  expect(warehouseLogin.ok()).toBe(true);
  const warehouseToken = (await warehouseLogin.json()).accessToken;
  const denied = await request.post("/api/inventory/transfers", {
    headers: { Authorization: "Bearer " + warehouseToken },
    data: {
      operationId: crypto.randomUUID(),
      fromId: home.id,
      toId: store.id,
      reason: "Sin permiso",
      lines: [{ variantId, qty: 1 }],
    },
  });
  expect(denied.status()).toBe(403);
  const after = await (
    await request.get("/api/inventory/stock", { headers })
  ).json();
  const rowAfter = after.find((v: any) => v.id === variantId);
  expect(Number(rowAfter.stock)).toBe(3);
  expect(Number(rowAfter.homeStock)).toBe(5);
  expect(Number(rowAfter.totalStock)).toBe(8);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.evaluate(() => (location.hash = "inventory"));
  await expect(page.getByText("Dónde está la mercancía")).toBeVisible();
  await page.getByLabel("Almacén", { exact: true }).selectOption(home.id);
  await expect(
    page
      .getByRole("row", { name: new RegExp("E2E Almacén " + suffix) })
      .first(),
  ).toContainText("5");
});

test("el traspaso desde Casa propone Tienda como destino en móvil", async ({
  page,
  request,
}) => {
  const headers = await ownerHeaders(request);
  const warehouses = await (
    await request.get("/api/inventory/warehouses", { headers })
  ).json();
  const home = warehouses.find((w: any) => w.kind === "home");
  const store = warehouses.find((w: any) => w.kind === "store");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.evaluate(() => (location.hash = "inventory"));
  await expect(page.getByText("Dónde está la mercancía")).toBeVisible();
  await page.getByLabel("Almacén", { exact: true }).selectOption(home.id);
  await page.getByLabel("Producto", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Traspasar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const selects = dialog.locator("select");
  await expect(selects.nth(0)).toHaveValue(home.id);
  await expect(selects.nth(1)).toHaveValue(store.id);
});

test("el conteo precarga la existencia del almacén seleccionado", async ({
  page,
  request,
}) => {
  const headers = await ownerHeaders(request);
  const warehouses = await (
    await request.get("/api/inventory/warehouses", { headers })
  ).json();
  const home = warehouses.find((w: any) => w.kind === "home");
  const store = warehouses.find((w: any) => w.kind === "store");
  const categories = await (await request.get("/api/categories", { headers })).json();
  const suffix = crypto.randomUUID().slice(0, 8);
  const created = await request.post("/api/products", {
    headers,
    data: {
      name: "Conteo por almacén " + suffix,
      sku: "COUNT-WH-P-" + suffix,
      categoryId: categories.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "COUNT-WH-V-" + suffix,
          barcode: "COUNT-WH-B-" + suffix,
          price: 250,
          costAvg: 100,
        },
      ],
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const variantId = (await created.json()).variants[0].id;
  for (const [warehouseId, qty] of [[store.id, 3], [home.id, 5]]) {
    const adjustment = await request.post("/api/inventory/adjustments", {
      headers,
      data: { variantId, warehouseId, qty, reason: "Preparación conteo E2E" },
    });
    expect(adjustment.ok(), await adjustment.text()).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.evaluate(() => (location.hash = "inventory"));
  await expect(page.getByText("Dónde está la mercancía")).toBeVisible();
  await page.getByLabel("Buscar producto o código").fill("COUNT-WH-V-" + suffix);
  await page.getByRole("row", { name: new RegExp("Conteo por almacén " + suffix) })
    .getByRole("button", { name: "Contar" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const counted = dialog.getByLabel("Cantidad contada");
  await expect(counted).toHaveValue("3");
  await dialog.getByLabel("Almacén").selectOption(home.id);
  await expect(counted).toHaveValue("5");
  await counted.fill("6");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  const pendingCounts = await (
    await request.get("/api/inventory/counts", { headers })
  ).json();
  const createdCount = pendingCounts.find(
    (record: any) =>
      record.status === "pending" &&
      record.warehouseId === home.id &&
      record.items.some(
        (item: any) => item.variantId === variantId && Number(item.counted) === 6,
      ),
  );
  expect(createdCount).toBeTruthy();
  await page.getByRole("button", { name: "Conteos físicos" }).click();
  const pendingAt = pendingCounts
    .filter((record: any) => record.status === "pending")
    .findIndex((record: any) => record.id === createdCount.id);
  await page.getByRole("button", { name: "Aprobar ajuste" }).nth(pendingAt).click();
  await expect(page.getByText("Conteo aprobado y aplicado.")).toBeVisible();
  const finalStock = await (
    await request.get("/api/inventory/stock", { headers })
  ).json();
  expect(Number(finalStock.find((v: any) => v.id === variantId).homeStock)).toBe(6);
});

test("el traspaso Casa→Tienda conserva la identidad del lote en móvil", async ({
  page,
  request,
}) => {
  const headers = await ownerHeaders(request);
  const suffix = crypto.randomUUID().slice(0, 8);
  const categoryResponse = await request.post("/api/categories", {
    headers,
    data: {
      name: "Lote Casa E2E " + suffix,
      color: "#7C3AED",
      requiresLot: true,
      requiresExpiry: true,
    },
  });
  expect(categoryResponse.ok(), await categoryResponse.text()).toBe(true);
  const category = await categoryResponse.json();
  const productResponse = await request.post("/api/products", {
    headers,
    data: {
      name: "Producto con lote en Casa " + suffix,
      sku: "LOT-WH-P-" + suffix,
      categoryId: category.id,
      variants: [
        {
          sku: "LOT-WH-V-" + suffix,
          barcode: "LOT-WH-B-" + suffix,
          costAvg: 100,
          price: 250,
        },
      ],
    },
  });
  expect(productResponse.ok(), await productResponse.text()).toBe(true);
  const variantId = (await productResponse.json()).variants[0].id;
  const warehouses = await (
    await request.get("/api/inventory/warehouses", { headers })
  ).json();
  const home = warehouses.find((w: any) => w.kind === "home");
  const store = warehouses.find((w: any) => w.kind === "store");
  const adjusted = await request.post("/api/inventory/adjustments", {
    headers,
    data: {
      variantId,
      warehouseId: home.id,
      qty: 3,
      lotNumber: "CASA-" + suffix,
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      reason: "Preparación E2E, solo pruebas",
    },
  });
  expect(adjusted.ok(), await adjusted.text()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.evaluate(() => (location.hash = "inventory"));
  await expect(page.getByText("Dónde está la mercancía")).toBeVisible();
  await page.getByLabel("Almacén", { exact: true }).selectOption(home.id);
  await page
    .getByLabel("Producto", { exact: true })
    .selectOption({ label: "Producto con lote en Casa " + suffix + " · LOT-WH-V-" + suffix });
  await page.getByRole("button", { name: "Traspasar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const normalizedLot = ("CASA-" + suffix).toUpperCase();
  await expect(dialog.getByLabel("Lote (si aplica)")).toContainText(normalizedLot);
  await dialog.getByLabel("Desde").selectOption(home.id);
  await dialog.getByLabel("Hasta").selectOption(store.id);
  await dialog.getByLabel("Cantidad").fill("1");
  await dialog.getByLabel("Lote (si aplica)").selectOption({ label: normalizedLot });
  await dialog.getByLabel("Motivo").fill("Prueba local de traslado con lote");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  const stock = await (
    await request.get("/api/inventory/stock", { headers })
  ).json();
  const result = stock.find((v: any) => v.id === variantId);
  expect(Number(result.homeStock)).toBe(2);
  expect(Number(result.stock)).toBe(1);
  expect(Number(result.totalStock)).toBe(3);
  expect(result.lots.some((lot: any) => lot.lotNumber === normalizedLot && Number(lot.qty) === 1)).toBe(true);
});

test("la vista previa de Casa detalla el antes y el después del Excel", async ({
  page,
  request,
}) => {
  const headers = await ownerHeaders(request);
  const categories = await (await request.get("/api/categories", { headers })).json();
  const suffix = crypto.randomUUID().slice(0, 8);
  const sku = "EXCEL-WH-V-" + suffix;
  const created = await request.post("/api/products", {
    headers,
    data: {
      name: "Vista previa Casa " + suffix,
      sku: "EXCEL-WH-P-" + suffix,
      categoryId: categories.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [{ sku, barcode: "EXCEL-WH-B-" + suffix, price: 250, costAvg: 100 }],
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventario Casa");
  sheet.addRow([
    "ID",
    "DESCRIPCION",
    "REFERENCIA",
    "SUB-GRUPO DE ARTICULO",
    "EXISTENCIA",
    "COSTO",
    "PRECIODETALLE",
  ]);
  sheet.addRow([sku, "Vista previa Casa " + suffix, "REF-" + suffix, "Ropa deportiva", 7, 100, 250]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.evaluate(() => (location.hash = "inventory"));
  await expect(page.getByText("Dónde está la mercancía")).toBeVisible();
  await page.getByLabel("Excel de Casa").setInputFiles({
    name: "levantamiento-casa.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await page.getByRole("button", { name: "Revisar archivo" }).click();
  const preview = page.locator('[role="status"]').filter({ hasText: "1 filas" });
  await expect(preview).toBeVisible();
  const previewRow = preview.getByRole("row", { name: new RegExp(sku) });
  await expect(previewRow.locator("td").nth(2)).toHaveText("0");
  await expect(previewRow.locator("td").nth(3)).toHaveText("7");
  await preview.getByRole("button", { name: "Cargar en Casa" }).click();
  await expect(page.getByText("Levantamiento de Casa aplicado.")).toBeVisible();
  const stock = await (
    await request.get("/api/inventory/stock", { headers })
  ).json();
  const row = stock.find((v: any) => v.sku === sku);
  expect(Number(row.stock)).toBe(0);
  expect(Number(row.homeStock)).toBe(7);
  expect(Number(row.totalStock)).toBe(7);
});

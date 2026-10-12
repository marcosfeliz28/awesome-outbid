import { test, expect, ownerHeaders } from "./apoyo";

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
});

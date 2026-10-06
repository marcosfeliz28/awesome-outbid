import { test, expect } from "@playwright/test";
// Revisión R9 · facturas: recibir una orden de compra desde Compras.
// R9-facturas-8: si la API ya recibió la mercancía pero la respuesta se
// pierde, volver a pulsar Guardar no la recibe dos veces.
test("R9-facturas-8: Guardar otra vez tras perder la respuesta de una recepción no duplica la mercancía", async ({
  page,
  request,
}) => {
  const auth = await (
    await request.post("/api/auth/login", {
      data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
    })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  // Las órdenes y el stock sólo se mueven desde un equipo aprobado.
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E R9 facturas", secret: "e2e-r9-facturas-" + id },
  });
  expect(registered.ok()).toBe(true);
  const code = "R9F" + String(Math.floor(Math.random() * 9000000) + 1000000);
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const product = await (
    await request.post("/api/products", {
      headers,
      data: {
        name: "Faja E2E recepción " + code,
        sku: "P-" + code,
        categoryId: categories.find((c: any) => c.name === "Fajas").id,
        variants: [
          { sku: code, barcode: "B-" + code, price: 1500, costAvg: 700 },
        ],
      },
    })
  ).json();
  expect(product.id, JSON.stringify(product)).toBeTruthy();
  const suppliers = await (
    await request.get("/api/suppliers", { headers })
  ).json();
  const created = await request.post("/api/purchase-orders", {
    headers,
    data: {
      supplierId: suppliers[0].id,
      items: [{ variantId: product.variants[0].id, qty: 10, unitCost: 1000 }],
    },
  });
  expect(created.ok()).toBe(true);
  const order = await created.json();

  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await page
    .getByRole("row", { name: new RegExp(order.number) })
    .getByRole("button", { name: "Recibir" })
    .click();
  await page.getByLabel(/Cantidad pendiente/).fill("4");

  // La primera vez la API recibe la mercancía, pero la respuesta no llega.
  const bodies: any[] = [];
  let lost = false;
  await page.route(
    "**/api/purchase-orders/" + order.id + "/receive",
    (route) => {
      bodies.push(route.request().postDataJSON());
      if (lost) return route.continue();
      lost = true;
      return route.fetch().then((response) => {
        expect(response.ok()).toBe(true);
        return route.abort("connectionreset");
      });
    },
  );
  const save = page.getByRole("button", { name: "Guardar", exact: true });
  await save.click();
  await expect(page.locator(".form-error")).toBeVisible();
  // La persona vuelve a pulsar Guardar.
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  expect(bodies).toHaveLength(2);
  const orders = await (
    await request.get("/api/purchase-orders", { headers })
  ).json();
  const saved = orders.find((o: any) => o.id === order.id);
  expect(Number(saved.items[0].receivedQty)).toBe(4);
  expect(saved.receipts).toHaveLength(1);
  const stocked = await (
    await request.get("/api/products/" + product.id, { headers })
  ).json();
  expect(Number(stocked.variants[0].stock)).toBe(4);
  // El mismo id de operación en los dos envíos.
  expect(bodies[0].operationId).toBeTruthy();
  expect(bodies[1].operationId).toBe(bodies[0].operationId);
  await request.patch("/api/products/" + product.id, {
    headers,
    data: { active: false },
  });
});

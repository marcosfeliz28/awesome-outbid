// Auditoría 05 v2 (N5, B2, B4, B9, B10, B11, N10 en pantalla): detalles de la
// caja y del inicio de sesión. Cada escenario usa datos con códigos al azar.
import { test, expect, selectNamedCustomer } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const code = (first: string) =>
  first + String(Math.floor(Math.random() * 9000000) + 1000000);

async function ownerApi(request: any) {
  const auth = await (
    await request.post("/api/auth/login", { data: OWNER })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E borrador", secret: "e2e-borrador-" + id },
  });
  expect(registered.ok()).toBe(true);
  const sessions = await (
    await request.get("/api/cash-sessions", { headers })
  ).json();
  for (const s of sessions.filter(
    (s: any) => s.userId === auth.user.id && !s.closedAt,
  ))
    await request.post("/api/cash-sessions/" + s.id + "/close", {
      headers,
      data: {
        countedCash: Math.max(0, s.expected.cash),
        countedCard: Math.max(0, s.expected.card),
        countedTransfer: Math.max(0, s.expected.transfer),
        notes: "Cierre entre escenarios E2E",
      },
    });
  return { headers };
}
async function newProduct(
  request: any,
  headers: any,
  name: string,
  sku: string,
) {
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const created = await request.post("/api/products", {
    headers,
    data: {
      name,
      sku: "BD-" + sku,
      categoryId: categories.find((c: any) => c.name === "Fajas").id,
      variants: [{ sku, barcode: "BDB-" + sku, price: 1500, costAvg: 700 }],
    },
  });
  const product = await created.json();
  expect(product.id, JSON.stringify(product)).toBeTruthy();
  const stocked = await request.post("/api/inventory/adjustments", {
    headers,
    data: { variantId: product.variants[0].id, qty: 5, reason: "E2E borrador" },
  });
  expect(stocked.ok()).toBe(true);
  return product;
}
async function retire(request: any, headers: any, products: any[]) {
  for (const p of products)
    await request.patch("/api/products/" + p.id, {
      headers,
      data: { active: false },
    });
}
async function login(page: any) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(OWNER.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
}
const goTo = (page: any, hash: string) =>
  page.evaluate((h: string) => (location.hash = h), hash);
async function openCash(page: any) {
  await goTo(page, "cash");
  const open = page.getByRole("button", { name: "Abrir caja", exact: true });
  const opened = page.getByText("Caja abierta", { exact: true });
  await expect(open.or(opened).first()).toBeVisible();
  if (await open.isVisible()) {
    await open.click();
    await page.getByLabel("Efectivo inicial").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
  }
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
}
async function pos(page: any) {
  await goTo(page, "pos");
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  return page.getByLabel("Buscar productos");
}
const qty = (page: any, name: string) =>
  page
    .locator(".cart-item", { hasText: name })
    .locator(".quantity-control span");

test("N5: Enter en el selector elige al único cliente que empieza por lo escrito y, con varios, pide elegir", async ({
  page,
  request,
}) => {
  const { headers } = await ownerApi(request);
  const tag = code("1");
  for (const name of [
    "Adriana Torres " + tag,
    "Ana Herrera " + tag,
    "Marta Pérez " + tag,
    "Marta Gómez " + tag,
  ]) {
    const created = await request.post("/api/customers", {
      headers,
      data: { name, phone: "", email: "", legalId: "", notes: "" },
    });
    expect(created.ok()).toBe(true);
  }
  await login(page);
  await pos(page);
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog", {
    name: "¿Para quién es esta venta?",
  });
  const finder = dialog.getByLabel("Buscar cliente");
  // «Ana» está dentro de «Adriana», pero sólo Ana Herrera empieza por Ana.
  await finder.fill("ana " + tag);
  await expect(dialog.locator(".customer-list button")).toHaveCount(2);
  await expect(dialog.locator(".customer-list button").first()).toContainText(
    "Ana Herrera",
  );
  // Dos «Marta»: Enter no elige a ciegas.
  await finder.fill("marta " + tag);
  await expect(dialog.locator(".customer-list button")).toHaveCount(2);
  await finder.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText(
    "elige uno de la lista",
  );
  await finder.fill("ana " + tag);
  await finder.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".customer-selector strong")).toHaveText(
    "Ana Herrera " + tag,
  );
});

test("B2, B4, B10, B11: la cajera ve «Sin conexión», no hay 403 al entrar, el celular no muestra F12 y la contraseña se puede ver", async ({
  page,
  context,
}) => {
  const denied: string[] = [];
  page.on("response", (r) => {
    if (r.status() === 403) denied.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("vendedor@fitstore.demo");
  const password = page.getByLabel("Contraseña", { exact: true });
  await password.fill(OWNER.password);
  await expect(password).toHaveAttribute("type", "password");
  const reveal = page.getByRole("button", { name: "Mostrar contraseña" });
  await reveal.click();
  await expect(reveal).toHaveAttribute("aria-pressed", "true");
  await expect(password).toHaveAttribute("type", "text");
  await reveal.click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  expect(denied).toEqual([]);
  // B10: la barra del celular no muestra la tecla F12.
  await expect(page.locator(".pos-mobile-charge kbd")).toBeHidden();
  // B2: el indicador dice «Sin conexión», no «Offline».
  await context.setOffline(true);
  await expect(page.locator(".connection")).toContainText("Sin conexión");
  await expect(page.locator(".connection")).not.toContainText("Offline");
  // B1: la zona que responde al toque del botón de conexión llega a 44 px.
  const hit = await page.locator(".connection").evaluate((el) => {
    const after = getComputedStyle(el, "::after");
    const box = el.getBoundingClientRect();
    const grow = (v: string) => Math.abs(parseFloat(v) || 0);
    return {
      width: box.width + grow(after.left) + grow(after.right),
      height: box.height + grow(after.top) + grow(after.bottom),
    };
  });
  expect(hit.width).toBeGreaterThanOrEqual(43.5);
  expect(hit.height).toBeGreaterThanOrEqual(43.5);
  await context.setOffline(false);
});

test("B9: la venta en espera dice de qué cliente es", async ({
  page,
  request,
}) => {
  const { headers } = await ownerApi(request);
  const sku = code("5");
  const name = "Faja E2E en espera " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("1");
  await selectNamedCustomer(page);
  const customer = (await page
    .locator(".customer-selector strong")
    .textContent())!.trim();
  await page
    .locator(".cart-bottom-actions")
    .getByRole("button", { name: /En espera/ })
    .click();
  await expect(page.locator(".cart-item")).toHaveCount(0);
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: /En espera/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Ventas en espera y cotizaciones",
  });
  await expect(
    dialog.locator(".held-row", { hasText: name }).first(),
  ).toContainText(customer);
  await retire(request, headers, [product]);
});

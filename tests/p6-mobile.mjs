// Verificación visual aislada: Vite preview en 4261, API sintética, sin producción.
/* global getComputedStyle */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import process from "node:process";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const category = {
  id: "qa-category",
  name: "Prueba",
  color: "#ffff00",
  requiresLot: false,
};
await page.route("**/api/**", async (route) => {
  const url = route.request().url();
  let data = [];
  if (url.includes("/auth/refresh"))
    data = {
      accessToken: "local-visual-fixture",
      user: {
        id: "qa-p6",
        name: "Usuario de prueba",
        branchId: "main",
        permissions: ["*"],
        roleName: "Administrador",
        sessionTimeoutMinutes: 30,
      },
    };
  else if (url.includes("/settings"))
    data = {
      name: "Tienda de prueba",
      taxIncluded: true,
      allowOfflineSales: false,
    };
  else if (url.includes("/categories")) data = [category];
  else if (url.includes("/products"))
    data = [
      {
        id: "qa-product",
        name: "Artículo de prueba",
        categoryId: category.id,
        category,
        minStock: 0,
        variants: [
          {
            id: "qa-variant",
            sku: "QA001",
            stock: "5",
            price: "100",
            attributes: {},
          },
        ],
      },
    ];
  else if (url.includes("/terminals/register"))
    data = { id: "qa-terminal", status: "approved" };
  if (url.includes("/products")) data = { items: data, total: data.length };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await page.goto("http://127.0.0.1:4261/#pos");
await page.getByRole("button", { name: /Artículo de prueba/ }).click();
for (const label of [
  "Reducir Artículo de prueba",
  "Aumentar Artículo de prueba",
  "Quitar Artículo de prueba",
]) {
  const control = page.getByRole("button", { name: label, exact: true });
  const box = await control.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, label + ": objetivo 44px");
}
const search = page.getByRole("textbox", { name: "Buscar productos" });
await search.focus();
assert.equal(
  await search.evaluate((el) => getComputedStyle(el).outlineStyle),
  "solid",
);
await page.screenshot({
  path: "docs/capturas/P6-pos-claro-390.png",
  fullPage: false,
});
await page
  .getByRole("button", {
    name: "Activar modo oscuro",
  })
  .click();
await page.waitForTimeout(300);
await page.screenshot({
  path: "docs/capturas/P6-pos-oscuro-390.png",
  fullPage: false,
});
await page.goto("http://127.0.0.1:4261/#cash");
const open = page.getByRole("button", { name: "Abrir caja", exact: true });
await open.waitFor();
const box = await open.boundingBox();
assert.ok(box.width >= 44 && box.height >= 44, JSON.stringify(box));
await page.screenshot({
  path: "docs/capturas/P6-caja-390.png",
  fullPage: false,
});
await page.setViewportSize({ width: 320, height: 844 });
assert.ok(
  await page.evaluate(
    "document.documentElement.scrollWidth <= window.innerWidth",
  ),
  "Caja sin desbordamiento a320px",
);
await page.goto("http://127.0.0.1:4261/#pos");
await page.getByRole("button", { name: /^Artículo de prueba/ }).waitFor();
assert.ok(
  await page.evaluate(
    "document.documentElement.scrollWidth <= window.innerWidth",
  ),
  "POS sin desbordamiento a320px",
);
assert.deepEqual(errors, []);
process.stdout.write(
  "P6: controles de cantidad/quitar y abrir caja >=44px; foco sólido; claro/oscuro390px; 0 errores de página.\n",
);
await browser.close();

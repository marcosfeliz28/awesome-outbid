import { chromium } from "@playwright/test";
// Smoke visual aislado: API sintética, build de producción y sin datos reales.
// Ejecutar con Vite preview en 127.0.0.1:4261; no modifica tests/e2e.
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
await page.route("**/api/**", async (route) => {
  const url = route.request().url();
  let data = [];
  if (url.includes("/auth/refresh"))
    data = {
      accessToken: "local-visual-fixture",
      user: {
        id: "qa-u2",
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
  else if (url.includes("/dashboard/summary"))
    data = {
      revenue: 0,
      grossProfit: 0,
      inventoryRetail: 0,
      invoices: 0,
      ticketAverage: 0,
      daily: [],
      alerts: [],
      top: [],
      category: [],
      peakHours: [],
    };
  else if (url.includes("/terminals/register"))
    data = { id: "qa-terminal", status: "approved" };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await page.goto("http://127.0.0.1:4261/#dashboard");
await page.getByRole("heading", { name: /Hola,/ }).waitFor();
await page.screenshot({
  path: "docs/capturas/U2-resumen-390.png",
  fullPage: false,
});
await page.getByRole("button", { name: "Abrir menú" }).click();
assert.equal(
  await page
    .getByRole("button", { name: "Guía de estilos", exact: true })
    .count(),
  0,
);
await page.screenshot({
  path: "docs/capturas/U2-menu-390.png",
  fullPage: false,
});
await page.getByRole("button", { name: "Ver ayuda" }).click();
await page
  .getByText("Si tu tienda permite ventas sin internet", { exact: false })
  .waitFor();
await page.screenshot({
  path: "docs/capturas/U2-ayuda-390.png",
  fullPage: false,
});
await page.goto("http://127.0.0.1:4261/#styles");
await page.waitForFunction('location.hash !== "#styles"');
assert.equal(
  await page
    .getByRole("button", { name: "Guía de estilos", exact: true })
    .count(),
  0,
);
assert.deepEqual(errors, []);
process.stdout.write(
  "U2 producción: menú sin guía, hash styles redirige, ayuda útil; 390 px; 0 errores de página.",
);
await browser.close();

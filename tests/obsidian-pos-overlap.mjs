/* global document, innerWidth, window, Event */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { URL } from "node:url";
import { mkdirSync } from "node:fs";
import process from "node:process";
// Solo navegador local y fixtures: no inicia sesión ni opera una empresa real.
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  serviceWorkers: "block",
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
const asks = [];
const sourceQueries = [];
const writes = [];
let permissions = ["*"];
let summaryError = false;
let empty = false;
let askFailure = 0;
let role = "admin";
const day = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const base = process.env.LUMINA_TEST_URL || "http://127.0.0.1:4264";
const out =
  (process.env.LUMINA_OUT || "docs/capturas/obsidian-lumina-fase2") + "/";
mkdirSync(out, { recursive: true });
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  let data = [],
    status = 200;
  if (request.method() !== "GET") writes.push(url.pathname);
  if (url.pathname.endsWith("/auth/refresh"))
    data = {
      accessToken: "local-visual-fixture",
      user: {
        id: "qa-dashboard",
        name: "Elena · prueba visual",
        branchId: "qa-branch",
        role,
        permissions,
        sessionTimeoutMinutes: 30,
      },
    };
  else if (url.pathname.endsWith("/products"))
    data = {
      total: 1,
      items: [
        {
          id: "visual-product",
          name: "Producto de ejemplo",
          categoryId: "visual-category",
          category: { id: "visual-category", name: "General" },
          minStock: 1,
          variants: [
            {
              id: "visual-variant",
              sku: "EJEMPLO-01",
              stock: 12,
              price: 500,
              attributes: {},
            },
          ],
        },
      ],
    };
  else if (url.pathname.endsWith("/settings"))
    data = {
      name: "Negocio de ejemplo",
      branchName: "Sucursal de prueba",
      allowOfflineSales: false,
      taxIncluded: true,
    };
  else if (url.pathname.endsWith("/dashboard/summary")) {
    sourceQueries.push(url.search);
    if (summaryError) {
      status = 500;
      data = { message: "Reporte temporalmente no disponible." };
    } else
      data = {
        revenue: empty ? 0 : 12500,
        grossProfit: empty ? 0 : 4100,
        margin: 32.8,
        invoices: empty ? 0 : 25,
        ticketAverage: empty ? 0 : 500,
        inventoryRetail: 85000,
        previousYearRevenue: 10000,
        yearOverYear: 25,
        expenses: 100,
        fees: 20,
        netProfit: 3980,
        inventoryCost: 42000,
        daily: empty ? [] : [{ day: day, total: 12500 }],
        peakHours: [],
        top: empty
          ? []
          : [
              {
                name: "Producto de ejemplo",
                category: "General",
                units: 25,
                revenue: 12500,
              },
            ],
        category: empty
          ? []
          : [{ name: "General", color: "#8B5CF6", total: 12500 }],
        alerts: empty
          ? []
          : [
              {
                id: "alert-low",
                type: "low_stock",
                severity: "low",
                status: "new",
                message: "Referencia de prueba: revisar existencias.",
              },
              {
                id: "alert-high",
                type: "expense_budget",
                severity: "high",
                status: "seen",
                message:
                  "Presupuesto mensual de prueba: revisar gastos del período.",
              },
            ],
      };
  } else if (url.pathname.endsWith("/dashboard/year")) data = { months: [] };
  else if (url.pathname.endsWith("/assistant/usage"))
    data = { usadas: 3, limite: 100, mes: day.slice(0, 7) };
  else if (url.pathname.endsWith("/assistant/ask")) {
    asks.push(request.postDataJSON());
    if (askFailure) {
      status = askFailure;
      data = {
        message:
          askFailure === 429
            ? "Cuota de consultas agotada."
            : "El asistente no está activado en esta empresa.",
      };
    } else
      data = {
        answer:
          "Lectura simulada para verificar la interfaz. Fuente: reportes disponibles del " +
          day +
          ". Revisa las fechas antes de decidir.",
        remaining: 96,
        proposal: {
          factura: "NO-EJECUTAR",
          motivo: "propuesta sintética que no debe ejecutar el resumen",
        },
      };
  } else if (url.pathname.endsWith("/support-access"))
    data = { enabled: false, expiresAt: null };
  else if (url.pathname.endsWith("/onboarding")) data = { available: false };
  else if (url.pathname.endsWith("/terminals/register"))
    data = { id: "visual-terminal", status: "approved" };
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await page.goto(base + "/#dashboard");
await page.getByRole("heading", { name: "Tu día, en claro" }).waitFor();
await page.locator(".executive-metric").first().waitFor();
assert.equal(await page.locator(".executive-metric").count(), 4);
assert.equal(
  await page.getByLabel("Período del resumen").inputValue(),
  "today",
);
assert.ok(
  sourceQueries.some(
    (q) => q.includes("from=" + day) && q.includes("to=" + day),
  ),
);
assert.match(
  await page.locator(".executive-metric").first().innerText(),
  /12,500/,
);
assert.match(
  await page.locator(".daily-brief-facts").innerText(),
  /25 ventas completadas hoy/,
);
assert.match(
  await page.locator(".intelligent-alert-list li").first().innerText(),
  /Prioridad alta/,
);
assert.equal(asks.length, 0, "Cargar el tablero no consume IA");
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [390, 844],
]) {
  await page.setViewportSize({ width, height });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const motion of ["reduce", "no-preference"]) {
      await page.emulateMedia({ reducedMotion: motion });
      await page.screenshot({
        path: out + `hoy-marco-${width}x${height}-${theme}-${motion}.png`,
      });
    }
  }
}
await page.evaluate(() => {
  location.hash = "#pos";
});
await page.locator(".pos-shell").waitFor({ timeout: 12000 });
await page.locator(".product-card").first().waitFor({ timeout: 12000 });
await page.setViewportSize({ width: 390, height: 844 });
const customer = page.getByRole("button", { name: /Selecciona el cliente/ });
const launcher = page.getByRole("button", {
  name: "Pregúntale a Nexora",
  exact: true,
});
const a = await customer.boundingBox(),
  b = await launcher.boundingBox();
process.stdout.write(JSON.stringify({ customer: a, launcher: b }) + "\n");
assert.ok(a && b, "Ambos controles deben estar visibles");
assert.ok(
  a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y,
  "El asistente no debe cubrir el selector de cliente",
);
await customer.scrollIntoViewIfNeeded();
await customer.click();
await page.getByLabel("Buscar cliente").waitFor();
await page.keyboard.press("Escape");
await launcher.click();
await page
  .getByRole("dialog", { name: "Pregúntale a Nexora", exact: true })
  .waitFor();
await page.keyboard.press("Escape");
assert.equal(
  await launcher.evaluate((el) => el === document.activeElement),
  true,
  "El foco vuelve al asistente",
);
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [390, 844],
]) {
  await page.setViewportSize({ width, height });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const motion of ["reduce", "no-preference"]) {
      await page.emulateMedia({ reducedMotion: motion });
      await page.screenshot({
        path: out + `pos-${width}x${height}-${theme}-${motion}.png`,
      });
    }
  }
}
await browser.close();
process.stdout.write("Capturas Hoy y marco generadas con fixtures.\n");
process.exit(0);

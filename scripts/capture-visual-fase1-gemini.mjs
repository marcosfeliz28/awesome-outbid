/* global document, localStorage */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const base = "http://127.0.0.1:4268";
const root = resolve("apps/web/dist");
const state = process.env.VISUAL_STATE || "antes";
const only = process.env.VISUAL_POINT || "all";
const output = resolve("docs/diseno/obsidian-lumina/gemini-fase1");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, base).pathname;
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + "\\") && !file.startsWith(root + "/"))
      throw Error("boundary");
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(4268, "127.0.0.1", done));

const browser = await chromium.launch({ headless: true });
const user = {
  id: "visual-admin",
  name: "Administración de prueba",
  role: "admin",
  branchId: "visual-branch",
  permissions: ["*"],
  sessionTimeoutMinutes: 30,
};
const settings = {
  name: "Negocio de prueba",
  branchName: "Sucursal de prueba",
  taxIncluded: true,
  allowOfflineSales: false,
  ncfMode: "disabled",
  logo: null,
};
const warehouses = [
  { id: "store", name: "Tienda", kind: "store", sellable: true },
  { id: "home", name: "Almacén", kind: "home", sellable: false },
];
const stock = [
  {
    id: "variant-1",
    sku: "PRUEBA-001",
    barcode: "0000001",
    price: "18400",
    costAvg: "9200",
    stock: "12",
    totalStock: "18",
    attributes: { Presentación: "Unidad" },
    warehouseStocks: [{ warehouseId: "home", qty: "6" }],
    lots: [
      { id: "lot-1", lotNumber: "L-2026", qty: "12", expiryDate: "2027-10-27" },
    ],
    product: {
      id: "product-1",
      name: "Producto de prueba",
      minStock: "2",
      category: { requiresLot: true },
    },
  },
];

async function mockApi(page, authenticated) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === base
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    let status = 200;
    let json = [];
    if (path === "/auth/refresh") {
      if (authenticated) json = { user, accessToken: "visual-token" };
      else {
        status = 401;
        json = { message: "Sin sesión" };
      }
    } else if (path === "/settings") json = settings;
    else if (path === "/onboarding") json = { available: false };
    else if (path === "/support-access")
      json = { enabled: false, expiresAt: null };
    else if (path === "/terminals/register")
      json = { id: "visual-terminal", approved: true, active: true };
    else if (path === "/customers")
      json = [
        {
          id: "customer-1",
          name: "Cliente de referencia",
          phone: "8095550101",
          email: "cliente@example.invalid",
          legalId: "00100000001",
          purchases: 12,
          totalSpent: "18400",
          lastPurchase: "2026-10-26",
          debt: 0,
        },
      ];
    else if (path === "/reportes") json = [];
    else if (path.startsWith("/reports/sales"))
      json = {
        rows: [{ FECHA: "2026-10-26", VENTAS: 12, TOTAL: 18400 }],
        total: 1,
        limit: 25,
      };
    else if (path === "/inventory/stock") json = stock;
    else if (path === "/inventory/counts") json = [];
    else if (path === "/inventory/warehouses") json = warehouses;
    else if (path === "/inventory/location-report")
      json = [
        {
          variantId: "variant-1",
          product: "Producto de prueba",
          sku: "PRUEBA-001",
          store: "12",
          home: "6",
          total: "18",
          valueAtCost: "RD$ 165,600.00",
        },
      ];
    else if (path === "/inventory/transfers" || path === "/suppliers")
      json = [];
    else if (path === "/assistant/usage")
      json = { usadas: 2, limite: 100, mes: "2026-10" };
    else if (path === "/alerts") json = [];
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });
}

async function capture({
  point,
  screen,
  route = "dashboard",
  width,
  theme,
  login = false,
  assistant = false,
}) {
  if (only !== "all" && only !== point) return;
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    (selectedTheme) => localStorage.setItem("fitstore-theme", selectedTheme),
    theme,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await mockApi(page, !login);
  await page.goto(base + "/#" + route, { waitUntil: "networkidle" });
  if (login)
    await page
      .getByRole("heading", { name: /Un nuevo día para crecer/ })
      .waitFor();
  else await page.locator(".main-content").waitFor();
  if (assistant) {
    await page.getByRole("button", { name: "Pregúntale a Nexora" }).click();
    await page.getByRole("dialog", { name: "Pregúntale a Nexora" }).waitFor();
  }
  await page.evaluate(() => {
    const badge = document.createElement("div");
    badge.textContent = "DATOS FICTICIOS · CAPTURA LOCAL";
    Object.assign(badge.style, {
      position: "fixed",
      top: "4px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      padding: "3px 8px",
      borderRadius: "999px",
      background: "#fff4bd",
      color: "#292016",
      font: "700 10px Arial",
    });
    document.body.append(badge);
  });
  const folder = resolve(output, point, state);
  await mkdir(folder, { recursive: true });
  const size = width === 390 ? "390" : "1440";
  await page.screenshot({
    path: resolve(folder, `${screen}-${size}-${theme}.png`),
    fullPage: !assistant,
  });
  console.log("CAPTURA", point, state, screen, size, theme);
  await context.close();
}

try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      for (const [screen, route] of [
        ["clientes", "customers"],
        ["reportes", "reports"],
        ["configuracion", "settings"],
        ["inventario", "inventory"],
      ])
        await capture({ point: "F1-02", screen, route, width, theme });
      await capture({
        point: "F1-03",
        screen: "reportes-marca",
        route: "reports",
        width,
        theme,
      });
      await capture({
        point: "F1-04",
        screen: "portada",
        width,
        theme,
        login: true,
      });
      await capture({
        point: "F1-05",
        screen: "inventario-carga",
        route: "inventory",
        width,
        theme,
      });
      await capture({
        point: "F1-05",
        screen: "asistente",
        route: "inventory",
        width,
        theme,
        assistant: true,
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}

import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, screenshotPath } from "./apoyo";

test.use({ serviceWorkers: "block", reducedMotion: "reduce" });

const SESSION = "nexora-soporte-token";
const stage = process.env.LUMINA_CAPTURE_STAGE || "resultado";
const user = {
  id: "lumina-admin",
  name: "Administración visual",
  email: "visual@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: "lumina-branch",
};
const category = {
  id: "cat-lumina",
  name: "Bienestar",
  color: "#7C3AED",
  requiresLot: false,
  requiresExpiry: false,
  attributes: [],
};
const product = {
  id: "product-lumina",
  name: "Producto de referencia",
  sku: "LUM-001",
  brand: "Nexora",
  categoryId: category.id,
  category,
  minStock: "5",
  maxStock: "40",
  imageUrl: null,
  active: true,
  unit: "unidad",
  soldByUnit: true,
  variants: [
    {
      id: "variant-lumina",
      sku: "LUM-001-U",
      barcode: "746000000001",
      attributes: {},
      price: "1450",
      costAvg: "820",
      stock: "12",
      lots: [],
      active: true,
    },
  ],
};

async function mockApp(context: BrowserContext) {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/settings")
      return route.fulfill({
        json: {
          name: "Negocio de referencia",
          branchName: "Sucursal principal",
          taxIncluded: true,
          lowMargin: 15,
          allowCredit: true,
          allowOfflineSales: false,
          receiptWidth: "80",
          ncfEnabled: false,
        },
      });
    if (path === "/api/terminals/register")
      return route.fulfill({
        json: { id: "terminal-lumina", status: "approved" },
      });
    if (path === "/api/terminals")
      return route.fulfill({
        json: [
          {
            id: "terminal-lumina",
            name: "Equipo principal",
            status: "approved",
            identified: true,
            current: true,
            openCashes: [],
          },
        ],
      });
    if (path === "/api/products")
      return route.fulfill({ json: { items: [product], total: 1 } });
    if (path === "/api/categories") return route.fulfill({ json: [category] });
    if (path === "/api/inventory/stock")
      return route.fulfill({
        json: [
          {
            ...product.variants[0],
            product,
            warehouseStocks: [],
            totalStock: "12",
            homeStock: "0",
            sellableStock: "12",
            expiredStock: "0",
          },
        ],
      });
    if (path === "/api/inventory/warehouses")
      return route.fulfill({
        json: [
          {
            id: "warehouse-lumina",
            name: "Tienda",
            kind: "store",
            sellable: true,
          },
        ],
      });
    if (path === "/api/inventory/location-report")
      return route.fulfill({ json: [] });
    if (path === "/api/customers")
      return route.fulfill({
        json: [
          {
            id: "customer-lumina",
            name: "Cliente de referencia",
            phone: "809-555-0101",
            email: "cliente@example.invalid",
            taxId: null,
            notes: "Cliente frecuente",
            purchases: 4,
            totalSpent: 7250,
            lastPurchase: "2026-10-24T14:00:00.000Z",
          },
        ],
      });
    if (path === "/api/reportes") return route.fulfill({ json: [] });
    if (path.startsWith("/api/reports/"))
      return route.fulfill({
        json: {
          rows: [{ fecha: "2026-10-26", ventas: 12, total: 18400 }],
          total: 1,
          limit: 50,
        },
      });
    if (path === "/api/assistant/usage")
      return route.fulfill({
        json: { usadas: 7, limite: 100, mes: "2026-10" },
      });
    if (path === "/api/survey/summary")
      return route.fulfill({ json: { responses: 0, questions: [] } });
    if (path === "/api/backups/status")
      return route.fulfill({
        json: {
          configured: false,
          missing: [],
          redirectUri: "https://example.invalid/backups/google/callback",
          folderName: "Nexora POS respaldos",
          connected: false,
          needsReconnect: false,
          account: null,
          running: false,
          lastRun: null,
          lastSuccess: null,
          consecutiveFailures: 0,
          nextRunAt: null,
          telegramAlerts: false,
        },
      });
    if (path === "/api/support-access")
      return route.fulfill({ json: { enabled: false, expiresAt: null } });
    if (path === "/api/onboarding")
      return route.fulfill({ json: { available: false } });
    if (path === "/api/events") return route.fulfill({ status: 503, body: "" });
    if (request.method() === "GET") return route.fulfill({ json: [] });
    return route.fulfill({
      status: 404,
      json: { message: "No disponible en captura." },
    });
  });
}

async function open(page: Page, hash: string) {
  await page.addInitScript(
    ([key, value]) => sessionStorage.setItem(key, value),
    [SESSION, "sesion-visual-local"],
  );
  await page.goto("/#" + hash);
  await expect(page.locator(".main-content h1").first()).toBeVisible();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
}

const screens = [
  ["products", "catalogo"],
  ["inventory", "inventario"],
  ["customers", "clientes"],
  ["reports", "reportes"],
  ["settings", "configuracion"],
  ["merchandise", "mercancia"],
] as const;

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "movil", width: 390, height: 844 },
]) {
  test(`capturas Lumina B · ${viewport.name}`, async ({ page, context }) => {
    test.setTimeout(90000);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.addInitScript(() =>
      localStorage.setItem("fitstore-theme", "dark"),
    );
    await mockApp(context);
    for (const [hash, name] of screens) {
      await open(page, hash);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: screenshotPath(
          `docs/diseno/obsidian-lumina/adentro/${stage}-${name}-${viewport.name}.png`,
        ),
        fullPage: true,
      });
    }
    await open(page, "products");
    const launcher = page.getByRole("button", { name: "Pregúntale a Nexora" });
    // El asistente sólo se monta en la edición SaaS. La compilación local que
    // usa verify conserva el modo de tienda y, por contrato, no debe simularlo.
    if (await launcher.count()) {
      await expect(launcher).toBeVisible();
      await launcher.click();
      await expect(
        page.getByRole("dialog", { name: "Pregúntale a Nexora" }),
      ).toBeVisible();
      await page.screenshot({
        path: screenshotPath(
          `docs/diseno/obsidian-lumina/adentro/${stage}-asistente-${viewport.name}.png`,
        ),
        fullPage: true,
      });
    }
  });
}

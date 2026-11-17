/** DEMO local únicamente: respuestas API simuladas; nunca cobra ni escribe en un servidor. */
import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Product } from "../apps/web/src/api";
const category = {
  name: "Suplementos DEMO",
  color: "#188965",
  requiresLot: false,
};
const products: Product[] = [
  {
    id: "demo-protein",
    name: "Proteína DEMO",
    sku: "DEMO-001",
    brand: "DEMO",
    imageUrl: "",
    taxRate: "18",
    minStock: "2",
    maxStock: "100",
    categoryId: "demo-category",
    category,
    variants: [
      {
        id: "demo-variant",
        productId: "demo-protein",
        sku: "DEMO-001",
        barcode: "DEMO001",
        price: "118.00",
        stock: "20",
        attributes: { Presentación: "Demostración" },
      },
    ],
  },
  {
    id: "demo-empty",
    name: "Producto agotado DEMO",
    sku: "DEMO-002",
    brand: "DEMO",
    imageUrl: "",
    taxRate: "18",
    minStock: "2",
    maxStock: "100",
    categoryId: "demo-category",
    category,
    variants: [
      {
        id: "demo-empty-variant",
        productId: "demo-empty",
        sku: "DEMO-002",
        barcode: "DEMO002",
        price: "236.00",
        stock: "0",
        attributes: {},
      },
    ],
  },
];
const user = {
  id: "demo-cashier",
  name: "Operador DEMO",
  email: "demo@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: "demo-branch",
  sessionTimeoutMinutes: 30,
};
async function setup(page: Page, theme: "light" | "dark") {
  const blockedWrites: string[] = [];
  await page.addInitScript((theme) => {
    localStorage.setItem("fitstore-theme", theme);
    localStorage.setItem(
      "fitstore-equipment:demo-branch",
      JSON.stringify({
        id: "demo-terminal",
        name: "Terminal DEMO",
        secret: "not-a-real-secret-test-only",
      }),
    );
  }, theme);
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    // Fixtures must never leak requests to a remote API, image CDN or analytics.
    if (!["127.0.0.1", "localhost"].includes(url.hostname))
      return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let body: unknown;
    const path = url.pathname;
    if (path === "/api/auth/refresh" && req.method() === "POST")
      body = { user, accessToken: "demo-token-not-real" };
    else if (path === "/api/terminals/register" && req.method() === "POST")
      body = {
        id: "demo-terminal",
        name: "Terminal DEMO",
        approved: true,
        status: "approved",
      };
    else if (!["GET", "HEAD"].includes(req.method())) {
      blockedWrites.push(`${req.method()} ${path}`);
      return route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ error: "DEMO: writes disabled" }),
      });
    } else if (path === "/api/products")
      body = {
        items: url.searchParams.get("page") === "1" ? products : [],
        total: products.length,
      };
    else if (path === "/api/categories")
      body = [{ id: "demo-category", ...category }];
    else if (path === "/api/customers")
      body = [
        {
          id: "demo-customer",
          name: "Cliente DEMO",
          phone: "",
          email: "",
          legalId: "",
        },
      ];
    else if (path === "/api/cash-sessions")
      body = [
        {
          id: "demo-cash-session",
          userId: user.id,
          registerId: "demo-terminal",
          registerName: "Terminal DEMO",
          branchId: user.branchId,
          openedAt: new Date().toISOString(),
          closedAt: null,
          openingAmount: "0",
        },
      ];
    else if (path === "/api/settings")
      body = {
        name: "Tienda DEMO",
        currency: "DOP",
        taxIncluded: true,
        allowNegativeStock: false,
        sellerDiscountLimit: 10,
      };
    else if (
      [
        "/api/promotions",
        "/api/alerts",
        "/api/void-requests",
        "/api/credit-notes",
        "/api/branches",
        "/api/quotes",
      ].includes(path)
    )
      body = [];
    else
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: `No DEMO fixture for ${path}` }),
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/#pos");
  await expect(
    page.getByRole("textbox", { name: "Buscar productos", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(
    page.locator(".product-card").filter({ hasText: "Producto agotado DEMO" }),
  ).toBeDisabled();
  return blockedWrites;
}
async function addProduct(page: Page) {
  await page
    .locator(".product-card")
    .filter({
      has: page.getByRole("heading", { name: "Proteína DEMO", exact: true }),
    })
    .click();
  await expect(page.locator(".cart-item")).toHaveCount(1);
}
function amount(text: string | null) {
  return Number((text ?? "").replace(/[^\d.,-]/g, "").replaceAll(",", ""));
}
async function total(page: Page, value: number) {
  await expect
    .poll(async () =>
      amount(await page.locator(".cart-total strong").textContent()),
    )
    .toBe(value);
}
for (const width of [1440, 390])
  for (const theme of ["light", "dark"] as const)
    test(`Caja DEMO ${width} ${theme}: catálogo, carrito, sin desborde`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const blocked = await setup(page, theme);
      await addProduct(page);
      await total(page, 118);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
      await page.evaluate(() => document.fonts.ready);
      await mkdir("test-results/higgsfield-caja-visual/capturas", {
        recursive: true,
      });
      await page.screenshot({
        path: `test-results/higgsfield-caja-visual/capturas/caja-${width}-${theme}.png`,
        fullPage: true,
      });
      expect(blocked).toEqual([]);
    });
test("cantidad, descuento e ITBIS conservan aritmética: 2 × 118 menos 10% = 212.40", async ({
  page,
}) => {
  const blocked = await setup(page, "dark");
  await addProduct(page);
  await page
    .getByRole("button", { name: "Aumentar Proteína DEMO", exact: true })
    .click();
  await total(page, 236);
  await page
    .getByRole("spinbutton", {
      name: "Descuento de Proteína DEMO",
      exact: true,
    })
    .fill("10");
  await total(page, 212.4);
  const tax = page
    .locator(".cart-summary > div")
    .filter({ hasText: "ITBIS" })
    .locator("strong");
  await expect.poll(async () => amount(await tax.textContent())).toBe(32.4);
  await page
    .getByRole("button", { name: "Reducir Proteína DEMO", exact: true })
    .click();
  await total(page, 106.2);
  expect(blocked).toEqual([]);
});
test("F2/F4/F12 mantienen foco y diálogo: nunca confirmar pago", async ({
  page,
}) => {
  const blocked = await setup(page, "light");
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("textbox", { name: "Buscar productos", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("F4");
  const picker = page.getByRole("dialog", {
    name: "¿Para quién es esta venta?",
    exact: true,
  });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("button", { name: "Cliente DEMO", exact: true })
    .click();
  await addProduct(page);
  await page.keyboard.press("F12");
  const checkout = page.getByRole("dialog", {
    name: "Todo listo para cobrar",
    exact: true,
  });
  await expect(checkout).toBeVisible();
  await checkout.getByRole("button", { name: "Cerrar", exact: true }).click();
  await total(page, 118);
  expect(blocked).toEqual([]);
});
test("movimiento reducido no anima tarjeta al pasar mouse; teclado mantiene acceso", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page, "dark");
  const card = page.locator(".product-card.in-stock").first();
  await card.focus();
  await expect(card).toBeFocused();
  await card.hover();
  const motion = await card.evaluate((el) => ({
    duration: getComputedStyle(el).transitionDuration,
    animation: getComputedStyle(el).animationName,
  }));
  expect(
    motion.duration.split(",").every((value) => parseFloat(value) <= 0.01),
  ).toBe(true);
  expect(motion.animation).toBe("none");
});
test("preferencias e inglés mantienen la venta sin recargar ni cambiar total", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const blocked = await setup(page, "dark");
  await addProduct(page);
  await total(page, 118);
  await page.locator(".fc-preferences > summary").click();
  await page
    .getByRole("combobox", { name: "Idioma de la interfaz", exact: true })
    .selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Point of sale", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cart-total")).toContainText("Total due");
  await page.locator(".fusion-accent-blue").click();
  await expect(page.locator(".fusion-accent-blue")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("group", { name: "Checkout theme", exact: true })
    .getByRole("button", { name: "Black", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-overview-surface",
    "black",
  );
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await total(page, 118);
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("es");
  await expect(
    page.getByRole("heading", { name: "Punto de venta", exact: true }),
  ).toBeVisible();
  await total(page, 118);
  expect(blocked).toEqual([]);
});
for (const width of [1024, 1180, 1366, 1536])
  test(`cobro visible sin scroll ${width}x768`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await setup(page, "dark");
    await addProduct(page);
    const charge = page.locator(".cart-summary > .charge-button");
    const rect = await charge.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(768);
    const card = await page
      .locator(".product-card.in-stock")
      .first()
      .boundingBox();
    expect(card).not.toBeNull();
    expect(card!.y).toBeLessThan(768);
    await expect(page.locator(".cart-item-detail > strong")).toHaveText(
      "Proteína DEMO",
    );
  });

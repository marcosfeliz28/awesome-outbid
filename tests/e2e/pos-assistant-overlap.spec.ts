import { test as base, expect } from "./apoyo";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const test = base.extend<{ productUrl: string }>({
  productUrl: async ({ baseURL }, use) => {
    void baseURL;
    const root = resolve(process.cwd(), "apps/web");
    const requireWeb = createRequire(resolve(root, "package.json"));
    const vite = await import(pathToFileURL(requireWeb.resolve("vite")).href);
    const oldMode = process.env.VITE_PRODUCT_TENANCY;
    process.env.VITE_PRODUCT_TENANCY = "required";
    const server = await vite.createServer({
      root,
      server: { host: "127.0.0.1", port: 0, strictPort: true },
    });
    try {
      await server.listen();
      const address = server.httpServer.address();
      if (!address || typeof address === "string")
        throw new Error("No se pudo iniciar Vite local");
      await use(`http://127.0.0.1:${address.port}`);
    } finally {
      await server.close();
      if (oldMode === undefined) delete process.env.VITE_PRODUCT_TENANCY;
      else process.env.VITE_PRODUCT_TENANCY = oldMode;
    }
  },
});

test.use({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
  serviceWorkers: "block",
});

test("El asistente no tapa el cliente y su panel cabe en la caja móvil", async ({
  page,
  context,
  productUrl,
}) => {
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === productUrl
      ? route.continue()
      : route.abort(),
  );
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path.endsWith("/auth/refresh"))
      json = {
        accessToken: "local-visual-fixture",
        user: {
          id: "qa-dashboard",
          name: "Elena de prueba",
          branchId: "qa-branch",
          role: "admin",
          permissions: ["*"],
          sessionTimeoutMinutes: 30,
        },
      };
    else if (path.endsWith("/settings"))
      json = {
        name: "Negocio de ejemplo",
        branchName: "Sucursal de prueba",
        allowOfflineSales: false,
        taxIncluded: true,
      };
    else if (path.endsWith("/products"))
      json = {
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
    else if (path.endsWith("/terminals/register"))
      json = { id: "visual-terminal", status: "approved" };
    else if (path.endsWith("/onboarding")) json = { available: false };
    else if (path.endsWith("/support-access"))
      json = { enabled: false, expiresAt: null };
    else if (path.endsWith("/assistant/usage"))
      json = { usadas: 0, limite: 100, mes: "2026-10" };
    await route.fulfill({ json });
  });
  await page.goto(`${productUrl}/#pos`);
  await expect(page.locator(".product-card").first()).toBeVisible();
  const customer = page.getByRole("button", { name: /Selecciona el cliente/ });
  const launcher = page.getByRole("button", {
    name: "Pregúntale a Norexos",
    exact: true,
  });
  await expect(customer).toBeVisible();
  await expect(launcher).toBeVisible();
  const a = await customer.boundingBox(),
    b = await launcher.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(
    a!.x + a!.width <= b!.x ||
      b!.x + b!.width <= a!.x ||
      a!.y + a!.height <= b!.y ||
      b!.y + b!.height <= a!.y,
  ).toBe(true);
  await customer.scrollIntoViewIfNeeded();
  await customer.click();
  await expect(page.getByLabel("Buscar cliente")).toBeVisible();
  await page.keyboard.press("Escape");
  await launcher.click();
  const dialog = page.getByRole("dialog", {
    name: "Pregúntale a Norexos",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
});

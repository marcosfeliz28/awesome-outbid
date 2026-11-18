/** DEMO aislada. No certifica permisos del servidor. Bloquea toda mutación. */
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
for (const width of [1440, 390])
  for (const theme of ["light", "dark"]) {
    test(`Inventario ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const writes: string[] = [];
      const user = {
        id: "demo",
        name: "Inventario DEMO",
        role: "admin",
        branchId: "demo",
        permissions: ["*"],
      };
      await page.addInitScript(
        (theme) => localStorage.setItem("fitstore-theme", theme),
        theme,
      );
      await page.route("**/*", async (route) => {
        const r = route.request(),
          u = new URL(r.url()),
          p = u.pathname;
        if (!["localhost", "127.0.0.1"].includes(u.hostname))
          return route.abort();
        if (!p.startsWith("/api/")) return route.continue();
        let body: unknown = [];
        if (p === "/api/auth/refresh")
          body = { user, accessToken: "demo-not-real" };
        else if (p === "/api/terminals/register")
          body = { id: "demo", name: "DEMO", approved: true };
        else if (!["GET", "HEAD"].includes(r.method())) {
          writes.push(p);
          return route.fulfill({ status: 405, body: "DEMO writes blocked" });
        } else if (p === "/api/settings")
          body = { currency: "DOP", taxIncluded: true };
        else if (p === "/api/inventory/warehouses")
          body = [
            { id: "demo", name: "Tienda DEMO", kind: "store", sellable: true },
          ];
        else if (p === "/api/inventory/stock")
          body = [
            {
              id: "demo-stock",
              sku: "DEMO-001",
              barcode: "DEMO",
              attributes: {},
              price: "118.00",
              costAvg: "50",
              stock: "8",
              totalStock: "8",
              warehouseStocks: [],
              lots: [],
              product: {
                id: "demo-product",
                name: "Producto de demostración",
                minStock: 10,
              },
            },
          ];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      await page.goto("/#inventory");
      const section = page.locator(".fusion-inventory");
      await expect(section).toBeVisible();
      await expect(section).toContainText("Producto de demostración");
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      await mkdir("test-results/higgsfield-inventario", { recursive: true });
      await page.screenshot({
        path: `test-results/higgsfield-inventario/${width}-${theme}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Conteos físicos", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Stock actual", exact: true })
        .click();
      await expect(section).toContainText("Producto de demostración");
      expect(writes).toEqual([]);
    });
  }

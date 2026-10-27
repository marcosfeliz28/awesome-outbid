import { test, expect } from "./apoyo";

for (const theme of ["claro", "oscuro"] as const) {
  for (const state of ["vacío", "importe largo"] as const) {
    test(`la barra del carrito ${state} conserva texto y controles a 320 px (${theme})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      // Precios de prueba solo en la respuesta al navegador: no se cambia el catálogo.
      await page.route("**/api/products?*", async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        for (const product of data.items) {
          for (const variant of product.variants) variant.price = 999999999.99;
        }
        await route.fulfill({ response, json: data });
      });
      await page.goto("/");
      await page.getByLabel("Usuario").fill("admin@fitstore.demo");
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill("FitStore-Demo-2026!");
      await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
      await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
      if (theme === "oscuro")
        await page.getByRole("button", { name: "Activar modo oscuro" }).click();
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await page
        .locator(".sidebar")
        .getByRole("button", { name: "Punto de venta", exact: true })
        .click();

      const charge = page.locator(".pos-mobile-bar .pos-mobile-charge");
      const cart = page.locator(".pos-mobile-cart");
      const fits = async () =>
        charge.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const span = el.querySelector("span")!;
          const text = span.getBoundingClientRect();
          return {
            fits:
              text.left >= box.left &&
              text.right <= box.right &&
              text.top >= box.top &&
              text.bottom <= box.bottom &&
              span.scrollWidth <= span.clientWidth + 1 &&
              el.scrollWidth <= el.clientWidth + 1,
            width: box.width,
            height: box.height,
          };
        });
      if (state === "vacío") {
        await expect(charge).toHaveText(/Carrito vacío/);
        await expect(charge).toBeDisabled();
      } else {
        await page.locator(".product-card:not(:disabled)").first().click();
        const option = page.locator(".variant-option").first();
        if (await option.isVisible()) await option.click();
        await expect(charge).toBeEnabled();
        await expect(charge).toContainText("999,999,999.99");
      }
      await expect.poll(fits).toMatchObject({ fits: true });
      expect((await cart.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await charge.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      await cart.click();
      await expect(page.locator(".cart-items")).toBeInViewport();
    });
  }
}

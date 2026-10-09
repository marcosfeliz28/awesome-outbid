// U1 (reducido) · Total del punto de venta y barra del carrito.
// docs/coordinacion/PROMPT_UI_POS.md: el total es el texto más grande
// (Plus Jakarta Sans 28–32 px, negrita) y la lista del carrito muestra una
// barra fina (con ratón, la señal de que hay más artículos).
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}

for (const width of [390, 1280])
  test(`U1: total de 28 a 32 px y barra fina en el carrito a ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
    await login(page);
    await page.evaluate(() => (location.hash = "pos"));
    const total = page.locator(".cart-summary > .cart-total strong");
    await expect(total).toBeVisible();
    const style = await total.evaluate((e) => {
      const s = getComputedStyle(e);
      return {
        size: parseFloat(s.fontSize),
        family: s.fontFamily,
        weight: Number(s.fontWeight),
      };
    });
    expect(style.size).toBeGreaterThanOrEqual(28);
    expect(style.size).toBeLessThanOrEqual(32);
    expect(style.family).toContain("Plus Jakarta Sans");
    expect(style.weight).toBeGreaterThanOrEqual(700);
    const items = page.locator(".cart-items");
    await expect(items).toHaveCSS("scrollbar-width", "thin");
    await expect(items).toHaveCSS("overflow-y", "auto");
  });

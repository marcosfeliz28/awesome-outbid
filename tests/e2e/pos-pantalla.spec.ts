// W5 · El punto de venta cabe en el monitor de la caja sin tocar el zoom.
// Con la escala de Windows de 125 a 150 % la ventana CSS mide ~1280×720 o
// ~1366×768. Se exige: sin desborde horizontal, la primera tarjeta de producto
// y «Cobrar» a la vez en pantalla, el carrito entero dentro de la ventana, el
// carrito a la vista aunque se baje por el catálogo y letra legible.
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
async function open(page: Page, id: string) {
  await page.evaluate((hash) => (location.hash = hash), id);
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await expect(page.locator(".main-content h1").first()).toBeVisible();
}
const overflow = (page: Page) =>
  page.evaluate(() => ({
    page: document.documentElement.scrollWidth - innerWidth,
    main: (() => {
      const m = document.querySelector(".main-content") as HTMLElement;
      return m.scrollWidth - m.clientWidth;
    })(),
  }));
const inside = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = (
      document.querySelector(s) as HTMLElement
    ).getBoundingClientRect();
    return (
      r.left >= 0 &&
      r.top >= 0 &&
      r.right <= innerWidth &&
      r.bottom <= innerHeight
    );
  }, selector);

for (const [width, height] of [
  [1280, 720],
  [1366, 768],
  [1536, 864],
  [1024, 768],
]) {
  test(`W5: POS sin desborde y con catálogo y «Cobrar» a la vez a ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await login(page);
    await open(page, "pos");
    const card = page.locator(".product-card").first();
    const charge = page
      .locator(".cart-summary .charge-button:not(.pos-mobile-charge)")
      .first();
    await expect(card).toBeVisible();
    await expect(charge).toBeVisible();
    // Un nombre largo sin espacios y una categoría enorme no deben ensanchar.
    await page.evaluate(() => {
      const h3 = document.querySelector(".product-card h3");
      if (h3) h3.textContent = "X".repeat(120);
      const tab = document.querySelectorAll(".category-tabs button")[1];
      if (tab) tab.textContent = "Categoria".repeat(20);
    });
    expect(await overflow(page)).toEqual({ page: 0, main: 0 });
    expect(await inside(page, ".product-card")).toBe(true);
    expect(await inside(page, ".cart-summary .charge-button")).toBe(true);
    // El carrito completo (hasta «Limpiar») cabe en la ventana.
    expect(await inside(page, ".cart-panel")).toBe(true);
    // Bajando por el catálogo, el carrito y «Cobrar» siguen a la vista.
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect
      .poll(() => inside(page, ".cart-summary .charge-button"))
      .toBe(true);
    expect(await inside(page, ".cart-panel")).toBe(true);
    // Letra legible: nada de 8–10 px en el nombre del producto y el carrito.
    const sizes = await page.evaluate(() =>
      [
        ".product-info h3",
        ".product-bottom strong",
        ".cart-summary > .cart-total span",
        ".cart-heading h2",
      ].map((s) =>
        parseFloat(getComputedStyle(document.querySelector(s)!).fontSize),
      ),
    );
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(12);
  });
}

for (const [width, height] of [
  [1280, 720],
  [1366, 768],
])
  for (const id of [
    "pos",
    "cash",
    "products",
    "merchandise",
    "dashboard",
    "settings",
  ])
    test(`W5: «${id}» sin desborde horizontal a ${width}×${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await login(page);
      await open(page, id);
      expect(await overflow(page)).toEqual({ page: 0, main: 0 });
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll(".main-content *")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            if (!r.width || r.right <= innerWidth + 1) return false;
            // Lo que desplaza dentro de su propia tabla o carril es válido.
            for (let p = e.parentElement; p; p = p.parentElement)
              if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX))
                return false;
            return true;
          })
          .slice(0, 3)
          .map((e) => e.className || e.tagName),
      );
      expect(wide).toEqual([]);
    });

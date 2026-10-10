// U1 · Capturas del punto de venta a 390 y 1280 px, en claro y oscuro.
//
// Usa la aplicación compilada contra una API local con la semilla de
// demostración (pnpm db:seed): nada de datos reales.
//
//   pnpm build && pnpm --filter @fitstore/api start         (API en :3001)
//   pnpm --filter @fitstore/web exec vite preview --port 4173
//   node scripts/capturas-u1.mjs
//
// Variables: NEXORA_URL (por defecto http://127.0.0.1:4173), SEED_DEMO_PASSWORD
// (la de la semilla) y NEXORA_CAPTURAS (carpeta de salida, por defecto
// docs/capturas). Escribe U1-pos-{390,1280}-{claro,oscuro}.png.
// Globales del navegador usadas dentro de page.evaluate:
/* global document, localStorage, location */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const base = process.env.NEXORA_URL || "http://127.0.0.1:4173";
const password = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const out = process.env.NEXORA_CAPTURAS || "docs/capturas";
const login = "admin@fitstore.demo";
await mkdir(out, { recursive: true });

// Seis variantes con existencias de la semilla, para que el carrito tenga
// más líneas de las que caben y se vea la barra de desplazamiento.
const api = async (path, options = {}) => {
  const response = await fetch(base + "/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error(path + ": " + response.status);
  return response.json();
};
const { accessToken } = await api("/auth/login", {
  method: "POST",
  body: JSON.stringify({ login, password }),
});
const { items } = await api("/products", {
  headers: { Authorization: "Bearer " + accessToken },
});
const skus = items
  .filter((p) => !p.category?.requiresLot)
  .flatMap((p) => p.variants)
  .filter((v) => Number(v.stock) > 2)
  .slice(0, 6)
  .map((v) => v.sku);
if (skus.length < 6)
  throw new Error("La semilla no tiene 6 variantes con stock.");

// Sin --hide-scrollbars (Playwright lo pone en modo headless): la captura
// debe mostrar la barra del carrito como la ve la cajera.
const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--hide-scrollbars"],
});
// Un solo equipo (contexto) para las cuatro capturas: la caja se abre una vez
// y queda en este equipo; el tema y el ancho cambian entre capturas.
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
});
try {
  const page = await context.newPage();
  await page.goto(base + "/");
  await page.getByLabel("Usuario").fill(login);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await page.getByRole("heading", { name: /Hola,/ }).waitFor();
  await page.evaluate(() => (location.hash = "cash"));
  await page.locator(".main-content h1").first().waitFor();
  await page
    .locator(".main-content .loading")
    .waitFor({ state: "detached" })
    .catch(() => {});
  const open = page.getByRole("button", { name: "Abrir caja", exact: true });
  if (await open.isVisible()) {
    await open.click();
    await page.getByLabel("Efectivo inicial").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
  }
  await page.getByText("Caja abierta", { exact: true }).waitFor();
  for (const [theme, label] of [
    ["light", "claro"],
    ["dark", "oscuro"],
  ])
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
      await page.evaluate(
        (value) => localStorage.setItem("fitstore-theme", value),
        theme,
      );
      await page.evaluate(() => (location.hash = "pos"));
      await page.reload();
      await page.locator(".product-card").first().waitFor();
      const search = page.getByLabel("Buscar productos");
      if ((await page.locator(".cart-item").count()) !== skus.length) {
        const clear = page.getByRole("button", {
          name: "Limpiar",
          exact: true,
        });
        if (await clear.isEnabled()) await clear.click();
        for (const [index, sku] of skus.entries()) {
          await search.fill(sku);
          await search.press("Enter");
          await page.locator(".cart-item").nth(index).waitFor();
        }
      }
      await search.fill("");
      // Sin el aviso de «agregado» ni el foco del buscador en la captura.
      await page.mouse.move(0, 0);
      await page
        .locator(".toast")
        .waitFor({ state: "detached", timeout: 15000 })
        .catch(() => {});
      await page.evaluate(() => document.activeElement?.blur?.());
      const file = join(out, `U1-pos-${width}-${label}.png`);
      // En el celular el carrito va debajo del catálogo: se lleva a la vista.
      if (width < 600)
        await page
          .locator(".cart-panel")
          .evaluate((e) => e.scrollIntoView({ block: "end" }));
      await page.screenshot({ path: file });
      console.log("Captura " + file);
    }
} finally {
  await context.close();
  await browser.close();
}

/* global document, window */
// Ronda 7 · la caja con el inventario real de la tienda (616 productos).
// Requiere: base cargada con apps/api/scripts/import-inventario.ts, la API en
// el puerto 3001 apuntando a esa base y la PWA compilada (vite preview, 4173).
// Uso: TIENDA_EMAIL=… TIENDA_PASSWORD=… node caja-con-inventario.mjs
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";

const base = process.env.FITSTORE_WEB_URL ?? "http://127.0.0.1:4173";
const out = new URL("./", import.meta.url).pathname;
mkdirSync(out + "capturas", { recursive: true });
const result = { checks: {} };
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [
    ["pc", { width: 1440, height: 900 }],
    ["cel", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/");
    await page.getByLabel("Correo electrónico").fill(process.env.TIENDA_EMAIL);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(process.env.TIENDA_PASSWORD);
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    await page.getByRole("heading", { name: /Hola,/ }).waitFor();
    if (label === "cel")
      await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    const open = page.getByRole("button", { name: "Abrir caja", exact: true });
    if (await open.isVisible().catch(() => false)) {
      await open.click();
      await page.getByLabel("Efectivo inicial").fill("1000");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
    }
    if (label === "cel")
      await page.getByRole("button", { name: "Abrir menú" }).click();
    await page
      .getByRole("button", { name: "Punto de venta", exact: true })
      .click();
    const search = page.getByLabel("Buscar productos");
    await search.waitFor();
    await page.locator(".product-card").first().waitFor();
    const r = {};
    r.caption = await page.locator(".catalog-caption span").first().innerText();
    r.cardsRendered = await page.locator(".product-card").count();
    // Código del inventario + Enter agrega el producto al carrito.
    const t0 = Date.now();
    await search.fill("1002");
    await search.press("Enter");
    await page.locator(".cart-item").first().waitFor();
    r.codeEnterMs = Date.now() - t0;
    r.cartAfterCode = await page
      .locator(".cart-item strong")
      .first()
      .innerText();
    // Palabras sueltas, sin acentos ni orden.
    for (const q of [
      "iso100 vanilla",
      "moira 275n",
      "cinturilla 2xs",
      "proteina whey",
    ]) {
      await search.fill(q);
      r["search:" + q] = await page.locator(".product-card").count();
    }
    await search.fill("moira foundation");
    const name = await page.locator(".product-card h3").first().innerText();
    r.cardNameShowsTone = /\d{3}N|\d{3}/.test(name);
    r.cardName = name;
    await page.screenshot({ path: out + `capturas/${label}-busqueda.png` });
    await search.fill("");
    await page.screenshot({ path: out + `capturas/${label}-caja.png` });
    r.horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    r.jsErrors = errors;
    result.checks[label] = r;
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    out + "caja-con-inventario.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}

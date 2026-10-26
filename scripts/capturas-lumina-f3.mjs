// Obsidian Lumina F3 · capturas de Catálogo, Inventario, Clientes, Reportes y
// Configuración a 1366x768 y 390x844, en tema oscuro, con la semilla de demostración.
//
//   node scripts/capturas-lumina-f3.mjs --fase antes|despues [--web http://127.0.0.1:4186]
//
// No arranca nada: necesita la web compilada (vite preview) con su API y la base
// con `pnpm db:seed` ya en marcha (ver docs/diseno/OBSIDIAN_LUMINA_F3_CAPTURAS.md).
// Variables: SEED_DEMO_PASSWORD (la de la semilla). Usuario: admin@fitstore.demo.
// Salida: docs/diseno/obsidian-lumina/f3/<fase>-<pantalla>-<desktop|mobile>.png
/* global document, localStorage, location, window */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const fase = arg("fase");
const web = (arg("web", "http://127.0.0.1:4186") ?? "").replace(/\/$/, "");
const login = "admin@fitstore.demo";
const password = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
if (!["antes", "despues"].includes(fase))
  fail("Falta --fase antes|despues.");
if (/:(3001|4173|5432)(\/|$)/.test(web))
  fail("Ese puerto es el de la tienda real; usa uno propio (p. ej. 4186).");
const out = "docs/diseno/obsidian-lumina/f3";
const pantallas = [
  ["catalogo", "products"],
  ["inventario", "inventory"],
  ["clientes", "customers"],
  ["reportes", "reports"],
  ["configuracion", "settings"],
];
const vistas = [
  ["desktop", { width: 1366, height: 768 }],
  ["mobile", { width: 390, height: 844 }],
];

function fail(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}

try {
  const r = await fetch(web + "/");
  if (!r.ok) throw new Error("HTTP " + r.status);
} catch (e) {
  fail(`No responde ${web} (${e.message}). Inicia la web de vista previa y la API.`);
}
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: vistas[0][1],
  deviceScaleFactor: 1,
  serviceWorkers: "block",
});
let faltan = 0;
try {
  const page = await context.newPage();
  await context.addInitScript(() => localStorage.setItem("fitstore-theme", "dark"));
  await page.goto(web + "/");
  await page.getByLabel("Usuario").fill(login);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  try {
    await page.getByRole("heading", { name: /Hola,/ }).waitFor({ timeout: 20000 });
  } catch {
    fail("No se pudo entrar como " + login + ": ¿la base tiene la semilla y SEED_DEMO_PASSWORD es la correcta?");
  }
  for (const [vista, size] of vistas)
    for (const [nombre, hash] of pantallas) {
      await page.setViewportSize(size);
      await page.evaluate((h) => (location.hash = h), hash);
      await page.reload();
      await page.locator(".main-content h1").first().waitFor({ timeout: 20000 });
      // Sin esqueletos ni «Cargando» (datos ya visibles).
      await page
        .locator(".skeleton, .table-skeleton, .main-content .loading")
        .first()
        .waitFor({ state: "detached", timeout: 20000 })
        .catch(() => console.warn(`AVISO ${nombre}/${vista}: sigue habiendo esqueleto/cargando.`));
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.locator(".toast").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.evaluate(() => window.scrollTo(0, 0));
      const ancho = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      if (ancho[0] > ancho[1])
        console.warn(`AVISO ${nombre}/${vista}: desplazamiento horizontal (scrollWidth ${ancho[0]} > innerWidth ${ancho[1]}).`);
      const file = join(out, `${fase}-${nombre}-${vista}.png`);
      try {
        await page.screenshot({ path: file });
        console.log("Captura " + file);
      } catch (e) {
        faltan++;
        console.error("FALTA " + file + ": " + e.message);
      }
    }
} finally {
  await context.close();
  await browser.close();
}
if (faltan) process.exit(1);

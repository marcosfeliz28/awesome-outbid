// Deja a la cajera con caja abierta y una venta de contado hecha hoy (copia local).
import { lanzar, contexto, entrar, abrirCaja, ventaEfectivo } from "./ayudas.mjs";

const browser = await lanzar();
const ctx = await contexto(browser, 1366);
const page = await ctx.newPage();
page.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url()));
await entrar(page, "cajera");
console.log("caja abierta ahora:", await abrirCaja(page));
await ventaEfectivo(page);
await page.screenshot({ path: process.argv[2] || "/tmp/qa-venta.png" });
await browser.close();

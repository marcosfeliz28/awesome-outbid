// Selector ES/EN de la portada pública: dos botones, textos del hero en ambos idiomas y
// cambio de idioma con el atributo lang. La elección se guarda solo en este navegador.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync("apps/web/public/venta/index.html", "utf8");

it("la portada ofrece selector ES/EN con los textos del hero en ambos idiomas", () => {
  expect(html).toMatch(/data-idioma="es"[^>]*aria-pressed/);
  expect(html).toMatch(/data-idioma="en"[^>]*aria-pressed/);
  expect(html).toMatch(/data-en="Sell with clarity\. Decide with data\."/);
  expect(html).toMatch(/data-en="Quiero probarlo gratis|Try it free/);
});

it("el cambio de idioma actualiza lang y guarda la elección sin romper si no hay almacenamiento", () => {
  expect(html).toMatch(/document\.documentElement\.lang\s*=/);
  expect(html).toMatch(/try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/);
});

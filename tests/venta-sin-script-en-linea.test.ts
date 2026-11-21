// La CSP de la web (script-src 'self') bloquea todo <script> en línea: la portada /venta/
// solo puede cargar scripts propios con src (Lighthouse: "Executing inline script violates...").
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync("apps/web/public/venta/index.html", "utf8");

it("/venta/index.html no tiene <script> en línea ni manejadores on*", () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  expect(scripts.length).toBeGreaterThan(0);
  for (const [, attrs, body] of scripts) {
    expect(attrs).toMatch(/\bsrc="[^"]+"/);
    expect(body.trim()).toBe("");
  }
  expect(html).not.toMatch(/\son[a-z]+\s*=/i);
});

it("cada script usa ruta absoluta /venta/ y existe (con /venta sin barra, una ruta relativa pediría el .js en la raíz)", () => {
  for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
    expect(src).toMatch(/^\/venta\/[\w.-]+\.js$/);
    expect(existsSync(`apps/web/public${src}`)).toBe(true);
  }
});

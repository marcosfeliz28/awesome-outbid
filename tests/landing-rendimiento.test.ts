// Rendimiento de la portada: el script no bloquea el render, toda imagen declara sus dimensiones
// (evita saltos de maquetación) y las no visibles al cargar van con lazy.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync("apps/web/public/venta/index.html", "utf8");

it("el script de WhatsApp no bloquea el render", () => {
  expect(html).toMatch(
    /<script src="whatsapp\.js"[^>]*\bdefer\b[^>]*><\/script>/,
  );
});

it("toda imagen declara width y height, y las que no están en el primer pantallazo usan lazy", () => {
  const imagenes = html.match(/<img\b[^>]*>/g) ?? [];
  for (const img of imagenes) {
    expect(img, img).toMatch(/\swidth=/);
    expect(img, img).toMatch(/\sheight=/);
    if (!/fetchpriority="high"/.test(img))
      expect(img, img).toMatch(/loading="lazy"/);
  }
});

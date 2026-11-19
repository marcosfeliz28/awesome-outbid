import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const bloque = css.slice(css.indexOf("/* F2-03:"));

it("F2-03: miniatura translúcida, botón + de 44 px y Cobrar con jerarquía", () => {
  expect(bloque).toMatch(/\.product-image\s*\{[^}]*backdrop-filter/);
  expect(bloque).toMatch(
    /\.add-product\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/,
  );
  expect(bloque).toMatch(/\.charge-button\s*\{[^}]*min-height:\s*60px/);
  expect(bloque).toContain("prefers-reduced-motion");
});

it("F2-03: no cambia las etiquetas de cobro que buscan las pruebas e2e", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  expect(pos).toContain("aria-label={`Cobrar ${formatMoney(total)}`}");
  expect(pos).toContain("<kbd>F12</kbd>");
});

it("CP-12: las tres acciones inferiores del carrito caben con el mismo ancho en escritorio", () => {
  const fusion = readFileSync("apps/web/src/fusion-caja-higgsfield.css", "utf8");
  expect(fusion).toMatch(
    /@media \(min-width: 601px\) \{[\s\S]*?\.cart-bottom-actions \{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  );
});

it("CP-13: el buscador usa una ayuda breve que cabe en 390 px", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  expect(pos).toContain('placeholder={t("Buscar producto o código")}');
});

it("CP-14: las cuatro acciones superiores del POS permanecen en una fila móvil", () => {
  const fusion = readFileSync("apps/web/src/fusion-caja-higgsfield.css", "utf8");
  expect(fusion).toMatch(
    /@media \(max-width: 600px\) \{[\s\S]*?\.heading-actions \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(0, 1\.2fr\) repeat\(2, 44px\)/,
  );
});

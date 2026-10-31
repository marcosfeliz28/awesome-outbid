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

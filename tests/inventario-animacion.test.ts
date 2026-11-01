import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const merchandise = readFileSync("apps/web/src/Merchandise.tsx", "utf8");
const inventoryImport = readFileSync(
  "apps/web/src/InventoryImport.tsx",
  "utf8",
);

// Orden 98 · pieza 5: animación de inventario y mercancía (tarjetas, estados
// vacíos, confirmación y vista previa de la importación). Solo CSS: transform y
// opacity, tokens --nx-dur-*, prefers-reduced-motion apaga todo. Bloque propio
// al final de styles.css.
const start = css.indexOf("/* Orden 98 · pieza 5");
const bloque = start > -1 ? css.slice(start) : "";

describe("Inventario y mercancía · animación", () => {
  it("el bloque de animación de inventario existe al final de styles.css", () => {
    expect(
      start,
      "falta el bloque «Orden 98 · pieza 5» en styles.css",
    ).toBeGreaterThan(-1);
  });

  it("las clases que animamos existen en Merchandise.tsx e InventoryImport.tsx", () => {
    expect(merchandise).toMatch(/className="panel goods-card"/);
    expect(merchandise).toMatch(/className="goods-empty"/);
    expect(merchandise).toMatch(/className="goods-done"/);
    expect(inventoryImport).toMatch(/className="inv-preview"/);
    expect(inventoryImport).toMatch(/className="inv-ok"/);
  });

  it("la entrada de inventario anima solo opacity y transform", () => {
    const k = bloque.indexOf("@keyframes inventario-enter");
    expect(k).toBeGreaterThan(-1);
    const body = bloque.slice(k, bloque.indexOf("\n}\n", k));
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(props)).toEqual(new Set(["opacity", "transform"]));
  });

  it("tarjetas, estados y avisos entran con tokens de movimiento y sin duraciones sueltas", () => {
    expect(bloque).toMatch(
      /\.goods-card,\s*\.goods-empty,\s*\.goods-done,\s*\.inv-preview,\s*\.inv-ok,\s*\.inv-warn,\s*\.inv-error \{\s*animation:\s*inventario-enter var\(--nx-dur-slow\) var\(--nx-ease-out\) backwards;/,
    );
    expect(bloque).not.toMatch(/animation:[^;]*\b\d+ms\b[^;]*;/);
  });

  it("las tarjetas consecutivas entran escalonadas", () => {
    expect(bloque).toMatch(
      /\.goods-card \+ \.goods-card \{\s*animation-delay: 60ms;/,
    );
    expect(bloque).toMatch(
      /\.goods-card \+ \.goods-card \+ \.goods-card \{\s*animation-delay: 120ms;/,
    );
  });

  it("prefers-reduced-motion apaga la entrada de inventario", () => {
    const m = bloque.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/,
    );
    expect(
      m,
      "falta el bloque de movimiento reducido de inventario",
    ).toBeTruthy();
    const reducido = m ? m[0] : "";
    expect(reducido).toMatch(/\.goods-card,/);
    expect(reducido).toMatch(/\.inv-error \{\s*animation: none;/);
  });

  it("no toca POS, carrito, cobro, caja ni teclado", () => {
    expect(bloque).not.toMatch(
      /pos|carrito|cart|cobro|checkout|caja|keyboard|F2|F4|F8|F12/i,
    );
  });

  it("la prueba está en la lista de vitest", () => {
    const config = readFileSync("vitest.config.ts", "utf8");
    expect(config).toMatch(/"tests\/inventario-animacion\.test\.ts"/);
  });
});

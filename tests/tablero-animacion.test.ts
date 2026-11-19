import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const dashboard = readFileSync("apps/web/src/Dashboard.tsx", "utf8");

// Orden 98 · pieza 2: animación del tablero (KPIs, franja de KPIs y alertas).
// Solo CSS: transform y opacity, tokens --nx-dur-*, hover de 2 px y
// prefers-reduced-motion que apaga todo. Bloque propio al final de styles.css.
const start = css.indexOf("/* Orden 98 · pieza 2");
const bloque = start > -1 ? css.slice(start) : "";

describe("Tablero · animación y pistas", () => {
  it("el bloque de animación del tablero existe al final de styles.css", () => {
    expect(
      start,
      "falta el bloque «Orden 98 · pieza 2» en styles.css",
    ).toBeGreaterThan(-1);
  });

  it("la grilla de KPIs del tablero tiene su propia clase (no la de reportes)", () => {
    expect(dashboard).toMatch(/className="kpi-grid tablero-kpis"/);
  });

  it("la entrada del tablero anima solo opacity y transform", () => {
    const k = bloque.indexOf("@keyframes tablero-enter");
    expect(k).toBeGreaterThan(-1);
    const body = bloque.slice(k, bloque.indexOf("\n}\n", k));
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(props)).toEqual(new Set(["opacity", "transform"]));
  });

  it("KPIs, franja y alertas entran con tokens de movimiento y sin duraciones sueltas", () => {
    expect(bloque).toMatch(
      /\.tablero-kpis > \.kpi-card,\s*\.kpi-strip > \.kpi-strip-card,\s*\.dashboard-alerts > \.dashboard-alert \{\s*animation:\s*tablero-enter var\(--nx-dur-slow\) var\(--nx-ease-out\) backwards;/,
    );
    expect(bloque).not.toMatch(/animation:[^;]*\b\d+ms\b[^;]*;/);
  });

  it("el escalonado usa retrasos con nth-child en las tarjetas y las alertas", () => {
    expect(bloque).toMatch(
      /\.tablero-kpis > \.kpi-card:nth-child\(4\)[^{]*\{\s*animation-delay:/,
    );
    expect(bloque).toMatch(
      /\.kpi-strip > \.kpi-strip-card:nth-child\(3\)[^{]*\{\s*animation-delay:/,
    );
    expect(bloque).toMatch(
      /\.dashboard-alerts > \.dashboard-alert:nth-child\(2\)[^{]*\{\s*animation-delay:/,
    );
  });

  it("las tarjetas suben 2 px al pasar el cursor, con transición corta", () => {
    expect(bloque).toMatch(
      /\.tablero-kpis > \.kpi-card:hover,\s*\.kpi-strip > \.kpi-strip-card:hover \{\s*transform: translateY\(-2px\);/,
    );
    expect(bloque).toMatch(
      /transition:\s*transform var\(--nx-dur-fast\) var\(--nx-ease-out\);/,
    );
  });

  it("prefers-reduced-motion apaga la entrada, la transición y el hover del tablero", () => {
    const m = bloque.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/,
    );
    expect(
      m,
      "falta el bloque de movimiento reducido del tablero",
    ).toBeTruthy();
    const reducido = m ? m[0] : "";
    expect(reducido).toMatch(
      /\.dashboard-alerts > \.dashboard-alert \{\s*animation: none;/,
    );
    expect(reducido).toMatch(/transition: none;/);
    expect(reducido).toMatch(/:hover \{\s*transform: none;/);
  });

  it("no toca POS, carrito, cobro, caja ni teclado", () => {
    expect(bloque).not.toMatch(
      /pos|carrito|cart|cobro|checkout|caja|keyboard|F2|F4|F8|F12/i,
    );
  });

  it("la prueba está en la lista de vitest", () => {
    const config = readFileSync("vitest.config.ts", "utf8");
    expect(config).toMatch(/"tests\/tablero-animacion\.test\.ts"/);
  });
});

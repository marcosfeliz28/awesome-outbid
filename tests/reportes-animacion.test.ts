import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const monthReport = readFileSync("apps/web/src/MonthReport.tsx", "utf8");

// Orden 98 · pieza 3: animación de reportes y desglose del mes (tarjetas,
// periodo, top 10 y filas). Solo CSS: transform y opacity, tokens --nx-dur-* y
// --nx-stagger-*, hover de 2 px y prefers-reduced-motion que apaga todo. Bloque
// propio al final de styles.css. Todo queda detrás de .reporte-animado: el
// desglose de venta y ganancia (MonthReport) no lleva esa clase, así que no se anima.
const start = css.indexOf("/* Orden 98 · pieza 3");
const bloque = start > -1 ? css.slice(start) : "";

// Reglas CSS del bloque (sin @keyframes ni @media): selector y cuerpo.
function reglas(texto: string) {
  const out: { selectores: string[]; cuerpo: string }[] = [];
  for (const m of texto.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (sel.startsWith("@") || /^(from|to|\d+%)$/.test(sel)) continue;
    out.push({ selectores: sel.split(",").map((s) => s.trim()), cuerpo: m[2] });
  }
  return out;
}

describe("Reportes y desglose · animación", () => {
  it("el bloque de animación de reportes existe al final de styles.css", () => {
    expect(
      start,
      "falta el bloque «Orden 98 · pieza 3» en styles.css",
    ).toBeGreaterThan(-1);
  });

  it("MonthReport no lleva el interruptor .reporte-animado (venta y ganancia no se animan)", () => {
    expect(monthReport).not.toMatch(/reporte-animado/);
  });

  it("toda regla animada exige el ancestro .reporte-animado", () => {
    const animadas = reglas(bloque).filter((r) =>
      /animation/.test(r.cuerpo),
    );
    expect(animadas.length, "no hay reglas animadas en el bloque").toBeGreaterThan(0);
    for (const r of animadas) {
      for (const s of r.selectores) {
        expect(s, `selector sin .reporte-animado: ${s}`).toMatch(
          /^\.reporte-animado /,
        );
      }
    }
  });

  it("la entrada de reportes anima solo opacity y transform", () => {
    const k = bloque.indexOf("@keyframes reporte-enter");
    expect(k).toBeGreaterThan(-1);
    const body = bloque.slice(k, bloque.indexOf("\n}\n", k));
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(props)).toEqual(new Set(["opacity", "transform"]));
  });

  it("tarjetas, periodo, top 10 y filas entran con tokens de movimiento y sin duraciones sueltas", () => {
    expect(bloque).toMatch(
      /\.reporte-animado \.kpi-grid > \.kpi-card,\s*\.reporte-animado \.panel \{\s*animation:\s*reporte-enter var\(--nx-dur-slow\) var\(--nx-ease-out\) backwards;/,
    );
    expect(bloque).toMatch(
      /\.reporte-animado tbody tr \{\s*animation:\s*reporte-enter var\(--nx-dur-base\) var\(--nx-ease-out\) backwards;/,
    );
    expect(bloque).not.toMatch(/animation:[^;]*\b\d+ms\b[^;]*;/);
  });

  it("el escalonado usa retrasos con nth-child en las tarjetas y las filas", () => {
    expect(bloque).toMatch(
      /\.reporte-animado \.kpi-grid > \.kpi-card:nth-child\(4\)[^{]*\{\s*animation-delay:/,
    );
    expect(bloque).toMatch(
      /\.reporte-animado tbody tr:nth-child\(3\)[^{]*\{\s*animation-delay:/,
    );
  });

  it("el escalonado sale de tokens --nx-stagger-* y no de milisegundos sueltos", () => {
    expect(bloque).toMatch(
      /:root \{\s*--nx-stagger-tarjeta: 60ms;\s*--nx-stagger-fila: 24ms;\s*\}/,
    );
    expect(bloque).not.toMatch(/animation-delay:[^;]*\b\d+ms\b/);
    expect(bloque).not.toMatch(/animation-delay:\s*\d/);
    expect(bloque).toMatch(
      /\.reporte-animado \.kpi-grid > \.kpi-card:nth-child\(6\) \{\s*animation-delay: calc\(var\(--nx-stagger-tarjeta\) \* 5\);/,
    );
    expect(bloque).toMatch(
      /\.reporte-animado tbody tr:nth-child\(6\) \{\s*animation-delay: calc\(var\(--nx-stagger-fila\) \* 5\);/,
    );
  });

  it("las tarjetas suben 2 px al pasar el cursor, con transición corta", () => {
    expect(bloque).toMatch(
      /\.reporte-animado \.kpi-grid > \.kpi-card:hover \{\s*transform: translateY\(-2px\);/,
    );
    expect(bloque).toMatch(
      /transition:\s*transform var\(--nx-dur-fast\) var\(--nx-ease-out\);/,
    );
  });

  it("prefers-reduced-motion apaga la entrada, la transición y el hover de reportes", () => {
    const m = bloque.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/,
    );
    expect(
      m,
      "falta el bloque de movimiento reducido de reportes",
    ).toBeTruthy();
    const reducido = m ? m[0] : "";
    expect(reducido).toMatch(/\.reporte-animado \.panel,/);
    expect(reducido).toMatch(/\.reporte-animado tbody tr \{\s*animation: none;/);
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
    expect(config).toMatch(/"tests\/reportes-animacion\.test\.ts"/);
  });
});

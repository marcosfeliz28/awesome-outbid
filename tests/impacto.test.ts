import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countFrame, COUNT_MS } from "../apps/web/src/impacto";

const css = readFileSync("apps/web/src/impacto.css", "utf8");
const main = readFileSync("apps/web/src/main.tsx", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");
const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
const keyframes = [...css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g)];

// Capa «Modo visual: Impacto» (9-nov-2026): solo apariencia, apagada por
// defecto, nunca en la caja y apagada con movimiento reducido.
describe("Impacto · cifras que cuentan", () => {
  it("termina en el texto exacto (el dinero mostrado no cambia)", () => {
    for (const text of ["RD$ 9,650.00", "RD$ 0.00", "1,284", "96", "Sin datos"])
      expect(countFrame(text, 1)).toBe(text);
  });
  it("empieza en cero y conserva prefijo, decimales y miles", () => {
    expect(countFrame("RD$ 412,850.00", 0)).toBe("RD$ 0.00");
    expect(countFrame("1,284", 0)).toBe("0");
    const middle = countFrame("RD$ 412,850.00", 0.5);
    expect(middle).toMatch(/^RD\$ \d{1,3}(,\d{3})*\.\d{2}$/);
  });
  it("crece sin pasarse del valor final", () => {
    const value = (t: number) =>
      Number(countFrame("RD$ 1,000.00", t).replace(/[^\d.]/g, ""));
    let last = -1;
    for (let t = 0; t <= 1; t += 0.1) {
      expect(value(t)).toBeGreaterThanOrEqual(last);
      expect(value(t)).toBeLessThanOrEqual(1000);
      last = value(t);
    }
  });
  it("dura lo mismo que el token CSS --nx-dur-cuenta", () => {
    expect(css).toContain(`--nx-dur-cuenta: ${COUNT_MS}ms;`);
  });
});

describe("Impacto · contrato de la hoja", () => {
  it("las animaciones solo mueven transform y opacity", () => {
    expect(keyframes.length).toBeGreaterThan(4);
    for (const [, name, body] of keyframes) {
      const props = new Set(
        [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]),
      );
      for (const p of props)
        expect(["transform", "opacity"], `${name} anima ${p}`).toContain(p);
    }
    expect(css).not.toMatch(
      /transition:[^;]*\b(width|height|margin|top|left)\b/,
    );
  });
  it("nada se aplica a la caja: toda regla de la app excluye .pos-shell", () => {
    const appRules = [
      ...css.matchAll(/^:root\[data-visual="impacto"\] \.app-shell([^{]*)\{/gm),
    ];
    expect(appRules.length).toBeGreaterThan(5);
    for (const [rule] of appRules)
      expect(rule).toContain(".app-shell:not(.pos-shell)");
    expect(css).not.toMatch(/pos-content|cart|\.pos-(?!shell)/);
    expect(pos).not.toMatch(/impacto|CountUp|withTransition/);
  });
  it("viene apagada y entrar o salir de la caja nunca espera una transición", () => {
    expect(main).toContain(
      "document.documentElement.dataset.visual = readVisual();",
    );
    expect(app).toMatch(/id === "pos" \|\| page === "pos"/);
  });
  it("prefers-reduced-motion apaga cada animación de la capa", () => {
    const reduced = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced.length).toBeGreaterThan(50);
    for (const sel of [
      ".recharts-wrapper::after",
      ".loading-skeleton i::after",
      ".empty-art .flota",
      ".login-page::before",
      "::view-transition-new(nx-vista)",
      ".tabs button::after",
    ])
      expect(reduced, sel).toContain(sel);
  });
  it("las duraciones salen de tokens, no sueltas", () => {
    const uses = [...css.matchAll(/(?:animation|transition):([^;]+);/g)].map(
      (m) => m[1]!,
    );
    const loose = uses.filter((u) => /\b\d+ms\b/.test(u) && !/var\(/.test(u));
    expect(loose).toEqual([]);
  });
});

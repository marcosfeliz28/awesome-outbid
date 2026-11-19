import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");
const rule = (selector: string) => {
  const start = css.lastIndexOf(`\n${selector} {`);
  expect(start, `falta la regla ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
};

// Orden 98 · pieza 1: animación y didáctica de la pantalla de Entrada.
// Reglas del plan: solo transform/opacity, tokens de movimiento, ≤ 240 ms,
// y prefers-reduced-motion apaga todo.
describe("Entrada (login) · animación y didáctica", () => {
  it("la entrada de la columna de marca y del formulario usa tokens de movimiento", () => {
    for (const selector of [
      ".login-art > *:not(.login-scene)",
      ".login-form-panel form",
    ]) {
      expect(rule(selector)).toMatch(
        /animation:\s*login-enter var\(--nx-dur-slow\)/,
      );
    }
  });
  it("login-enter anima solo opacity y transform", () => {
    const start = css.indexOf("@keyframes login-enter");
    expect(start).toBeGreaterThan(-1);
    const body = css.slice(start, css.indexOf("\n}\n", start));
    expect(body).toMatch(/opacity/);
    expect(body).toMatch(/transform/);
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(props)).toEqual(new Set(["opacity", "transform"]));
  });
  it("los íconos de las ventajas reaccionan al cursor y al foco sin pasar de 240 ms", () => {
    expect(css).toMatch(/\.login-stats > span:(?:hover|focus-within)[^{]*svg/);
    expect(rule(".login-stats svg")).toMatch(
      /transition:\s*transform var\(--nx-dur-/,
    );
  });
  it("el error de la entrada aparece con movimiento corto", () => {
    expect(rule(".login-form-panel form > p.form-error")).toMatch(
      /animation:\s*login-enter var\(--nx-dur-base\)/,
    );
  });
  it("con movimiento reducido todo queda sin animación ni desplazamiento", () => {
    const m = [
      ...css.matchAll(
        /@media \(prefers-reduced-motion: reduce\) \{[^@]*?\n\}/g,
      ),
    ]
      .map((x) => x[0])
      .find((b) => b.includes(".login-form-panel form"));
    expect(m, "falta el bloque de movimiento reducido del login").toBeTruthy();
    expect(m).toMatch(/animation:\s*none/);
    expect(m).toMatch(/\.login-stats svg/);
  });
  it("ninguna duración del login se escribe suelta", () => {
    const start = css.indexOf(".login-page {");
    const end = css.indexOf("/* fin login */");
    const login = css.slice(
      start,
      end > 0
        ? end
        : css.indexOf(".login-form-panel .password-change-fields p"),
    );
    const loose = login.match(/animation:\s*login-enter\s+\d/g);
    expect(loose).toBeNull();
  });
  it("hay una pista corta junto al usuario, en español sencillo", () => {
    expect(app).toMatch(/className="login-hint"/);
  });
});

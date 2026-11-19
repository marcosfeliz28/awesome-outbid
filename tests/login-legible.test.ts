import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const block = (selector: string) => {
  const start = css.lastIndexOf(`${selector} {`);
  expect(start, `falta la regla ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
};

// Hallazgos bajos de la auditoría de usuario (31-oct): letra de 14 px y foco
// poco visible en la pantalla de entrada.
describe("Entrada (login) · letra y foco", () => {
  it.each([
    ".login-art p",
    ".login-stats > span",
    ".login-form-panel form > p",
    ".login-form-panel .field",
  ])("%s usa la letra base de 16 px", (selector) => {
    expect(block(selector)).toMatch(/font-size:\s*var\(--fs-base\)/);
  });
  it("el foco de los campos tiene un contorno visible, no solo una sombra tenue", () => {
    const focus = block(".login-form-panel .field input:focus-visible");
    expect(focus).toMatch(/outline:\s*3px solid/);
    expect(focus).not.toMatch(/outline:\s*none/);
  });
  it("el botón y el enlace de mostrar contraseña también muestran foco", () => {
    expect(css).toMatch(
      /\.login-form-panel (?:\.button|\.show-password)[^{]*:focus-visible/,
    );
  });
});

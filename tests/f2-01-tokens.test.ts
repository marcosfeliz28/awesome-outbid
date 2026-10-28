import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RUTA = "packages/ui/src/tokens.css";

it("define los tokens en tres capas: base, semántica y componente", () => {
  expect(existsSync(RUTA)).toBe(true);
  const css = readFileSync(RUTA, "utf8");
  expect(css).toMatch(/\/\* capa 1: base \*\//);
  expect(css).toMatch(/\/\* capa 2: semántica \*\//);
  expect(css).toMatch(/\/\* capa 3: componente \*\//);
});

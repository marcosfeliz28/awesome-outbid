import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("calidad 9-nov · documentación de entrada", () => {
  const readme = readFileSync("README.md", "utf8");

  it("nombra el producto vigente y declara con precisión el límite fiscal", () => {
    expect(readme.startsWith("# Norexos POS\n")).toBe(true);
    expect(readme).toContain("no emite NCF/e-CF");
    expect(readme).not.toContain("Aplicación de demostración");
    expect(readme).not.toContain("No se ha publicado un servidor externo");
  });

  it("separa el arranque de desarrollo de la operación real", () => {
    expect(readme).toContain("## Desarrollo local");
    expect(readme).toMatch(/No uses el `seed` sobre datos\s+reales/);
  });
});

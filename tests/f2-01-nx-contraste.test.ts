import { describe, it, expect } from "vitest";
import { razonContraste, cumpleAA } from "../packages/ui/src/nx-contraste";

describe("nx-contraste", () => {
  it("calcula la razón de contraste entre negro y blanco", () => {
    expect(razonContraste("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(razonContraste("#ffffff", "#ffffff")).toBe(1);
  });

  it("rechaza colores que no son hex de 6 dígitos", () => {
    expect(() => razonContraste("#00000", "#ffffff")).toThrowError(
      "Color inválido",
    );
    expect(() => razonContraste("#000000", "#fffff")).toThrowError(
      "Color inválido",
    );
  });

  it("cumple AA para texto normal solo con razón 4.5 o más", () => {
    expect(cumpleAA("#000000", "#ffffff", "normal")).toBe(true);
    expect(cumpleAA("#777777", "#ffffff", "normal")).toBe(false);
  });

  it("cumple AA para texto grande con razón 3 o más", () => {
    expect(cumpleAA("#000000", "#ffffff", "grande")).toBe(true);
    expect(cumpleAA("#777777", "#ffffff", "grande")).toBe(true);
  });
});

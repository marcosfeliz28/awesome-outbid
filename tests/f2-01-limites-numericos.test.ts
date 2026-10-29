import { describe, it, expect } from "vitest";
import { siguienteFoco } from "../packages/ui/src/nx-foco-ciclico";
import { razonContraste, cumpleAA } from "../packages/ui/src/nx-contraste";

describe("límites de nx-foco-ciclico", () => {
  it("un solo elemento: siempre vuelve a 0", () => {
    expect(siguienteFoco(0, 1, 1)).toBe(0);
    expect(siguienteFoco(0, 1, -1)).toBe(0);
  });

  it("índice igual al total se trata como fuera de rango", () => {
    expect(siguienteFoco(3, 3, 1)).toBe(0);
    expect(siguienteFoco(3, 3, -1)).toBe(2);
  });

  it("total negativo devuelve -1", () => {
    expect(siguienteFoco(0, -2, 1)).toBe(-1);
  });
});

describe("límites de nx-contraste", () => {
  it("el mismo color da razón 1", () => {
    expect(razonContraste("#336699", "#336699")).toBe(1);
  });

  it("acepta mayúsculas y minúsculas en el hex", () => {
    expect(razonContraste("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(razonContraste("#ffffff", "#000000")).toBeCloseTo(21, 2);
  });

  it("rechaza hex de 3 dígitos o sin #", () => {
    expect(() => razonContraste("#fff", "#000000")).toThrowError(
      "Color inválido",
    );
    expect(() => razonContraste("ffffff", "#000000")).toThrowError(
      "Color inválido",
    );
  });

  it("el umbral se cumple exactamente en 4.5 y 3", () => {
    expect(cumpleAA("#767676", "#ffffff", "normal")).toBe(true);
    expect(cumpleAA("#777777", "#ffffff", "grande")).toBe(true);
  });
});

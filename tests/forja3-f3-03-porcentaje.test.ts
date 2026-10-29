import { describe, it, expect } from "vitest";
import { formatearPorcentaje } from "../packages/ui/src/nx-porcentaje";

describe("formatearPorcentaje (F3-03)", () => {
  it("español usa coma decimal y espacio antes del %", () => {
    expect(formatearPorcentaje(15, 0)).toBe("15 %");
    expect(formatearPorcentaje(12.5, 2)).toBe("12,50 %");
  });

  it("inglés pega el % y usa punto decimal", () => {
    expect(formatearPorcentaje(15, 0, "en")).toBe("15%");
  });

  it("cero y -0 se ven igual", () => {
    expect(formatearPorcentaje(0, 0)).toBe("0 %");
    expect(formatearPorcentaje(-0, 0)).toBe("0 %");
  });

  it("negativos llevan signo", () => {
    expect(formatearPorcentaje(-5, 1)).toBe("-5,0 %");
  });

  it("los decimales se ajustan al rango 0 a 4", () => {
    expect(formatearPorcentaje(1, 9)).toBe("1,0000 %");
    expect(formatearPorcentaje(1, -2)).toBe("1 %");
  });

  it("NaN da una raya", () => {
    expect(formatearPorcentaje(NaN, 0)).toBe("—");
  });
});

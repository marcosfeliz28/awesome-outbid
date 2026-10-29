import { describe, it, expect } from "vitest";
import { clasificarAncho } from "../packages/ui/src/nx-breakpoint";

describe("nx-breakpoint", () => {
  it("clasifica menos de 768 como móvil, también 0 y negativos", () => {
    expect(clasificarAncho(390)).toBe("movil");
    expect(clasificarAncho(767)).toBe("movil");
    expect(clasificarAncho(0)).toBe("movil");
    expect(clasificarAncho(-5)).toBe("movil");
  });

  it("clasifica de 768 a 1199 como tableta", () => {
    expect(clasificarAncho(768)).toBe("tableta");
    expect(clasificarAncho(1199)).toBe("tableta");
  });

  it("clasifica desde 1200 como escritorio", () => {
    expect(clasificarAncho(1200)).toBe("escritorio");
    expect(clasificarAncho(1440)).toBe("escritorio");
  });
});

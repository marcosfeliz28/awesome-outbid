import { describe, it, expect } from "vitest";
import { plural } from "../packages/ui/src/nx-plural";

const formas = { uno: "resultado", otros: "resultados" };

describe("nx-plural", () => {
  it("usa la forma singular solo para 1", () => {
    expect(plural(1, formas)).toBe("resultado");
  });

  it("usa la forma plural para 0, 2 y negativos", () => {
    expect(plural(0, formas)).toBe("resultados");
    expect(plural(2, formas)).toBe("resultados");
    expect(plural(-1, formas)).toBe("resultados");
  });

  it("usa la forma plural para fracciones", () => {
    expect(plural(1.5, formas)).toBe("resultados");
  });
});

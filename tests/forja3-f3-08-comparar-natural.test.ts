import { describe, it, expect } from "vitest";
import { compararNatural } from "../packages/ui/src/nx-comparar-natural";

describe("compararNatural (F3-08)", () => {
  it("item2 va antes que item10", () => {
    expect(compararNatural("item2", "item10")).toBeLessThan(0);
  });
  it("ignora mayúsculas y acentos", () => {
    expect(compararNatural("Árbol", "arbol")).toBe(0);
  });
  it("el vacío va antes que cualquier texto", () => {
    expect(compararNatural("", "a")).toBeLessThan(0);
  });
});

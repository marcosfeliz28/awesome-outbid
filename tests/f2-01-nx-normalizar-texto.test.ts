import { describe, it, expect } from "vitest";
import { normalizarTexto } from "../packages/ui/src/nx-normalizar-texto";

describe("nx-normalizar-texto", () => {
  it("pasa a minúsculas y quita tildes", () => {
    expect(normalizarTexto("México")).toBe("mexico");
    expect(normalizarTexto("ÁRBOL")).toBe("arbol");
    expect(normalizarTexto("pingüino")).toBe("pinguino");
  });

  it("conserva la ñ como ñ", () => {
    expect(normalizarTexto("Ñandú")).toBe("ñandu");
    expect(normalizarTexto("año")).toBe("año");
  });

  it("devuelve cadena vacía para cadena vacía", () => {
    expect(normalizarTexto("")).toBe("");
  });
});

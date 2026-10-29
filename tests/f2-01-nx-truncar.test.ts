import { describe, it, expect } from "vitest";
import { truncar } from "../packages/ui/src/nx-truncar";

describe("nx-truncar", () => {
  it("devuelve el texto igual si cabe", () => {
    expect(truncar("Hola mundo", 20)).toBe("Hola mundo");
  });

  it("corta en el último espacio dentro del límite, incluido el puntos suspensivos", () => {
    expect(truncar("uno dos tres cuatro", 10)).toBe("uno dos…");
  });

  it("no excede el límite cuando el espacio cae justo en la posición máxima", () => {
    const r = truncar("abcde fgh", 5);
    expect(r).toBe("abcd…");
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it("corta sin espacio y añade puntos suspensivos", () => {
    expect(truncar("abcdefghij", 5)).toBe("abcd…");
  });

  it("no parte un par de surrogados (emoji)", () => {
    expect(truncar("😀😀😀", 5)).toBe("😀😀…");
    expect(truncar("😀😀😀", 4)).toBe("😀…");
  });
});

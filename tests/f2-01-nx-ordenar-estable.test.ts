import { describe, it, expect } from "vitest";
import { ordenarEstable } from "../packages/ui/src/nx-ordenar-estable";

describe("nx-ordenar-estable", () => {
  it("ordena por clave con locale es (ñ después de n, tildes junto a su letra)", () => {
    const r = ordenarEstable(
      [{ n: "Zeta" }, { n: "Ñandú" }, { n: "Nube" }, { n: "Árbol" }],
      (x) => x.n,
    );
    expect(r.map((x) => x.n)).toEqual(["Árbol", "Nube", "Ñandú", "Zeta"]);
  });

  it("es estable: claves iguales conservan el orden original", () => {
    const r = ordenarEstable(
      [
        { k: "a", i: 1 },
        { k: "b", i: 2 },
        { k: "a", i: 3 },
        { k: "a", i: 4 },
      ],
      (x) => x.k,
    );
    expect(r.map((x) => x.i)).toEqual([1, 3, 4, 2]);
  });

  it("deja los nulos e indefinidos al final, en su orden original", () => {
    const r = ordenarEstable(
      [
        { k: null, i: 1 },
        { k: "b", i: 2 },
        { k: undefined, i: 3 },
        { k: "a", i: 4 },
      ],
      (x) => x.k,
    );
    expect(r.map((x) => x.i)).toEqual([4, 2, 1, 3]);
  });

  it("no modifica la lista original y maneja la lista vacía", () => {
    const original = [{ k: "b" }, { k: "a" }];
    ordenarEstable(original, (x) => x.k);
    expect(original.map((x) => x.k)).toEqual(["b", "a"]);
    expect(ordenarEstable([], (x: { k: string }) => x.k)).toEqual([]);
  });
});

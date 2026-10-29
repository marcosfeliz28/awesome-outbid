import { describe, it, expect } from "vitest";
import { copiarSinAliasing } from "../packages/ui/src/nx-copia-segura";

describe("nx-copia-segura", () => {
  it("copia en profundidad sin compartir referencias", () => {
    const o = { a: 1, b: { c: [1, 2, { d: "x" }] }, e: null };
    const c = copiarSinAliasing(o);
    expect(c).toEqual(o);
    expect(c.b).not.toBe(o.b);
    expect(c.b.c).not.toBe(o.b.c);
    (c.b.c[2] as { d: string }).d = "y";
    expect((o.b.c[2] as { d: string }).d).toBe("x");
  });

  it("acepta primitivos, null y arreglos", () => {
    expect(copiarSinAliasing(5)).toBe(5);
    expect(copiarSinAliasing("hola")).toBe("hola");
    expect(copiarSinAliasing(null)).toBeNull();
    expect(copiarSinAliasing([1, [2]])).toEqual([1, [2]]);
  });

  it("falla claro con funciones", () => {
    expect(() => copiarSinAliasing({ f: () => 1 })).toThrow(/función/);
  });

  it("falla claro con ciclos", () => {
    const o: Record<string, unknown> = {};
    o.yo = o;
    expect(() => copiarSinAliasing(o)).toThrow(/ciclo/);
  });

  it("falla claro con undefined, símbolos, bigint y valores no finitos", () => {
    expect(() => copiarSinAliasing({ u: undefined })).toThrow(/JSON/);
    expect(() => copiarSinAliasing({ n: NaN })).toThrow(/JSON/);
    expect(() => copiarSinAliasing({ n: 1n })).toThrow(/JSON/);
  });

  it("un objeto repetido sin ciclo (diamante) no cuenta como ciclo", () => {
    const x = { v: 1 };
    const c = copiarSinAliasing({ a: x, b: x });
    expect(c.a).toEqual({ v: 1 });
    expect(c.a).not.toBe(c.b);
  });

  it("rechaza tipos que no son JSON simple (Date, Map, Set) en vez de copiarlos como {}", () => {
    expect(() => copiarSinAliasing({ fecha: new Date() })).toThrowError(
      /objeto no plano/,
    );
    expect(() => copiarSinAliasing({ m: new Map([["a", 1]]) })).toThrowError(
      /objeto no plano/,
    );
    expect(() => copiarSinAliasing(new Set([1]))).toThrowError(
      /objeto no plano/,
    );
  });
});

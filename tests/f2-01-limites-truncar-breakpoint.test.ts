import { describe, it, expect } from "vitest";
import { truncar } from "../packages/ui/src/nx-truncar";
import { clasificarAncho } from "../packages/ui/src/nx-breakpoint";

describe("nx-truncar: casos límite", () => {
  it("con límite 0 o negativo devuelve vacío", () => {
    expect(truncar("hola", 0)).toBe("");
    expect(truncar("hola", -3)).toBe("");
  });

  it("con límite 1 devuelve solo los puntos suspensivos", () => {
    expect(truncar("hola mundo", 1).length).toBeLessThanOrEqual(1);
    expect(truncar("hola mundo", 1)).toBe("…");
  });

  it("texto vacío y texto que ya cabe quedan igual", () => {
    expect(truncar("", 5)).toBe("");
    expect(truncar("hola", 4)).toBe("hola");
  });

  it("corta antes de la palabra que no cabe y el … cuenta dentro del límite", () => {
    expect(truncar("hola mundo", 5)).toBe("hola…");
    expect(truncar("hola mundo", 5).length).toBeLessThanOrEqual(5);
  });

  it("no parte un par de surrogados (emoji)", () => {
    expect(truncar("ab😀cd", 4)).toBe("ab…");
  });
});

describe("nx-breakpoint: casos límite", () => {
  it("valores no finitos cuentan como móvil", () => {
    expect(clasificarAncho(NaN)).toBe("movil");
    expect(clasificarAncho(Infinity)).toBe("movil");
  });

  it("los cortes caen en 768 y 1200", () => {
    expect(clasificarAncho(767.9)).toBe("movil");
    expect(clasificarAncho(768)).toBe("tableta");
    expect(clasificarAncho(1199)).toBe("tableta");
    expect(clasificarAncho(1200)).toBe("escritorio");
  });

  it("anchos de referencia 390 y 1440", () => {
    expect(clasificarAncho(390)).toBe("movil");
    expect(clasificarAncho(1440)).toBe("escritorio");
  });
});

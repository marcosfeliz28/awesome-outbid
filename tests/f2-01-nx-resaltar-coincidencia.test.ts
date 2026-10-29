import { describe, it, expect } from "vitest";
import { resaltarCoincidencia } from "../packages/ui/src/nx-resaltar-coincidencia";

describe("nx-resaltar-coincidencia", () => {
  it("marca la coincidencia sin importar acentos ni mayúsculas", () => {
    expect(resaltarCoincidencia("Café con leche", "cafe")).toEqual([
      { texto: "Café", coincide: true },
      { texto: " con leche", coincide: false },
    ]);
  });

  it("la ñ coincide con n y la búsqueda ñ coincide con la n", () => {
    expect(resaltarCoincidencia("Niño", "NIN")).toEqual([
      { texto: "Niñ", coincide: true },
      { texto: "o", coincide: false },
    ]);
  });

  it("marca cada aparición y une las partes de igual tipo", () => {
    expect(resaltarCoincidencia("ab ab", "ab")).toEqual([
      { texto: "ab", coincide: true },
      { texto: " ", coincide: false },
      { texto: "ab", coincide: true },
    ]);
  });

  it("la búsqueda vacía no marca nada", () => {
    expect(resaltarCoincidencia("Café", "")).toEqual([{ texto: "Café", coincide: false }]);
  });

  it("los caracteres de regex se buscan literalmente", () => {
    expect(resaltarCoincidencia("a.*b c", "a.*b")).toEqual([
      { texto: "a.*b", coincide: true },
      { texto: " c", coincide: false },
    ]);
    expect(resaltarCoincidencia("axb", "a.b")).toEqual([{ texto: "axb", coincide: false }]);
  });

  it("un texto vacío da cero partes y las partes reconstruyen el texto original", () => {
    expect(resaltarCoincidencia("", "a")).toEqual([]);
    const texto = "Ñandú y Café 🍕";
    const partes = resaltarCoincidencia(texto, "cafe");
    expect(partes.map((p) => p.texto).join("")).toBe(texto);
  });
});

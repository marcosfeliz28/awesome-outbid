import { describe, expect, it } from "vitest";
import {
  checkDigitCedula,
  checkDigitRnc,
  isCedulaValida,
  isRncValido,
} from "./cedula-rnc";

describe("dígito verificador de la cédula (módulo 10)", () => {
  it("calcula el dígito de 0011234567", () => {
    // productos: 0,0,1,2,2,6,4,(5×2→1),(6×1),(7×2→5) = 27; (10−27%10)%10 = 3.
    expect(checkDigitCedula("0011234567")).toBe(3);
  });
});

describe("dígito verificador del RNC (módulo 11)", () => {
  it("calcula el dígito del RNC 1-30-22250-9", () => {
    // 1×7+3×9+0+2×6+2×5+2×4+5×3+0 = 79; 79 mod 11 = 2; 11−2 = 9.
    expect(checkDigitRnc("13022250")).toBe(9);
  });
  it("residuo 0 → dv 11 → 1", () => {
    expect(checkDigitRnc("00000000")).toBe(1);
  });
  it("residuo 1 → dv 10 → 0", () => {
    // 1×7+3×9 = 34; 34 mod 11 = 1; dv = 10 → 0.
    expect(checkDigitRnc("13000000")).toBe(0);
  });
});

describe("isCedulaValida", () => {
  it.each([
    ["001-1234567-3", true],
    ["00112345673", true],
    ["001-1234567-4", false], // dígito verificador erróneo
    ["0011234567", false], // faltan dígitos
    ["00112345673x", true], // los guiones/letras se ignoran; quedan 11 dígitos válidos
    ["", false],
  ])("cédula %j → %s", (value, expected) => {
    expect(isCedulaValida(value)).toBe(expected);
  });
});

describe("isRncValido", () => {
  it.each([
    ["130222509", true],
    ["1-30-22250-9", true],
    ["130222508", false], // dígito verificador erróneo
    ["13022250", false], // faltan dígitos
    ["1302225099", false], // sobran dígitos
    ["", false],
  ])("RNC %j → %s", (value, expected) => {
    expect(isRncValido(value)).toBe(expected);
  });
});

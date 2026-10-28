import { describe, expect, it } from "vitest";
import {
  formatMoneyRD,
  formatFechaDDMMAAAA,
  formatNcf,
  formatTelefonoRD,
  formatCedula,
} from "./index";

describe("format · dinero RD$", () => {
  it.each([
    [0, "RD$ 0.00"],
    [9, "RD$ 9.00"],
    [9.5, "RD$ 9.50"],
    [9825, "RD$ 9,825.00"],
    [1234567.89, "RD$ 1,234,567.89"],
    [-5.25, "RD$ -5.25"],
    ["12.5", "RD$ 12.50"],
  ])("formatea %s → %s", (value, expected) => {
    expect(formatMoneyRD(value as number | string)).toBe(expected);
  });
  it("un valor no numérico cae en RD$ 0.00", () => {
    expect(formatMoneyRD(Number.NaN)).toBe("RD$ 0.00");
  });
});

describe("format · fecha dd/mm/aaaa", () => {
  it.each([
    [new Date(2026, 0, 5, 12), "05/01/2026"],
    [new Date(2026, 11, 31, 12), "31/12/2026"],
    [new Date(2026, 6, 9, 12), "09/07/2026"],
  ])("formatea %s", (value, expected) => {
    expect(formatFechaDDMMAAAA(value)).toBe(expected);
  });
});

describe("format · NCF", () => {
  it.each([
    ["b01 0000 0001", "B0100000001"],
    ["  e31-00000002 ", "E31-00000002"],
    ["B15", "B15"],
  ])("normaliza %j → %s", (value, expected) => {
    expect(formatNcf(value)).toBe(expected);
  });
});

describe("format · teléfono RD", () => {
  it.each([
    ["8091234567", "(809) 123-4567"],
    ["829-555-1234", "(829) 555-1234"],
    ["(849) 987 6543", "(849) 987-6543"],
    ["+1 809 123 4567", "(809) 123-4567"],
    ["18091234567", "(809) 123-4567"],
  ])("formatea %j → %s", (value, expected) => {
    expect(formatTelefonoRD(value)).toBe(expected);
  });
  it("un número no dominicano queda sin formatear", () => {
    expect(formatTelefonoRD("5551234")).toBe("5551234");
  });
});

describe("format · cédula RD", () => {
  it.each([
    ["00112345678", "001-1234567-8"],
    ["001-1234567-8", "001-1234567-8"],
    [" 40212345671 ", "402-1234567-1"],
  ])("formatea %j → %s", (value, expected) => {
    expect(formatCedula(value)).toBe(expected);
  });
  it("un valor que no son 11 dígitos queda sin formatear", () => {
    expect(formatCedula("12345")).toBe("12345");
  });
});

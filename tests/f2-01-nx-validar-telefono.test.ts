import { describe, it, expect } from "vitest";
import { validarTelefono } from "../packages/ui/src/nx-validar-telefono";

describe("nx-validar-telefono", () => {
  it("acepta 809, 829 y 849 y normaliza a 10 dígitos", () => {
    expect(validarTelefono("809-555-1234")).toEqual({
      valido: true,
      normalizado: "8095551234",
    });
    expect(validarTelefono("(829) 555 1234")).toEqual({
      valido: true,
      normalizado: "8295551234",
    });
    expect(validarTelefono("849.555.1234")).toEqual({
      valido: true,
      normalizado: "8495551234",
    });
  });

  it("acepta el prefijo de país +1 o 1", () => {
    expect(validarTelefono("+1 809 555 1234")).toEqual({
      valido: true,
      normalizado: "8095551234",
    });
    expect(validarTelefono("18295551234")).toEqual({
      valido: true,
      normalizado: "8295551234",
    });
  });

  it("rechaza códigos de área ajenos", () => {
    expect(validarTelefono("787-555-1234")).toEqual({
      valido: false,
      normalizado: "",
    });
  });

  it("rechaza longitudes incorrectas y letras", () => {
    expect(validarTelefono("809555123")).toEqual({
      valido: false,
      normalizado: "",
    });
    expect(validarTelefono("80955512345")).toEqual({
      valido: false,
      normalizado: "",
    });
    expect(validarTelefono("809-ABC-1234")).toEqual({
      valido: false,
      normalizado: "",
    });
  });

  it("vacío, nulo o indefinido no es válido", () => {
    expect(validarTelefono("")).toEqual({ valido: false, normalizado: "" });
    expect(validarTelefono(null)).toEqual({ valido: false, normalizado: "" });
    expect(validarTelefono(undefined)).toEqual({
      valido: false,
      normalizado: "",
    });
  });
});

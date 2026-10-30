import { describe, it, expect } from "vitest";
// @ts-expect-error script .mjs sin tipos; la prueba fija su comportamiento puro
import { esSospechosa } from "../scripts/tildes-nuevas.mjs";

describe("tildes-nuevas: detección de «?» dentro de palabras", () => {
  it("marca una tilde rota dentro de una palabra", () => {
    expect(esSospechosa("Ese paciente se pacie?te")).toBe(true);
  });
  it("ignora una URL con ? de consulta", () => {
    expect(esSospechosa("Visita https://ejemplo.com/buscar?texto=hola para más")).toBe(false);
  });
  it("ignora código dentro de comillas invertidas", () => {
    expect(esSospechosa("Usa `usuario?nombre` en el código")).toBe(false);
  });
  it("ignora el encadenamiento opcional de TypeScript", () => {
    expect(esSospechosa("const x = cliente?.nombre ?? ''")).toBe(false);
  });
});

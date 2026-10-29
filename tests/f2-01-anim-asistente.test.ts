import { expect, it } from "vitest";
import { aperturaAsistente } from "../packages/ui/src/nx-asistente-apertura";

it("aperturaAsistente escala de 0.96 a 1 sin robar el foco", () => {
  expect(aperturaAsistente(false)).toEqual({
    desdeEscala: 0.96,
    hastaEscala: 1,
    duracionMs: 180,
    robaFoco: false,
  });
  expect(aperturaAsistente(true)).toEqual({
    desdeEscala: 1,
    hastaEscala: 1,
    duracionMs: 0,
    robaFoco: false,
  });
});

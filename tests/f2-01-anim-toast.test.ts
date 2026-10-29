import { expect, it } from "vitest";
import { entradaToast } from "../packages/ui/src/nx-toast-entrada";

it("entradaToast sube desde abajo y los errores no se ocultan solos", () => {
  expect(entradaToast("exito", false)).toEqual({
    desdeAbajoPx: 16,
    duracionMs: 180,
    ocultaSola: true,
  });
  expect(entradaToast("error", false)).toEqual({
    desdeAbajoPx: 16,
    duracionMs: 180,
    ocultaSola: false,
  });
  expect(entradaToast("aviso", true)).toEqual({
    desdeAbajoPx: 0,
    duracionMs: 0,
    ocultaSola: true,
  });
});

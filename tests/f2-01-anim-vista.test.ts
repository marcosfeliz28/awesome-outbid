import { expect, it } from "vitest";
import { transicionVista } from "../packages/ui/src/nx-vista-transicion";

it("transicionVista desplaza 8 px en 180 ms y sin movimiento solo funde", () => {
  expect(transicionVista(false)).toEqual({
    desplazamientoPx: 8,
    duracionMs: 180,
    opacidad: [0, 1],
  });
  expect(transicionVista(true)).toEqual({
    desplazamientoPx: 0,
    duracionMs: 180,
    opacidad: [0, 1],
  });
});

import { expect, it } from "vitest";
import {
  CURVA_SALIDA,
  DURACION,
  limitarDuracion,
} from "../packages/ui/src/nx-motion";

it("nx-motion expone las tres duraciones y la curva de salida", () => {
  expect(DURACION).toEqual({ rapida: 120, base: 180, lenta: 240 });
  expect(CURVA_SALIDA).toBe("cubic-bezier(.2,.8,.2,1)");
});

it("limitarDuracion mantiene cada animación entre 0 y 240 ms", () => {
  expect(limitarDuracion(500)).toBe(240);
  expect(limitarDuracion(-5)).toBe(0);
  expect(limitarDuracion(180)).toBe(180);
});

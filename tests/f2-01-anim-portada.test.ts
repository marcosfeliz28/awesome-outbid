import { expect, it } from "vitest";
import { revelarSeccion } from "../packages/ui/src/nx-portada-revelado";

it("revelarSeccion revela cada sección una sola vez con retraso escalonado", () => {
  expect(revelarSeccion(0, false)).toEqual({
    retrasoMs: 0,
    duracionMs: 180,
    unaVez: true,
  });
  expect(revelarSeccion(2, false)).toEqual({
    retrasoMs: 80,
    duracionMs: 180,
    unaVez: true,
  });
  expect(revelarSeccion(3, true)).toEqual({
    retrasoMs: 0,
    duracionMs: 0,
    unaVez: true,
  });
});

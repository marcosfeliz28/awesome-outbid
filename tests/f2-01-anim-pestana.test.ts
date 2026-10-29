import { expect, it } from "vitest";
import { posicionPastilla } from "../packages/ui/src/nx-pestana-pastilla";

it("posicionPastilla coloca la pastilla bajo la pestaña activa", () => {
  expect(posicionPastilla(0, 96)).toEqual({ xPx: 0, duracionMs: 180 });
  expect(posicionPastilla(2, 96)).toEqual({ xPx: 192, duracionMs: 180 });
  expect(posicionPastilla(-1, 96)).toEqual({ xPx: 0, duracionMs: 180 });
});

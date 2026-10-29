import { expect, it } from "vitest";
import { porcentajeProgreso } from "../packages/ui/src/nx-progress";

it("porcentajeProgreso redondea y limita entre 0 y 100", () => {
  expect(porcentajeProgreso(1, 4)).toBe(25);
  expect(porcentajeProgreso(1, 3)).toBe(33);
  expect(porcentajeProgreso(5, 4)).toBe(100);
  expect(porcentajeProgreso(-1, 4)).toBe(0);
  expect(porcentajeProgreso(1, 0)).toBe(0);
});

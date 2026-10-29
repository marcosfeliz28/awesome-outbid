import { expect, it } from "vitest";
import { valorMovimiento } from "../packages/ui/src/nx-reduced-motion";

it("valorMovimiento apaga el desplazamiento con movimiento reducido", () => {
  expect(valorMovimiento(8, false)).toBe(8);
  expect(valorMovimiento(8, true)).toBe(0);
  expect(valorMovimiento(240, true)).toBe(0);
});

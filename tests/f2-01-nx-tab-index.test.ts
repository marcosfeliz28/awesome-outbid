import { expect, it } from "vitest";
import { siguienteIndice } from "../packages/ui/src/nx-tab-index";

it("siguienteIndice avanza y retrocede dando la vuelta", () => {
  expect(siguienteIndice(0, 3, 1)).toBe(1);
  expect(siguienteIndice(2, 3, 1)).toBe(0);
  expect(siguienteIndice(0, 3, -1)).toBe(2);
  expect(siguienteIndice(0, 0, 1)).toBe(0);
});

import { expect, it } from "vitest";
import { retrasoEscalonado } from "../packages/ui/src/nx-stagger";

it("retrasoEscalonado separa los elementos de una lista sin pasar de 240 ms", () => {
  expect(retrasoEscalonado(0)).toBe(0);
  expect(retrasoEscalonado(2)).toBe(80);
  expect(retrasoEscalonado(10)).toBe(240);
  expect(retrasoEscalonado(-1)).toBe(0);
});

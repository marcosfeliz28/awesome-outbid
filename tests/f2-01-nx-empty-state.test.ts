import { expect, it } from "vitest";
import { atributosVacio } from "../packages/ui/src/nx-empty-state";

it("atributosVacio anuncia el estado vacío con role status", () => {
  expect(
    atributosVacio({
      titulo: "Sin productos",
      texto: "Agrega el primero",
      accion: "Nuevo producto",
    }),
  ).toEqual({
    role: "status",
    titulo: "Sin productos",
    texto: "Agrega el primero",
    accion: "Nuevo producto",
  });
  expect(() =>
    atributosVacio({ titulo: "", texto: "x", accion: "y" }),
  ).toThrow();
});

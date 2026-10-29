import { expect, it } from "vitest";
import { atributosPestana, indiceTecla } from "../packages/ui/src/nx-tabs";

it("atributosPestana marca la pestaña activa y la única enfocable", () => {
  expect(atributosPestana({ id: "t1", panelId: "p1", activo: true })).toEqual({
    role: "tab",
    id: "t1",
    "aria-selected": true,
    "aria-controls": "p1",
    tabIndex: 0,
  });
  expect(
    atributosPestana({ id: "t2", panelId: "p2", activo: false }).tabIndex,
  ).toBe(-1);
});

it("indiceTecla navega con flechas, Inicio y Fin de forma circular", () => {
  expect(indiceTecla(0, 3, "ArrowRight")).toBe(1);
  expect(indiceTecla(0, 3, "ArrowLeft")).toBe(2);
  expect(indiceTecla(1, 3, "Home")).toBe(0);
  expect(indiceTecla(1, 3, "End")).toBe(2);
  expect(indiceTecla(1, 3, "Enter")).toBe(1);
  expect(indiceTecla(0, 0, "ArrowRight")).toBe(-1);
});

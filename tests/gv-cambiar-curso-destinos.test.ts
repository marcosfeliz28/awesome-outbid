import { expect, it } from "vitest";
import { cursosDestino } from "../apps/web/src/gvCursos";

const cursos = [
  { id: "a", name: "Curso A", active: true, enrolled: 3, capacity: 3 },
  { id: "b", name: "Curso B", active: true, enrolled: 1, capacity: 8 },
  { id: "c", name: "Curso C", active: false, enrolled: 0, capacity: 8 },
];

it("cursosDestino ofrece los cursos activos y deja el actual aunque esté inactivo", () => {
  expect(cursosDestino(cursos, "a").map((c) => c.id)).toEqual(["a", "b"]);
  expect(cursosDestino(cursos, "c").map((c) => c.id)).toEqual(["a", "b", "c"]);
});

it("cursosDestino marca los cursos llenos sin quitarlos", () => {
  const lleno = cursosDestino(cursos, "b").find((c) => c.id === "a");
  expect(lleno?.lleno).toBe(true);
  expect(cursosDestino(cursos, "b").find((c) => c.id === "b")?.lleno).toBe(
    false,
  );
});

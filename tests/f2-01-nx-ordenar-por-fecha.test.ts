import { describe, it, expect } from "vitest";
import { ordenarPorFecha } from "../packages/ui/src/nx-ordenar-por-fecha";

const x = { id: "x", fecha: "2026-10-03" };
const y = { id: "y", fecha: "2026-10-01" };
const z = { id: "z", fecha: "2026-10-02" };
const ids = (lista: { id: string }[]) => lista.map((i) => i.id);

describe("nx-ordenar-por-fecha", () => {
  it("ordena ascendente y descendente", () => {
    expect(ids(ordenarPorFecha([x, y, z], "fecha", "asc"))).toEqual(["y", "z", "x"]);
    expect(ids(ordenarPorFecha([x, y, z], "fecha", "desc"))).toEqual(["x", "z", "y"]);
  });

  it("las fechas inválidas van al final en ambas direcciones", () => {
    const rota = { id: "r", fecha: "no-es-fecha" };
    const nula = { id: "n", fecha: null };
    expect(ids(ordenarPorFecha([rota, x, nula, y], "fecha", "asc"))).toEqual(["y", "x", "r", "n"]);
    expect(ids(ordenarPorFecha([rota, x, nula, y], "fecha", "desc"))).toEqual(["x", "y", "r", "n"]);
  });

  it("es estable: las fechas iguales conservan su orden de entrada", () => {
    const a = { id: "a", fecha: "2026-10-01" };
    const b = { id: "b", fecha: "2026-10-01" };
    expect(ids(ordenarPorFecha([a, b], "fecha", "asc"))).toEqual(["a", "b"]);
    expect(ids(ordenarPorFecha([a, b], "fecha", "desc"))).toEqual(["a", "b"]);
  });

  it("una dirección no válida se trata como ascendente", () => {
    expect(ids(ordenarPorFecha([x, y], "fecha", "raro" as "asc"))).toEqual(["y", "x"]);
  });

  it("una lista vacía da una lista vacía y no cambia la lista original", () => {
    expect(ordenarPorFecha([], "fecha", "asc")).toEqual([]);
    const original = [x, y];
    ordenarPorFecha(original, "fecha", "asc");
    expect(ids(original)).toEqual(["x", "y"]);
  });
});

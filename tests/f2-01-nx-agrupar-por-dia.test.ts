import { describe, it, expect } from "vitest";
import { agruparPorDia } from "../packages/ui/src/nx-agrupar-por-dia";

// 29-oct 22:00 RD y 29-oct 13:00 RD caen el mismo día; 30-oct 00:30 RD es otro día.
const a = { id: "a", fecha: "2026-10-30T02:00:00Z" };
const b = { id: "b", fecha: "2026-10-29T17:00:00Z" };
const c = { id: "c", fecha: "2026-10-30T04:30:00Z" };

describe("nx-agrupar-por-dia", () => {
  it("agrupa por día calendario de República Dominicana, no de UTC", () => {
    const { grupos } = agruparPorDia([a, b, c], "fecha");
    expect(grupos.map((g) => g.dia)).toEqual(["2026-10-30", "2026-10-29"]);
    expect(grupos[1].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(grupos[0].items.map((i) => i.id)).toEqual(["c"]);
  });

  it("ordena los días del más nuevo al más viejo y conserva el orden de entrada dentro de un día", () => {
    const viejo = { id: "v", fecha: "2026-10-01T12:00:00Z" };
    const { grupos } = agruparPorDia([viejo, b, c], "fecha");
    expect(grupos.map((g) => g.dia)).toEqual(["2026-10-30", "2026-10-29", "2026-10-01"]);
    expect(grupos[1].items.map((i) => i.id)).toEqual(["b"]);
  });

  it("acepta fechas como objeto Date además de texto ISO", () => {
    const { grupos } = agruparPorDia([{ fecha: new Date("2026-10-29T12:00:00Z") }], "fecha");
    expect(grupos[0].dia).toBe("2026-10-29");
  });

  it("una lista vacía da cero grupos y cero omitidos", () => {
    expect(agruparPorDia([], "fecha")).toEqual({ grupos: [], omitidos: 0 });
  });

  it("omite y cuenta las fechas inválidas, vacías o nulas", () => {
    const { grupos, omitidos } = agruparPorDia(
      [a, { id: "x", fecha: "no-es-fecha" }, { id: "y", fecha: null }, { id: "z" }],
      "fecha",
    );
    expect(omitidos).toBe(3);
    expect(grupos.flatMap((g) => g.items.map((i) => i.id))).toEqual(["a"]);
  });
});

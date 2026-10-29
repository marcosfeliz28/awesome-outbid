import { describe, it, expect } from "vitest";
import { agruparPorDia } from "../packages/ui/src/nx-agrupar-por-dia";

type Item = { id: number; fecha: string | Date };

describe("nx-agrupar-por-dia", () => {
  it("una lista vacía da cero grupos y cero omitidos", () => {
    expect(agruparPorDia([], "fecha")).toEqual({ grupos: [], omitidos: 0 });
  });

  it("agrupa por día de calendario RD y ordena de más reciente a más antiguo", () => {
    const items: Item[] = [
      { id: 1, fecha: "2026-10-28T15:00:00Z" },
      { id: 2, fecha: "2026-10-29T15:00:00Z" },
      { id: 3, fecha: "2026-10-29T18:00:00Z" },
    ];
    const r = agruparPorDia(items, "fecha");
    expect(r.grupos.map((g) => g.dia)).toEqual(["2026-10-29", "2026-10-28"]);
    expect(r.grupos[0].items.map((i) => i.id)).toEqual([2, 3]);
    expect(r.omitidos).toBe(0);
  });

  it("el cambio de día usa la zona de RD (UTC-4), no UTC", () => {
    const items: Item[] = [
      { id: 1, fecha: "2026-10-30T03:30:00Z" }, // 29-oct 23:30 RD
      { id: 2, fecha: "2026-10-30T04:30:00Z" }, // 30-oct 00:30 RD
    ];
    const r = agruparPorDia(items, "fecha");
    expect(r.grupos.map((g) => g.dia)).toEqual(["2026-10-30", "2026-10-29"]);
  });

  it("omite y cuenta las fechas inválidas", () => {
    const items: Item[] = [
      { id: 1, fecha: "no-es-fecha" },
      { id: 2, fecha: "2026-10-29T15:00:00Z" },
      { id: 3, fecha: new Date("x") },
    ];
    const r = agruparPorDia(items, "fecha");
    expect(r.grupos).toHaveLength(1);
    expect(r.omitidos).toBe(2);
  });

  it("no modifica la lista original", () => {
    const items: Item[] = [{ id: 1, fecha: "2026-10-29T15:00:00Z" }];
    const copia = JSON.stringify(items);
    agruparPorDia(items, "fecha");
    expect(JSON.stringify(items)).toBe(copia);
  });
});

import { describe, expect, it } from "vitest";
import { tablePage, tableRowsKey } from "../apps/web/src/tablePagination";

describe("N-17 · tablas al filtrar o reordenar", () => {
  it("detecta otro resultado de igual longitud y un nuevo orden", () => {
    const before = Array.from({ length: 41 }, (_, i) => ({ id: `a-${i}` }));
    const filtered = Array.from({ length: 41 }, (_, i) => ({ id: `b-${i}` }));
    expect(tableRowsKey(filtered)).not.toBe(tableRowsKey(before));
    expect(tableRowsKey([...before].reverse())).not.toBe(tableRowsKey(before));
    expect(tableRowsKey(before.map((row) => ({ ...row })))).toBe(tableRowsKey(before));
  });

  it("no muestra una página vacía si una búsqueda reduce el total", () => {
    expect(tablePage(3, 41)).toEqual({ current: 3, totalPages: 3 });
    expect(tablePage(3, 8)).toEqual({ current: 1, totalPages: 1 });
    expect(tablePage(3, 23)).toEqual({ current: 2, totalPages: 2 });
  });
});

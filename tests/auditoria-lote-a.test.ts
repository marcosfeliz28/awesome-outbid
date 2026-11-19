// Auditoría lote A (19-nov-2026): pruebas unitarias de los arreglos A1-A6.
import { describe, expect, it } from "vitest";
import { dateRange } from "../apps/api/src/reports";

describe("A1 · dateRange acepta fecha sola o fecha con hora", () => {
  it("fecha sola cubre el día entero en UTC-4", () => {
    const r = dateRange({ from: "2026-11-19", to: "2026-11-19" });
    expect(r.gte.toISOString()).toBe("2026-11-19T04:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-11-20T03:59:59.999Z");
  });
  it("fecha con hora (lo que manda Caja) se usa tal cual", () => {
    const r = dateRange({
      from: "2026-11-19T00:00:00-04:00",
      to: "2026-11-19T23:59:59-04:00",
    });
    expect(r.gte.toISOString()).toBe("2026-11-19T04:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-11-20T03:59:59.000Z");
  });
  it("sigue rechazando fechas inválidas o al revés", () => {
    expect(() => dateRange({ from: "basura" })).toThrow(/Rango de fechas/);
    expect(() =>
      dateRange({ from: "2026-11-20", to: "2026-11-19T00:00:00-04:00" }),
    ).toThrow(/Rango de fechas/);
  });
});

import { describe, it, expect } from "vitest";
import { rangoDeDias } from "../packages/ui/src/nx-rango-dias";

describe("rangoDeDias (F3-06)", () => {
  it("incluye inicio y fin", () => {
    expect(rangoDeDias("2026-10-29", "2026-10-31")).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  it("mismo día devuelve un solo día", () => {
    expect(rangoDeDias("2026-10-29", "2026-10-29")).toEqual(["2026-10-29"]);
  });

  it("inicio posterior a fin es error", () => {
    expect(() => rangoDeDias("2026-10-31", "2026-10-29")).toThrow(
      "inicio posterior a fin",
    );
  });

  it("fechas inválidas son error, incluido 30 de febrero", () => {
    expect(() => rangoDeDias("2026-02-30", "2026-03-01")).toThrow(
      "fecha inválida",
    );
  });

  it("366 días se permiten y 367 no", () => {
    expect(rangoDeDias("2024-01-01", "2024-12-31")).toHaveLength(366);
    expect(() => rangoDeDias("2024-01-01", "2025-01-01")).toThrow(
      "máximo 366 días",
    );
  });
});

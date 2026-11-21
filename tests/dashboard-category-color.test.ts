import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dashboardCategoryColor } from "../apps/web/src/dashboardCategoryColor";
import { dashboardCategoryShares } from "../apps/web/src/dashboardCategoryShares";
import { grossProfitLabel } from "../apps/web/src/dashboardProfitLabel";

describe("DD-05 · categorías de GV distinguibles", () => {
  it("da a cada línea de GV un color propio distinto al rosa de Fajas", () => {
    const fajas = dashboardCategoryColor("Fajas", "#EC4899");
    const gv = ["GV Productos", "GV Servicios", "GV Cursos"].map((name) =>
      dashboardCategoryColor(name, "#EC4899"),
    );

    expect(new Set(gv).size).toBe(3);
    expect(gv).not.toContain(fajas);
  });

  it("conserva el color de categorías ajenas a GV", () => {
    expect(dashboardCategoryColor("Suplementos", "#16A34A")).toBe("#16A34A");
  });
});

describe("DD-06 · porcentajes visibles por categoría", () => {
  it("redondea los rótulos del tablero en conjunto y no las barras", () => {
    const dashboard = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
    expect(dashboard).toContain("dashboardCategoryShares(");
    expect(dashboard).toContain("{label}%");
    expect(dashboard).toContain("${percent}%");
    expect(dashboard).not.toContain("percent.toFixed(0)");
  });

  it("reparte el resto para corregir tanto 99% como 101%", () => {
    const labels = (totals: number[]) =>
      dashboardCategoryShares(totals).map(({ label }) => label);
    expect(labels([1, 1, 1])).toEqual([34, 33, 33]);
    expect(labels([5, 5, 190])).toEqual([3, 2, 95]);
  });

  it("conserva el orden y excluye importes netos negativos", () => {
    const shares = dashboardCategoryShares([8, 3, -2]);
    expect(shares.map(({ label }) => label)).toEqual([73, 27, 0]);
    expect(shares[0].percent).toBeCloseTo(72.7272727);
    expect(shares[2].percent).toBe(0);
  });

  it("no inventa participaciones cuando no hay una base de comparación", () => {
    expect(dashboardCategoryShares([])).toEqual([]);
    expect(dashboardCategoryShares([0, 0, 0])).toEqual(
      Array.from({ length: 3 }, () => ({ label: 0, percent: 0 })),
    );
    expect(dashboardCategoryShares([15, -15])).toEqual([
      { label: 100, percent: 100 },
      { label: 0, percent: 0 },
    ]);
    expect(
      dashboardCategoryShares([0, 25, 0]).map(({ label }) => label),
    ).toEqual([0, 100, 0]);
  });
});

describe("DD-07 · alcance visible de la ganancia bruta", () => {
  it("aclara el tratamiento del ITBIS en ambos idiomas", () => {
    expect(grossProfitLabel(true, "es")).toBe("Ganancia bruta (con ITBIS)");
    expect(grossProfitLabel(false, "es")).toBe("Ganancia bruta (sin ITBIS)");
    expect(grossProfitLabel(true, "en")).toBe("Gross profit (tax included)");
    expect(grossProfitLabel(false, "en")).toBe("Gross profit (tax excluded)");
  });
});

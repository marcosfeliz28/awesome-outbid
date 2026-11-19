import { describe, expect, it } from "vitest";
import { dashboardCategoryColor } from "../apps/web/src/dashboardCategoryColor";

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

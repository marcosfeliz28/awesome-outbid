import { describe, expect, it } from "vitest";
import { reviewCsv } from "../apps/web/src/inventoryImportCsv";

describe("N-19 · avisos completos de la vista previa", () => {
  it("exporta los 1.500 avisos sin perder el último ni ejecutar fórmulas", () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      id: `${i + 1}`, name: i === 1499 ? '=HYPERLINK("https://example.invalid")' : `Producto ${i}`,
      category: "Varios", qty: i, active: i % 2 === 0, notes: ["Margen bajo"],
    }));
    const csv = reviewCsv(rows);
    expect(csv.split("\r\n")).toHaveLength(1501);
    expect(csv).toContain('"1500";"\'=HYPERLINK(');
    expect(csv).toContain('"1";"Producto 0";"Varios";"0";"Sí";"Margen bajo"');
  });
});

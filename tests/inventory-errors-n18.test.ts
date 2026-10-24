import { describe, expect, it } from "vitest";
import { problemsCsv } from "../apps/web/src/inventoryImportCsv";

describe("N-18 · todos los errores de inventario descargables", () => {
  it("incluye los 1.500 errores con fila, columna y causa, sin ejecutar fórmulas CSV", () => {
    const problems = Array.from({ length: 1500 }, (_, i) => ({
      row: i + 2, column: "EXISTENCIA", message: i === 1499 ? '=HYPERLINK("https://example.invalid")' : `Valor inválido ${i}`,
    }));
    const csv = problemsCsv(problems);
    expect(csv.split("\r\n")).toHaveLength(1501);
    expect(csv).toContain('"1501";"EXISTENCIA";"\'=HYPERLINK(');
    expect(csv).toContain('"2";"EXISTENCIA";"Valor inválido 0"');
  });
});

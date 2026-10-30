import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

// docs/sistema/INDICE.json debe ser JSON válido y listar exactamente los .md de la carpeta.
describe("índice de docs/sistema", () => {
  it("INDICE.json es JSON válido y lista exactamente los .md de la carpeta", () => {
    const indice = JSON.parse(readFileSync("docs/sistema/INDICE.json", "utf8"));
    const listados = (indice.archivos as { archivo: string }[]).map((a) => a.archivo).sort();
    const enCarpeta = readdirSync("docs/sistema").filter((f) => f.endsWith(".md")).sort();
    expect(listados).toEqual(enCarpeta);
  });

  it("CAMBIOS.md existe y tiene encabezado de tabla", () => {
    const txt = readFileSync("docs/sistema/CAMBIOS.md", "utf8");
    expect(txt).toMatch(/^\|.*\|\s*$/m);
  });
});

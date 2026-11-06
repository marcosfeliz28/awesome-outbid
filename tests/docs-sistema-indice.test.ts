// docs/sistema/INDICE.json es JSON válido y lista exactamente los .md de la carpeta;
// CAMBIOS.md existe y tiene encabezado de tabla.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = join(process.cwd(), "docs", "sistema");

describe("índice de docs/sistema", () => {
  it("INDICE.json es JSON válido y lista exactamente los .md de la carpeta", () => {
    const indice = JSON.parse(readFileSync(join(DOCS, "INDICE.json"), "utf8"));
    const listados = indice.archivos
      .map((a: { archivo: string }) => a.archivo)
      .filter((n: string) => n.endsWith(".md"))
      .sort();
    const reales = readdirSync(DOCS)
      .filter((n) => n.endsWith(".md"))
      .sort();
    expect(listados).toEqual(reales);
  });

  it("cada entrada del índice tiene archivo, título y resumen", () => {
    const indice = JSON.parse(readFileSync(join(DOCS, "INDICE.json"), "utf8"));
    for (const a of indice.archivos) {
      expect(typeof a.archivo).toBe("string");
      expect(a.titulo.length).toBeGreaterThan(0);
      expect(a.resumen.length).toBeGreaterThan(0);
    }
  });

  it("CAMBIOS.md existe y tiene encabezado de tabla", () => {
    const ruta = join(DOCS, "CAMBIOS.md");
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta, "utf8")).toMatch(
      /^\| fecha \| quién \| qué cambió \| archivos \|$/m,
    );
  });
});

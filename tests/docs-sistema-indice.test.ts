import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Base del sistema (docs/sistema): el índice debe ser JSON válido y listar
// exactamente los .md de la carpeta (INDICE.json puede listarse a sí mismo).
const docs = join(new URL("..", import.meta.url).pathname, "docs/sistema");
const indice = JSON.parse(readFileSync(join(docs, "INDICE.json"), "utf8")) as {
  archivos: { archivo: string; titulo: string; resumen: string }[];
};
const md = readdirSync(docs)
  .filter((f) => f.endsWith(".md"))
  .sort();
const listados = indice.archivos
  .map((a) => a.archivo)
  .filter((f) => f !== "INDICE.json")
  .sort();

describe("Índice de docs/sistema", () => {
  it("es JSON válido con una lista de archivos", () => {
    expect(Array.isArray(indice.archivos)).toBe(true);
    expect(indice.archivos.length).toBeGreaterThan(0);
  });

  it("lista exactamente los .md de la carpeta", () => {
    expect(listados).toEqual(md);
  });

  it("cada entrada tiene título y resumen, y su archivo existe", () => {
    for (const a of indice.archivos) {
      expect(existsSync(join(docs, a.archivo)), a.archivo).toBe(true);
      expect(a.titulo.length, `${a.archivo}: título`).toBeGreaterThan(0);
      expect(a.resumen.length, `${a.archivo}: resumen`).toBeGreaterThan(0);
    }
  });

  it("CAMBIOS.md existe y trae el encabezado de la tabla", () => {
    const cambios = readFileSync(join(docs, "CAMBIOS.md"), "utf8");
    expect(cambios).toContain("| fecha | quién | qué cambió | archivos |");
    expect(cambios).toContain("|---|---|---|---|");
  });
});

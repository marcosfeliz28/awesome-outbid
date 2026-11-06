import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error script .mjs sin tipos
import { extraerReglas, ARCHIVOS } from "../scripts/reglas-si.mjs";

describe("reglas-si: extracción de reglas condicionales", () => {
  it("toma viñetas, numeradas y en negrita que empiezan por Si, Cuando, Solo o No se puede", () => {
    const texto = ["- Si pasa X, haz Y (`a.ts:10`)", "2. **Cuando** cierres la caja", "- **Solo** el admin", "No se puede vender", "Sí, claro", "Sin equipo aprobado"].join("\n");
    const reglas = extraerReglas("doc.md", texto);
    expect(reglas.map((r: { linea: number }) => r.linea)).toEqual([1, 2, 3, 4]);
  });
  it("cada regla extraída de los documentos reales existe en esa línea", () => {
    for (const archivo of ARCHIVOS) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      for (const r of extraerReglas(archivo, lineas.join("\n"))) {
        expect(lineas[r.linea - 1].trim()).toBe(r.texto);
      }
    }
  });
});

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sin tipos
import { buscarLinea, reanclar } from "../scripts/citas-reanclar.mjs";

function repo(codigo: string[], doc: string) {
  const raiz = mkdtempSync(join(tmpdir(), "citas-"));
  mkdirSync(join(raiz, "apps", "api"), { recursive: true });
  mkdirSync(join(raiz, "docs", "sistema"), { recursive: true });
  writeFileSync(join(raiz, "apps", "api", "x.ts"), codigo.join("\n"));
  writeFileSync(join(raiz, "docs", "sistema", "A.md"), doc);
  return raiz;
}

describe("citas-reanclar", () => {
  it("mueve la cita (y su rango) cuando el código baja de línea", () => {
    const codigo = ["a", "b", "export function cobrar() {", "  return 1;", "}"];
    const raiz = repo(codigo, "Cobra en `apps/api/x.ts:3` y `apps/api/x.ts:3-5`.\n");
    expect(reanclar({ raiz }).movidas).toEqual([]); // primera vez: solo crea anclas
    writeFileSync(join(raiz, "apps", "api", "x.ts"), ["nuevo 1", "nuevo 2", "nuevo 3", ...codigo].join("\n"));
    const r = reanclar({ raiz });
    expect(r.movidas).toEqual([{ cita: "apps/api/x.ts:3", de: 3, a: 6 }]);
    expect(readFileSync(join(raiz, "docs", "sistema", "A.md"), "utf8")).toBe(
      "Cobra en `apps/api/x.ts:6` y `apps/api/x.ts:6-8`.\n",
    );
    expect(reanclar({ raiz }).movidas).toEqual([]); // estable
  });

  it("--revisar no escribe y una línea borrada se reporta como perdida", () => {
    const raiz = repo(["uno", "export const TASA = 0.18;", "tres"], "Tasa `apps/api/x.ts:2`.\n");
    reanclar({ raiz });
    writeFileSync(join(raiz, "apps", "api", "x.ts"), ["cero", "uno", "tres"].join("\n"));
    const r = reanclar({ raiz, escribir: false });
    expect(r.perdidas).toEqual(["apps/api/x.ts:2"]);
    expect(readFileSync(join(raiz, "docs", "sistema", "A.md"), "utf8")).toBe("Tasa `apps/api/x.ts:2`.\n");
  });

  it("buscarLinea elige la coincidencia más cercana y no adivina en empate", () => {
    const l = ["x = 1", "y", "x = 1", "z", "z", "x = 1"];
    expect(buscarLinea(l, "x = 1", 5)).toBe(6);
    expect(buscarLinea(l, "x = 1", 2)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sin tipos
import { filtrarCambiados, marcadoresEn } from "../scripts/pre-empuje.mjs";

describe("pre-empuje", () => {
  it("encuentra marcadores de conflicto por archivo:línea sin imprimir contenido", () => {
    const texto = "ok\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> rama\nfin";
    expect(marcadoresEn("a.ts", texto)).toEqual(["a.ts:2", "a.ts:6"]);
  });

  it("no confunde una línea ======= de un título Markdown con un conflicto", () => {
    expect(marcadoresEn("a.md", "Título\n=======\ntexto")).toEqual([]);
  });

  it("separa lo formateable de lo que pasa por eslint", () => {
    const r = filtrarCambiados(["a.ts", "b.md", "c.png", "d.mjs"]);
    expect(r.formateables).toEqual(["a.ts", "b.md", "d.mjs"]);
    expect(r.codigo).toEqual(["a.ts", "d.mjs"]);
  });
});

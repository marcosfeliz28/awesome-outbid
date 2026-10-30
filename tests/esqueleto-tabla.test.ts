import { describe, it, expect } from "vitest";
// @ts-expect-error script .mjs sin tipos
import { extraerTerminos } from "../scripts/esqueleto-tabla.mjs";

describe("esqueleto-tabla: términos de un glosario con su cita", () => {
  it("toma el término en negrita antes del guion y la primera cita archivo:línea", () => {
    const texto = "**Abono** — Pago posterior (`apps/api/src/sales.ts:4414`).\n\nTexto corrido sin término.\n**Kardex** — Historial (`apps/web/src/Management.tsx:760`).";
    const r = extraerTerminos(texto);
    expect(r).toEqual([
      { termino: "Abono", cita: "apps/api/src/sales.ts:4414" },
      { termino: "Kardex", cita: "apps/web/src/Management.tsx:760" },
    ]);
  });
});

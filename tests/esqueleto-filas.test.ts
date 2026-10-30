import { describe, it, expect } from "vitest";
// @ts-expect-error script .mjs sin tipos
import { extraerFilas } from "../scripts/esqueleto-tabla.mjs";

describe("esqueleto-tabla: filas de tabla de pantallas", () => {
  it("toma la etiqueta en negrita de cada fila numerada y su primera cita", () => {
    const texto = "| # | Etiqueta | Permiso | Componente | Línea |\n|---|---|---|---|---|\n| 1 | **Mercancía** | `inventory:write` | `Merchandise` (`apps/web/src/Merchandise.tsx:279`) | 197 |\n| 2 | **Resumen** | `reports:read` | `Dashboard` (`apps/web/src/Dashboard.tsx:105`) | 203 |";
    expect(extraerFilas(texto)).toEqual([
      { termino: "Mercancía", cita: "apps/web/src/Merchandise.tsx:279" },
      { termino: "Resumen", cita: "apps/web/src/Dashboard.tsx:105" },
    ]);
  });
});

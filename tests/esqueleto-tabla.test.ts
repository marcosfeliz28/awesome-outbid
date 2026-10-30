// El esqueleto lo pone el script: una fila por término de un trozo, con su cita archivo:línea.
// El modelo solo redacta la columna de significado. Si el script pierde o inventa términos, la prueba falla.
import { describe, expect, it } from "vitest";
import { esqueleto } from "../scripts/esqueleto-tabla.mjs";

const texto = [
  "# Glosario",
  "",
  "**Abono** — Pago posterior a una venta.",
  "- **Caja** — Pantalla de turno.",
  "",
  "| Término | Qué |",
  "|---------|-----|",
  "| Casa | Almacén fuera de la tienda. |",
].join("\n");

describe("esqueleto de tabla", () => {
  it("saca los términos de viñetas y filas de tabla con su cita", () => {
    expect(esqueleto(texto, "GLOSARIO.md")).toEqual([
      { termino: "Abono", cita: "GLOSARIO.md:3" },
      { termino: "Caja", cita: "GLOSARIO.md:4" },
      { termino: "Casa", cita: "GLOSARIO.md:8" },
    ]);
  });

  it("no toma encabezados ni separadores de tabla", () => {
    const filas = esqueleto(texto, "GLOSARIO.md").map((f) => f.termino);
    expect(filas).not.toContain("Término");
    expect(filas).not.toContain("---------");
  });

  it("respeta el rango de líneas del trozo", () => {
    expect(esqueleto(texto, "GLOSARIO.md", 1, 4).map((f) => f.termino)).toEqual(["Abono", "Caja"]);
  });
});

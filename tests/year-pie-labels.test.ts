import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DD-08 · etiquetas del resumen anual", () => {
  it("distingue el resultado antes de gastos de la ganancia neta", () => {
    const source = readFileSync("apps/web/src/YearPie.tsx", "utf8");
    expect(source).toContain('t("Bruta − costo")');
    expect(source).not.toContain('t("Neta")');
  });
});

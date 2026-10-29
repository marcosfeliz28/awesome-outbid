// El valor por defecto de «brand» al crear un producto sin marca es Norexos.
// Un producto con marca guardada conserva su valor: el default solo entra si no llega marca.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const catalogo = readFileSync("apps/api/src/catalog.ts", "utf8");

it("el default de brand al crear un producto es Norexos", () => {
  expect(catalogo).toMatch(
    /brand: z\.string\(\)\.max\(80\)\.default\("Norexos"\)/,
  );
  expect(catalogo).not.toMatch(/default\("Nexora"\)/);
});

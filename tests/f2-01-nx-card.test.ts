import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RUTA = "packages/ui/src/nx-card.ts";

it("nx-card traduce su variante a clase CSS", () => {
  expect(existsSync(RUTA)).toBe(true);
  expect(readFileSync(RUTA, "utf8")).toMatch(/export function claseVariante\(/);
});

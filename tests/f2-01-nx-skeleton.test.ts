import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RUTA = "packages/ui/src/nx-skeleton.ts";

it("NxSkeleton traduce la forma de carga a su clase CSS", () => {
  expect(existsSync(RUTA)).toBe(true);
  expect(readFileSync(RUTA, "utf8")).toMatch(/export function claseEsqueleto\(/);
});

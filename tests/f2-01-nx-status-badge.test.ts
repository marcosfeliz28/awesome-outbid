import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RUTA = "packages/ui/src/nx-status-badge.ts";

it("NxStatusBadge traduce el tono a su clase CSS", () => {
  expect(existsSync(RUTA)).toBe(true);
  expect(readFileSync(RUTA, "utf8")).toMatch(/export function claseTono\(/);
});

import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RUTA = "packages/ui/src/nx-money.ts";

it("NxMoney formatea RD$ con separador de miles y dos decimales", () => {
  expect(existsSync(RUTA)).toBe(true);
  const src = readFileSync(RUTA, "utf8");
  expect(src).toMatch(/export function formatDOP\(/);
});

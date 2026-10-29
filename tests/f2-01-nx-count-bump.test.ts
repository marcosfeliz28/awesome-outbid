import { expect, it } from "vitest";
import { debeRebotar } from "../packages/ui/src/nx-count-bump";

it("debeRebotar solo rebota cuando el contador sube", () => {
  expect(debeRebotar(1, 2)).toBe(true);
  expect(debeRebotar(2, 1)).toBe(false);
  expect(debeRebotar(2, 2)).toBe(false);
});

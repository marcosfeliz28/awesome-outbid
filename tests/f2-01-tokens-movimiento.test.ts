import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync("packages/ui/src/tokens.css", "utf8");

it("tokens.css define las duraciones y la curva de movimiento", () => {
  expect(css).toMatch(/--nx-dur-fast:\s*120ms;/);
  expect(css).toMatch(/--nx-dur-base:\s*180ms;/);
  expect(css).toMatch(/--nx-dur-slow:\s*240ms;/);
  expect(css).toMatch(/--nx-ease-out:\s*cubic-bezier\(\.2,\s*\.8,\s*\.2,\s*1\);/);
});

import { expect, it } from "vitest";
import { claseSuperficie } from "../packages/ui/src/nx-card";

it("claseSuperficie distingue superficie normal y elevada", () => {
  expect(claseSuperficie(false)).toBe("nx-superficie");
  expect(claseSuperficie(true)).toBe("nx-superficie nx-superficie--elevada");
});

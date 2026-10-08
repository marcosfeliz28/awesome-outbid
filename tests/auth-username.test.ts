import { describe, expect, it } from "vitest";
import { normalizeUsername } from "../apps/api/src/auth";

describe("inicio de sesión con usuario corto", () => {
  it("ignora mayúsculas, espacios repetidos y acentos", () => {
    expect(normalizeUsername("  F   Rodríguez ")).toBe("f rodriguez");
    expect(normalizeUsername("M Félix")).toBe("m felix");
  });
});

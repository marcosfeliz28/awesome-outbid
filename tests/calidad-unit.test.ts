// W9 · pruebas unitarias que matan mutaciones que sobrevivían (auditoría 07 v2).
import { describe, expect, it } from "vitest";
import { validateSecret } from "../apps/api/src/security";

describe("SE06 · el secreto JWT exige 32 caracteres como mínimo", () => {
  it.each([undefined, "", "corto", "x".repeat(8), "x".repeat(31)])(
    "rechaza %j",
    (secret) => {
      expect(() => validateSecret(secret as any, false)).toThrow(
        /al menos 32 caracteres/,
      );
      expect(() => validateSecret(secret as any, true)).toThrow(
        /al menos 32 caracteres/,
      );
    },
  );
  it("acepta 32 o más caracteres (y en producción pide uno aleatorio)", () => {
    const secret = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6";
    expect(secret).toHaveLength(32);
    expect(validateSecret(secret, false)).toBe(secret);
    expect(validateSecret(secret, true)).toBe(secret);
    expect(() => validateSecret("a".repeat(40), true)).toThrow(/aleatorio/);
    expect(validateSecret("a".repeat(40), false)).toBe("a".repeat(40));
  });
});

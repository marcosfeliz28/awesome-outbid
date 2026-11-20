import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Producto protegido · nombre de alerta de apertura", () => {
  it("presenta opening_shortfall como Fondo de apertura menor", () => {
    const source = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(source).toContain(
      'opening_shortfall: "Fondo de apertura menor",',
    );
    expect(source).toContain(
      'opening_shortfall: "Opening fund shortfall",',
    );
  });
});

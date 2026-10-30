import { describe, it, expect } from "vitest";
import { esMismoDia } from "../packages/ui/src/nx-mismo-dia";

describe("esMismoDia (F3-07)", () => {
  it("compara el día en zona Santo Domingo, no en UTC", () => {
    // 00:30 del 29 en RD y 22:30 del 29 en RD: mismo día aunque en UTC sean 29 y 30.
    expect(
      esMismoDia(
        new Date("2026-10-29T04:30:00Z"),
        new Date("2026-10-30T02:30:00Z"),
      ),
    ).toBe(true);
  });

  it("23:30 RD y 00:30 RD siguiente son días distintos", () => {
    expect(
      esMismoDia(
        new Date("2026-10-29T03:30:00Z"),
        new Date("2026-10-29T04:30:00Z"),
      ),
    ).toBe(false);
  });

  it("fechas inválidas o que no son Date dan falso", () => {
    expect(esMismoDia(new Date("no"), new Date())).toBe(false);
    expect(esMismoDia("no" as unknown as Date, new Date())).toBe(false);
  });
});

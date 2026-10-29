import { describe, it, expect } from "vitest";
import { diasHasta } from "../packages/ui/src/nx-dias-hasta";

const ahora = new Date("2026-10-29T12:00:00Z");
const dias = (n: number) => new Date(ahora.getTime() + n * 86400000);

describe("nx-dias-hasta", () => {
  it("la misma fecha da 0", () => {
    expect(diasHasta(ahora, ahora)).toBe(0);
  });

  it("mañana da 1 y ayer da -1", () => {
    expect(diasHasta(dias(1), ahora)).toBe(1);
    expect(diasHasta(dias(-1), ahora)).toBe(-1);
  });

  it("cuenta días de calendario en República Dominicana, no en UTC", () => {
    const ahoraRD = new Date("2026-10-30T03:00:00Z"); // 29-oct 23:00 en RD
    expect(diasHasta(new Date("2026-10-30T02:00:00Z"), ahoraRD)).toBe(0); // 29-oct 22:00 RD
    expect(diasHasta(new Date("2026-10-30T04:30:00Z"), ahoraRD)).toBe(1); // 30-oct 00:30 RD
  });

  it("una fecha inválida da NaN", () => {
    expect(diasHasta(new Date("no-es-fecha"), ahora)).toBeNaN();
    expect(diasHasta(ahora, new Date("no-es-fecha"))).toBeNaN();
  });
});

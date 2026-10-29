import { describe, it, expect } from "vitest";
import { tiempoRelativo } from "../packages/ui/src/nx-tiempo-relativo";

const ahora = new Date("2026-10-29T12:00:00Z");
const minutosAntes = (n: number) => new Date(ahora.getTime() - n * 60000);

describe("límites de nx-tiempo-relativo", () => {
  it("la misma fecha dice ahora mismo", () => {
    expect(tiempoRelativo(ahora, ahora, "es")).toBe("ahora mismo");
    expect(tiempoRelativo(ahora, ahora, "en")).toBe("just now");
  });

  it("59 minutos siguen siendo minutos; 60 pasan a horas", () => {
    expect(tiempoRelativo(minutosAntes(59), ahora, "es")).toBe("hace 59 min");
    expect(tiempoRelativo(minutosAntes(60), ahora, "es")).toBe("hace 1 h");
  });

  it("23 horas siguen siendo horas; 24 horas pasan a días", () => {
    expect(tiempoRelativo(minutosAntes(23 * 60), ahora, "en")).toBe("23 h ago");
    expect(tiempoRelativo(minutosAntes(24 * 60), ahora, "en")).toBe("1 d ago");
  });

  it("un futuro de 59 minutos se dice en 59 min", () => {
    expect(
      tiempoRelativo(new Date(ahora.getTime() + 59 * 60000), ahora, "es"),
    ).toBe("en 59 min");
  });
});

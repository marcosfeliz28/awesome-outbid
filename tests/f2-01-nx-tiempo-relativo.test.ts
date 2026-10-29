import { describe, it, expect } from "vitest";
import { tiempoRelativo } from "../packages/ui/src/nx-tiempo-relativo";

const ahora = new Date("2026-10-29T12:00:00Z");
const minutosAntes = (n: number) => new Date(ahora.getTime() - n * 60000);
const minutosDespues = (n: number) => new Date(ahora.getTime() + n * 60000);

describe("nx-tiempo-relativo", () => {
  it("dice ahora mismo (o just now) por debajo de un minuto", () => {
    const desde = new Date(ahora.getTime() - 10000);
    expect(tiempoRelativo(desde, ahora, "es")).toBe("ahora mismo");
    expect(tiempoRelativo(desde, ahora, "en")).toBe("just now");
  });

  it("dice hace N min (o N min ago) para el pasado", () => {
    expect(tiempoRelativo(minutosAntes(5), ahora, "es")).toBe("hace 5 min");
    expect(tiempoRelativo(minutosAntes(5), ahora, "en")).toBe("5 min ago");
  });

  it("dice en N min (o in N min) para el futuro", () => {
    expect(tiempoRelativo(minutosDespues(5), ahora, "es")).toBe("en 5 min");
    expect(tiempoRelativo(minutosDespues(5), ahora, "en")).toBe("in 5 min");
  });
});

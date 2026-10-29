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

  it("redondea hacia cero: ±90 s es 1 min en ambos sentidos", () => {
    const pasado = new Date(ahora.getTime() - 90000);
    const futuro = new Date(ahora.getTime() + 90000);
    expect(tiempoRelativo(pasado, ahora, "es")).toBe("hace 1 min");
    expect(tiempoRelativo(futuro, ahora, "es")).toBe("en 1 min");
    expect(tiempoRelativo(futuro, ahora, "en")).toBe("in 1 min");
  });

  it("usa horas desde 60 min y días desde 24 h, en es y en", () => {
    const h = (n: number) => new Date(ahora.getTime() - n * 3600000);
    const hf = (n: number) => new Date(ahora.getTime() + n * 3600000);
    expect(tiempoRelativo(minutosAntes(59), ahora, "es")).toBe("hace 59 min");
    expect(tiempoRelativo(minutosAntes(60), ahora, "es")).toBe("hace 1 h");
    expect(tiempoRelativo(h(23), ahora, "en")).toBe("23 h ago");
    expect(tiempoRelativo(h(24), ahora, "es")).toBe("hace 1 d");
    expect(tiempoRelativo(h(120), ahora, "es")).toBe("hace 5 d");
    expect(tiempoRelativo(h(120), ahora, "en")).toBe("5 d ago");
    expect(tiempoRelativo(hf(2), ahora, "es")).toBe("en 2 h");
    expect(tiempoRelativo(hf(48), ahora, "en")).toBe("in 2 d");
  });
});

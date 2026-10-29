import { describe, it, expect } from "vitest";
import { etiquetaCupo } from "../packages/ui/src/nx-etiqueta-cupo";

describe("nx-etiqueta-cupo", () => {
  it("sin cupos libres dice «Lleno»", () => {
    expect(etiquetaCupo(10, 10)).toBe("Lleno");
    expect(etiquetaCupo(12, 10)).toBe("Lleno");
  });

  it("pocos cupos dice «Quedan N» (1 en singular)", () => {
    expect(etiquetaCupo(7, 10)).toBe("Quedan 3");
    expect(etiquetaCupo(9, 10)).toBe("Queda 1");
  });

  it("con muchos cupos libres dice «Disponible»", () => {
    expect(etiquetaCupo(0, 10)).toBe("Disponible");
    expect(etiquetaCupo(5, 10)).toBe("Disponible");
  });

  it("capacidad 0, nula, negativa o inválida: «Sin cupo definido»", () => {
    expect(etiquetaCupo(0, 0)).toBe("Sin cupo definido");
    expect(etiquetaCupo(3, null)).toBe("Sin cupo definido");
    expect(etiquetaCupo(3, undefined)).toBe("Sin cupo definido");
    expect(etiquetaCupo(3, -5)).toBe("Sin cupo definido");
    expect(etiquetaCupo(3, NaN)).toBe("Sin cupo definido");
  });

  it("inscritos inválidos o negativos cuentan como 0", () => {
    expect(etiquetaCupo(NaN, 10)).toBe("Disponible");
    expect(etiquetaCupo(-4, 10)).toBe("Disponible");
  });
});

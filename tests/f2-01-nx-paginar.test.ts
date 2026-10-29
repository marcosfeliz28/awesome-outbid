import { describe, it, expect } from "vitest";
import { paginar } from "../packages/ui/src/nx-paginar";

const cinco = [1, 2, 3, 4, 5];

describe("nx-paginar", () => {
  it("devuelve la página pedida con total de páginas", () => {
    expect(paginar(cinco, 2, 2)).toEqual({ items: [3, 4], pagina: 2, totalPaginas: 3 });
  });

  it("la última página puede tener menos elementos", () => {
    expect(paginar(cinco, 3, 2).items).toEqual([5]);
  });

  it("una página fuera de rango se ajusta al rango válido", () => {
    expect(paginar(cinco, 0, 2).pagina).toBe(1);
    expect(paginar(cinco, -4, 2).pagina).toBe(1);
    expect(paginar(cinco, 99, 2)).toMatchObject({ pagina: 3, items: [5] });
  });

  it("una página NaN se toma como la primera", () => {
    expect(paginar(cinco, NaN, 2)).toMatchObject({ pagina: 1, items: [1, 2] });
  });

  it("un tamaño 0, negativo o NaN deja todo en una sola página", () => {
    for (const tamano of [0, -3, NaN]) {
      expect(paginar(cinco, 1, tamano)).toEqual({ items: cinco, pagina: 1, totalPaginas: 1 });
    }
  });

  it("una lista vacía da una página vacía", () => {
    expect(paginar([], 1, 10)).toEqual({ items: [], pagina: 1, totalPaginas: 1 });
  });
});

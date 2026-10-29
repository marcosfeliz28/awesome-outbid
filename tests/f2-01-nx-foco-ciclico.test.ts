import { describe, it, expect } from "vitest";
import { siguienteFoco } from "../packages/ui/src/nx-foco-ciclico";

describe("nx-foco-ciclico", () => {
  it("devuelve -1 si no hay elementos enfocables", () => {
    expect(siguienteFoco(0, 0, 1)).toBe(-1);
    expect(siguienteFoco(5, 0, 1)).toBe(-1);
    expect(siguienteFoco(0, -1, 1)).toBe(-1);
  });

  it("avanza y retrocede en círculo", () => {
    expect(siguienteFoco(0, 3, 1)).toBe(1);
    expect(siguienteFoco(2, 3, 1)).toBe(0);
    expect(siguienteFoco(0, 3, -1)).toBe(2);
  });

  it("con índice fuera de rango empieza por el primero (hacia delante) o el último (hacia atrás)", () => {
    expect(siguienteFoco(5, 3, 1)).toBe(0);
    expect(siguienteFoco(-1, 3, 1)).toBe(0);
    expect(siguienteFoco(-1, 3, -1)).toBe(2);
  });
});

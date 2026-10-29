import { describe, it, expect } from "vitest";
import { enmascararTelefono } from "../packages/ui/src/nx-telefono-mascara";

describe("nx-telefono-mascara", () => {
  it("muestra el área y los últimos 4 dígitos", () => {
    expect(enmascararTelefono("809-555-4567")).toBe("809-***-4567");
    expect(enmascararTelefono("(829) 555 4567")).toBe("829-***-4567");
  });

  it("quita el prefijo de país 1 (con o sin +)", () => {
    expect(enmascararTelefono("+1 809 555 4567")).toBe("809-***-4567");
    expect(enmascararTelefono("18095554567")).toBe("809-***-4567");
  });

  it("vacío, corto o largo da —", () => {
    expect(enmascararTelefono("")).toBe("—");
    expect(enmascararTelefono("555-4567")).toBe("—");
    expect(enmascararTelefono("1 809 555 45678")).toBe("—");
  });

  it("dígitos de otro alfabeto no cuentan (—)", () => {
    expect(enmascararTelefono("８０９ ５５５ ４５６７")).toBe("—");
  });
});

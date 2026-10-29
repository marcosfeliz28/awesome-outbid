import { describe, it, expect } from "vitest";
import { formatearCedulaRNC } from "../packages/ui/src/nx-cedula-rnc";

describe("nx-cedula-rnc", () => {
  it("da formato de cédula de 11 dígitos (3-7-1), con o sin guiones", () => {
    expect(formatearCedulaRNC("00112345678")).toBe("001-1234567-8");
    expect(formatearCedulaRNC("001-1234567-8")).toBe("001-1234567-8");
    expect(formatearCedulaRNC("001 1234567 8")).toBe("001-1234567-8");
  });

  it("da formato de RNC de 9 dígitos (3-5-1)", () => {
    expect(formatearCedulaRNC("123456789")).toBe("123-45678-9");
  });

  it("cualquier otra longitud da guion largo", () => {
    expect(formatearCedulaRNC("")).toBe("—");
    expect(formatearCedulaRNC("1234567890")).toBe("—");
    expect(formatearCedulaRNC("123456789012")).toBe("—");
  });

  it("con letras da guion largo, sin importar cuántos dígitos tenga", () => {
    expect(formatearCedulaRNC("00112345678A")).toBe("—");
    expect(formatearCedulaRNC("RNC123456789")).toBe("—");
  });
});

import { describe, it, expect } from "vitest";
import { formatearMonedaRD } from "../packages/ui/src/nx-moneda-rd";

describe("formatearMonedaRD (F2-01)", () => {
  it("cero y -0 se ven igual, sin signo", () => {
    expect(formatearMonedaRD(0)).toBe("RD$ 0.00");
    expect(formatearMonedaRD(-0)).toBe("RD$ 0.00");
  });

  it("negativos llevan el signo antes de RD$", () => {
    expect(formatearMonedaRD(-5.5)).toBe("-RD$ 5.50");
  });

  it("separa miles y muestra dos decimales", () => {
    expect(formatearMonedaRD(1234.5)).toBe("RD$ 1,234.50");
    expect(formatearMonedaRD(1e9)).toBe("RD$ 1,000,000,000.00");
  });

  it("NaN e Infinity dan una raya", () => {
    expect(formatearMonedaRD(NaN)).toBe("—");
    expect(formatearMonedaRD(Infinity)).toBe("—");
  });
});

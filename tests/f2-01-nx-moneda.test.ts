import { describe, it, expect } from "vitest";
import { formatearMonedaRD } from "../packages/ui/src/nx-moneda";

describe("nx-moneda", () => {
  it("formatea con RD$, coma de miles y dos decimales", () => {
    expect(formatearMonedaRD(1234.5)).toBe("RD$ 1,234.50");
    expect(formatearMonedaRD(1e9)).toBe("RD$ 1,000,000,000.00");
  });

  it("cero y -0 se ven igual", () => {
    expect(formatearMonedaRD(0)).toBe("RD$ 0.00");
    expect(formatearMonedaRD(-0)).toBe("RD$ 0.00");
  });

  it("los negativos llevan el signo delante de RD$", () => {
    expect(formatearMonedaRD(-1500)).toBe("-RD$ 1,500.00");
  });

  it("redondea a dos decimales", () => {
    expect(formatearMonedaRD(999.999)).toBe("RD$ 1,000.00");
  });

  it("NaN e infinitos dan —", () => {
    expect(formatearMonedaRD(Number.NaN)).toBe("—");
    expect(formatearMonedaRD(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatearMonedaRD(Number.NEGATIVE_INFINITY)).toBe("—");
  });
});

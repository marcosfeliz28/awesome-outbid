import { describe, expect, it } from "vitest";
import { posStockLabel } from "../apps/web/src/posStockLabel";
import { posChargeDisabled } from "../apps/web/src/posChargeState";

describe("Producto protegido · existencia de servicios en Caja", () => {
  it("presenta Servicio en vez de Infinity para un servicio", () => {
    expect(posStockLabel(Infinity, true, "es")).toBe("Servicio");
    expect(posStockLabel(Infinity, true, "en")).toBe("Service");
  });

  it("conserva el conteo de existencia para productos físicos", () => {
    expect(posStockLabel(12, false, "es")).toBe("12 en stock");
    expect(posStockLabel(12, false, "en")).toBe("12 in stock");
  });
});

describe("disponibilidad del botón Cobrar", () => {
  it("se deshabilita sin artículos, sin caja o con la caja en otro equipo", () => {
    expect(posChargeDisabled(0, true, false)).toBe(true);
    expect(posChargeDisabled(1, false, false)).toBe(true);
    expect(posChargeDisabled(1, true, true)).toBe(true);
    expect(posChargeDisabled(1, true, false)).toBe(false);
  });
});

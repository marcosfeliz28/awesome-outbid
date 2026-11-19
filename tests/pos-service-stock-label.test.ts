import { describe, expect, it } from "vitest";
import { posStockLabel } from "../apps/web/src/posStockLabel";

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

// Top 10 por categoría: sin profit:read no salen costo, ganancia ni margen; ventas y unidades sí.
import { describe, expect, it } from "vitest";
import { safe } from "../apps/api/src/common";

const row = {
  name: "Prueba",
  sku: "X1",
  units: 3,
  revenue: 300,
  cost: 150,
  profit: 150,
  margin: 50,
};
const body = {
  topByCategory: [{ category: "Fajas", byUnits: [row], byAmount: [row] }],
};

describe("topByCategory y permisos", () => {
  it("quien no tiene profit:read no ve costo, ganancia ni margen", () => {
    const out: any = safe(body, {
      role: "custom",
      permissions: ["reports:read"],
    } as any);
    const g = out.topByCategory[0];
    expect(g.category).toBe("Fajas");
    expect(g.byUnits[0]).toEqual({
      name: "Prueba",
      sku: "X1",
      units: 3,
      revenue: 300,
    });
    expect(g.byAmount[0]).toEqual(g.byUnits[0]);
  });
  it("con profit:read sí los ve", () => {
    const out: any = safe(body, {
      role: "manager",
      permissions: ["reports:read", "profit:read"],
    } as any);
    expect(out.topByCategory[0].byUnits[0].profit).toBe(150);
  });
});

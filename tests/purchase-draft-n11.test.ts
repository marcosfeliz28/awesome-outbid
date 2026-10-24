import { describe, expect, it } from "vitest";
import { purchaseDrafts } from "../apps/web/src/purchase-draft";

describe("N-11 · propuesta de compra sin crear orden", () => {
  it("descuenta Casa antes de proponer compra y muestra traslado", () => {
    const rows = [{ SKU: "A", Producto: "Avena", "Vendidas en el período": 30, "Venta diaria": 1, "Días restantes": 3, "Existencia en Tienda": 3, "Existencia en Casa": 12 }];
    expect(purchaseDrafts(rows, [{ id: "v1", sku: "A", costAvg: 4 }])).toEqual([expect.objectContaining({ variantId: "v1", sold30: 30, transfer: 12, buy: 15 })]);
  });

  it("ignora artículos sin ventas y nunca propone cantidad negativa", () => {
    const rows = [{ SKU: "B", Producto: "B", "Vendidas en el período": 0, "Existencia en Tienda": 10, "Existencia en Casa": 20 }];
    expect(purchaseDrafts(rows, [{ id: "v2", sku: "B", costAvg: 4 }])).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inventorySummary } from "../apps/web/src/InventorySummary";
import { shouldShowWarehouseRow } from "../apps/web/src/inventoryWarehouseView";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);

describe("filtro por almacén en Inventario", () => {
  it("mantiene visibles los agotados y negativos al consultar Tienda", () => {
    expect(shouldShowWarehouseRow("store-1", "store", 0)).toBe(true);
    expect(shouldShowWarehouseRow("store-1", "store", -2)).toBe(true);
  });

  it("en otros almacenes oculta solo cero, nunca existencias negativas", () => {
    expect(shouldShowWarehouseRow("house-1", "house", 0)).toBe(false);
    expect(shouldShowWarehouseRow("house-1", "house", -2)).toBe(true);
    expect(shouldShowWarehouseRow("all", undefined, 0)).toBe(true);
  });

  it("calcula resumen y alertas con las filas de búsqueda sin filtro de almacén", () => {
    const quantities = [{ qty: 0 }, { qty: -2 }, { qty: 4 }];
    expect(inventorySummary(quantities, (row) => row.qty)).toEqual({
      units: 2,
      low: 0,
      empty: 2,
    });
    expect(management).toContain("const searchRows = (query.data || [])");
    expect(management).toContain("<InventorySummary rows={searchRows}");
    expect(management).toContain("<InventoryAlerts rows={searchRows}");
    expect(management).toMatch(
      /const rows = searchRows\.filter\([\s\S]*?shouldShowWarehouseRow\(/,
    );
  });
});

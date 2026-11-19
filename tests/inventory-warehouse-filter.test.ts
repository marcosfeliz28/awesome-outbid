import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { warehouseIncludesVariant } from "../apps/web/src/warehouseInventory";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);

describe("filtro por almacén en Inventario", () => {
  const store = { id: "tienda", kind: "store" };
  const home = { id: "casa", kind: "home" };

  it("filtra las filas visibles por asignación, no por saldo positivo", () => {
    expect(management).toMatch(
      /const rows = \(query\.data \|\| \[\]\)[\s\S]*?\.filter\(\s*\(v: any\) =>\s*warehouseIncludesVariant\(v, selectedWarehouse\),?\s*\)/,
    );
  });

  it.each(["0", 0, "-2.5", -1, "4.5"])(
    "conserva una variante de Casa con saldo %s, positivo o no",
    (qty) => {
      const variant = { warehouseStocks: [{ warehouseId: "casa", qty }] };
      expect(warehouseIncludesVariant(variant, home)).toBe(true);
    },
  );

  it("no confunde un registro de otro almacén con un saldo local cero", () => {
    const variant = { warehouseStocks: [{ warehouseId: "otro", qty: 5 }] };
    expect(warehouseIncludesVariant(variant, home)).toBe(false);
    expect(warehouseIncludesVariant({}, home)).toBe(false);
  });

  it("conserva todo el catálogo en Todos y en Tienda, cuyo saldo viene en stock", () => {
    for (const stock of [-2, 0, 2]) {
      const variant = { stock, warehouseStocks: [] };
      expect(warehouseIncludesVariant(variant)).toBe(true);
      expect(warehouseIncludesVariant(variant, store)).toBe(true);
    }
  });
});

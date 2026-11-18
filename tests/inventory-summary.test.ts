import { describe, it, expect } from "vitest";
import { inventorySummary } from "../apps/web/src/InventorySummary";
describe("loaded inventory summary", () => {
  it("uses authorized loaded rows only and separates zero from low", () => {
    const rows = [
      { product: { minStock: 5 }, qty: 8 },
      { product: { minStock: 5 }, qty: 3 },
      { product: { minStock: 5 }, qty: 0 },
    ];
    expect(
      inventorySummary(rows, (r) => (r as (typeof rows)[number]).qty),
    ).toEqual({ units: 11, low: 1, empty: 1 });
    expect(
      inventorySummary(rows.slice(1), (r) => (r as (typeof rows)[number]).qty),
    ).toEqual({ units: 3, low: 1, empty: 1 });
  });
  it("does not fabricate zero for hidden or invalid quantities", () => {
    for (const value of [null, undefined, "", NaN, "bad"])
      expect(inventorySummary([{}], () => value)).toBeNull();
  });
});

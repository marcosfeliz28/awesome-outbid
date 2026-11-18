import { describe, expect, it } from "vitest";
import {
  inventoryEnglish,
  inventoryText,
} from "../apps/web/src/inventoryLanguage";
describe("Inventory UI translation", () => {
  it("translates all explicit labels without changing Spanish", () => {
    for (const [es, en] of Object.entries(inventoryEnglish)) {
      expect(inventoryText(es, "es")).toBe(es);
      expect(inventoryText(es, "en")).toBe(en);
      expect(en.length).toBeGreaterThan(0);
    }
  });
  it("preserves product names and unknown server strings", () => {
    for (const value of [
      "SKU-001",
      "Proteína de demostración",
      "counted",
      "stock",
      "RD$ 118.00",
    ])
      expect(inventoryText(value, "en")).toBe(value);
  });
});

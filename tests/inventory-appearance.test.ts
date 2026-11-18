import { describe, expect, it } from "vitest";
import { readInventoryAppearance } from "../apps/web/src/inventoryAppearance";
describe("Inventory direct-route preferences", () => {
  it("restores blue and black without visiting Home", () => {
    expect(
      readInventoryAppearance({
        getItem: (key) => (key === "noxeros-visual-accent" ? "blue" : "true"),
      }),
    ).toEqual({ accent: "blue", black: true });
  });
  it("uses safe defaults for missing or inaccessible storage", () => {
    expect(readInventoryAppearance({ getItem: () => null })).toEqual({
      accent: "green",
      black: false,
    });
    expect(
      readInventoryAppearance({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual({ accent: "green", black: false });
  });
});

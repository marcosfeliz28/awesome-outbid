import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
describe("Inventory readonly insights", () => {
  it("uses only existing catalog images and a neutral fallback", () => {
    const s = readFileSync("apps/web/src/InventoryProduct.tsx", "utf8");
    expect(s).toContain("src={image}");
    expect(s).toContain('loading="lazy"');
    expect(s).toContain("onError");
    expect(s).not.toContain("/products/");
  });
  it("limits alerts to loaded stock and never changes business records", () => {
    const s = readFileSync("apps/web/src/InventoryAlerts.tsx", "utf8");
    expect(s).toContain("Number.isFinite");
    expect(s).toContain("alerts.slice(0, 5)");
    expect(s).toContain("onInspect(row)");
    expect(s).not.toMatch(/\bpost\(/);
  });
});

it("loads bounded permission-scoped history without polling or writes", () => {
  const s = readFileSync("apps/web/src/InventoryMovements.tsx", "utf8");
  expect(s).toContain('can(user.permissions, "catalog:read")');
  expect(s).toContain("enabled: allowed");
  expect(s).toContain("user?.branchId, user?.id");
  expect(s).toContain("refetchInterval: false");
  expect(s).toContain("query.data.slice(0, 5)");
  expect(s).not.toMatch(/\bpost\(/);
});

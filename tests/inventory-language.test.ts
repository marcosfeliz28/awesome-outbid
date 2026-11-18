import { readFileSync } from "node:fs";
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

 it("scopes translated forms and ledger to Inventory, preserving API codes", () => {
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");
  const inventory = source.slice(source.indexOf("export function Inventory()"), source.indexOf("export function Purchases()"));
  expect(inventory.match(/<FormModal\s+english=\{inventoryLanguage === "en"\}/g)).toHaveLength(2);
  expect(inventory).toContain('<Kardex variantId={kardex.id} english={inventoryLanguage === "en"} />');
  expect(inventory.match(/<QueryState query=\{(?:query|counts)\} english=\{inventoryLanguage === "en"\}/g)).toHaveLength(2);
  expect(inventory).toContain('value: "supplier_return"');
  expect(inventory).toContain('data.type === "supplier_return"');
  expect(inventory).toContain('translateInventory("Cantidad (+ entrada / − salida)")');
  expect(source).toContain('english = false');
 });

it("keeps Spanish loading and variant defaults, opting Inventory into English", () => {
  const helpers = readFileSync("apps/web/src/helpers.tsx", "utf8");
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");
  const ui = readFileSync("packages/ui/src/index.tsx", "utf8");
  expect(helpers).toContain('fallback = "Única"');
  expect(helpers).toContain('.join(" · ") || fallback');
  expect(helpers).toContain('<Loading label={english ? "Loading data…" : undefined} />');
  expect(ui).toContain('label = "Cargando datos…"');
  expect(source).toContain('attrLabel(v.attributes, inventoryLanguage === "en" ? "Standard variant" : "Única")');
  expect(helpers).toContain('onClick={() => query.refetch()}');
});

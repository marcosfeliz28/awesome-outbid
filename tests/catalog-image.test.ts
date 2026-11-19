import { expect, it } from "vitest";
import { handleCatalogImageError } from "../apps/web/src/catalogImage";
import { readFileSync } from "node:fs";
it("falls back once on broken product photo without retrying a broken placeholder", () => {
  let src = "/missing-photo.webp", changes = 0;
  const image = { getAttribute: () => src, setAttribute: (_key: string, value: string) => { src = value; changes++; } };
  handleCatalogImageError(image);
  expect(src).toBe("/products/accessories.svg");
  handleCatalogImageError(image);
  expect(changes).toBe(1);
  src = "/new-product-photo.webp";
  handleCatalogImageError(image);
  expect(changes).toBe(2);
});
it("wires table image fallback and resets image identity when source changes", () => {
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");
  expect(source).toContain('key={p.imageUrl}');
  expect(source).toContain('onError={(event) => handleCatalogImageError(event.currentTarget)}');
});
it("inventory stock and count tables propagate language including pagination and dates", () => {
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");
  const inventory = source.slice(source.indexOf("export function Inventory()"), source.indexOf("export function Purchases()"));
  expect(inventory.match(/<DataTable\s+english=\{inventoryLanguage === "en"\}/g)).toHaveLength(2);
  expect(inventory).toContain('dateLabel(lot.expiryDate, inventoryLanguage === "en" ? "en-US" : "es-DO")');
  expect(inventory).toContain('dateLabel(c.createdAt, inventoryLanguage === "en" ? "en-US" : "es-DO")');
});

it("keeps catalog actions reachable and brings mobile preview before list", () => {
 const css = readFileSync("apps/web/src/catalogPresentation.css", "utf8");
 expect(css).toContain("table-layout:fixed");
 expect(css).toContain(".catalog-fusion .table-actions { flex-wrap:wrap; gap:4px; }");
 expect(css).toContain(".catalog-fusion-preview { order:2; }");
 expect(css).toContain(".catalog-fusion-main > .panel { order:3; }");
 expect(css).toContain(".app-shell:has(.catalog-fusion) .goods-mobile-bar { position:fixed; }");
 expect(css).toContain('Georgia, "Times New Roman", serif');
});
it("localizes import entry while disclosing untranslated review", () => {
 const source=readFileSync("apps/web/src/InventoryImport.tsx","utf8");
 expect(source).toContain('english ? "Import inventory" : "Importar inventario"');
 expect(source).toContain('closeLabel={english ? "Close" : "Cerrar"}');
 expect(source).toContain("The import review is currently displayed in Spanish.");
});

it("keeps merchandise toolbar out of shell layout on mobile", () => {
 const css=readFileSync("apps/web/src/catalogPresentation.css","utf8");
 expect(css).not.toMatch(/\.goods-mobile-bar\s*\{[^}]*position:\s*static/);
 expect(css).toContain('.app-shell:has(.catalog-fusion) .goods-mobile-bar .button.primary');
 const globalCss=readFileSync("apps/web/src/styles.css","utf8");
 // El producto deja 176 px para que la barra y el lanzador no cubran el contenido.
 expect(globalCss).toMatch(/\.app-shell:has\(\.goods-mobile-bar\) \.main-content\s*\{\s*padding-bottom:\s*calc\(176px \+ env\(safe-area-inset-bottom\)\);/);
 expect(globalCss).toMatch(/\.app-shell:has\(\.goods-actions\.has-items\) \.main-content\s*\{\s*padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom\)\);/);
});
it("fits long preview price and prevents desktop heading/category spill", () => {
  const css = readFileSync("apps/web/src/catalogPresentation.css", "utf8");
  expect(css).toContain('.catalog-fusion-preview { container-type:inline-size; }');
  expect(css).toContain('font-size:clamp(14px,7.5cqw,24px)');
  expect(css).toContain('th:nth-child(3) { white-space:nowrap; overflow-wrap:normal; }');
  expect(css).toContain('max-width:100%; white-space:normal; overflow-wrap:anywhere;');
});

it("keeps the detail modal named once and reuses the guarded photo fallback", () => {
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");
  const modalStart = source.indexOf("open={!!detail}");
  const modal = source.slice(modalStart, source.indexOf("</Modal>", modalStart));
  expect(modal).toContain('title={detail?.name || ct("Producto")}');
  expect(modal).not.toContain("<h2>{detail.name}</h2>");

  const general = modal.slice(modal.indexOf('className="product-detail"'));
  const photo = general.match(/<img\s[\s\S]*?\/>/)?.[0];
  expect(photo).toContain('key={detail.id + ":" + detail.imageUrl}');
  expect(photo).toContain('src={detail.imageUrl || "/products/accessories.svg"}');
  expect(photo).toContain('onError={(event) => handleCatalogImageError(event.currentTarget)}');
  expect(photo).toContain('alt={detail.name}');
});

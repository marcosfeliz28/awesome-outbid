import { catalogText } from "../apps/web/src/catalogLanguage";
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const view = readFileSync("apps/web/src/CatalogPresentation.tsx", "utf8");
const css = readFileSync("apps/web/src/catalogPresentation.css", "utf8");
const management = readFileSync("apps/web/src/Management.tsx", "utf8");
describe("Productos: presentación sin mutaciones", () => {
  it("wrapper reversible: conserva código de negocio byte por byte", () => {
    const record = JSON.parse(readFileSync("docs/diseno/productos-higgsfield/PRESENTACION_REVERSIBLE.json", "utf8"));
    let restored = management;
    for (const edit of [...record.changes].reverse()) {
      expect(restored.split(edit.after).length).toBe(2);
      restored = restored.replace(edit.after, edit.before);
    }
    expect(createHash("sha256").update(restored).digest("hex")).toBe(record.base_sha256);
  });

  it("usa filas filtradas y errores, sin datos de demostración", () => {
    expect(management).toContain("products={rows} loading={query.isPending} failed={query.isError}");
    expect(view).toContain('available ? value : "—"');
    expect(view).not.toMatch(/DEMO|128|\bfetch\(|\bpost\(|\bapi\(/);
  });
  it("conserva permisos de edición y detalle original", () => {
    expect(management).toContain('can(user.permissions, "catalog:write")');
    expect(management).toContain('can(user.permissions, "profit:read")');
    expect(management).toContain('setDetail(p); setTab("General");');
    expect(view).toContain("onDetail(selected)");
  });
  it("selección accesible y fallback al filtrar", () => {
    expect(view).toContain("products.find((p) => p.id === selectedId) ?? products[0]");
    expect(view).toContain('className="catalog-fusion-picker"');
    expect(view).toContain('type="button"');
    expect(view).toContain('selected.variants.length');
  });
  it("soporta tema, azul, foco y movimiento reducido", () => {
    expect(css).toContain('data-theme="dark"');
    expect(css).toContain('data-accent="blue"');
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("max-width: 520px");
  });
});

it("translates UI without changing product data or tab keys", () => {
  expect(catalogText(true,"Precio de venta")).toBe("Sale price");
  expect(catalogText(false,"Precio de venta")).toBe("Precio de venta");
  expect(catalogText(true,"Marca real 900 g")).toBe("Marca real 900 g");
  expect(management).toContain('const [tab, setTab] = useState("General")');
  expect(management).toContain('tab === "Variantes"');
  expect(management).toContain('unit: "servicio", minStock: 0');
  expect(management).toContain('initial: "talla"');
  expect(management).toContain('initial: "Negro,Azul"');
});
it("preserves original mutation endpoints and permission gates", () => {
  const catalog = management.slice(management.indexOf("export function Catalog"), management.indexOf("export function Barcode"));
  for (const invariant of ['post("/products",','post("/products/" + matrix.id + "/variants",','can(user.permissions, "catalog:write")','can(user.permissions, "profit:read")','can(user.permissions, "inventory:import")','setMatrix(p)','setLabels(p)','setDetail(p)']) expect(catalog).toContain(invariant);
  expect(catalog).not.toContain('post("/sales');
});
it("keeps heading above metrics and uses real photos", () => {
  expect(view.indexOf("{heading}")).toBeLessThan(view.indexOf('className="catalog-fusion-metrics"'));
  expect(view).toContain('selected.imageUrl || "/products/accessories.svg"');
  expect(view).toContain("failedImages.has(selected.imageUrl)");
  expect(css).toContain('.catalog-fusion-price { white-space: nowrap;');
});
it("retains status distinctions and locale without changing timezone", () => {
  const helper = readFileSync("apps/web/src/helpers.tsx", "utf8");
  expect(management).toContain("status: query.error.status");
  expect(helper).toContain("query.error?.status === 401");
  expect(helper).toContain("query.error?.status === 403");
  expect(helper).toContain('locale = "es-DO"');
  expect(helper).toContain('timeZone: "America/Santo_Domingo"');
  expect(management).toContain('dateLabel(l.expiryDate, en ? "en-US" : "es-DO")');
  expect(management).toContain('dateLabel(m.createdAt, english ? "en-US" : "es-DO")');
});
it("failed preview photos fall back once and are counted without invented data", () => {
  expect(view).toContain('failedImages.has(p.imageUrl)');
  expect(view).toContain('!failedImages.has(selected.imageUrl)');
  expect(view).toContain('"Photo unavailable" : "Foto no disponible"');
});

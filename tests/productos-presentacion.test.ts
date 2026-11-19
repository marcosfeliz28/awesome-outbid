import { catalogText } from "../apps/web/src/catalogLanguage";
import { describe, it, expect } from "vitest";
import { managementDigest, managementProductLedger, reverseManagement } from "./management-presentation-ledgers";
import { readFileSync } from "node:fs";
import ts from "typescript";
const view = readFileSync("apps/web/src/CatalogPresentation.tsx", "utf8");
const css = readFileSync("apps/web/src/catalogPresentation.css", "utf8");
const management = readFileSync("apps/web/src/Management.tsx", "utf8");
describe("Productos: presentación sin mutaciones", () => {
  it("wrapper reversible: conserva código de negocio byte por byte", () => {
    const { catalog, operations } = managementProductLedger;
    const baseline = reverseManagement(reverseManagement(management, operations), catalog);
    expect(managementDigest(baseline)).toBe(catalog.base_sha256);
  });

  it("usa filas filtradas y errores, sin datos de demostración", () => {
    const file = ts.createSourceFile(
      "Management.tsx", management, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
    );
    const catalog = file.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === "Catalog",
    );
    expect(catalog).toBeDefined();
    const wrappers: ts.JsxElement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "CatalogPresentation")
        wrappers.push(node);
      ts.forEachChild(node, visit);
    };
    visit(catalog!);
    expect(wrappers).toHaveLength(1);
    const wrapper = wrappers[0];
    const props = Object.fromEntries(
      wrapper.openingElement.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((prop) => [prop.name.getText(file), prop.initializer?.getText(file)]),
    );
    expect(props.products).toBe("{rows}");
    expect(props.loading).toBe("{query.isPending}");
    expect(props.failed).toBe("{query.isError}");
    expect(props.onDetail).toMatch(/^\{\(p\) => \{\s*setDetail\(p\);\s*setTab\("General"\);\s*\}\}$/);
    const content = wrapper.children.filter(ts.isJsxElement);
    expect(content.map((node) => node.openingElement.tagName.getText(file))).toEqual(["Heading", "section"]);
    expect(content[1].openingElement.getText(file)).toContain('aria-labelledby="catalog-list-title"');
    expect(content[1].getText(file)).toContain("<QueryState query={query} english={en}>");
    expect(view).toContain('available ? value : "—"');
    expect(view).not.toMatch(/DEMO|128|\bfetch\(|\bpost\(|\bapi\(/);
  });
  it("conserva permisos de edición y detalle original", () => {
    const start = management.indexOf("export function Catalog()");
    const catalog = management.slice(
      start,
      management.indexOf("export function Barcode", start),
    );
    expect(catalog).toContain('can(user.permissions, "catalog:write")');
    expect(catalog).toContain('can(user.permissions, "profit:read")');
    // Un salto de línea no cambia el comportamiento del botón Ver.
    expect(catalog).toMatch(
      /<button\s+aria-label=\{ct\("Ver "\) \+ p\.name\}\s+onClick=\{\(\) => \{\s*setDetail\(p\);\s*setTab\("General"\);\s*\}\}/,
    );
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

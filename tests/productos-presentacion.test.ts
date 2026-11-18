import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const view = readFileSync("apps/web/src/CatalogPresentation.tsx", "utf8");
const css = readFileSync("apps/web/src/catalogPresentation.css", "utf8");
const management = readFileSync("apps/web/src/Management.tsx", "utf8");
describe("Productos: presentación sin mutaciones", () => {
  it("wrapper reversible: conserva código de negocio byte por byte", () => {
    const restored = management
      .replace('import { CatalogPresentation } from "./CatalogPresentation";\n', '')
      .replace('      <CatalogPresentation products={rows} loading={query.isLoading} failed={query.isError} onDetail={(p) => { setDetail(p); setTab("General"); }}>\n', '')
      .replace('      </CatalogPresentation>\n', '');
    expect(createHash("sha256").update(restored).digest("hex")).toBe("1d79193b05abcbb2701e6c717e65cd21ce149f219eea8e1120fac5127285e247");
  });

  it("usa filas filtradas y errores, sin datos de demostración", () => {
    expect(management).toContain("products={rows} loading={query.isLoading} failed={query.isError}");
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

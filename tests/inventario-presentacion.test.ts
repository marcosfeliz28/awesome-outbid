import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
const read = (path: string) => readFileSync(path, "utf8");
describe("Inventario Higgsfield: presentación sin alterar negocio", () => {
  it("conserva Inventory byte a byte al quitar el contenedor visual", () => {
    const source = read("apps/web/src/Management.tsx");
    const record = JSON.parse(
      read("docs/diseno/inventario/PRESENTACION_REVERSIBLE.json"),
    );
    let inventory = source.slice(
      source.indexOf("export function Inventory()"),
      source.indexOf("export function Purchases()"),
    );
    for (const edit of [...record.changes].reverse()) {
      expect(inventory).toContain(edit.after);
      inventory = inventory.replace(edit.after, edit.before);
    }
    expect(createHash("sha256").update(inventory).digest("hex")).toBe(
      record.inventory_sha256,
    );
  });
  it("incluye accesibilidad, preferencias y responsive sin métricas ficticias", () => {
    const css = read("apps/web/src/fusion-inventory.css").replace(
      /\s*:\s*/g,
      ":",
    );
    for (const token of [
      'data-theme="dark"',
      'data-accent="blue"',
      'data-overview-surface="black"',
      "prefers-reduced-motion:reduce",
      "forced-colors:active",
      ":focus-visible",
      "max-width:600px",
    ])
      expect(css).toContain(token);
    expect(css).not.toMatch(/url\(|content:\s*['"](?:RD|\d)/);
  });
});

it("corrige el acento heredado y evita barra superpuesta en móvil", () => {
  const css = read("apps/web/src/fusion-inventory.css");
  expect(css).toContain("--primary: var(--iv-accent)");
  expect(css).toContain("--primary-soft: var(--iv-pressed)");
  expect(css).toMatch(/\.goods-mobile-bar\s*\{\s*position: static;/);
  expect(css).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

it("distingue disabled sin cambiar el atributo ni las acciones", () => {
  const css = read("apps/web/src/fusion-inventory.css");
  expect(css).toMatch(
    /button:disabled\s*\{[^}]*background: var\(--iv-deep\) !important/,
  );
  expect(css).toMatch(/button:disabled\s*\{[^}]*cursor: not-allowed/);
});

it("IT-018/IT-019: aclara el encabezado de Excel y separa su acción", () => {
  const panel = read("apps/web/src/WarehousesPanel.tsx");
  const css = read("apps/web/src/styles.css");
  expect(panel).toContain("PRECIODETALLE (sin espacio)");
  expect(panel).toContain('className="casa-import-actions"');
  expect(css).toMatch(
    /\.casa-import-actions\s*\{[^}]*display:\s*flex[^}]*gap:\s*10px/,
  );
});

it("INV-011: mantiene las tres acciones dentro del borde visible en escritorio", () => {
  const css = read("apps/web/src/fusion-inventory.css");
  expect(css).toMatch(
    /@media \(min-width: 769px\)[\s\S]*?\.fusion-inventory :is\(th, td\):last-child\s*\{[\s\S]*?position:\s*sticky[\s\S]*?right:\s*0/,
  );
  expect(css).toMatch(
    /\.fusion-inventory \.table-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?min-width:\s*160px/,
  );
});

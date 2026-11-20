import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { reverseIt003 } from "./it003-preservation";
const read = (path: string) => readFileSync(path, "utf8");
describe("Inventario Higgsfield: presentación sin alterar negocio", () => {
  it("conserva Inventory byte a byte al quitar el contenedor visual", () => {
    const source = reverseIt003(
      read("apps/web/src/Management.tsx"),
      "Management",
    );
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

describe("A10 · presentación responsive de GV e Inventario", () => {
  it("GV-17 muestra una pista de desplazamiento en sus tablas móviles", () => {
    const css = read("apps/web/src/gv.css");

    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.gv-reports \.table-wrap::after\s*\{[^}]*content:\s*"Desliza ↔"/,
    );
    expect(css).toMatch(
      /\.gv-reports \.table-wrap\s*\{[^}]*overflow-x:\s*auto[^}]*scrollbar-width:\s*auto/,
    );
  });

  it("GV-18 reserva espacio inferior para que la barra móvil no tape contenido", () => {
    const css = read("apps/web/src/gv.css");

    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.gv-page\s*\{[^}]*padding-bottom:\s*calc\(96px \+ env\(safe-area-inset-bottom\)\)/,
    );
  });

  it("INV-011 mantiene juntas y visibles las tres acciones a 390 px", () => {
    const source = read("apps/web/src/Management.tsx");
    const css = read("apps/web/src/styles.css");

    expect(source).toContain('className="table-actions inventory-row-actions"');
    expect(css).toMatch(
      /\.fusion-inventory \.table-actions\.inventory-row-actions\s*\{[^}]*flex-wrap:\s*nowrap[^}]*min-width:\s*max-content/,
    );
    expect(css).toMatch(
      /@media \(max-width: 600px\)[\s\S]*\.fusion-inventory \.table-actions\.inventory-row-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
  });
});

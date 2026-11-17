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

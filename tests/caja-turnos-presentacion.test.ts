import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
describe("Caja y turnos: presentación aislada", () => {
  it("conserva Management completo byte por byte al revertir import y clase", () => {
    const record = JSON.parse(
      readFileSync(
        "docs/diseno/caja-turnos/PRESENTACION_REVERSIBLE.json",
        "utf8",
      ),
    );
    let source = readFileSync("apps/web/src/Management.tsx", "utf8");
    for (const edit of [...record.changes].reverse()) {
      expect(source).toContain(edit.after);
      source = source.replace(edit.after, edit.before);
    }
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      record.base_sha256,
    );
  });
  it("ofrece temas y accesibilidad sin cifras ni fondos rasterizados inventados", () => {
    const css = readFileSync("apps/web/src/fusion-caja-turnos.css", "utf8");
    for (const token of [
      "fusion-cash-turnos",
      'data-theme="dark"',
      'data-accent="blue"',
      'data-overview-surface="black"',
      "prefers-reduced-motion:reduce",
      "forced-colors:active",
      ":focus-visible",
    ])
      expect(css.replace(/\s*:\s*/g, ":")).toContain(token);
    expect(css).not.toMatch(/url\(|content:\s*['"](?:RD|\d)/);
  });
});

it("historial no expone importes esperados ni diferencias sin permiso", () => {
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");
  expect(source).toContain('if (!canSeeExpected) return "—";');
  expect(source).toMatch(
    /label: "Diferencias por método",\s*render: \(s\) =>\s*canSeeExpected &&/,
  );
});

it("aplica acento coherente y permite envolver las acciones del historial", () => {
  const css = readFileSync("apps/web/src/fusion-caja-turnos.css", "utf8");
  expect(css).toContain("--primary: var(--ct-accent)");
  expect(css).toContain(".button.primary");
  expect(css).toContain(".brand-icon");
  expect(css).toContain("table-layout: fixed");
  expect(css).toContain("white-space: normal");
  expect(css).not.toContain("Georgia");
});

it("reserva ancho y apilado para acciones móviles y acento de Mercancía", () => {
  const css = readFileSync("apps/web/src/fusion-caja-turnos.css", "utf8");
  expect(css).toContain('td[data-label="Acciones"]');
  expect(css).toContain(".goods-mobile-bar .button");
  expect(css).toContain("flex-shrink: 0");
});

it("importe principal se adapta a su tarjeta, no al viewport", () => {
  const css = readFileSync("apps/web/src/fusion-caja-turnos.css", "utf8");
  expect(css).toContain("container-type: inline-size");
  expect(css).toContain("font-size: clamp(18px, 9cqw, 40px)");
  expect(css).toContain("overflow-x: auto");
});

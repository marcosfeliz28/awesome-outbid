import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyIllustration } from "./EmptyIllustration";
import { Empty } from "../../../packages/ui/src/index";

describe("ilustraciones de estados vacíos", () => {
  it("mantiene la estrella original para los estados sin ilustración", () => {
    const markup = renderToStaticMarkup(createElement(Empty, { title: "Sin clientes" }));
    expect(markup).toContain('class="empty-orbit"');
  });
  it("no añade la estrella cuando se proporciona una ilustración", () => {
    const markup = renderToStaticMarkup(createElement(Empty, {
      title: "Sin inventario", illustration: createElement(EmptyIllustration, { kind: "inventario" }),
    }));
    expect(markup).toContain('/ilustraciones/vacio-inventario.svg');
    expect(markup).not.toContain('class="empty-orbit"');
  });
  for (const kind of ["carrito", "inventario", "reportes"] as const) {
    it(`${kind} es pequeña y autocontenida`, () => {
      const svg = readFileSync(new URL(`../public/ilustraciones/vacio-${kind}.svg`, import.meta.url), "utf8");
      expect(Buffer.byteLength(svg)).toBeLessThan(10_000);
      expect(svg).toMatch(/^<svg\s[^>]*viewBox="0 0 240 160"/);
      expect(svg).not.toMatch(/<(?:script|foreignObject|image|text)\b|\bon\w+\s*=|(?:href|url)\s*[:=(]|<!DOCTYPE/i);
      const colors = svg.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
      expect(colors.length).toBeGreaterThan(0);
      expect(colors.every((color) => ["#7c3aed", "#a78bfa", "#43e3b1", "#64748b"].includes(color.toLowerCase()))).toBe(true);
    });
    it(`${kind} se presenta como imagen decorativa adaptable`, () => {
      const markup = renderToStaticMarkup(createElement(EmptyIllustration, { kind }));
      expect(markup).toContain(`src="/ilustraciones/vacio-${kind}.svg"`);
      expect(markup).toContain('alt=""');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain("max-width:100%");
    });
  }
  it("reserva las ilustraciones para los tres estados vacíos indicados", () => {
    const pos = readFileSync(new URL("./POS.tsx", import.meta.url), "utf8");
    const management = readFileSync(new URL("./Management.tsx", import.meta.url), "utf8");
    expect(pos).toMatch(/className="cart-empty-state"[\s\S]*?<EmptyIllustration kind="carrito"\s*\/>[\s\S]*?Carrito vacío/);
    expect(management).toMatch(/empty="No encontramos artículos en el inventario"\s+emptyIllustration="inventario"/);
    expect(management).toMatch(/empty="No hay datos para este período"\s+emptyIllustration="reportes"/);
  });
});

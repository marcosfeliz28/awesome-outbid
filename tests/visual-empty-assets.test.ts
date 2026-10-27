import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ilustraciones de estados vacíos", () => {
  for (const name of ["carrito", "inventario", "reportes"]) {
    it(`${name} es pequeña y autocontenida`, () => {
      const svg = readFileSync(new URL(`../apps/web/public/ilustraciones/vacio-${name}.svg`, import.meta.url), "utf8");
      expect(Buffer.byteLength(svg)).toBeLessThan(10_000);
      expect(svg).toMatch(/^<svg\s[^>]*viewBox="0 0 240 160"/);
      expect(svg).not.toMatch(/<(?:script|foreignObject|image|text)\b|\bon\w+\s*=|(?:href|url)\s*[:=(]|<!DOCTYPE/i);
      const colors = svg.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
      expect(colors.length).toBeGreaterThan(0);
      expect(colors.every((color) => ["#7c3aed", "#a78bfa", "#43e3b1", "#64748b"].includes(color.toLowerCase()))).toBe(true);
    });
  }
});

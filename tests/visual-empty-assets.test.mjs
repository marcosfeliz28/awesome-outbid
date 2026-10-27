import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const name of ['carrito', 'inventario', 'reportes']) {
  test(`ilustración ${name} es pequeña y autocontenida`, () => {
    const svg = readFileSync(new URL(`../apps/web/public/ilustraciones/vacio-${name}.svg`, import.meta.url), 'utf8');
    assert.ok(Buffer.byteLength(svg) < 10_000);
    assert.match(svg, /^<svg\s[^>]*viewBox="0 0 240 160"/);
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image|text)\b|\bon\w+\s*=|(?:href|url)\s*[:=(]|<!DOCTYPE/i);
    const colors = svg.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    assert.ok(colors.length > 0);
    assert.ok(colors.every((color) => ['#7c3aed', '#a78bfa', '#43e3b1', '#64748b'].includes(color.toLowerCase())));
  });
}

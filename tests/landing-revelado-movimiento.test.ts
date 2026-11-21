// Revelado suave de las secciones de la portada: solo transform y opacity, 180 ms,
// se apaga con prefers-reduced-motion y el contenido es visible sin JavaScript.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync("apps/web/public/venta/index.html", "utf8");
// El script vive en un archivo propio (la CSP script-src 'self' bloquea los scripts en línea).
const js = readFileSync("apps/web/public/venta/revelado.js", "utf8");

it("el revelado usa solo transform/opacity, 180 ms y respeta movimiento reducido", () => {
  expect(html).toMatch(/\.reveal\s*\{[^}]*opacity:\s*0[^}]*transform/);
  expect(html).toMatch(/transition:\s*opacity 180ms[^;]*,\s*transform 180ms/);
  expect(html).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.reveal\s*\{[^}]*transition:\s*none/,
  );
  expect(js).toMatch(/IntersectionObserver/);
  expect(html).not.toMatch(/transition:[^;]*(width|height|margin|top|left)/);
});

import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("mantiene un bloque de tokens por tema y conserva los valores visuales", () => {
  const css = readFileSync("apps/web/src/styles.css", "utf8");
  expect(css.match(/^:root\s*\{/gm)).toHaveLength(1);
  expect(css.match(/^:root\[data-theme="dark"\]\s*\{/gm)).toHaveLength(1);
  const light = css.match(/^:root\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
  const dark = css.match(/^:root\[data-theme="dark"\]\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
  expect(light).toContain("--sidebar-w: clamp(185px, 15.5vw, 225px)");
  expect(light).toContain("--pos-cart-w: clamp(300px, 29vw, 400px)");
  expect(light).toContain("--lumina-laser: linear-gradient(90deg, #7c3aed, #10b981, #3b82f6, #7c3aed)");
  expect(dark).toContain("--shadow: 0 18px 42px rgba(0, 0, 0, 0.28)");
  expect(dark).toContain("--lumina-grid: rgba(255, 255, 255, 0.025)");
});

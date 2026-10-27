import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("anima la línea del marco una sola vez y respeta movimiento reducido", () => {
  const css = readFileSync("apps/web/src/styles.css", "utf8");
  const line = css.match(/\.app-shell:not\(\.pos-shell\) \.topbar::after\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  expect(line).toMatch(/animation:\s*lumina-laser\s+4\.8s\s+linear\s+1\s+both/);
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.app-shell:not\(\.pos-shell\) \.topbar::after\s*\{\s*animation:\s*none/);
});

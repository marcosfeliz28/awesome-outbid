import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("GV-17: reportes móviles indican que las tablas se pueden desplazar", () => {
  const view = readFileSync("apps/web/src/Gv.tsx", "utf8");
  const css = readFileSync("apps/web/src/gv.css", "utf8");
  expect(view.match(/table-wrap gv-table-wrap/g)?.length).toBeGreaterThanOrEqual(3);
  expect(css).toMatch(/\.gv-reports \.gv-table-wrap::after\s*\{[\s\S]*?content:\s*"↔"/);
  expect(css).toMatch(/\.gv-reports \.gv-table-wrap\s*\{[\s\S]*?scrollbar-width:\s*thin/);
});

it("GV-18: Caja GV reserva espacio si la barra móvil está activa", () => {
  const css = readFileSync("apps/web/src/premiumOperations.css", "utf8");
  expect(css).toMatch(
    /@media \(max-width: 768px\)[\s\S]*?\.app-shell:has\(\.goods-mobile-bar\)[\s\S]*?\[data-premium-area="gv"\][\s\S]*?padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom\)\)/,
  );
});

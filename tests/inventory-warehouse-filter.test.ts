import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);

describe("filtro por almacén en Inventario", () => {
  it("oculta variantes sin existencia al elegir un almacén concreto", () => {
    expect(management).toMatch(
      /const rows = \(query\.data \|\| \[\]\)[\s\S]*?\.filter\(\s*\(v: any\) =>\s*warehouseView === "all" \|\| Number\(visibleStock\(v\)\) > 0,?\s*\)/,
    );
  });
});

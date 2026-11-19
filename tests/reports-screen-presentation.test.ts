import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);

describe("presentación de reportes en Management", () => {
  it("traduce códigos, oculta columnas internas y muestra las filas preparadas", () => {
    expect(management).toContain("reportCellText");
    expect(management).toContain("reportColumnVisible");
    expect(management).toContain("reportDisplayRows");
    expect(management).toMatch(
      /\.filter\(\(k\) => k !== "class" && reportColumnVisible\(report, k\)\)/,
    );
    expect(management).toMatch(
      /reportCellText\(report, key, row\[key\]\)/,
    );
    expect(management).toContain("rows={displayRows}");
  });
});

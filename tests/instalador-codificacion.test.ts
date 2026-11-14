import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// El PowerShell de Windows 10 lee como texto antiguo (ANSI) los scripts en UTF-8
// que no traen marca BOM: «dueño» sale como «dueÃ±o». Todo .ps1 del instalador
// con acentos debe empezar por la marca BOM.
it("los scripts de PowerShell del instalador con acentos llevan marca BOM", () => {
  const files = execSync("git ls-files instalador", { encoding: "utf8" })
    .split("\n")
    .filter((f) => f.endsWith(".ps1"));
  expect(files.length).toBeGreaterThan(10);
  const sinMarca = files.filter((f) => {
    const bytes = readFileSync(f);
    const tieneBom =
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const tieneAcentos = /[^\x00-\x7f]/.test(bytes.toString("utf8"));
    return tieneAcentos && !tieneBom;
  });
  expect(sinMarca).toEqual([]);
});

// Lista cada tests/*.test.ts con su primer describe. Salida: docs/auditoria/MAPA_DE_PRUEBAS.md
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const archivos = execSync("git ls-files tests", { encoding: "utf8" })
  .split("\n").filter((f) => /^tests\/[^/]+\.test\.ts$/.test(f)).sort();
const filas = archivos.map((f) => {
  const m = readFileSync(f, "utf8").match(/describe\(\s*(["'`])(.*?)\1/);
  return `| ${f} | ${m ? m[2].replace(/\|/g, "/") : "NO ENCONTRADO"} |`;
});
writeFileSync("docs/auditoria/MAPA_DE_PRUEBAS.md", [
  "# Mapa de pruebas (archivo y primer describe)", "",
  "Borrador verificado por script. Fuente: rama claude-pc/bloque15 sobre nexora-cloud.", "",
  "| Archivo | Primer describe |", "|---|---|", ...filas, "",
].join("\n"));
console.log("pruebas listadas:", archivos.length, "sin describe:", filas.filter((x) => x.endsWith("NO ENCONTRADO |")).length);

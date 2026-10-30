// Busca «e-CF», «DGII» y «Nexora POS» en docs/venta y docs/diseno/borradores-local. Salida: docs/auditoria/PROHIBIDOS_EN_BORRADORES.md
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PROHIBIDOS = ["e-CF", "DGII", "Nexora POS"];
const archivos = [
  ...execSync("git ls-files docs/venta", { encoding: "utf8" }).split("\n"),
  ...(existsSync("docs/diseno/borradores-local") ? execSync("git ls-files docs/diseno/borradores-local", { encoding: "utf8" }).split("\n") : []),
].filter((f) => f.endsWith(".md"));
const hallazgos = [];
for (const f of archivos) {
  readFileSync(f, "utf8").split("\n").forEach((linea, i) => {
    for (const p of PROHIBIDOS) if (linea.includes(p)) hallazgos.push(`| ${f}:${i + 1} | ${p} | ${linea.trim().slice(0, 120).replace(/\|/g, "/")} |`);
  });
}
writeFileSync("docs/auditoria/PROHIBIDOS_EN_BORRADORES.md", [
  "# Términos prohibidos en borradores (solo informe)", "",
  "Borrador verificado por script. «Nexora POS» puede aparecer como nombre anterior; lo decide Norexos 1.", "",
  "| archivo:línea | término | texto |", "|---|---|---|", ...hallazgos, "",
].join("\n"));
console.log("archivos revisados:", archivos.length, "hallazgos:", hallazgos.length);

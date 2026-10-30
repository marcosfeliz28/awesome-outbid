// Busca en docs y apps/web/src texto con mojibake («Ã», «â€») o «?» dentro de palabras. Solo informe.
// Salida: docs/auditoria/TILDES_NUEVAS.md
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const archivos = execSync("git ls-files docs apps/web/src", { encoding: "utf8" }).split("\n")
  .filter((f) => /\.(md|tsx?|css|html|json)$/.test(f) && !f.startsWith("docs/operacion/") && !f.startsWith("docs/legal/") && !f.startsWith("docs/seguridad/"));
const reMojibake = /Ã|â€/;
const reInterrogacion = /[a-záéíóúñA-ZÁÉÍÓÚÑ]\?[a-záéíóúñA-ZÁÉÍÓÚÑ]/;
const hallazgos = [];
for (const f of archivos) {
  readFileSync(f, "utf8").split("\n").forEach((linea, i) => {
    if (reMojibake.test(linea)) hallazgos.push(`| ${f}:${i + 1} | mojibake | ${linea.trim().slice(0, 110).replace(/\|/g, "/")} |`);
    else if (reInterrogacion.test(linea)) hallazgos.push(`| ${f}:${i + 1} | ? en palabra | ${linea.trim().slice(0, 110).replace(/\|/g, "/")} |`);
  });
}
writeFileSync("docs/auditoria/TILDES_NUEVAS.md", ["# Tildes rotas (solo informe)", "", "Borrador verificado por script.", "",
  hallazgos.length ? "| archivo:línea | tipo | texto |" : "Ninguna.", hallazgos.length ? "|---|---|---|" : "", ...hallazgos, ""].join("\n"));
console.log("archivos:", archivos.length, "hallazgos:", hallazgos.length);

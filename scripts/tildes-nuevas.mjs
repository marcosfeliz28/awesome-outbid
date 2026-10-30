// Busca en docs/ y apps/web/src textos en español con «?» en medio de palabras (tildes rotas).
// Solo informe: no cambia nada. Salida: docs/auditoria/TILDES_NUEVAS.md
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = /\.(md|tsx?)$/;
const PATRON = /[a-záéíóúüñ]\?[a-záéíóúüñ]/i;

// Quita lo que no es texto en español: URLs, código entre comillas invertidas y el encadenamiento opcional (?. y ??).
export function esSospechosa(linea) {
  const sinCodigo = linea
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\?\.|\?\?/g, " ");
  return PATRON.test(sinCodigo);
}

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    if (n === "node_modules" || n === "dist") return [];
    return statSync(r).isDirectory() ? archivos(r) : EXT.test(n) ? [r] : [];
  });
}

if (process.argv[1]?.endsWith("tildes-nuevas.mjs")) {
  const hallazgos = [];
  for (const base of ["docs", "apps/web/src"]) {
    for (const ruta of archivos(join(raiz, base))) {
      if (relative(raiz, ruta).split(sep).join("/") === "docs/auditoria/TILDES_NUEVAS.md") continue; // el propio informe no se analiza
      readFileSync(ruta, "utf8").split("\n").forEach((l, i) => {
        if (esSospechosa(l)) hallazgos.push(`${relative(raiz, ruta)}:${i + 1}: ${l.trim().slice(0, 140)}`);
      });
    }
  }
  const lineas = [
    "# Tildes rotas o «?» dentro de palabras (solo informe)",
    "",
    `Generado por \`scripts/tildes-nuevas.mjs\`. ${hallazgos.length} líneas. Cada una hay que revisar a mano: puede ser código legítimo.`,
    "",
    ...hallazgos.map((h) => `- ${h.replace(/\\/g, "\\\\")}`),
    "",
  ];
  mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
  writeFileSync(join(raiz, "docs/auditoria/TILDES_NUEVAS.md"), lineas.join("\n"));
  console.log(`hallazgos=${hallazgos.length}`);
}

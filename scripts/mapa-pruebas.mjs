// Lista las pruebas (tests/*.test.ts) con su primer describe o it → docs/auditoria/MAPA_DE_PRUEBAS.md. Solo lectura.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, "tests");
const archivos = readdirSync(dir).filter((n) => /\.test\.(ts|mjs)$/.test(n)).sort();
const filas = archivos.map((n) => {
  const texto = readFileSync(join(dir, n), "utf8");
  const primero = /(?:describe|it)\(\s*["'`]([^"'`]+)["'`]/.exec(texto)?.[1] ?? "(sin describe ni it)";
  return { archivo: n, primero: primero.slice(0, 120) };
});
const lineas = [
  "# Mapa de pruebas",
  "",
  `Generado por \`scripts/mapa-pruebas.mjs\`. ${filas.length} archivos de prueba en \`tests/\`.`,
  "",
  "| archivo | primer describe o it |",
  "|---|---|",
  ...filas.map((f) => `| \`tests/${f.archivo}\` | ${f.primero.replace(/\|/g, "\\|")} |`),
  "",
];
mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
writeFileSync(join(raiz, "docs/auditoria/MAPA_DE_PRUEBAS.md"), lineas.join("\n"));
console.log(`pruebas=${filas.length}`);

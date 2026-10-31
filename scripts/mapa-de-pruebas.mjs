#!/usr/bin/env node
import { fileURLToPath } from "node:url";
// Tarea 98: lista las pruebas de tests/*.test.ts con su primer `describe`.
// Solo lectura; escribe un informe.
//   node scripts/mapa-de-pruebas.mjs [--out ruta.md]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const i = process.argv.indexOf("--out");
const out =
  i > 0 ? process.argv[i + 1] : join(root, "docs/auditoria/MAPA_DE_PRUEBAS.md");
const dir = join(root, "tests");

const filas = readdirSync(dir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort()
  .map((f) => {
    const texto = readFileSync(join(dir, f), "utf8");
    const m = texto.match(
      /\bdescribe(?:\.\w+)?\(\s*(["'`])((?:\\.|(?!\1).)*)\1/s,
    );
    const limpio = (t) => t.replace(/\s+/g, " ").replace(/\|/g, "\\|");
    // Sin describe: se muestra el título de la primera prueba (it/test) para no dejar la fila vacía.
    const t = texto.match(
      /^\s*(?:it|test)(?:\.\w+)?\(\s*(["'`])((?:\\.|(?!\1).)*)\1/ms,
    );
    return {
      f,
      describe: m ? limpio(m[2]) : null,
      primera: t ? limpio(t[2]) : null,
    };
  });
const sin = filas.filter((x) => x.describe === null).length;
const md = [
  "Informe generado por `scripts/mapa-de-pruebas.mjs` (solo lectura). Toma el primer `describe` de cada `tests/*.test.ts`; no ejecuta ninguna prueba.",
  "",
  "# Mapa de pruebas",
  "",
  `Archivos de prueba: ${filas.length}. Sin \`describe\` literal: ${sin}.`,
  "",
  "| Archivo | Primer describe |",
  "|---|---|",
  ...filas.map(
    (x) =>
      `| \`tests/${x.f}\` | ${x.describe ?? `(sin describe) · prueba: ${x.primera ?? "—"}`} |`,
  ),
  "",
].join("\n");
writeFileSync(out, md);
console.log(`${out}: ${filas.length} pruebas, ${sin} sin describe`);

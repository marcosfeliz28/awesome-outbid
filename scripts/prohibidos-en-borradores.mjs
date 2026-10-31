#!/usr/bin/env node
import { fileURLToPath } from "node:url";
// Tarea 100: verifica en docs/venta/*.md y docs/diseno/borradores-local/*.md que
// «e-CF», «DGII» y «Nexora POS» no aparezcan como promesa. Una aparición en una
// línea que la niega o la presenta como nombre anterior se lista aparte. Solo
// lectura; escribe un informe.
//   node scripts/prohibidos-en-borradores.mjs [--out ruta.md]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const i = process.argv.indexOf("--out");
const out =
  i > 0
    ? process.argv[i + 1]
    : join(root, "docs/auditoria/PROHIBIDOS_EN_BORRADORES.md");
const prohibidas = [
  ["e-CF", /e-CF/i],
  ["DGII", /DGII/i],
  ["Nexora POS", /Nexora POS/i],
];
// Contexto que niega la función o dice que el nombre es el anterior: no es una promesa.
const niega =
  /\b(no emite|no lo emite|no se emite|no emitimos|no es|no genera|no incluye|sin emisi[oó]n|nombre anterior|antes|anterior|no declara|no hay|retirado|fuera de la versión)\b|\(not issued\)|does not issue/i;

const hallazgos = [];
let archivos = 0;
for (const base of ["docs/venta", "docs/diseno/borradores-local"]) {
  let lista = [];
  try {
    lista = readdirSync(join(root, base))
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    continue;
  }
  for (const f of lista) {
    archivos++;
    readFileSync(join(root, base, f), "utf8")
      .split("\n")
      .forEach((linea, n) => {
        for (const [nombre, re] of prohibidas)
          if (re.test(linea))
            hallazgos.push({
              donde: `${base}/${f}:${n + 1}`,
              nombre,
              negada: niega.test(linea),
              texto: linea.trim().slice(0, 110).replace(/\|/g, "\\|"),
            });
      });
  }
}
const promesa = hallazgos.filter((h) => !h.negada);
const negadas = hallazgos.filter((h) => h.negada);
const tabla = (filas) => [
  "| Archivo:línea | Palabra | Texto |",
  "|---|---|---|",
  ...filas.map((h) => `| \`${h.donde}\` | ${h.nombre} | ${h.texto} |`),
];
const md = [
  "Informe generado por `scripts/prohibidos-en-borradores.mjs` (solo lectura). La separación entre «posible promesa» y «mención negada o histórica» es una heurística por palabras de la misma línea; una persona debe revisar la primera lista.",
  "",
  "# Palabras prohibidas en borradores",
  "",
  `Archivos revisados: ${archivos}. Posibles promesas: ${promesa.length}. Menciones negadas o históricas: ${negadas.length}.`,
  "",
  "## Posible promesa (revisar)",
  "",
  ...(promesa.length ? tabla(promesa) : ["Ninguna."]),
  "",
  "## Mención negada o histórica",
  "",
  ...(negadas.length ? tabla(negadas) : ["Ninguna."]),
  "",
].join("\n");
writeFileSync(out, md);
console.log(
  `${out}: ${promesa.length} posibles promesas, ${negadas.length} negadas/históricas`,
);

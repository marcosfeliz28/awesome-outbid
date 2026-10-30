#!/usr/bin/env node
// Tarea 96: cuenta por archivo las apariciones de «Nexora POS», «Nexora» y
// «Norexos» en apps/web/src y docs/. Solo cuenta; no cambia nada. Es insumo de
// la etapa E1 del cambio de nombre. «Nexora» incluye a «Nexora POS».
//   node scripts/nombre-producto-conteo.mjs [--out ruta.md]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const i = process.argv.indexOf("--out");
const out =
  i > 0
    ? process.argv[i + 1]
    : join(root, "docs/auditoria/NOMBRE_PRODUCTO_CONTEO.md");
const ext = /\.(md|txt|json|html|tsx?|css)$/;
// Los informes de estas tareas citan los nombres: se excluyen para que el conteo no cambie al regenerarlos.
const propios = new Set(
  [
    "NOMBRE_PRODUCTO_CONTEO",
    "MENU_VS_PANTALLAS",
    "RUTAS_Y_PERMISOS",
    "MAPA_DE_PRUEBAS",
    "TILDES_NUEVAS",
    "PROHIBIDOS_EN_BORRADORES",
  ].map((n) => `docs/auditoria/${n}.md`),
);

function archivos(dir, salida = []) {
  for (const nombre of readdirSync(dir).sort()) {
    if (["node_modules", ".git", "dist", "build"].includes(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else if (ext.test(nombre)) salida.push(ruta);
  }
  return salida;
}
const cuenta = (texto, re) => (texto.match(re) ?? []).length;

const filas = [];
for (const base of ["apps/web/src", "docs"])
  for (const ruta of archivos(join(root, base))) {
    const rel = relative(root, ruta);
    if (propios.has(rel)) continue;
    const t = readFileSync(ruta, "utf8");
    const pos = cuenta(t, /Nexora POS/g);
    const nexora = cuenta(t, /Nexora/g);
    const norexos = cuenta(t, /Norexos/g);
    if (pos + nexora + norexos > 0) filas.push({ rel, pos, nexora, norexos });
  }
const tot = filas.reduce(
  (a, f) => ({
    pos: a.pos + f.pos,
    nexora: a.nexora + f.nexora,
    norexos: a.norexos + f.norexos,
  }),
  { pos: 0, nexora: 0, norexos: 0 },
);

const md = [
  "Informe generado por `scripts/nombre-producto-conteo.mjs` (solo lectura, no cambia nada). Insumo de la etapa E1 del cambio de nombre. «Nexora» incluye las apariciones de «Nexora POS» y de nombres como `nexora-cloud`.",
  "",
  "# Conteo del nombre del producto",
  "",
  `Archivos con al menos una aparición: ${filas.length}. Totales: «Nexora POS» ${tot.pos}, «Nexora» ${tot.nexora}, «Norexos» ${tot.norexos}.`,
  "",
  "| Archivo | «Nexora POS» | «Nexora» | «Norexos» |",
  "|---|---|---|---|",
  ...filas.map(
    (f) => `| \`${f.rel}\` | ${f.pos} | ${f.nexora} | ${f.norexos} |`,
  ),
  "",
].join("\n");
writeFileSync(out, md);
console.log(`${out}: ${filas.length} archivos`);

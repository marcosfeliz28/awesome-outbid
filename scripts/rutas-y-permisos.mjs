#!/usr/bin/env node
// Tarea 97: lista las rutas de la API (@Get/@Post/@Put/@Patch/@Delete en
// apps/api/src) con su @Permit o @Public. Solo lectura; escribe un informe.
//   node scripts/rutas-y-permisos.mjs [--out ruta.md]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const i = process.argv.indexOf("--out");
const out =
  i > 0
    ? process.argv[i + 1]
    : join(root, "docs/auditoria/RUTAS_Y_PERMISOS.md");
const dir = join(root, "apps/api/src");
const metodos = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:["'`]([^"'`]*)["'`])?/;
// Constantes de texto de todo apps/api (p. ej. INVENTORY_IMPORT_PERMISSION = "inventory:import").
const constantes = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts")))
  for (const m of readFileSync(join(dir, f), "utf8").matchAll(
    /\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g,
  ))
    constantes.set(m[1], m[2]);
const permiso = (t) => {
  const m = t.match(/@Permit\(\s*(?:["'`]([^"'`]+)["'`]|([A-Z][A-Z0-9_]*))/);
  if (m) return m[1] ?? constantes.get(m[2]) ?? m[2];
  return /@Public\(/.test(t) ? "público" : null;
};

const filas = [];
for (const archivo of readdirSync(dir)
  .filter((f) => f.endsWith(".ts"))
  .sort()) {
  const lineas = readFileSync(join(dir, archivo), "utf8").split("\n");
  const ctl = lineas.findIndex((l) => /^@Controller\(/.test(l));
  if (ctl < 0) continue;
  const prefijo =
    lineas[ctl].match(/@Controller\(\s*["'`]([^"'`]*)["'`]/)?.[1] ?? "";
  // Decoradores de clase: las líneas con @ justo antes de `export class`.
  let claseDesde = ctl;
  while (claseDesde > 0 && /^\s*@/.test(lineas[claseDesde - 1])) claseDesde--;
  let claseHasta = ctl;
  while (
    claseHasta + 1 < lineas.length &&
    !/^export class/.test(lineas[claseHasta + 1]) &&
    /^\s*@|^\s*$|^\s+["'`)]/.test(lineas[claseHasta + 1])
  )
    claseHasta++;
  const deClase = permiso(lineas.slice(claseDesde, claseHasta + 1).join("\n"));
  lineas.forEach((l, n) => {
    const m = l.match(metodos);
    if (!m || n <= claseHasta) return;
    // Bloque de decoradores de este método: hacia arriba y hacia abajo hasta la firma.
    let a = n;
    while (a > 0 && /^\s*@/.test(lineas[a - 1])) a--;
    let b = n;
    while (
      b + 1 < lineas.length &&
      !/^\s*(async\s+)?[A-Za-z_]\w*\s*\(/.test(lineas[b + 1]) &&
      b - n < 12
    )
      b++;
    const bloque = lineas.slice(a, b + 1).join("\n");
    const ruta =
      "/" +
      [prefijo, m[2] ?? ""].filter(Boolean).join("/").replace(/\/+/g, "/");
    filas.push({
      ruta,
      metodo: m[1].toUpperCase(),
      permiso:
        permiso(bloque) ??
        (deClase ? `${deClase} (clase)` : "SIN PERMISO DECLARADO"),
      donde: `apps/api/src/${archivo}:${n + 1}`,
    });
  });
}
const sin = filas.filter((f) => f.permiso === "SIN PERMISO DECLARADO").length;
const md = [
  "Informe generado por `scripts/rutas-y-permisos.mjs` (solo lectura). Lee los decoradores de `apps/api/src`; es un inventario por texto, no sustituye a la prueba `tests/rutas-permiso.test.ts`, que recorre las rutas reales.",
  "",
  "# Rutas de la API y su permiso",
  "",
  `Rutas encontradas: ${filas.length}. Sin permiso declarado: ${sin}.`,
  "",
  "| Ruta | Método | Permiso | Archivo:línea |",
  "|---|---|---|---|",
  ...filas.map(
    (f) => `| \`${f.ruta}\` | ${f.metodo} | \`${f.permiso}\` | ${f.donde} |`,
  ),
  "",
].join("\n");
writeFileSync(out, md);
console.log(`${out}: ${filas.length} rutas, ${sin} sin permiso`);

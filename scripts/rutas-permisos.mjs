// Lista las rutas de la API (@Get/@Post/@Patch/@Put/@Delete en apps/api/src) con su @Permit.
// Salida: docs/auditoria/RUTAS_Y_PERMISOS.md (ruta | método | permiso | archivo:línea). Solo lectura.
import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, "apps/api/src");
const archivos = readdirSync(dir)
  .filter((n) => n.endsWith(".ts"))
  .map((n) => join(dir, n))
  .filter((r) => statSync(r).isFile());
const VERBO = /@(Get|Post|Patch|Put|Delete)\((?:"([^"]*)")?\)/;
const filas = [];
for (const ruta of archivos) {
  const lineas = readFileSync(ruta, "utf8").split("\n");
  let prefijo = "";
  lineas.forEach((l) => {
    const c = /@Controller\((?:"([^"]*)")?\)/.exec(l);
    if (c) prefijo = c[1] ?? "";
  });
  lineas.forEach((l, i) => {
    const m = VERBO.exec(l);
    if (!m) return;
    // El @Permit suele estar entre las 4 líneas de decoradores que preceden al método.
    let permiso = "(sin @Permit)";
    for (let j = i; j >= Math.max(0, i - 4); j--) {
      const p = /@Permit\(([^)]+)\)/.exec(lineas[j]);
      if (p) {
        permiso = p[1].trim().replace(/^"(.*)"$/, "$1");
        break;
      }
    }
    for (
      let j = i + 1;
      j <= Math.min(lineas.length - 1, i + 4) && permiso === "(sin @Permit)";
      j++
    ) {
      const p = /@Permit\(([^)]+)\)/.exec(lineas[j]);
      if (p) permiso = p[1].trim().replace(/^"(.*)"$/, "$1");
    }
    // Un decorador @Public marca la ruta como pública por diseño (sin sesión).
    const publica = [i, i - 1, i - 2, i - 3].some(
      (k) => k >= 0 && /@Public\(\)/.test(lineas[k]),
    );
    if (permiso === "(sin @Permit)" && publica)
      permiso = "pública por diseño (@Public)";
    const sub = m[2] ?? "";
    const ruta_ =
      "/api/" + [prefijo, sub].filter(Boolean).join("/").replace(/\/+/g, "/");
    filas.push({
      ruta: ruta_.replace(/\/$/, ""),
      metodo: m[1].toUpperCase(),
      permiso,
      lugar: `${relative(raiz, ruta)}:${i + 1}`,
    });
  });
}
filas.sort(
  (a, b) => a.ruta.localeCompare(b.ruta) || a.metodo.localeCompare(b.metodo),
);
const sinPermiso = filas.filter((f) => f.permiso === "(sin @Permit)").length;
const lineas = [
  "# Rutas de la API y sus permisos",
  "",
  `Generado por \`scripts/rutas-permisos.mjs\`. ${filas.length} rutas; ${sinPermiso} sin @Permit cerca del método (revisar).`,
  "",
  "| ruta | método | permiso | archivo:línea |",
  "|---|---|---|---|",
  ...filas.map(
    (f) =>
      `| \`${f.ruta}\` | ${f.metodo} | \`${f.permiso}\` | \`${f.lugar}\` |`,
  ),
  "",
];
mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
writeFileSync(
  join(raiz, "docs/auditoria/RUTAS_Y_PERMISOS.md"),
  lineas.join("\n"),
);
console.log(`rutas=${filas.length} sinPermiso=${sinPermiso}`);

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
const VERBO =
  /@(Get|Post|Patch|Put|Delete)\(\s*(?:"([^"]*)"|\[([^\]]*)\])?\s*\)/;
const PERMIT = /@Permit\(([^)]+)\)/;
// Un cierre de bloque o la cabecera del método marcan el límite del grupo de decoradores.
const LIMITE = /^\s*\}|\)\s*\{/;

function valorPermiso(crudo, texto) {
  const v = crudo.trim();
  const lit = /^"(.*)"$/.exec(v);
  if (lit) return lit[1];
  const c = new RegExp(`const\\s+${v}\\s*=\\s*"([^"]*)"`).exec(texto);
  return c ? c[1] : v;
}

// Busca el @Permit más cercano a la ruta, antes o después (±4 líneas), sin cruzar al método vecino.
function buscarPermit(lineas, i) {
  if (PERMIT.test(lineas[i])) return PERMIT.exec(lineas[i])[1];
  for (let d = 1; d <= 4; d++) {
    for (const j of [i - d, i + d]) {
      if (j < 0 || j >= lineas.length) continue;
      if (j > i && LIMITE.test(lineas[i])) continue;
      const lado = j < i ? -1 : 1;
      let cruza = false;
      for (let k = i + lado; k !== j; k += lado)
        if (LIMITE.test(lineas[k])) cruza = true;
      if (cruza) continue;
      const p = PERMIT.exec(lineas[j]);
      if (p) return p[1];
    }
  }
  return null;
}

export function extraerRutas(base = raiz) {
  const dir = join(base, "apps/api/src");
  const archivos = readdirSync(dir)
    .filter((n) => n.endsWith(".ts"))
    .map((n) => join(dir, n))
    .filter((r) => statSync(r).isFile());
  const filas = [];
  for (const ruta of archivos) {
    const texto = readFileSync(ruta, "utf8");
    const lineas = texto.split("\n");
    let prefijo = "";
    lineas.forEach((l) => {
      const c = /@Controller\((?:"([^"]*)")?\)/.exec(l);
      if (c) prefijo = c[1] ?? "";
    });
    lineas.forEach((l, i) => {
      const m = VERBO.exec(l);
      if (!m) return;
      const crudo = buscarPermit(lineas, i);
      let permiso = crudo ? valorPermiso(crudo, texto) : "(sin @Permit)";
      // Un decorador @Public marca la ruta como pública por diseño (sin sesión).
      const publica = [i, i - 1, i - 2, i - 3].some(
        (k) => k >= 0 && /@Public\(\)/.test(lineas[k]),
      );
      if (permiso === "(sin @Permit)" && publica)
        permiso = "pública por diseño (@Public)";
      const subs =
        m[3] !== undefined
          ? [...m[3].matchAll(/"([^"]*)"/g)].map((x) => x[1])
          : [m[2] ?? ""];
      for (const sub of subs) {
        const ruta_ =
          "/api/" +
          [prefijo, sub].filter(Boolean).join("/").replace(/\/+/g, "/");
        filas.push({
          ruta: ruta_.replace(/\/$/, ""),
          metodo: m[1].toUpperCase(),
          permiso,
          lugar: `${relative(base, ruta)}:${i + 1}`,
        });
      }
    });
  }
  return filas;
}

const filas = extraerRutas();
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
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
  writeFileSync(
    join(raiz, "docs/auditoria/RUTAS_Y_PERMISOS.md"),
    lineas.join("\n"),
  );
  console.log(`rutas=${filas.length} sinPermiso=${sinPermiso}`);
}

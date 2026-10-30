#!/usr/bin/env node
// Tarea 99: busca en docs/ y apps/web/src textos con tildes rotas (caracteres
// de reemplazo, mojibake) o un `?` en medio de una palabra en español
// («descripci?n»). Solo informa; no cambia nada.
//   node scripts/tildes-nuevas.mjs [--out ruta.md]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const i = process.argv.indexOf("--out");
const out =
  i > 0 ? process.argv[i + 1] : join(root, "docs/auditoria/TILDES_NUEVAS.md");
const ext = /\.(md|txt|html|tsx?)$/;
const L = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const reglas = [
  ["carácter de reemplazo", /�/],
  ["mojibake", /Ã[¡©­³ºñ±]|Â[¿¡]|â€[™œ"“”]/],
  // Letra + ? + letra, sin '=' ni '.' ni ':' pegados (descarta URLs, `?.` y ternarios).
  [
    "? dentro de una palabra",
    new RegExp(`(?<![=/.:&#\\w-])[${L}]{2,}\\?[${L}]+(?![=.:&\\w])`),
  ],
];
// Los informes de estas tareas citan los patrones: se excluyen para que no se marquen a sí mismos.
const propios = new Set(
  [
    "TILDES_NUEVAS",
    "PROHIBIDOS_EN_BORRADORES",
    "NOMBRE_PRODUCTO_CONTEO",
    "RUTAS_Y_PERMISOS",
    "MAPA_DE_PRUEBAS",
    "MENU_VS_PANTALLAS",
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

const hallazgos = [];
for (const base of ["docs", "apps/web/src"])
  for (const ruta of archivos(join(root, base))) {
    const rel = relative(root, ruta);
    if (propios.has(rel)) continue;
    readFileSync(ruta, "utf8")
      .split("\n")
      .forEach((linea, n) => {
        for (const [tipo, re] of reglas) {
          const m = linea.match(re);
          if (m)
            hallazgos.push({
              rel,
              n: n + 1,
              tipo,
              texto: linea
                .trim()
                .slice(Math.max(0, linea.trim().indexOf(m[0]) - 25), 80)
                .replace(/\|/g, "\\|"),
            });
        }
      });
  }
const md = [
  "Informe generado por `scripts/tildes-nuevas.mjs` (solo lectura, solo informe). Busca caracteres de reemplazo, mojibake y `?` dentro de una palabra en `docs/` y `apps/web/src`. Los `?` de código (cadenas de consulta, `?.`, ternarios) se descartan; puede haber falsos positivos.",
  "",
  "# Textos con tildes rotas o `?` sospechoso",
  "",
  `Hallazgos: ${hallazgos.length}.`,
  "",
  "| Archivo:línea | Tipo | Fragmento |",
  "|---|---|---|",
  ...hallazgos.map(
    (h) => `| \`${h.rel}:${h.n}\` | ${h.tipo} | \`${h.texto}\` |`,
  ),
  "",
].join("\n");
writeFileSync(out, md);
console.log(`${out}: ${hallazgos.length} hallazgos`);

#!/usr/bin/env node
// Tarea 95: compara las etiquetas del menú (lista `navigation` de App.tsx) con la
// tabla de docs/sistema/PANTALLAS.md. Solo lectura; escribe un informe.
//   node scripts/etiquetas-menu.mjs [--out ruta.md]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const i = process.argv.indexOf("--out");
const out =
  i > 0
    ? process.argv[i + 1]
    : join(root, "docs/auditoria/MENU_VS_PANTALLAS.md");

const app = readFileSync(join(root, "apps/web/src/App.tsx"), "utf8");
const inicio = app.indexOf("const navigation = [");
const fin = app.indexOf("\n];", inicio);
if (inicio < 0 || fin < 0)
  throw new Error("No se encontró `const navigation` en App.tsx");
const codigo = [
  ...app
    .slice(inicio, fin)
    .matchAll(
      /\bid:\s*"([^"]+)",\s*label:\s*"([^"]+)",[^}]*?permission:\s*"([^"]+)"/g,
    ),
].map((m, n) => ({ orden: n + 1, id: m[1], etiqueta: m[2], permiso: m[3] }));

const doc = readFileSync(join(root, "docs/sistema/PANTALLAS.md"), "utf8");
const tabla = [
  ...doc.matchAll(/^\| (\d+) \| \*\*(.+?)\*\* \| `(.+?)` \|/gm),
].map((m) => ({
  orden: Number(m[1]),
  etiqueta: m[2],
  permiso: m[3],
}));

const dif = [];
for (const c of codigo) {
  const d = tabla.find((t) => t.etiqueta === c.etiqueta);
  if (!d)
    dif.push(
      `En el código y no en PANTALLAS.md: «${c.etiqueta}» (orden ${c.orden}, permiso \`${c.permiso}\`).`,
    );
  else {
    if (d.permiso !== c.permiso)
      dif.push(
        `Permiso distinto en «${c.etiqueta}»: código \`${c.permiso}\`, documento \`${d.permiso}\`.`,
      );
    if (d.orden !== c.orden)
      dif.push(
        `Orden distinto en «${c.etiqueta}»: código ${c.orden}, documento ${d.orden}.`,
      );
  }
}
for (const t of tabla)
  if (!codigo.some((c) => c.etiqueta === t.etiqueta))
    dif.push(
      `En PANTALLAS.md y no en el código: «${t.etiqueta}» (orden ${t.orden}).`,
    );

const md = [
  "Informe generado por `scripts/etiquetas-menu.mjs` (solo lectura). Compara la lista `navigation` de `apps/web/src/App.tsx` con la tabla de `docs/sistema/PANTALLAS.md`.",
  "",
  "# Menú del código contra PANTALLAS.md",
  "",
  `Pantallas en el código: ${codigo.length}. Filas en el documento: ${tabla.length}.`,
  "",
  "## Diferencias",
  "",
  ...(dif.length
    ? dif.map((d) => `- ${d}`)
    : ["- Ninguna: etiquetas, permisos y orden coinciden."]),
  "",
  "## Menú en el código",
  "",
  "| Orden | id | Etiqueta | Permiso |",
  "|---|---|---|---|",
  ...codigo.map(
    (c) => `| ${c.orden} | ${c.id} | ${c.etiqueta} | \`${c.permiso}\` |`,
  ),
  "",
].join("\n");
writeFileSync(out, md);
console.log(`${out}: ${codigo.length} pantallas, ${dif.length} diferencias`);

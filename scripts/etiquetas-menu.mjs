// Compara las etiquetas del menú de apps/web/src/App.tsx (lista `navigation`) con la tabla de
// docs/sistema/PANTALLAS.md y escribe las diferencias en docs/auditoria/MENU_VS_PANTALLAS.md.
// Solo lectura: no cambia código ni documentos de la base.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(raiz, "apps/web/src/App.tsx"), "utf8").split("\n");
const pantallas = readFileSync(join(raiz, "docs/sistema/PANTALLAS.md"), "utf8").split("\n");

// Bloque `const navigation = [` ... `];` de App.tsx.
const inicio = app.findIndex((l) => /^const navigation = \[/.test(l));
const fin = app.findIndex((l, i) => i > inicio && /^\];/.test(l));
const menu = [];
const bloque = app.slice(inicio, fin + 1).join("\n");
for (const m of bloque.matchAll(/\{\s*id: "([^"]+)",([\s\S]*?)\}/g)) {
  const id = m[1];
  const label = /label: "([^"]+)"/.exec(m[2])?.[1];
  const permiso = /permission: "([^"]+)"/.exec(m[2])?.[1];
  const linea = inicio + bloque.slice(0, m.index).split("\n").length;
  if (label) menu.push({ id, label, permiso: permiso ?? null, linea });
}
// Tabla de PANTALLAS.md: | # | Etiqueta | Permiso | Componente | Línea |
const tabla = pantallas
  .filter((l) => /^\|\s*\d+\s*\|/.test(l))
  .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
  .map(([, etiqueta, permiso]) => ({
    etiqueta: etiqueta.replace(/\*\*/g, ""),
    permiso: permiso.replace(/`/g, "") || null,
  }));

const porEtiqueta = new Map(tabla.map((t) => [t.etiqueta, t]));
const sinDocumentar = menu.filter((m) => !porEtiqueta.has(m.label));
const soloEnDoc = tabla.filter((t) => !menu.some((m) => m.label === t.etiqueta));
const permisoDistinto = menu.filter((m) => {
  const t = porEtiqueta.get(m.label);
  return t && (t.permiso ?? null) !== (m.permiso ?? null);
});

const lineas = [
  "# Menú de App.tsx frente a PANTALLAS.md",
  "",
  `Generado por \`scripts/etiquetas-menu.mjs\`. Menú: ${menu.length} entradas (App.tsx:${inicio + 1}-${fin + 1}). Tabla de PANTALLAS.md: ${tabla.length} filas.`,
  "",
  "## Etiquetas del menú que faltan en PANTALLAS.md",
  sinDocumentar.length ? sinDocumentar.map((m) => `- \`${m.label}\` (id \`${m.id}\`, App.tsx:${m.linea})`).join("\n") : "Ninguna.",
  "",
  "## Filas de PANTALLAS.md que no están en el menú",
  soloEnDoc.length ? soloEnDoc.map((t) => `- ${t.etiqueta}`).join("\n") : "Ninguna.",
  "",
  "## Permiso distinto entre el menú y la tabla",
  permisoDistinto.length
    ? permisoDistinto.map((m) => `- \`${m.label}\`: App.tsx \`${m.permiso}\`, tabla \`${porEtiqueta.get(m.label).permiso}\``).join("\n")
    : "Ninguna.",
  "",
];
mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
writeFileSync(join(raiz, "docs/auditoria/MENU_VS_PANTALLAS.md"), lineas.join("\n"));
console.log(`menú=${menu.length} tabla=${tabla.length} faltan=${sinDocumentar.length} sobran=${soloEnDoc.length} permisos=${permisoDistinto.length}`);

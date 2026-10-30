// Cuenta por archivo las apariciones de «Nexora POS», «Nexora» y «Norexos» en apps/web/src y docs.
// Solo cuenta, no cambia nada. Salida: docs/auditoria/NOMBRE_PRODUCTO_CONTEO.md
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TERMINOS = ["Nexora POS", "Nexora", "Norexos"];
const archivos = execSync("git ls-files apps/web/src docs", { encoding: "utf8" })
  .split("\n").filter((f) => f && /\.(tsx?|md|json|css|html)$/.test(f) && !f.startsWith("docs/operacion/") && !f.startsWith("docs/legal/") && !f.startsWith("docs/seguridad/"));

const filas = [];
for (const f of archivos) {
  const txt = readFileSync(f, "utf8");
  const conteos = TERMINOS.map((t) => txt.split(t).length - 1);
  if (conteos.some((c) => c > 0)) filas.push({ f, conteos });
}
const total = TERMINOS.map((_, i) => filas.reduce((s, r) => s + r.conteos[i], 0));
const salida = [
  "# Conteo del nombre del producto (solo conteo, sin cambios)",
  "",
  "Borrador verificado por script. Fuente: rama claude-pc/bloque15 (commit del worktree) sobre nexora-cloud.",
  "",
  `Totales: ${TERMINOS.map((t, i) => `${t} = ${total[i]}`).join(" · ")}`,
  "",
  "| Archivo | Nexora POS | Nexora | Norexos |",
  "|---|---:|---:|---:|",
  ...filas.map((r) => `| ${r.f} | ${r.conteos[0]} | ${r.conteos[1]} | ${r.conteos[2]} |`),
  "",
];
writeFileSync("docs/auditoria/NOMBRE_PRODUCTO_CONTEO.md", salida.join("\n"));
console.log("archivos con el nombre:", filas.length, "totales:", total.join(" "));

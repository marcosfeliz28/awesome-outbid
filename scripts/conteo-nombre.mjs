// Cuenta, por archivo, las apariciones de «Nexora POS», «Nexora» y «Norexos» en apps/web/src y docs/.
// Solo cuenta: no cambia nada. Salida: docs/auditoria/NOMBRE_PRODUCTO_CONTEO.md
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TERMINOS = ["Nexora POS", "Nexora", "Norexos"];
const EXT = /\.(tsx?|jsx?|css|html|md|json|txt|svg)$/;

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    if (n === "node_modules" || n === "dist") return [];
    return statSync(r).isDirectory() ? archivos(r) : EXT.test(n) ? [r] : [];
  });
}
const filas = [];
for (const base of ["apps/web/src", "docs"]) {
  for (const ruta of archivos(join(raiz, base))) {
    const texto = readFileSync(ruta, "utf8");
    const cuenta = TERMINOS.map((t) => [t, texto.split(t).length - 1]);
    const total = cuenta.reduce((a, [, n]) => a + n, 0);
    if (total > 0) filas.push({ archivo: relative(raiz, ruta), cuenta, total });
  }
}
filas.sort((a, b) => b.total - a.total);
const suma = (t) => filas.reduce((a, f) => a + (f.cuenta.find(([x]) => x === t)?.[1] ?? 0), 0);
const lineas = [
  "# Conteo del nombre del producto (insumo de la etapa E1)",
  "",
  "Generado por `scripts/conteo-nombre.mjs`. Solo cuenta; no cambia código ni documentos.",
  "",
  "«Nexora» cuenta también dentro de «Nexora POS»; por eso no se suman las columnas.",
  "",
  `Totales en apps/web/src y docs/: «Nexora POS» ${suma("Nexora POS")}, «Nexora» ${suma("Nexora")}, «Norexos» ${suma("Norexos")}.`,
  "",
  "| archivo | «Nexora POS» | «Nexora» | «Norexos» | total |",
  "|---|---:|---:|---:|---:|",
  ...filas.map((f) => `| \`${f.archivo}\` | ${f.cuenta[0][1]} | ${f.cuenta[1][1]} | ${f.cuenta[2][1]} | ${f.total} |`),
  "",
];
mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
writeFileSync(join(raiz, "docs/auditoria/NOMBRE_PRODUCTO_CONTEO.md"), lineas.join("\n"));
console.log(`archivos=${filas.length} NexoraPOS=${suma("Nexora POS")} Nexora=${suma("Nexora")} Norexos=${suma("Norexos")}`);

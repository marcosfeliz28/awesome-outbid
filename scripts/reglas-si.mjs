// Extrae de los flujos del sistema las líneas que son reglas («Si», «Cuando», «Solo», «No se puede») con su cita archivo:línea.
// Solo escribe docs/diseno/borradores-local/reglas-si.json. No cambia ningún documento.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ARCHIVOS = [
  "docs/sistema/FLUJO_CAJA_POS.md",
  "docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md",
  "docs/sistema/FLUJO_MERCANCIA.md",
  "docs/sistema/GV.md",
  "docs/sistema/ROLES_Y_PERMISOS.md",
];
// Empieza (tras viñeta, número o negrita) por «Si», «Cuando», «Solo» o «No se puede».
const INICIO = /^(?:[-*]\s+|\d+\.\s+)?(?:\*\*)?(Si|Cuando|Solo|No se puede)\b/;

export function extraerReglas(archivo, texto) {
  return texto.split("\n").flatMap((linea, i) => {
    const limpia = linea.trim();
    return INICIO.test(limpia) ? [{ archivo, linea: i + 1, texto: limpia }] : [];
  });
}

if (process.argv[1]?.endsWith("reglas-si.mjs")) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const reglas = ARCHIVOS.flatMap((a) => extraerReglas(a, readFileSync(join(raiz, a), "utf8")));
  mkdirSync(join(raiz, "docs/diseno/borradores-local"), { recursive: true });
  writeFileSync(join(raiz, "docs/diseno/borradores-local/reglas-si.json"), JSON.stringify(reglas, null, 2) + "\n", "utf8");
  console.log(`reglas=${reglas.length}`);
}

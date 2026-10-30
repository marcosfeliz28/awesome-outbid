// Extrae de docs/sistema las líneas que empiezan (tras viñeta o negrita) por «Si», «Cuando», «Solo» o «No se puede» → docs/diseno/borradores-local/reglas-si.json (archivo, linea, texto). Solo lectura de docs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ARCHIVOS = [
  "FLUJO_CAJA_POS.md",
  "FLUJO_COBROS_Y_TRANSFERENCIAS.md",
  "FLUJO_MERCANCIA.md",
  "GV.md",
  "ROLES_Y_PERMISOS.md",
];
const INICIO = /^\s*(?:[-*+]|\d+[.)])?\s*(?:\*\*)?(?:Si|Cuando|Solo|No se puede)\b/;

const raiz = process.cwd();
const reglas = [];
for (const nombre of ARCHIVOS) {
  const archivo = `docs/sistema/${nombre}`;
  readFileSync(join(raiz, archivo), "utf8")
    .split("\n")
    .forEach((linea, i) => {
      if (INICIO.test(linea)) reglas.push({ archivo, linea: i + 1, texto: linea.trim() });
    });
}
const salida = join(raiz, "docs/diseno/borradores-local");
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, "reglas-si.json"), JSON.stringify(reglas, null, 2) + "\n");
console.log(`reglas=${reglas.length}`);

// Una tarea del modelo local por cada 5 reglas (formato de COLA_LOCAL_ACTIVA_NUEVA.json).
const POR_LOTE = 5;
const INSTRUCCION =
  "Borrador sin verificar, hecho por modelo local. Español de República Dominicana. No añadas datos que no estén en la regla. Prohibido: e-CF, DGII, NCF como promesa, 'Nexora' (el producto se llama Norexos). NO escribas conteos: los mide un script.\n" +
  "Reescribe cada regla de la entrada (JSON: archivo, linea, texto) como una frase «Si … entonces …» de máximo 25 palabras, sin añadir datos. Conserva la cita `archivo:línea` al final de cada frase. Una frase por regla, en una lista.";
const tareas = [];
for (let i = 0; i * POR_LOTE < reglas.length; i++) {
  const nn = String(i + 1).padStart(2, "0");
  const base = "docs/diseno/borradores-local";
  writeFileSync(join(salida, `reglas-lote-${nn}-entrada.json`), JSON.stringify(reglas.slice(i * POR_LOTE, (i + 1) * POR_LOTE), null, 2) + "\n");
  tareas.push({
    id: `R${nn}-reglas-si`,
    modelo: "qwen-optimizado",
    maxTokens: 1200,
    instrucciones: INSTRUCCION,
    entradas: [`${base}/reglas-lote-${nn}-entrada.json`],
    salida: `${base}/reglas-lote-${nn}.md`,
  });
}
writeFileSync(
  join(salida, "reglas-tareas.json"),
  JSON.stringify({ descripcion: "Orden 85: una tarea por cada 5 reglas de reglas-si.json. Generado por scripts/reglas-si.mjs.", tareas }, null, 2) + "\n",
);
console.log(`tareas=${tareas.length}`);

// Zona 2 del cambio de nombre: textos que la API devuelve o imprime (errores, PDFs, correos, avisos).
// Excepciones: el nombre de la carpeta de Drive (ya existe en las cuentas), el valor por defecto
// de la marca en el catálogo (dato, no texto fijo) y los identificadores técnicos.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const RAIZ = "apps/api/src";
const EXCEPCIONES = [
  'FOLDER_NAME = "Nexora POS respaldos"',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.ts$/.test(n) ? [ruta] : [];
  });
}

it("la API no muestra Nexora fuera de las excepciones permitidas", () => {
  const sobrantes: string[] = [];
  for (const ruta of archivos(RAIZ)) {
    readFileSync(ruta, "utf8")
      .split("\n")
      .forEach((linea, i) => {
        if (!/\bNexora\b|\bNEXORA\b/.test(linea)) return;
        if (EXCEPCIONES.some((e) => linea.includes(e))) return;
        sobrantes.push(`${ruta}:${i + 1}`);
      });
  }
  expect(sobrantes).toEqual([]);
});

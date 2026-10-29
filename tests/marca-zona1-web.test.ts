// Zona 1 del cambio de nombre: la app web no muestra «Nexora» a la persona usuaria.
// Excepción: el nombre de la carpeta de Google Drive, que ya existe en las cuentas de la dueña.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const RAIZ = "apps/web/src";
const EXCEPCIONES = ["«Nexora POS respaldos»"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(tsx?|css)$/.test(n) ? [ruta] : [];
  });
}

it("la app web no muestra Nexora fuera de las excepciones permitidas", () => {
  const sobrantes: string[] = [];
  for (const ruta of [...archivos(RAIZ), "apps/web/index.html"]) {
    readFileSync(ruta, "utf8")
      .split("\n")
      .forEach((linea, i) => {
        if (!/\bNexora\b|\bNEXORA\b/.test(linea)) return;
        if (
          /\.css$/.test(ruta) ||
          (/\.(tsx?)$/.test(ruta) && /className="nexora-/.test(linea))
        )
          return;
        if (EXCEPCIONES.some((e) => linea.includes(e))) return;
        sobrantes.push(`${ruta}:${i + 1}`);
      });
  }
  expect(sobrantes).toEqual([]);
});

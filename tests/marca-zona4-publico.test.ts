// Zona 4 del cambio de nombre: páginas públicas, aviso de privacidad, página de venta, manuales de ayuda.
// Excepciones: dominios y correos (nexorapos.net, soporte@nexorapos.net), que se cambian aparte
// cuando se compre el dominio norexos.ai; identificadores técnicos.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const RAIZ = "apps/web/public";
const EXCEPCIONES = [/nexorapos\.net/, /runtime-config/];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(html|md|txt|svg)$/.test(n) ? [ruta] : [];
  });
}

it("el contenido público no muestra Nexora fuera de las excepciones permitidas", () => {
  const sobrantes: string[] = [];
  for (const ruta of archivos(RAIZ)) {
    readFileSync(ruta, "utf8")
      .split("\n")
      .forEach((linea, i) => {
        if (!/\bNexora\b|\bNEXORA\b/.test(linea)) return;
        if (EXCEPCIONES.some((e) => e.test(linea))) return;
        sobrantes.push(`${ruta}:${i + 1}`);
      });
  }
  expect(sobrantes).toEqual([]);
});

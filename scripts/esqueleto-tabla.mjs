// Genera el esqueleto de una tabla de glosario: un término por línea «**Término** — ...» del trozo, con su primera cita archivo:línea.
// Uso: node scripts/esqueleto-tabla.mjs <fuente.md> <linea-inicio> <linea-fin>   (imprime JSON)
import { readFileSync } from "node:fs";

export function extraerTerminos(texto) {
  return texto.split("\n").flatMap((linea) => {
    const m = /^\*\*(.+?)\*\* — /.exec(linea);
    if (!m) return [];
    const cita = /(apps\/[^\s`()]+:\d[\d-]*|docs\/[^\s`()]+:\d[\d-]*)/.exec(linea);
    return [{ termino: m[1], cita: cita ? cita[1] : null }];
  });
}

if (process.argv[1]?.endsWith("esqueleto-tabla.mjs")) {
  const [fuente, ini, fin] = process.argv.slice(2);
  const trozo = readFileSync(fuente, "utf8").split("\n").slice(Number(ini) - 1, Number(fin)).join("\n");
  console.log(JSON.stringify(extraerTerminos(trozo), null, 2));
}

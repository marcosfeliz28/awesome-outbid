// Saca el esqueleto de una tabla de glosario de un trozo de un .md: una fila por término,
// con el término copiado tal cual y su cita archivo:línea. El modelo solo escribe el significado.
// Uso: node scripts/esqueleto-tabla.mjs <archivo.md> [desde] [hasta]
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const reViñeta = /^- \*\*(.+?)\*\*/;
const reNegrita = /^\*\*(.+?)\*\*/;

export function esqueleto(texto, nombre, desde = 1, hasta = Infinity) {
  const filas = [];
  texto.split("\n").forEach((linea, i) => {
    const n = i + 1;
    if (n < desde || n > hasta) return;
    const termino =
      linea.match(reViñeta)?.[1] ??
      linea.match(reNegrita)?.[1] ??
      (linea.startsWith("|") ? celdaDeFila(linea) : null);
    if (termino) filas.push({ termino, cita: `${nombre}:${n}` });
  });
  return filas;
}

function celdaDeFila(linea) {
  const celda = linea.split("|")[1]?.trim() ?? "";
  if (!celda || /^-+$/.test(celda) || celda === "Término") return null;
  return celda;
}

if (process.argv[1]?.endsWith("esqueleto-tabla.mjs")) {
  const [ruta, desde, hasta] = process.argv.slice(2);
  const filas = esqueleto(
    readFileSync(ruta, "utf8"),
    basename(ruta),
    desde ? Number(desde) : 1,
    hasta ? Number(hasta) : Infinity,
  );
  console.log(JSON.stringify(filas, null, 2));
}

// Orden 97 (letra legible): pasa cada `font-size: Npx` fuera de @media print a
// `var(--fs-N)` y escribe los tokens --fs-N en el bloque :root de styles.css.
// Escala: 13→15, 14→16, 15→17, 16→18, 17–23 ×1.1; desde 24 sin cambio; todo lo menor de 13 sube a 14.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..", "apps", "web", "src");
const escala = (n) => {
  if (n < 13) return 14;
  if (n <= 16) return n + 2;
  return n >= 24 ? n : Math.round(n * 1.1);
};

function reescribir(texto, usados) {
  let salida = "";
  let i = 0;
  const tramo = (t) =>
    t.replace(/font-size:\s*(\d+)px/g, (_, n) => {
      usados.add(Number(n));
      return `font-size: var(--fs-${n})`;
    });
  while (i < texto.length) {
    const ini = texto.indexOf("@media print", i);
    if (ini < 0) {
      salida += tramo(texto.slice(i));
      break;
    }
    salida += tramo(texto.slice(i, ini));
    let prof = 0;
    let j = texto.indexOf("{", ini);
    for (; j < texto.length; j++) {
      if (texto[j] === "{") prof++;
      if (texto[j] === "}" && --prof === 0) break;
    }
    salida += texto.slice(ini, j + 1);
    i = j + 1;
  }
  return salida;
}

const usados = new Set();
for (const f of readdirSync(SRC).filter((x) => x.endsWith(".css"))) {
  const ruta = join(SRC, f);
  const antes = readFileSync(ruta, "utf8");
  const despues = reescribir(antes, usados);
  if (despues !== antes) writeFileSync(ruta, despues);
}
const tokens = [...usados]
  .sort((a, b) => a - b)
  .map((n) => `  --fs-${n}: ${escala(n)}px;`)
  .join("\n");
const estilos = join(SRC, "styles.css");
let t = readFileSync(estilos, "utf8");
t = t.replace(
  /(--muted-on-soft: #586274;\n)/,
  `$1  /* Tipografía: un solo sitio (orden 97). Nada bajo 14 px. */\n${tokens}\n`,
);
t = t.replace(
  /(font-synthesis: none;\n {2}font-size: )13px;/,
  "$116px;\n  line-height: 1.5;",
);
writeFileSync(estilos, t);
console.log("tokens:", [...usados].sort((a, b) => a - b).join(","));

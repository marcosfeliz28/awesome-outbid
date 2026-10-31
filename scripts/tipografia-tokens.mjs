// Orden 97/99: la letra se controla desde tokens (--fs-base, --fs-min, --fs-scale, --lh-base).
// Pasa cada `font-size` en px/rem/clamp de los CSS a una expresión con piso y escala de tokens.
// Es idempotente: no vuelve a envolver lo que ya usa var(--fs-min).
import { readFileSync, writeFileSync } from "node:fs";

const ROOT_PX = 13; // :root { font-size: 13px } → 1rem = 13px en este código
const archivos = process.argv.slice(2);
const envolver = (expr) =>
  `max(var(--fs-min), calc(${expr} * var(--fs-scale)))`;

for (const archivo of archivos) {
  let cambios = 0;
  const css = readFileSync(archivo, "utf8").replace(
    /font-size:\s*([^;{}]+);/g,
    (m, v) => {
      v = v.trim();
      if (v.includes("var(--fs-")) return m;
      let r = null;
      let x;
      if ((x = v.match(/^(\d*\.?\d+)px$/)) && Number(x[1]) > 0)
        r = envolver(`${x[1]}px`);
      else if ((x = v.match(/^(\d*\.?\d+)rem$/)))
        r = envolver(`${Math.round(Number(x[1]) * ROOT_PX * 100) / 100}px`);
      else if (/^clamp\(.*\)$/.test(v)) r = envolver(v);
      if (!r) return m;
      cambios++;
      return `font-size: ${r};`;
    },
  );
  writeFileSync(archivo, css);
  console.log(`${archivo}: ${cambios} font-size → tokens`);
}

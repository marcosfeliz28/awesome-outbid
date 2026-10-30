// En docs/venta/*.md y docs/diseno/borradores-local/*.md busca «e-CF», «DGII» y «Nexora POS».
// Salida con archivo:línea: docs/auditoria/PROHIBIDOS_EN_BORRADORES.md. Solo informe.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const carpetas = ["docs/venta", "docs/diseno/borradores-local"];
const PATRON = /e-CF|DGII|Nexora POS/;
const hallazgos = [];
for (const c of carpetas) {
  const dir = join(raiz, c);
  if (!existsSync(dir)) continue;
  for (const n of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    const ruta = join(dir, n);
    readFileSync(ruta, "utf8").split("\n").forEach((l, i) => {
      if (PATRON.test(l)) hallazgos.push(`${relative(raiz, ruta)}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
}
const lineas = [
  "# Términos prohibidos en borradores (e-CF, DGII, «Nexora POS»)",
  "",
  `Generado por \`scripts/prohibidos-borradores.mjs\`. ${hallazgos.length} líneas. Cada una: confirmar si es una promesa o una mención permitida (p. ej. una nota que pide quitarla).`,
  "",
  ...hallazgos.map((h) => `- ${h.replace(/\\/g, "\\\\")}`),
  "",
];
mkdirSync(join(raiz, "docs/auditoria"), { recursive: true });
writeFileSync(join(raiz, "docs/auditoria/PROHIBIDOS_EN_BORRADORES.md"), lineas.join("\n"));
console.log(`hallazgos=${hallazgos.length}`);

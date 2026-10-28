// check-product-brand-extra.mjs — busca restos de marcas anteriores en el build
// del producto. Complementa `check-product-brand.mjs` (no lo reemplaza): aquel
// cuida el nombre visible; este rastrea «MacGen», «GV Makeup» y «FitStore».
//
// Uso: node scripts/check-product-brand-extra.mjs [directorio]
//   Directorio por defecto: apps/web/dist
// Salida: 0 si no hay restos (o no hay build), 1 si los hay (para CI).

import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const BRANDS = ["MacGen", "GV Makeup", "FitStore"];
const TEXT_EXT = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".svg",
  ".txt",
  ".map",
]);

const root = process.argv[2] ?? "apps/web/dist";

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directorio inexistente: nada que revisar
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (TEXT_EXT.has(extname(entry.name).toLowerCase())) yield full;
  }
}

async function main() {
  let hits = 0;
  for await (const file of walk(root)) {
    const text = await readFile(file, "utf8").catch(() => "");
    for (const brand of BRANDS) {
      if (text.includes(brand)) {
        const line = text.split("\n").findIndex((l) => l.includes(brand)) + 1;
        console.log(`${file}:${line} contiene «${brand}»`);
        hits++;
      }
    }
  }
  if (hits > 0) {
    console.error(`\n${hits} resto(s) de marca anterior.`);
    process.exit(1);
  }
  console.log("Sin restos de marca anterior (MacGen / GV Makeup / FitStore).");
}

main();

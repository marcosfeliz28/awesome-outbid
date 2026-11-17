/* global console, process */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const rootArg = process.argv.indexOf("--root");
const root = resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const dir = join(root, "docs", "fotos", "retenidas-17nov");
const csv = readFileSync(join(dir, "candidatas.csv"), "utf8")
  .trim()
  .split("\n");
const rows = csv.slice(1);
const expected = new Set([
  "INV-1122",
  "INV-1147",
  "INV-1152",
  "INV-1156",
  "INV-1164",
  "INV-1165",
  "INV-1166",
  "INV-1167",
  "INV-1172",
  "INV-1173",
  "INV-1192",
  "INV-1193",
  "INV-1199",
  "INV-1213",
  "INV-1629",
  "INV-1937",
  "INV-1954",
  "INV-1987",
]);

if (rows.length !== expected.size)
  throw new Error(`Se esperaban 18 filas; hay ${rows.length}`);
for (const row of rows) {
  const sku = row.slice(0, row.indexOf(","));
  if (!expected.delete(sku))
    throw new Error(`SKU inesperado o duplicado: ${sku}`);
}
if (expected.size) throw new Error(`Faltan SKU: ${[...expected].join(", ")}`);

const files = readdirSync(dir).filter((name) => /^INV-\d+\.webp$/.test(name));
if (files.length !== 18)
  throw new Error(`Se esperaban 18 WebP; hay ${files.length}`);
for (const file of files) {
  const data = readFileSync(join(dir, file));
  if (data.length < 12 || data.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`${file} no es WebP válido`);
  }
  if (data.toString("ascii", 12, 16) !== "VP8 ") {
    throw new Error(
      `${file} usa un contenedor WebP no previsto por este control`,
    );
  }
  const width = data.readUInt16LE(26) & 0x3fff;
  const height = data.readUInt16LE(28) & 0x3fff;
  if (width !== 800 || height !== 800) {
    throw new Error(`${file} mide ${width}x${height}; se esperaban 800x800`);
  }
}

const exactas = rows.filter((row) =>
  row.includes(",coincidencia exacta,"),
).length;
if (exactas !== 6)
  throw new Error(`Se esperaban 6 coincidencias exactas; hay ${exactas}`);
if (!readdirSync(dir).includes("contacto.png"))
  throw new Error("Falta contacto.png");

console.log(
  "PASS: 18 candidatas contabilizadas; 6 coincidencias exactas y 12 pendientes explícitos",
);

/* global console, process */
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const lot = path.join(root, "lote-3");
const failures = [];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers = [], ...values] = rows;
  return values.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
  );
}

async function readCsv(file) {
  try {
    return parseCsv(await readFile(path.join(lot, file), "utf8"));
  } catch {
    failures.push(`${file}: no existe o no se puede leer`);
    return [];
  }
}

const photos = await readCsv("fotos.csv");
const missing = await readCsv("faltantes.csv");
const required = [
  "sku",
  "archivo",
  "fuente",
  "licencia/uso",
  "coincide_marca",
  "coincide_presentación",
];

for (const key of required) {
  if (photos.length && !(key in photos[0])) failures.push(`fotos.csv: falta columna ${key}`);
}
if (photos.length + missing.length !== 60) {
  failures.push(`conteo: ${photos.length} fotos + ${missing.length} faltantes; se esperaban 60`);
}

const seen = new Set();
for (const row of [...photos, ...missing]) {
  if (!row.sku) failures.push("fila sin SKU");
  if (seen.has(row.sku)) failures.push(`SKU duplicado: ${row.sku}`);
  seen.add(row.sku);
}

for (const row of photos) {
  for (const key of required) {
    if (!row[key]) failures.push(`${row.sku}: ${key} vacío`);
  }
  if (row.coincide_marca !== "sí" || row["coincide_presentación"] !== "sí") {
    failures.push(`${row.sku}: coincidencia no exacta`);
  }
  if (!row.archivo.endsWith(".webp")) failures.push(`${row.sku}: archivo no WebP`);
  const image = path.join(lot, row.archivo);
  try {
    const dimensions = execFileSync("identify", ["-format", "%w %h", image], {
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/)
      .map(Number);
    if (dimensions[0] < 800 || dimensions[1] < 800) {
      failures.push(`${row.sku}: ${dimensions.join("x")} menor de 800x800`);
    }
  } catch {
    failures.push(`${row.sku}: imagen ausente o inválida`);
  }
}

try {
  const files = await readdir(lot);
  const actual = files.filter((file) => file.endsWith(".webp")).length;
  if (actual !== photos.length) failures.push(`${actual} WebP para ${photos.length} filas`);
  execFileSync("identify", [path.join(lot, "contacto.png")]);
} catch {
  failures.push("contacto.png: ausente o inválida");
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`PASS: lote 3 completo, ${photos.length} fotos reales y ${missing.length} faltantes`);

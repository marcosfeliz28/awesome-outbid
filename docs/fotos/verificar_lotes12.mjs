/* global console, process */
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.FOTOS_ROOT || defaultRoot;
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
    Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ""]),
    ),
  );
}

async function readCsv(lot, file) {
  try {
    return parseCsv(await readFile(path.join(lot, file), "utf8"));
  } catch {
    failures.push(`${path.basename(lot)}/${file}: ausente o ilegible`);
    return [];
  }
}

for (const number of [1, 2]) {
  const lot = path.join(root, `lote-${number}`);
  const photos = await readCsv(lot, "fotos.csv");
  const missing = await readCsv(lot, "faltantes.csv");
  const expectedStart = number === 1 ? 1 : 61;
  const expectedEnd = number === 1 ? 60 : 120;
  const required = [
    "sku",
    "archivo",
    "fuente",
    "licencia/uso",
    "coincide_marca",
    "coincide_presentación",
    "n",
    "nombre",
    "url_original",
    "dimensiones_originales",
  ];
  for (const key of required) {
    if (photos.length && !(key in photos[0])) {
      failures.push(`lote-${number}/fotos.csv: falta ${key}`);
    }
  }
  if (photos.length + missing.length !== 60) {
    failures.push(
      `lote-${number}: ${photos.length} fotos + ${missing.length} faltantes; deben sumar 60`,
    );
  }

  const seenSku = new Set();
  const seenN = new Set();
  for (const row of [...photos, ...missing]) {
    if (!row.sku) failures.push(`lote-${number}: fila sin SKU`);
    if (row.sku && !/^INV-[0-9]+$/.test(row.sku)) {
      failures.push(`lote-${number}/${row.sku}: SKU sin formato INV-`);
    }
    if (seenSku.has(row.sku)) failures.push(`lote-${number}: SKU duplicado ${row.sku}`);
    seenSku.add(row.sku);
    const n = Number(row.n);
    if (!Number.isInteger(n) || n < expectedStart || n > expectedEnd) {
      failures.push(`lote-${number}: n inválido ${row.n}`);
    }
    if (seenN.has(n)) failures.push(`lote-${number}: n duplicado ${n}`);
    seenN.add(n);
  }

  for (const row of photos) {
    for (const key of required) {
      if (!row[key]) failures.push(`lote-${number}/${row.sku}: ${key} vacío`);
    }
    if (row.coincide_marca !== "sí" || row["coincide_presentación"] !== "sí") {
      failures.push(`lote-${number}/${row.sku}: coincidencia no exacta`);
    }
    if (!row["licencia/uso"].includes("no comprobado")) {
      failures.push(`lote-${number}/${row.sku}: derechos presentados como comprobados`);
    }
    const original = row.dimensiones_originales.split("x").map(Number);
    if (original.length !== 2 || original.some((value) => value < 800)) {
      failures.push(
        `lote-${number}/${row.sku}: original ${row.dimensiones_originales} menor de 800x800`,
      );
    }
    const image = path.join(lot, row.archivo);
    try {
      const delivered = execFileSync("identify", ["-format", "%w %h", image], {
        encoding: "utf8",
      })
        .trim()
        .split(/\s+/)
        .map(Number);
      if (delivered.some((value) => value < 800)) {
        failures.push(`lote-${number}/${row.archivo}: menor de 800x800`);
      }
    } catch {
      failures.push(`lote-${number}/${row.archivo}: ausente o inválida`);
    }
  }

  try {
    const files = await readdir(lot);
    const actual = files.filter((file) => file.endsWith(".webp")).length;
    if (actual !== photos.length) {
      failures.push(`lote-${number}: ${actual} WebP para ${photos.length} filas`);
    }
    execFileSync("identify", [path.join(lot, "contacto.png")]);
    await readFile(path.join(lot, "README.md"), "utf8");
  } catch {
    failures.push(`lote-${number}: contacto.png o README ausente`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: lotes 1 y 2 completos; 120 productos contabilizados");

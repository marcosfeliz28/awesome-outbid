// Genera un archivo fuente reproducible sin secretos, datos locales ni dependencias.
// Sólo usa Node: antes dependía de Python, que en Windows no suele estar (el
// alias de Microsoft Store responde por él y termina con el código 9009).
import {
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

// Carpetas y archivos generados o con datos del equipo, a cualquier profundidad.
const EXCLUDED = new Set([
  "node_modules",
  ".local-db",
  ".pnpm-store",
  ".git",
  "dist",
  "test-results",
  "playwright-report",
  "coverage",
  "target",
  "build",
  ".gradle",
  // Respaldos de la base y reporte del importador (lleva costos reales).
  "backups",
  "revision-inventario.csv",
]);
const SECRET = new Set([".log", ".pem", ".key", ".p12", ".keystore"]);
// 5 de octubre de 2026, 00:00:00, en el formato de fecha de MS-DOS.
const DATE = ((2026 - 1980) << 9) | (10 << 5) | 5;

function files(root, dir = "", found = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const { name } = entry;
    if (EXCLUDED.has(name) || entry.isSymbolicLink()) continue;
    const path = dir ? dir + "/" + name : name;
    if (entry.isDirectory()) files(root, path, found);
    else if (
      entry.isFile() &&
      !(name.startsWith(".env") && name !== ".env.example") &&
      !SECRET.has(extname(name))
    )
      found.push(path);
  }
  return found;
}
// Orden por carpetas y sin configuración regional: el mismo en todo sistema.
function byPath(a, b) {
  const [x, y] = [a.split("/"), b.split("/")];
  for (let i = 0; i < Math.min(x.length, y.length); i++)
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return x.length - y.length;
}

/**
 * Escribe en `output` el ZIP de la carpeta `root`.
 * `options.include` permite crear entregas de alcance limitado sin copiar el
 * árbol a una carpeta temporal. `options.validate` puede rechazar el contenido
 * de un archivo antes de escribirlo. La llamada histórica sin opciones conserva
 * el mismo contenido y prefijo.
 */
export function pack(root, output, options = {}) {
  const include = options.include ?? (() => true);
  const validate = options.validate ?? (() => {});
  const prefix = options.prefix ?? "fitstore-pos/";
  const names = files(root)
    .filter((path) => resolve(root, path) !== resolve(output))
    .filter(include)
    .sort(byPath);
  if (names.length > 0xffff)
    throw new Error("Demasiados archivos para un ZIP sin ZIP64.");
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const path of names) {
    const data = readFileSync(join(root, path));
    validate(path, data);
    const body = deflateRawSync(data, { level: 9 });
    const name = Buffer.from(prefix + path, "utf8");
    // Bit 11: el nombre va en UTF-8.
    const flags = /^[\x20-\x7e]*$/.test(path) ? 0 : 0x0800;
    const sums = Buffer.alloc(12);
    sums.writeUInt32LE(crc32(data), 0);
    sums.writeUInt32LE(body.length, 4);
    sums.writeUInt32LE(data.length, 8);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DATE, 12);
    sums.copy(local, 14);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    // Creado "en Unix" para que los permisos 0644 de abajo se respeten.
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DATE, 14);
    sums.copy(central, 16);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    parts.push(local, name, body);
    directory.push(central, name);
    offset += local.length + name.length + body.length;
    if (offset > 0xffffffff)
      throw new Error("El archivo supera los 4 GB de un ZIP sin ZIP64.");
  }
  const size = directory.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(output, Buffer.concat([...parts, ...directory, end]));
  return { files: names.length };
}

// Sólo actúa cuando se ejecuta como script; las pruebas importan pack().
function isMain() {
  try {
    const [a, b] = [process.argv[1], fileURLToPath(import.meta.url)].map(
      (path) => realpathSync(path),
    );
    return process.platform === "win32"
      ? a.toLowerCase() === b.toLowerCase()
      : a === b;
  } catch {
    return false;
  }
}
if (isMain()) {
  const output = resolve(process.argv[2] || "../fitstore-pos-corregido.zip");
  const { files: count } = pack(process.cwd(), output);
  console.log("ZIP:", output, `(${count} archivos)`);
}

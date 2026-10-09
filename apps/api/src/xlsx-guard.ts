// SEC-01: un .xlsx es un ZIP. Un archivo de pocos cientos de KB puede
// descomprimirse a cientos de MB de XML y ExcelJS lo carga entero antes de
// que podamos contar filas: en un contenedor de 512 MB eso es un OOM con una
// sola subida. Aquí se valida el ZIP ANTES de entregarlo a ExcelJS:
//
// 1. Se localiza el registro final (EOCD) y se exige que el archivo termine
//    exactamente en él (con su comentario) y que no sea ZIP64 ni multivolumen.
// 2. Se recorre el directorio central entrada por entrada: firmas, longitudes
//    y offsets deben ser coherentes, el número de entradas debe coincidir y el
//    directorio debe acabar justo donde empieza el EOCD. Nunca se buscan
//    firmas sueltas por el archivo.
// 3. Cada entrada se descomprime con un tope de salida (`maxOutputLength`)
//    igual al presupuesto restante: no se confía en el tamaño declarado (ni en
//    la cabecera local ni en la central) sino en lo que realmente sale del
//    descompresor, que además debe coincidir con lo declarado.
// 4. En los XML se cuentan las etiquetas de apertura: ExcelJS crea un objeto
//    por elemento, así que pocos MB de `<c/>` también agotan la memoria.
//
// Tras el parseo, `assertSheetCells` acota filas × columnas de la hoja.
import { inflateRawSync } from "node:zlib";
import type { Worksheet } from "exceljs";
import { bad } from "./common";

export const XLSX_MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
export const XLSX_MAX_ENTRIES = 500;
// Una factura de 1000 filas × 10 columnas tiene ~25 000 elementos entre la
// hoja y las cadenas compartidas: el tope deja holgura de sobra.
export const XLSX_MAX_XML_ELEMENTS = 300_000;
export const XLSX_MAX_SHEET_CELLS = 50_000;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_SIZE = 22;
const CENTRAL_SIZE = 46;
const LOCAL_SIZE = 30;

function corrupt(detail: string): never {
  bad(
    `El archivo no es un Excel (.xlsx) válido o está dañado (${detail}). Ábrelo en Excel y guárdalo de nuevo como .xlsx, o usa CSV.`,
  );
}
function tooBig(): never {
  bad(
    `El archivo es demasiado grande al descomprimirse (más de ${XLSX_MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB). Envía solo la hoja con los datos, sin imágenes ni hojas extra.`,
  );
}

function findEndOfCentralDirectory(buffer: Buffer) {
  if (buffer.length < EOCD_SIZE) corrupt("demasiado corto");
  // El EOCD está al final, seguido solo de su comentario (≤ 65 535 bytes). Se
  // acepta únicamente la posición cuyo comentario llega exactamente al final.
  const lowest = Math.max(0, buffer.length - EOCD_SIZE - 0xffff);
  for (let at = buffer.length - EOCD_SIZE; at >= lowest; at--)
    if (
      buffer.readUInt32LE(at) === EOCD_SIGNATURE &&
      at + EOCD_SIZE + buffer.readUInt16LE(at + 20) === buffer.length
    )
      return at;
  corrupt("sin registro final de ZIP");
}

/** Lanza 400 si el ZIP es malformado o excede el presupuesto de memoria. */
export function assertSafeXlsx(buffer: Buffer) {
  if (!Buffer.isBuffer(buffer)) corrupt("sin contenido");
  const eocd = findEndOfCentralDirectory(buffer);
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (
    entries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  )
    corrupt("formato ZIP64 no admitido");
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entries)
    corrupt("ZIP dividido en varias partes");
  if (entries === 0) corrupt("ZIP vacío");
  if (entries > XLSX_MAX_ENTRIES) corrupt("demasiadas entradas");
  // El directorio central ocupa exactamente el tramo previo al EOCD.
  if (centralOffset + centralSize !== eocd)
    corrupt("directorio central incoherente");

  const centralEnd = eocd;
  let budget = XLSX_MAX_UNCOMPRESSED_BYTES;
  let elements = 0;
  let at = centralOffset;
  for (let n = 0; n < entries; n++) {
    if (at + CENTRAL_SIZE > centralEnd) corrupt("entrada truncada");
    if (buffer.readUInt32LE(at) !== CENTRAL_SIGNATURE)
      corrupt("entrada sin firma");
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const compressedSize = buffer.readUInt32LE(at + 20);
    const declaredSize = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const localOffset = buffer.readUInt32LE(at + 42);
    const next = at + CENTRAL_SIZE + nameLength + extraLength + commentLength;
    if (next > centralEnd) corrupt("entrada truncada");
    const name = buffer.toString(
      "utf8",
      at + CENTRAL_SIZE,
      at + CENTRAL_SIZE + nameLength,
    );
    at = next;
    if (
      compressedSize === 0xffffffff ||
      declaredSize === 0xffffffff ||
      localOffset === 0xffffffff
    )
      corrupt("formato ZIP64 no admitido");
    if (flags & 0x0001) corrupt("archivo cifrado");
    // Antes del presupuesto restante: lo declarado ya basta para rechazar.
    if (declaredSize > budget) tooBig();

    // La cabecera local solo se usa para saber dónde empiezan los datos; los
    // tamaños válidos son los del directorio central.
    if (localOffset + LOCAL_SIZE > centralOffset)
      corrupt("entrada fuera del archivo");
    if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE)
      corrupt("cabecera local sin firma");
    const dataStart =
      localOffset +
      LOCAL_SIZE +
      buffer.readUInt16LE(localOffset + 26) +
      buffer.readUInt16LE(localOffset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) corrupt("datos fuera del archivo");
    const data = buffer.subarray(dataStart, dataEnd);

    let content: Buffer;
    if (method === 0) content = data;
    else if (method === 8) {
      try {
        // Nunca produce más que el presupuesto restante, mienta quien mienta.
        content = inflateRawSync(data, { maxOutputLength: budget + 1 });
      } catch (error: any) {
        if (
          error?.code === "ERR_BUFFER_TOO_LARGE" ||
          error instanceof RangeError
        )
          tooBig();
        corrupt("datos comprimidos dañados");
      }
    } else corrupt("compresión no admitida");
    if (content.length > budget) tooBig();
    if (content.length !== declaredSize) corrupt("tamaño declarado falso");
    budget -= content.length;

    if (/\.(xml|rels|vml)$/i.test(name)) {
      elements += countXmlElements(content);
      if (elements > XLSX_MAX_XML_ELEMENTS)
        bad(
          `El archivo tiene demasiados elementos (más de ${XLSX_MAX_XML_ELEMENTS}). Envía solo la hoja con los datos, sin filas ni columnas de relleno.`,
        );
    }
  }
  if (at !== centralEnd) corrupt("directorio central incoherente");
}

// Etiquetas de apertura: «<» seguido de letra o «_» (no «</», «<?», «<!»).
function countXmlElements(xml: Buffer) {
  let count = 0;
  for (let i = xml.indexOf(0x3c); i >= 0; i = xml.indexOf(0x3c, i + 1)) {
    const c = xml[i + 1] | 0x20;
    if ((c >= 0x61 && c <= 0x7a) || xml[i + 1] === 0x5f) count++;
  }
  return count;
}

/** Tras el parseo: filas × columnas de la hoja dentro del presupuesto. */
export function assertSheetCells(
  sheet: Worksheet | undefined,
  max = XLSX_MAX_SHEET_CELLS,
) {
  if (!sheet) return;
  const cells = sheet.rowCount * sheet.columnCount;
  if (cells > max)
    bad(
      `La hoja tiene demasiadas celdas (${sheet.rowCount} filas × ${sheet.columnCount} columnas). El máximo es ${max}: borra las columnas o filas sobrantes.`,
    );
}

/**
 * Texto de una celda que guarda un código (SKU o código de barras). Excel
 * guarda «00123» escrito en una columna con formato «00000» como el número
 * 123: `cell.text` perdía los ceros y el código ya no coincidía con el del
 * producto. Un entero con formato de solo ceros se rellena hasta su ancho; el
 * resto de celdas se lee como texto, tal cual.
 */
export function cellCodeText(cell: {
  value: unknown;
  numFmt?: string;
  text: string;
}) {
  const value = cell.value;
  const format = String(cell.numFmt ?? "").replace(/[\\"]/g, "");
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return /^0+$/.test(format)
      ? String(value).padStart(format.length, "0")
      : String(value);
  }
  return String(cell.text ?? "").trim();
}

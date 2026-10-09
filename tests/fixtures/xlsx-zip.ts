// Archivos .xlsx fabricados para las pruebas de SEC-01 (bomba de
// descompresión). Un .xlsx es un ZIP: aquí se escribe a mano para poder
// producir también ZIPs malformados o con cabeceras que mienten.
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";

const requireApi = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const ExcelJS = requireApi("exceljs");
// JSZip es dependencia de exceljs; se resuelve desde su paquete.
const JSZip = createRequire(requireApi.resolve("exceljs"))("jszip");

export type ZipEntry = {
  name: string;
  data: Buffer;
  /** Tamaño descomprimido que se declara en el directorio central. */
  declaredSize?: number;
  stored?: boolean;
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP mínimo (sin ZIP64). `eocd` permite falsear el registro final. */
export function buildZip(
  entries: ZipEntry[],
  eocd: { entries?: number; cdOffset?: number; cdSize?: number } = {},
) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const body = e.stored ? e.data : deflateRawSync(e.data, { level: 9 });
    const method = e.stored ? 0 : 8;
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.declaredSize ?? e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(e.declaredSize ?? e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + body.length;
  }
  const cdBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(eocd.entries ?? entries.length, 8);
  end.writeUInt16LE(eocd.entries ?? entries.length, 10);
  end.writeUInt32LE(eocd.cdSize ?? cdBuffer.length, 12);
  end.writeUInt32LE(eocd.cdOffset ?? offset, 16);
  return Buffer.concat([...locals, cdBuffer, end]);
}

/** Entradas de un libro real de ExcelJS, con la hoja 1 ya escrita. */
export async function workbookEntries(): Promise<ZipEntry[]> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Factura").addRow(["codigo", "descripcion", "cantidad"]);
  const zip = await JSZip.loadAsync(Buffer.from(await wb.xlsx.writeBuffer()));
  const out: ZipEntry[] = [];
  for (const name of Object.keys(zip.files))
    if (!zip.files[name].dir)
      out.push({ name, data: await zip.file(name).async("nodebuffer") });
  return out;
}

const column = (n: number) => {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
/**
 * XML de hoja con `rows` × `cols` celdas numéricas. Con `period` < `cols` las
 * referencias de columna se repiten cada `period` celdas: así comprime ~400:1.
 */
export function sheetXml(rows: number, cols: number, period = cols) {
  const letters = Array.from({ length: cols }, (_, c) => column(c % period));
  const parts: Buffer[] = [
    Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',
    ),
  ];
  for (let r = 1; r <= rows; r++) {
    let row = `<row r="${r}">`;
    for (let c = 0; c < cols; c++)
      row += `<c r="${letters[c]}${r}"><v>1</v></c>`;
    parts.push(Buffer.from(row + "</row>"));
  }
  parts.push(Buffer.from("</sheetData></worksheet>"));
  return Buffer.concat(parts);
}

/** Reemplaza la hoja 1 de un libro real y lo empaqueta. */
export async function xlsxWithSheet(
  sheet: Buffer,
  patch: (e: ZipEntry) => ZipEntry = (e) => e,
) {
  const entries = (await workbookEntries()).map((e) =>
    patch(e.name === "xl/worksheets/sheet1.xml" ? { ...e, data: sheet } : e),
  );
  return buildZip(entries);
}

/**
 * Bomba: 1000 filas × 4800 celdas. La hoja pesa >100 MB descomprimida y el
 * archivo ~300 KB, por debajo del límite de subida de 1 MB de facturas.
 */
let bomb: Promise<{ file: Buffer; uncompressed: number }> | undefined;
export function xlsxBomb() {
  bomb ??= (async () => {
    const sheet = sheetXml(1000, 4800, 2);
    return { file: await xlsxWithSheet(sheet), uncompressed: sheet.length };
  })();
  return bomb;
}

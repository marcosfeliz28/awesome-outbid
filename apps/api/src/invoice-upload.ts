import { bad, imageType } from "./common";
import { assertSafeXlsx } from "./xlsx-guard";

const TABLE_MAX_BYTES = 1024 * 1024;
export const INVOICE_MAX_BYTES = 5 * 1024 * 1024;
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOWNLOAD_TYPES = new Set([
  "text/csv",
  XLSX_MIME,
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// La extensión sólo elige el lector de tablas. El MIME de fotos/PDF se
// contrasta con los bytes antes de consultar la base o enviar datos a la IA.
export function validateInvoiceUpload(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length)
    bad("Adjunta la factura.");
  const { buffer } = file;
  if (buffer.length > INVOICE_MAX_BYTES) bad("La factura supera 5 MB.");
  const name = String(file.originalname).toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".xlsx")) {
    if (buffer.length > TABLE_MAX_BYTES)
      bad(
        "El Excel o CSV supera 1 MB. Revisa que sea el archivo de la factura.",
      );
    if (name.endsWith(".xlsx")) {
      assertSafeXlsx(buffer);
      return { format: "xlsx" as const, mime: XLSX_MIME };
    }
    // CSV admite UTF-8 y Windows-1252. Los controles binarios no son texto;
    // se permiten sólo tabulador y los separadores de línea CR/LF.
    if (buffer.some((b) => b < 32 && b !== 9 && b !== 10 && b !== 13))
      bad("El CSV contiene datos binarios. Guárdalo de nuevo como CSV.");
    return { format: "csv" as const, mime: "text/csv" };
  }
  const type = imageType(buffer);
  const pdf =
    /^%PDF-(?:1\.[0-7]|2\.0)(?:\r\n|\n|\r)/.test(
      buffer.subarray(0, 12).toString("latin1"),
    ) && /%%EOF[\t\r\n ]*$/.test(buffer.subarray(-1024).toString("latin1"));
  const mime = pdf
    ? "application/pdf"
    : type && type !== "gif"
      ? `image/${type}`
      : undefined;
  if (!mime || file.mimetype !== mime)
    bad(
      "El contenido de la factura debe ser una foto PNG/JPEG/WebP o PDF válido.",
    );
  return { format: "ai" as const, mime };
}

// Datos antiguos no pueden convertir esta descarga en una página activa.
export function invoiceDownloadMime(mime: string) {
  return DOWNLOAD_TYPES.has(mime) ? mime : "application/octet-stream";
}

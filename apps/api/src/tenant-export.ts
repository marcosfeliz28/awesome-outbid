import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { chmod, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Controller, Get, HttpException, Inject, Query, Req, Res } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import type { Request, Response } from "express";
import { Actor, CurrentUser, Database, Permit } from "./common";
import { currentTenantId } from "./tenant-context";
import { objectReferenceForRow, readPortableObject, recordObjectReference, type ObjectReference, type PortableObject } from "./tenant-object-portability";
import { tenantObjectStore } from "./tenant-object-store";

/** Portable business export. Authentication material is deliberately NOT portable;
 * the encrypted disaster-recovery backup is a separate operation. */
const SECRET_FIELD = /(?:password|pinHash|secret|token|verificationHash|api[_-]?key|private[_-]?key|credential|authorization|cookie)/i;
const SECRET_EXACT = new Set(["hash", "codeHash", "challenge", "refreshTokenEnc", "secretHash", "emailVerificationHash"]);
/** Notas internas del operador de la plataforma: la empresa ve sus pagos, no por qué se anularon
 * ni el estado previo que la anulación usa para deshacerse. */
const INTERNAL_COLUMNS = new Set([
  "PlatformPayment.voidReason",
  "PlatformPayment.prevStatus",
  "PlatformPayment.prevPaidThroughAt",
  "PlatformPayment.prevPastDueAt",
  "PlatformPayment.prevSuspendedAt",
  "PlatformPayment.operator",
]);
const BATCH = 100;

type ExportModel = { name: string; table: string; columns: string[]; order: string[] };

function quote(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/** No hard-coded 2026 table list: a migration adding a model cannot silently omit it. */
export function exportModels(): ExportModel[] {
  return Prisma.dmmf.datamodel.models.map((model) => {
    if (model.name !== "Tenant" && !model.fields.some((field) => field.name === "tenantId"))
      throw new Error(`Exportación incompleta: ${model.name} no tiene tenantId.`);
    const order = model.primaryKey?.fields ?? model.fields.filter((field) => field.isId).map((field) => field.name);
    if (!order.length) throw new Error(`Exportación incompleta: ${model.name} no tiene clave primaria.`);
    return {
      name: model.name,
      table: model.dbName ?? model.name,
      columns: model.fields.filter((field) => (field.kind === "scalar" || field.kind === "enum") && !INTERNAL_COLUMNS.has(`${model.name}.${field.name}`)).map((field) => field.dbName ?? field.name),
      order: order.map((field) => model.fields.find((candidate) => candidate.name === field)?.dbName ?? field),
    };
  });
}

function redact(value: unknown, name = ""): unknown {
  if (SECRET_EXACT.has(name) || SECRET_FIELD.test(name)) return "[RESERVADO]";
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array)
    return { encoding: "base64", data: Buffer.from(value).toString("base64") };
  if (typeof value === "bigint" || value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, key)]));
  return value;
}

export type TenantExport = {
  formatVersion: 1;
  generatedAt: string;
  tenantId: string;
  tables: Record<string, Record<string, unknown>[]>;
  /** Base64 data and digest make JSON a self-contained portable copy. */
  objects?: Record<string, Omit<PortableObject, "key">>;
};

async function validateTables(tx: Prisma.TransactionClient, models: ExportModel[]) {
  const role = await tx.$queryRawUnsafe<{ role: string }[]>("SELECT current_user AS role");
  if (role[0]?.role !== "nexora_tenant_runtime") throw new Error("Exportación requiere el rol RLS de empresa.");
  const catalog = await tx.$queryRawUnsafe<{ name: string; rls: boolean }[]>(
    `SELECT c.relname AS name, c.relrowsecurity AS rls FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations'`,
  );
  const expected = new Set(models.map((model) => model.table));
  const actual = new Set(catalog.map((table) => table.name));
  const missing = [...expected].filter((table) => !actual.has(table));
  const extra = [...actual].filter((table) => !expected.has(table));
  const unprotected = catalog.filter((table) => !table.rls).map((table) => table.name);
  if (missing.length || extra.length || unprotected.length)
    throw new Error(`Esquema no apto para exportación: faltan ${missing.join(",")}; sobran ${extra.join(",")}; sin RLS ${unprotected.join(",")}.`);
}

/** Compatibility helper for small test fixtures. Never use this in an HTTP
 * handler: by definition returning an object materializes the entire export. */
export async function exportTenant(db: PrismaClient, tenantId: string): Promise<TenantExport> {
  const file = await exportTenantToFile(db, tenantId, "json");
  try { return JSON.parse(await readFile(file.path, "utf8")) as TenantExport; }
  finally { await rm(file.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

function cell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  const result = typeof value === "string" ? value : JSON.stringify(value);
  // Excel-compatible viewers must never interpret user-supplied text as a formula.
  return /^[\s]*[=+\-@\t\r]/.test(result) ? `'${result}` : result;
}

export async function exportExcel(snapshot: TenantExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const longValues = workbook.addWorksheet("__valores_largos");
  longValues.addRow(["Tabla", "Fila", "Campo", "Fragmento", "Valor"]);
  for (const model of exportModels()) {
    const sheet = workbook.addWorksheet(model.name);
    const fields = model.columns.filter((name) => !SECRET_EXACT.has(name) && !SECRET_FIELD.test(name));
    sheet.addRow(fields);
    const rows = snapshot.tables[model.name] ?? [];
    for (const [index, row] of rows.entries()) {
      const values = fields.map((field) => {
        const value = cell(row[field]);
        if (typeof value !== "string" || value.length <= 30000) return value;
        for (let offset = 0; offset < value.length; offset += 30000)
          longValues.addRow([model.name, index + 2, field, offset / 30000 + 1, cell(value.slice(offset, offset + 30000))]);
        return `[VER __valores_largos: ${Math.ceil(value.length / 30000)} fragmentos]`;
      });
      sheet.addRow(values);
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  if (snapshot.objects && Object.keys(snapshot.objects).length) {
    const objects = workbook.addWorksheet("__objetos");
    objects.addRow(["Clave", "MIME", "SHA-256", "Fragmento", "Base64"]);
    for (const [key, object] of Object.entries(snapshot.objects))
      for (let offset = 0; offset < object.base64.length; offset += 30000)
        objects.addRow([key, object.mime, object.sha256, offset / 30000 + 1, object.base64.slice(offset, offset + 30000)]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

type ExportFormat = "json" | "xlsx";
type FileExport = { directory: string; path: string; maxRowsBuffered: number; rows: number };
type ExportFileOps = {
  createDirectory?: (prefix: string) => Promise<string>;
  protectDirectory?: (path: string, mode: number) => Promise<void>;
  createFile?: (path: string, flags: "wx", mode: number) => Promise<{ close(): Promise<void> }>;
};

/** The download is prepared in a private temporary directory. A cursor keeps one
 * REPEATABLE READ/RLS snapshot without OFFSET scans, while the writer never holds
 * the complete business in memory. The caller MUST remove directory in finally. */
export async function exportTenantToFile(
  db: PrismaClient, tenantId: string, format: ExportFormat, signal?: AbortSignal,
  fileOps?: ExportFileOps,
): Promise<FileExport> {
  if (tenantId !== currentTenantId()) throw new Error("Empresa incorrecta para exportación.");
  const models = exportModels();
  const directory = await (fileOps?.createDirectory ?? mkdtemp)(join(tmpdir(), "nexora-tenant-export-"));
  const path = join(directory, `empresa.${format}`);
  let stream: ReturnType<typeof createWriteStream> | undefined;
  let workbook: ExcelJS.stream.xlsx.WorkbookWriter | undefined;
  let longValues: ExcelJS.Worksheet | undefined;
  let maxRowsBuffered = 0;
  let rows = 0;
  const objects = new Map<string, ObjectReference>();
  const generatedAt = new Date().toISOString();
  try {
    await (fileOps?.protectDirectory ?? chmod)(directory, 0o700);
    const file = await (fileOps?.createFile ?? open)(path, "wx", 0o600);
    await file.close();
    if (format === "json") {
      stream = createWriteStream(path, { flags: "w", highWaterMark: 64 * 1024 });
      // Prevent an asynchronous disk-write failure from becoming an unhandled
      // EventEmitter error; write()/once(finish) still reject the operation.
      stream.on("error", () => undefined);
      await write(stream, JSON.stringify({ formatVersion: 1, generatedAt, tenantId }).slice(0, -1) + ',"tables":{');
    } else {
      workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: path, useSharedStrings: false, useStyles: false });
      longValues = workbook.addWorksheet("__valores_largos");
      longValues.addRow(["Tabla", "Fila", "Campo", "Fragmento", "Valor"]).commit();
    }

    await db.$transaction(async (tx) => {
      await validateTables(tx, models);
      let firstTable = true;
      for (const model of models) {
        if (signal?.aborted) throw new Error("Exportación cancelada.");
        const fields = model.columns.filter((name) => !SECRET_EXACT.has(name) && !SECRET_FIELD.test(name));
        const sheet = workbook?.addWorksheet(model.name);
        sheet?.addRow(fields).commit();
        if (stream) {
          await write(stream, `${firstTable ? "" : ","}${JSON.stringify(model.name)}:[`);
          firstTable = false;
        }
        const columns = model.columns.map(quote).join(", ");
        const order = model.order.map(quote).join(", ");
        const where = model.name === "Tenant" ? `${quote("id")} = '${tenantId}'::uuid` : `${quote("tenantId")} = '${tenantId}'::uuid`;
        // tenantId is a server-validated UUID from the signed actor; still reject
        // non-UUID input before interpolating into DECLARE (which has no bind API).
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId))
          throw new Error("Identificador de empresa inválido.");
        // The FETCH SQL must be distinct per model: Prisma caches result-column
        // metadata by query text, and different tables have different shapes.
        const cursor = quote(`nexora_export_${model.name}`);
        await tx.$executeRawUnsafe(`DECLARE ${cursor} NO SCROLL CURSOR FOR SELECT ${columns} FROM ${quote(model.table)} WHERE ${where} ORDER BY ${order}`);
        let modelRows = 0;
        try {
          while (true) {
            if (signal?.aborted) throw new Error("Exportación cancelada.");
            const batch = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`FETCH FORWARD ${BATCH} FROM ${cursor}`);
            maxRowsBuffered = Math.max(maxRowsBuffered, batch.length);
            for (const raw of batch) {
              if (signal?.aborted) throw new Error("Exportación cancelada.");
              recordObjectReference(objects, objectReferenceForRow(model.name, raw));
              const row = redact(raw) as Record<string, unknown>;
              if (stream) await write(stream, `${modelRows ? "," : ""}${JSON.stringify(row)}`);
              if (sheet) {
                const excelRow = fields.map((field) => {
                  const value = cell(row[field]);
                  if (typeof value !== "string" || value.length <= 30000) return value;
                  for (let offset = 0; offset < value.length; offset += 30000)
                    longValues!.addRow([model.name, modelRows + 2, field, offset / 30000 + 1, cell(value.slice(offset, offset + 30000))]).commit();
                  return `[VER __valores_largos: ${Math.ceil(value.length / 30000)} fragmentos]`;
                });
                sheet.addRow(excelRow).commit();
              }
              modelRows++;
              rows++;
            }
            if (batch.length < BATCH) break;
          }
        } finally {
          await tx.$executeRawUnsafe(`CLOSE ${cursor}`);
        }
        if (model.name === "Tenant" && modelRows !== 1) throw new Error("Empresa no encontrada para exportación.");
        if (stream) await write(stream, "]");
        sheet?.commit();
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60 * 60 * 1000 });

    if (stream) {
      await write(stream, '},"objects":{');
      let first = true;
      const objectStore = objects.size ? tenantObjectStore() : null;
      for (const ref of objects.values()) {
        if (signal?.aborted) throw new Error("Exportación cancelada.");
        const { key, ...object } = await readPortableObject(tenantId, ref, objectStore!);
        await write(stream, `${first ? "" : ","}${JSON.stringify(key)}:${JSON.stringify(object)}`);
        first = false;
      }
      await write(stream, "}}");
      stream.end();
      await once(stream, "finish");
    } else {
      if (objects.size) {
        const objectStore = tenantObjectStore();
        const sheet = workbook!.addWorksheet("__objetos");
        sheet.addRow(["Clave", "MIME", "SHA-256", "Fragmento", "Base64"]).commit();
        for (const ref of objects.values()) {
          if (signal?.aborted) throw new Error("Exportación cancelada.");
          const object = await readPortableObject(tenantId, ref, objectStore);
          for (let offset = 0; offset < object.base64.length; offset += 30000)
            sheet.addRow([object.key, object.mime, object.sha256, offset / 30000 + 1, object.base64.slice(offset, offset + 30000)]).commit();
        }
        sheet.commit();
      }
      longValues?.commit();
      await workbook!.commit();
    }
    return { directory, path, maxRowsBuffered, rows };
  } catch (error) {
    stream?.destroy();
    // Close ExcelJS' ZIP/file handle before deleting the partial export on
    // Windows; the incomplete result is never sent to the client.
    await workbook?.commit().catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw error;
  }
}

async function write(stream: ReturnType<typeof createWriteStream>, data: string) {
  if (stream.destroyed || stream.errored) throw new Error("No se pudo escribir la exportación.");
  if (!stream.write(data)) await new Promise<void>((resolve, reject) => {
    const drained = () => { stream.off("error", failed); resolve(); };
    const failed = (error: Error) => { stream.off("drain", drained); reject(error); };
    stream.once("drain", drained);
    stream.once("error", failed);
  });
}

/** También libera el archivo si Express informa error asíncrono o corte del cliente. */
export async function sendTenantExportFile(
  res: Response, file: FileExport, format: ExportFormat, tenantId: string,
) {
  try {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", format === "json"
      ? "application/json; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="nexora-empresa-${tenantId}.${format}"`);
    await new Promise<void>((resolve, reject) => {
      res.download(file.path, (error) => error ? reject(error) : resolve());
    });
  } finally {
    await rm(file.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

@Controller("tenant")
export class TenantExportController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get("export") @Permit("*")
  async download(@CurrentUser() actor: Actor, @Query("format") format: string | undefined, @Req() req: Request, @Res() res: Response) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("Disponible en el producto Norexos.", 404);
    if (format !== "json" && format !== "xlsx") throw new HttpException("Elige JSON o Excel.", 400);
    const abort = new AbortController();
    req.once("aborted", () => abort.abort());
    res.once("close", () => { if (!res.writableEnded) abort.abort(); });
    const file = await exportTenantToFile(this.db, actor.tenantId, format, abort.signal);
    if (abort.signal.aborted) {
      await rm(file.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      return;
    }
    await sendTenantExportFile(res, file, format, actor.tenantId);
  }
}

// Pantalla «Importar inventario» (sólo administración): vista previa y carga
// del Excel de existencias. La lógica está en inventory-import-core.ts (la
// misma del script de línea de comandos). El archivo vive sólo en memoria
// durante la petición: no se guarda en disco, ni en la base, ni sale a
// terceros, y ni los registros del servidor ni la bitácora llevan costos.
import {
  Body,
  Controller,
  HttpException,
  Inject,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  audit,
  bad,
  conflict,
} from "./common";
import { lockVariant, stockChange } from "./inventory";
import {
  InventoryBlockedError,
  InventoryBusyError,
  InventoryChangedError,
  InventoryFileError,
  importInventory,
  previewInventory,
  readInventory,
  type ImportOptions,
  type ImportReport,
} from "./inventory-import-core";
import { assertSafeXlsx, assertSheetCells } from "./xlsx-guard";

export const INVENTORY_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const INVENTORY_IMPORT_MAX_ROWS = 1500;
/** Sólo la administración (permiso «*»): ningún rol de cajas ni de gerencia lo tiene. */
export const INVENTORY_IMPORT_PERMISSION = "inventory:import";

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
/** «Conteo físico 10-oct-2026», con la fecha del negocio (Santo Domingo) de hoy. */
export function countReason(now = new Date()) {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
  })
    .format(now)
    .split("-");
  return "Conteo físico " + Number(day) + "-" + MONTHS[Number(m) - 1] + "-" + y;
}

/** «actualizar precios y costos» y «actualizar existencias»: activadas salvo que se pida «false». */
const flag = (value: unknown) => String(value) !== "false";
const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

@Controller()
export class InventoryImportController {
  private readonly log = new Logger("InventoryImport");
  constructor(@Inject(Database) private readonly db: Database) {}

  /** Valida y lee el archivo en memoria. */
  private async read(file: any) {
    if (!file?.buffer)
      bad("Selecciona el archivo Excel (.xlsx) del inventario.");
    if (!/\.xlsx$/i.test(String(file.originalname)))
      bad("El archivo debe ser un Excel (.xlsx).");
    if (file.size > INVENTORY_IMPORT_MAX_BYTES)
      bad("El archivo pesa más de 5 MB.");
    // Un .xlsx es un ZIP: se revisa antes de que ExcelJS lo descomprima.
    assertSafeXlsx(file.buffer);
    const buffer: Buffer = file.buffer;
    return {
      buffer,
      hash: sha256(buffer),
      name: String(file.originalname).split(/[\\/]/).pop()!.slice(0, 120),
    };
  }

  private options(
    body: any,
    actor: Actor,
    reason = countReason(),
    hash = "",
  ): ImportOptions {
    const update = flag(body?.updatePrices);
    return {
      updatePrices: update,
      updateCosts: update,
      disableLots: String(body?.withoutLots) === "true",
      lotStopMessage: (name) =>
        "La categoría «" +
        name +
        "» exige lote o vencimiento y el Excel no los trae. Marca «Cargar sin lotes» para continuar (queda en la bitácora).",
      stockCount: !flag(body?.updateStock)
        ? undefined
        : {
            reason,
            // La misma ruta que el conteo físico aprobado: variante bloqueada,
            // existencia y kardex (tipo «count», con el costo vigente).
            apply: async (tx, holder, delta) => {
              const variant = await lockVariant(tx, holder.id, actor);
              await stockChange(
                tx,
                actor,
                variant,
                delta,
                "count",
                reason,
                hash,
              );
            },
          },
    };
  }

  private fail(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (
      error instanceof InventoryBusyError ||
      error instanceof InventoryChangedError
    )
      conflict(error.message);
    if (error instanceof InventoryFileError)
      throw new HttpException(
        { message: error.message, problems: error.problems },
        400,
      );
    if (error instanceof InventoryBlockedError)
      throw new HttpException(
        { message: error.message, problems: error.problems },
        400,
      );
    // Sin datos del archivo en el registro: sólo el tipo de fallo.
    this.log.error(
      "Falló la importación: " +
        ((error as any)?.code ?? (error as any)?.name ?? "error"),
    );
    throw new HttpException(
      "No se pudo cargar el inventario. No se guardó nada; inténtalo de nuevo.",
      500,
    );
  }

  private async rows(buffer: Buffer) {
    return readInventory(buffer, {
      maxRows: INVENTORY_IMPORT_MAX_ROWS,
      inspect: (sheet) => assertSheetCells(sheet),
    });
  }

  @Post("inventory-import/preview")
  @RequireTerminal()
  @Permit(INVENTORY_IMPORT_PERMISSION)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: INVENTORY_IMPORT_MAX_BYTES, files: 1 },
    }),
  )
  async preview(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() actor: Actor,
  ) {
    const { buffer, hash, name } = await this.read(file);
    try {
      const rows = await this.rows(buffer);
      const report = await previewInventory(this.db, rows, actor, {
        ...this.options(body, actor),
        origen: name,
      });
      return this.present(report, hash, name);
    } catch (error) {
      // Los errores del contenido se muestran fila por fila en la pantalla.
      if (error instanceof InventoryFileError)
        return {
          fileName: name,
          hash,
          state: "",
          canApply: false,
          blocking: error.problems,
          rows: 0,
        };
      return this.fail(error);
    }
  }

  private present(report: ImportReport, hash: string, name: string) {
    return {
      fileName: name,
      hash,
      state: report.state,
      canApply: report.blocking.length === 0,
      blocking: report.blocking,
      rows: report.summary.leidos,
      summary: report.summary,
      categories: report.categories,
      changes: report.changes,
      newCategories: report.newCategories,
      lotCategories: report.lotCategories,
      review: report.review.map(
        ({ id, name, category, qty, active, notes }) => ({
          id,
          name,
          category,
          qty,
          active,
          notes,
        }),
      ),
    };
  }

  @Post("inventory-import/apply")
  @RequireTerminal()
  @Permit(INVENTORY_IMPORT_PERMISSION)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: INVENTORY_IMPORT_MAX_BYTES, files: 1 },
    }),
  )
  async apply(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() actor: Actor,
  ) {
    const { buffer, hash, name } = await this.read(file);
    if (!/^[0-9a-f]{64}$/.test(String(body?.hash)) || !body?.state)
      bad("Primero revisa la vista previa del archivo.");
    if (String(body.hash) !== hash)
      conflict(
        "El archivo no es el mismo que revisaste en la vista previa. No se cargó nada: súbelo otra vez y revisa la vista previa.",
      );
    try {
      const rows = await this.rows(buffer);
      const report = await importInventory(this.db, rows, actor, {
        ...this.options(body, actor, countReason(), hash),
        dryRun: false,
        origen: name,
        lock: true,
        expectState: String(body.state),
        transaction: { maxWait: 20000, timeout: 120000 },
        afterWrite: async (tx, done) => {
          const s = done.summary;
          // Cifras, nunca costos ni precios.
          await audit(
            tx,
            actor,
            "inventory_import",
            "inventory",
            hash,
            undefined,
            {
              hash,
              archivo: name,
              filas: s.leidos,
              nuevos: s.nuevos,
              unidadesNuevas: s.unidades,
              existenciasAjustadas: s.existencias,
              unidadesSuben: s.unidadesSuben,
              unidadesBajan: s.unidadesBajan,
              preciosCambiados: s.precios,
              costosCambiados: s.costos,
              activados: s.activados,
              sinCambios: s.sinCambios,
              categoriasNuevas: done.newCategories,
              sinLotes: done.lotCategories,
              actualizarPrecios: flag(body?.updatePrices),
              actualizarExistencias: flag(body?.updateStock),
            },
          );
        },
      });
      return { ok: true, ...this.present(report, hash, name) };
    } catch (error) {
      return this.fail(error);
    }
  }
}

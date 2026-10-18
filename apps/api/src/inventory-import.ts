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
import { d, quantity, weightedCost, z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  audit,
  bad,
  conflict,
  parse,
} from "./common";
import { lockVariant, stockChange } from "./inventory";
import { retrySerializable } from "./inventory-resilience";
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
import { errorDiagnostic } from "./safe-log";

export const INVENTORY_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const INVENTORY_IMPORT_MAX_ROWS = 1500;
/** Sólo la administración (permiso «*»): ningún rol de cajas ni de gerencia lo tiene. */
export const INVENTORY_IMPORT_PERMISSION = "inventory:import";

const boolField = z.enum(["true", "false"]).optional();
const importPreviewInput = z.object({
  updatePrices: boolField,
  updateStock: boolField,
  withoutLots: boolField,
});
const importApplyInput = importPreviewInput.extend({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  state: z.string().regex(/^[0-9a-f]{64}$/),
});
const homeApplyInput = z.object({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  state: z.string().regex(/^[0-9a-f]{64}$/),
});

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
      "Falló la importación: " + JSON.stringify(errorDiagnostic(error)),
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

  private async casaPlan(buffer: Buffer, actor: Actor, tx: any = this.db) {
    const rows = await this.rows(buffer);
    const home = await tx.warehouse.findUnique({
      where: { branchId_kind: { branchId: actor.branchId, kind: "home" } },
    });
    if (!home || !home.active) bad("El almacén Casa no está disponible.");
    const problems: { row?: number; message: string }[] = [];
    const changes = [];
    const seen = new Set<string>();
    const newBarcodes = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) {
        problems.push({
          row: row.line,
          message: `El ID ${row.id} está repetido en el Excel.`,
        });
        continue;
      }
      seen.add(row.id);
      const variant = await tx.variant.findFirst({
        where: { sku: row.id, branchId: actor.branchId },
        include: { product: { include: { category: true } } },
      });
      if (!variant) {
        const barcode = row.barcode ?? row.id;
        if (newBarcodes.has(barcode)) {
          problems.push({
            row: row.line,
            message: `El código de barras ${barcode} está repetido en productos nuevos del Excel.`,
          });
          continue;
        }
        newBarcodes.add(barcode);
        const skuTaken = await tx.variant.findUnique({
          where: { sku: row.id },
        });
        const barcodeTaken = await tx.variant.findUnique({
          where: { barcode: row.barcode ?? row.id },
        });
        const productTaken = await tx.product.findUnique({
          where: { sku: "INV-" + row.id },
        });
        const category = await tx.category.findUnique({
          where: { name: row.category },
        });
        if (
          skuTaken ||
          barcodeTaken ||
          productTaken ||
          (category && category.branchId !== actor.branchId)
        ) {
          problems.push({
            row: row.line,
            message: `El ID, código o categoría de ${row.id} ya está usado por otro producto o sucursal.`,
          });
          continue;
        }
        if (
          (category?.requiresLot || category?.requiresExpiry) &&
          row.qty > 0
        ) {
          problems.push({
            row: row.line,
            message: `${row.id} exige lote. Registra su existencia por lote en Casa.`,
          });
          continue;
        }
        changes.push({
          row,
          variantId: null as string | null,
          before: 0,
          after: row.qty,
          store: 0,
          costAvg: row.cost,
        });
        continue;
      }
      if (
        (variant.product.category.requiresLot ||
          variant.product.category.requiresExpiry) &&
        row.qty > 0
      ) {
        problems.push({
          row: row.line,
          message: `${row.id} exige lote. Registra el conteo por lote en Casa.`,
        });
        continue;
      }
      const current = Number(
        (
          await tx.variantStock.findUnique({
            where: {
              variantId_warehouseId: {
                variantId: variant.id,
                warehouseId: home.id,
              },
            },
          })
        )?.qty ?? 0,
      );
      const tracked = Number(
        (
          await tx.lotStock.aggregate({
            where: { warehouseId: home.id, lot: { variantId: variant.id } },
            _sum: { qty: true },
          })
        )._sum.qty ?? 0,
      );
      if (row.qty < tracked) {
        problems.push({
          row: row.line,
          message: `${row.id}: el conteo queda por debajo de los lotes de Casa.`,
        });
        continue;
      }
      changes.push({
        row,
        variantId: variant.id as string | null,
        before: current,
        after: row.qty,
        store: Number(variant.stock),
        costAvg: Number(variant.costAvg),
      });
    }
    const state = createHash("sha256")
      .update(
        JSON.stringify(
          changes.map((x) => [
            x.variantId ?? x.row.id,
            x.before,
            x.after,
            x.store,
            x.costAvg,
            x.row.cost,
          ]),
        ),
      )
      .digest("hex");
    return { home, rows, changes, problems, state };
  }

  @Post("inventory-import/casa/preview")
  @RequireTerminal()
  @Permit(INVENTORY_IMPORT_PERMISSION)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: INVENTORY_IMPORT_MAX_BYTES,
        files: 1,
        fields: 0,
        fieldSize: 128,
        parts: 2,
      },
    }),
  )
  async casaPreview(@UploadedFile() file: any, @CurrentUser() actor: Actor) {
    const { buffer, hash, name } = await this.read(file);
    try {
      const plan = await this.casaPlan(buffer, actor);
      return {
        fileName: name,
        hash,
        state: plan.state,
        rows: plan.rows.length,
        canApply: plan.problems.length === 0,
        blocking: plan.problems,
        changes: plan.changes.map((c) => ({
          id: c.row.id,
          name: c.row.name,
          kind: "existencia",
          before: c.before,
          after: c.after,
        })),
      };
    } catch (error) {
      return this.fail(error);
    }
  }

  @Post("inventory-import/casa/apply")
  @RequireTerminal()
  @Permit(INVENTORY_IMPORT_PERMISSION)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: INVENTORY_IMPORT_MAX_BYTES,
        files: 1,
        fields: 5,
        fieldSize: 128,
        parts: 6,
      },
    }),
  )
  async casaApply(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() actor: Actor,
  ) {
    body = parse(homeApplyInput, body ?? {});
    const { buffer, hash, name } = await this.read(file);
    if (body?.hash !== hash || !/^[0-9a-f]{64}$/.test(String(body?.state)))
      bad("Primero revisa este mismo archivo.");
    try {
      return await retrySerializable(() =>
        this.db.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('nexora-inventory-import'))`;
            const plan = await this.casaPlan(buffer, actor, tx);
            if (plan.problems.length)
              bad("Corrige el archivo antes de cargarlo.");
            if (plan.state !== body.state)
              conflict(
                "El inventario cambió. Revisa otra vez la vista previa.",
              );
            for (const change of plan.changes.sort((a, b) =>
              (a.variantId ?? a.row.id).localeCompare(b.variantId ?? b.row.id),
            )) {
              let variantId = change.variantId;
              if (!variantId) {
                const category = await tx.category.upsert({
                  where: { name: change.row.category },
                  create: {
                    name: change.row.category,
                    branchId: actor.branchId,
                  },
                  update: {},
                });
                const product = await tx.product.create({
                  data: {
                    name: change.row.name,
                    sku: "INV-" + change.row.id,
                    categoryId: category.id,
                    brand: "",
                    active:
                      change.row.price > change.row.cost && change.row.cost > 0,
                    branchId: actor.branchId,
                    createdBy: actor.id,
                    variants: {
                      create: {
                        sku: change.row.id,
                        barcode: change.row.barcode ?? change.row.id,
                        price: change.row.price,
                        costAvg: change.row.cost,
                        stock: 0,
                        active:
                          change.row.price > change.row.cost &&
                          change.row.cost > 0,
                        branchId: actor.branchId,
                        createdBy: actor.id,
                      },
                    },
                  },
                  include: { variants: true },
                });
                variantId = product.variants[0].id;
              } else {
                await tx.$queryRaw`SELECT id FROM "Variant" WHERE id=${variantId}::uuid FOR UPDATE`;
              }
              if (change.after === change.before) continue;
              if (change.variantId && change.after > change.before) {
                const other = await tx.variantStock.findMany({
                  where: {
                    variantId,
                    warehouse: { branchId: actor.branchId, sellable: false },
                  },
                  select: { qty: true },
                });
                const totalBefore = Math.max(
                  0,
                  other.reduce((sum, x) => sum + Number(x.qty), change.store),
                );
                await tx.variant.update({
                  where: { id: variantId },
                  data: {
                    costAvg: weightedCost(
                      totalBefore,
                      change.costAvg,
                      change.after - change.before,
                      change.row.cost,
                    ),
                  },
                });
              }
              await tx.variantStock.upsert({
                where: {
                  variantId_warehouseId: {
                    variantId,
                    warehouseId: plan.home.id,
                  },
                },
                create: {
                  variantId,
                  warehouseId: plan.home.id,
                  qty: change.after,
                },
                update: { qty: change.after },
              });
              await tx.inventoryMovement.create({
                data: {
                  variantId,
                  warehouseId: plan.home.id,
                  type: "count",
                  qty: quantity(d(change.after).minus(change.before)),
                  unitCost:
                    change.after > change.before
                      ? change.row.cost
                      : change.costAvg,
                  balanceAfter: change.after,
                  refId: hash,
                  reason: "Levantamiento Casa (" + name + ")",
                  userId: actor.id,
                  branchId: actor.branchId,
                },
              });
            }
            await audit(
              tx,
              actor,
              "inventory_import_home",
              "warehouse",
              plan.home.id,
              undefined,
              { hash, rows: plan.rows.length },
            );
            return {
              rows: plan.rows.length,
              changed: plan.changes.filter((c) => c.after !== c.before).length,
            };
          },
          { isolationLevel: "Serializable", timeout: 120000 },
        ),
      );
    } catch (error) {
      return this.fail(error);
    }
  }

  @Post("inventory-import/preview")
  @RequireTerminal()
  @Permit(INVENTORY_IMPORT_PERMISSION)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: INVENTORY_IMPORT_MAX_BYTES,
        files: 1,
        fields: 5,
        fieldSize: 128,
        parts: 6,
      },
    }),
  )
  async preview(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() actor: Actor,
  ) {
    body = parse(importPreviewInput, body ?? {});
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
      limits: {
        fileSize: INVENTORY_IMPORT_MAX_BYTES,
        files: 1,
        fields: 5,
        fieldSize: 128,
        parts: 7,
      },
    }),
  )
  async apply(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() actor: Actor,
  ) {
    body = parse(importApplyInput, body ?? {});
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

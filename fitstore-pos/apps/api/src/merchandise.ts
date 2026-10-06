import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { createHash } from "node:crypto";
import {
  businessDate,
  can,
  countedQty,
  d,
  expired,
  money,
  weightedCost,
  z,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  amount,
  audit,
  bad,
  denied,
  json,
  parse,
  positive,
  uuid,
} from "./common";
import { assertCodesFree } from "./catalog";
import {
  checkDamage,
  damageFields,
  damagedCostOf,
  documentData,
  documentSchema,
  lockVariant,
  receiptCosts,
  stockChange,
} from "./inventory";
import {
  DEFAULT_INVOICE_MODEL,
  extractAnthropic,
  matchInvoiceLines,
  readInvoiceTable,
} from "./invoice";
// Compatibilidad: las pruebas y otros módulos importaban desde aquí.
export {
  extractAnthropic,
  extractedSchema,
  nameConfidence,
  parseExtraction,
  readInvoiceTable,
} from "./invoice";
const quickSchema = z.object({
  name: z.string().trim().min(2).max(200),
  categoryId: uuid,
  price: positive,
  cost: positive,
  barcode: z.string().trim().min(1).max(100),
  variant: z.string().trim().min(1).max(100),
});
const lineSchema = z
  .object({
    variantId: uuid.optional(),
    quick: quickSchema.optional(),
    // En una entrada, 0 si toda la línea llegó dañada o rechazada.
    qty: countedQty(),
    ...damageFields,
    unitCost: positive,
    lotId: uuid.optional(),
    lotNumber: z.string().trim().min(1).max(100).optional(),
    expiryDate: z.string().datetime().optional(),
    supplierCode: z.string().max(100).optional(),
    itemId: uuid.optional(),
  })
  .refine(
    (l) => !!l.variantId !== !!l.quick,
    "Elige un producto o crea uno rápido.",
  );
// Documento del proveedor y condición de pago en la entrada (opcionales).
const operationSchema = documentSchema.extend({
  id: uuid,
  direction: z.enum(["entry", "exit"]),
  supplierId: uuid.optional(),
  orderId: uuid.optional(),
  draftId: uuid.optional(),
  reason: z
    .enum([
      "merma",
      "dañado",
      "vencido",
      "muestra",
      "uso interno",
      "devolución a proveedor",
    ])
    .optional(),
  freight: amount.default(0),
  taxes: amount.default(0),
  allocation: z.enum(["value", "units"]).default("value"),
  invoiceTotal: amount.optional(),
  acknowledgeMismatch: z.boolean().default(false),
  items: z.array(lineSchema).min(1).max(200),
});
function merchandiseAccess(actor: Actor) {
  if (actor.role === "seller") denied();
}
@Controller()
export class MerchandiseController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("merchandise/options")
  @Permit("inventory:write")
  options(@CurrentUser() actor: Actor) {
    merchandiseAccess(actor);
    return { aiEnabled: !!process.env.ANTHROPIC_API_KEY };
  }
  @Get("merchandise/profiles/:id")
  @Permit("inventory:write")
  profile(@Param("id") id: string, @CurrentUser() actor: Actor) {
    merchandiseAccess(actor);
    return this.db.supplierImportProfile.findUnique({
      where: {
        supplierId_branchId: {
          supplierId: parse(uuid, id),
          branchId: actor.branchId,
        },
      },
    });
  }
  @Get("merchandise/attachments/:id")
  @Permit("inventory:write")
  async attachment(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    merchandiseAccess(actor);
    const a = await this.db.invoiceAttachment.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    res.setHeader("Content-Type", a.mime);
    res.setHeader("Content-Disposition", 'attachment; filename="comprobante"');
    res.send(Buffer.from(a.data));
  }
  @Post("merchandise/import")
  @Permit("inventory:write")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async importInvoice(
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() actor: Actor,
  ) {
    merchandiseAccess(actor);
    if (!file) bad("Adjunta la factura.");
    const supplierId = body.supplierId
      ? parse(uuid, body.supplierId)
      : undefined;
    if (supplierId)
      await this.db.supplier.findFirstOrThrow({
        where: { id: supplierId, branchId: actor.branchId, active: true },
      });
    const format = String(file.originalname).toLowerCase().endsWith(".csv")
      ? "csv"
      : String(file.originalname).toLowerCase().endsWith(".xlsx")
        ? "xlsx"
        : "ai";
    // Una factura en Excel/CSV pesa pocos KB: archivos grandes se rechazan antes
    // de leerlos para no bloquear el servidor.
    if (format !== "ai" && file.size > 1024 * 1024)
      bad(
        "El Excel o CSV supera 1 MB. Revisa que sea el archivo de la factura.",
      );
    const dayAgo = new Date(Date.now() - 24 * 3600000);
    const pendingDrafts = await this.db.invoiceDraft.count({
      where: {
        branchId: actor.branchId,
        userId: actor.id,
        confirmedOperationId: null,
        createdAt: { gte: dayAgo },
      },
    });
    if (pendingDrafts >= 30)
      bad("Tienes muchas facturas sin confirmar hoy. Confirma o espera.");
    let extracted;
    let mapping: Record<string, string> | undefined;
    if (format !== "ai") {
      try {
        mapping = parse(
          z.object({
            code: z.string(),
            description: z.string(),
            qty: z.string(),
            unitCost: z.string(),
          }),
          JSON.parse(body.mapping || "{}"),
        );
      } catch {
        bad("Revisa el mapeo de columnas.");
      }
      extracted = await readInvoiceTable(file.buffer, format, mapping);
    } else {
      if (!process.env.ANTHROPIC_API_KEY) bad("Extracción IA no configurada.");
      if (
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          file.mimetype,
        )
      )
        bad("Usa foto PNG/JPEG/WebP o PDF.");
      extracted = await extractAnthropic(file, process.env.ANTHROPIC_API_KEY, {
        model: process.env.ANTHROPIC_MODEL || DEFAULT_INVOICE_MODEL,
      });
    }
    const variants = await this.db.variant.findMany({
      where: {
        branchId: actor.branchId,
        active: true,
        product: { active: true },
      },
      include: { product: true },
    });
    const equivalents = supplierId
      ? await this.db.supplierCode.findMany({
          where: { supplierId, branchId: actor.branchId },
        })
      : [];
    const lines = matchInvoiceLines(extracted.lines, variants, equivalents);
    return this.db.$transaction(async (tx) => {
      // Los borradores sin confirmar se conservan 7 días con su archivo.
      const stale = await tx.invoiceDraft.findMany({
        where: {
          branchId: actor.branchId,
          confirmedOperationId: null,
          createdAt: { lt: new Date(Date.now() - 7 * 24 * 3600000) },
        },
        select: { id: true, attachmentId: true },
      });
      if (stale.length) {
        await tx.invoiceDraft.deleteMany({
          where: { id: { in: stale.map((d) => d.id) } },
        });
        await tx.invoiceAttachment.deleteMany({
          where: {
            id: {
              in: stale.map((d) => d.attachmentId).filter(Boolean) as string[],
            },
          },
        });
      }
      if (supplierId && mapping)
        await tx.supplierImportProfile.upsert({
          where: {
            supplierId_branchId: { supplierId, branchId: actor.branchId },
          },
          create: { supplierId, branchId: actor.branchId, mapping },
          update: { mapping },
        });
      const attachment = await tx.invoiceAttachment.create({
        data: {
          branchId: actor.branchId,
          userId: actor.id,
          mime:
            format === "csv"
              ? "text/csv"
              : format === "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : file.mimetype,
          data: file.buffer,
        },
      });
      const draft = await tx.invoiceDraft.create({
        data: {
          branchId: actor.branchId,
          userId: actor.id,
          supplierId,
          attachmentId: attachment.id,
          lines: json(lines),
          total:
            extracted.total ??
            (body.total ? parse(amount, Number(body.total)) : null),
        },
      });
      await audit(
        tx,
        actor,
        "invoice_import_review",
        "invoice",
        draft.id,
        undefined,
        { attachmentId: attachment.id, lineCount: lines.length },
      );
      return {
        ...json(draft),
        skipped: "skipped" in extracted ? extracted.skipped : 0,
      };
    });
  }
  @Get("merchandise/operations")
  @Permit("inventory:write")
  async history(@CurrentUser() actor: Actor) {
    merchandiseAccess(actor);
    return this.db.merchandiseOperation.findMany({
      where: { branchId: actor.branchId, userId: actor.id },
      select: { id: true, result: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }
  @Post("merchandise/operations")
  @RequireTerminal()
  @Permit("inventory:write")
  async operation(@Body() body: unknown, @CurrentUser() actor: Actor) {
    merchandiseAccess(actor);
    const data = parse(operationSchema, body);
    if (!actor.terminalId)
      bad("Registra este equipo antes de mover mercancía.");
    if (data.direction === "exit" && !data.reason)
      bad("Elige el motivo de salida.");
    if (data.direction === "exit" && data.items.some((i) => i.quick))
      bad("No puedes crear productos en una salida.");
    // En una entrada el lote se indica por número (se crea o se incrementa);
    // un lotId sin validar quedaría en el kardex apuntando a otro lote.
    if (data.direction === "entry" && data.items.some((i) => i.lotId))
      bad("En una entrada indica el número de lote, no un lote existente.");
    if (data.direction === "exit" && data.items.some((i) => i.lotNumber))
      bad("En una salida elige el lote de la lista.");
    if (data.direction === "exit") {
      if (data.items.some((i) => i.damagedQty > 0))
        bad("Las unidades dañadas se registran al recibir; usa el motivo de salida.");
      if (data.items.some((i) => !(i.qty > 0)))
        bad("Cada línea necesita una cantidad mayor que 0.");
    } else data.items.forEach(checkDamage);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.id}))::text`;
        const prior = await tx.merchandiseOperation.findUnique({
          where: { id: data.id },
        });
        if (prior) {
          if (prior.userId !== actor.id || prior.branchId !== actor.branchId)
            denied();
          if (prior.requestHash !== requestHash)
            bad("UUID usado con datos distintos.");
          return prior.result;
        }
        // El código del producto rápido no puede ser ya de otro producto con
        // otras mayúsculas o en el SKU: la mercancía entraría a un duplicado y
        // la caja dejaría de agregar los dos por código (R9-codigos-3).
        await assertCodesFree(
          tx,
          actor.branchId,
          data.items.flatMap((l) =>
            l.quick ? [{ codes: [l.quick.barcode] }] : [],
          ),
        );
        const terminal = await tx.terminal.findFirstOrThrow({
          where: {
            id: actor.terminalId,
            branchId: actor.branchId,
            revokedAt: null,
          },
        });
        const supplier = data.supplierId
          ? await tx.supplier.findFirstOrThrow({
              where: {
                id: data.supplierId,
                branchId: actor.branchId,
                active: true,
              },
            })
          : null;
        let draft: any;
        if (data.draftId) {
          if (data.direction !== "entry")
            bad("Una factura sólo permite entradas.");
          await tx.$queryRaw`SELECT id FROM "InvoiceDraft" WHERE id=${data.draftId}::uuid FOR UPDATE`;
          draft = await tx.invoiceDraft.findFirstOrThrow({
            where: {
              id: data.draftId,
              branchId: actor.branchId,
              userId: actor.id,
            },
          });
          if (draft.confirmedOperationId) bad("La factura ya fue confirmada.");
          if (draft.supplierId !== (data.supplierId ?? null))
            bad("El proveedor debe coincidir con el de la revisión.");
        }
        const total = money(
          data.items.reduce((s, l) => s + l.qty * l.unitCost, 0) +
            data.freight +
            data.taxes,
        );
        const damagedCost = money(
          data.items.reduce(
            (s, l) => s.plus(damagedCostOf({ ...l, cost: l.unitCost })),
            d(0),
          ),
        );
        const invoiceTotal =
          data.invoiceTotal ??
          (draft?.total != null ? Number(draft.total) : undefined);
        // La factura puede cobrar también lo dañado: coincide con o sin ello.
        if (
          invoiceTotal !== undefined &&
          Math.abs(invoiceTotal - total) > 0.01 &&
          Math.abs(invoiceTotal - (total + damagedCost)) > 0.01 &&
          !data.acknowledgeMismatch
        )
          bad(
            "El total de las líneas, flete e impuestos no coincide con la factura. Revisa o confirma la diferencia.",
          );
        let order: any;
        if (data.orderId) {
          if (data.direction !== "entry") bad("La orden sólo permite entrada.");
          await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${data.orderId}::uuid FOR UPDATE`;
          order = await tx.purchaseOrder.findFirstOrThrow({
            where: { id: data.orderId, branchId: actor.branchId },
            include: { items: true },
          });
          if (order.status === "received") bad("Orden ya recibida.");
          if (order.supplierId !== data.supplierId)
            bad("Proveedor distinto al de la orden.");
        }
        const lines: any[] = [];
        for (const line of data.items) {
          let variantId = line.variantId;
          if (line.quick) {
            const q = line.quick;
            const cat = await tx.category.findFirstOrThrow({
              where: { id: q.categoryId, branchId: actor.branchId },
            });
            // Quien no puede editar el catálogo (almacén) crea el producto
            // inactivo: no se vende hasta que un gerente revise su precio.
            const canPrice = can(actor.permissions, "catalog:write");
            const p = await tx.product.create({
              data: {
                name: q.name,
                sku: "Q-" + data.id + "-" + lines.length,
                categoryId: cat.id,
                branchId: actor.branchId,
                createdBy: actor.id,
                supplierId: data.supplierId,
                ...(canPrice ? {} : { active: false }),
                variants: {
                  create: {
                    sku: "QV-" + data.id + "-" + lines.length,
                    barcode: q.barcode,
                    price: q.price,
                    costAvg: q.cost,
                    attributes: { variante: q.variant },
                    branchId: actor.branchId,
                    createdBy: actor.id,
                  },
                },
              },
              include: { variants: true },
            });
            variantId = p.variants[0].id;
            if (!canPrice)
              await tx.alert.upsert({
                where: { key: "new-product:" + p.id },
                create: {
                  key: "new-product:" + p.id,
                  type: "product_review",
                  severity: "medium",
                  entityId: p.id,
                  branchId: actor.branchId,
                  message:
                    p.name +
                    ": producto creado al recibir mercancía. Revisa el precio y actívalo para venderlo.",
                },
                update: {},
              });
          }
          if (order) {
            const item = order.items.find(
              (i: any) => i.id === line.itemId && i.variantId === variantId,
            );
            if (!item) bad("Línea ajena a la orden.");
            // Pedido = recibido bueno + dañado/rechazado + pendiente.
            item.receivedQty = Number(item.receivedQty) + line.qty;
            item.damagedQty = Number(item.damagedQty) + line.damagedQty;
            if (
              d(item.receivedQty).plus(item.damagedQty).gt(Number(item.qty))
            )
              bad("Cantidad superior a lo pendiente.");
          }
          lines.push({ ...line, variantId });
        }
        const costs =
          data.direction === "entry"
            ? receiptCosts(
                lines.map((l) => ({ qty: l.qty, cost: l.unitCost })),
                money(d(data.freight).plus(data.taxes)),
                data.allocation,
              )
            : [];
        const receipt =
          data.direction === "entry"
            ? await tx.goodsReceipt.create({
                data: {
                  orderId: data.orderId,
                  supplierId: data.supplierId,
                  total,
                  attachmentId: draft?.attachmentId,
                  operationId: data.id,
                  freight: data.freight,
                  otherCosts: data.taxes,
                  damagedCost,
                  // Sin condición propia, la de la orden o el plazo del proveedor.
                  ...documentData(
                    data,
                    order
                      ? {
                          paymentType: order.paymentType,
                          creditDays: order.creditDays,
                        }
                      : {},
                    supplier?.paymentTermsDays,
                  ),
                  items: json(
                    lines.map((l, i) => ({
                      ...l,
                      landedCost: costs[i],
                      damagedCost: damagedCostOf({ ...l, cost: l.unitCost }),
                      attachmentId: draft?.attachmentId,
                    })),
                  ),
                  userId: actor.id,
                  branchId: actor.branchId,
                },
              })
            : null;
        for (const [index, line] of lines
          .map((l, i) => [i, l] as const)
          .sort((a, b) => a[1].variantId.localeCompare(b[1].variantId))) {
          // Una línea sólo con dañados no entra al stock: cierra lo pendiente.
          if (data.direction === "entry" && !(line.qty > 0)) {
            if (order)
              await tx.purchaseItem.update({
                where: { id: line.itemId },
                data: { damagedQty: { increment: line.damagedQty } },
              });
            continue;
          }
          const v = await lockVariant(tx, line.variantId, actor);
          let lotId = line.lotId;
          if (data.direction === "entry") {
            if (
              (v.product.category.requiresLot ||
                v.product.category.requiresExpiry) &&
              !line.lotNumber
            )
              bad("Indica el lote.");
            if (v.product.category.requiresExpiry && !line.expiryDate)
              bad("Indica vencimiento.");
            if (expired(line.expiryDate))
              bad("No se recibe mercancía vencida.");
            v.costAvg = weightedCost(
              Math.max(0, Number(v.stock)),
              Number(v.costAvg),
              line.qty,
              costs[index],
            );
            await tx.variant.update({
              where: { id: v.id },
              data: { costAvg: v.costAvg },
            });
            if (line.lotNumber) {
              const existing = await tx.lot.findUnique({
                where: {
                  variantId_lotNumber: {
                    variantId: v.id,
                    lotNumber: line.lotNumber,
                  },
                },
              });
              if (
                existing &&
                (expired(existing.expiryDate) ||
                  (line.expiryDate &&
                    (!existing.expiryDate ||
                      businessDate(existing.expiryDate) !==
                        businessDate(line.expiryDate))))
              )
                bad("Lote vencido o con vencimiento distinto.");
              const lot = await tx.lot.upsert({
                where: {
                  variantId_lotNumber: {
                    variantId: v.id,
                    lotNumber: line.lotNumber,
                  },
                },
                create: {
                  variantId: v.id,
                  lotNumber: line.lotNumber,
                  expiryDate: line.expiryDate
                    ? new Date(line.expiryDate)
                    : null,
                  qty: line.qty,
                  cost: costs[index],
                  branchId: actor.branchId,
                },
                update: { qty: { increment: line.qty } },
              });
              lotId = lot.id;
            }
          } else {
            if (v.product.category.requiresLot && !lotId)
              bad("Selecciona el lote de salida.");
            if (lotId) {
              const lot = await tx.lot.findFirstOrThrow({
                where: { id: lotId, variantId: v.id, branchId: actor.branchId },
              });
              if (Number(lot.qty) < line.qty) bad("Lote insuficiente.");
              await tx.lot.update({
                where: { id: lot.id },
                data: { qty: { decrement: line.qty } },
              });
            } else {
              const untracked =
                Number(v.stock) -
                v.lots.reduce((s: number, l: any) => s + Number(l.qty), 0);
              if (untracked < line.qty)
                bad("Selecciona un lote con existencias.");
            }
            if (Number(v.stock) < line.qty) bad("Stock insuficiente.");
          }
          await stockChange(
            tx,
            actor,
            v,
            data.direction === "entry" ? line.qty : -line.qty,
            data.direction === "entry" ? "purchase" : "merchandise_exit",
            data.direction === "entry" ? "Entrada de mercancía" : data.reason!,
            receipt?.id ?? data.id,
            lotId,
            data.direction === "entry" ? costs[index] : undefined,
          );
          if (order)
            await tx.purchaseItem.update({
              where: { id: line.itemId },
              data: {
                receivedQty: { increment: line.qty },
                damagedQty: { increment: line.damagedQty },
              },
            });
          if (data.supplierId && line.supplierCode)
            await tx.supplierCode.upsert({
              where: {
                supplierId_branchId_code: {
                  supplierId: data.supplierId,
                  branchId: actor.branchId,
                  code: line.supplierCode,
                },
              },
              create: {
                supplierId: data.supplierId,
                branchId: actor.branchId,
                code: line.supplierCode,
                variantId: v.id,
              },
              update: { variantId: v.id },
            });
        }
        if (order)
          await tx.purchaseOrder.update({
            where: { id: order.id },
            data: {
              status: order.items.every((i: any) =>
                d(i.receivedQty).plus(i.damagedQty).gte(Number(i.qty)),
              )
                ? "received"
                : "partial",
            },
          });
        if (draft)
          await tx.invoiceDraft.update({
            where: { id: draft.id },
            data: { confirmedOperationId: data.id },
          });
        const result = {
          id: data.id,
          receiptId: receipt?.id,
          variantIds: lines.map((l) => l.variantId),
          total,
          attachmentId: draft?.attachmentId,
        };
        await audit(
          tx,
          { ...actor, terminalId: terminal.id },
          "merchandise_" + data.direction,
          "merchandise",
          data.id,
          undefined,
          { ...data, result },
        );
        await tx.merchandiseOperation.create({
          data: {
            id: data.id,
            branchId: actor.branchId,
            userId: actor.id,
            terminalId: terminal.id,
            requestHash,
            result: json(result),
          },
        });
        return result;
      },
      { timeout: 30000 },
    );
  }
}

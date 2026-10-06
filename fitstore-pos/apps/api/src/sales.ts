import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import {
  expired,
  BUSINESS_TIME_ZONE,
  SaleInput,
  saleSchema,
  lineTotals,
  paymentTotals,
  money,
  d,
  can,
  z,
  stockQty,
  derivedStockQty,
  returnShares,
  allocationCost,
  returnedAt,
  replayReturns,
  moneyAmount,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  parse,
  uuid,
  reason,
  audit,
  safe,
  bad,
  conflict,
  denied,
  json,
  safeErrorMessage,
  fieldLabel,
} from "./common";
import { lockVariant, takeStock, stockChange } from "./inventory";
import PDFDocument from "pdfkit";
import type { Response } from "express";

// Una caja abierta pertenece a un usuario y a un equipo. El dinero (ventas,
// abonos, movimientos) sólo se registra desde el equipo donde está la caja;
// cerrar y arquear se permite desde cualquier equipo del dueño, y un gerente
// puede actuar sobre la caja de otro usuario desde su propio equipo.
export async function cashLock(
  tx: any,
  actor: Actor,
  id: string,
  manager = false,
  capturedAt?: Date,
  options: { closing?: boolean } = {},
) {
  await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id = ${id}::uuid FOR UPDATE`;
  const session = await tx.cashSession.findFirstOrThrow({
    where: {
      id,
      branchId: actor.branchId,
      ...(capturedAt ? {} : { closedAt: null }),
    },
  });
  const own = session.userId === actor.id;
  if (!own && !(manager && can(actor.permissions, "sale:manage"))) denied();
  if (
    capturedAt &&
    (capturedAt < session.openedAt ||
      capturedAt > new Date() ||
      (session.closedAt && capturedAt > session.closedAt))
  )
    bad("La venta offline no corresponde al horario de esta caja.");
  // Las ventas offline se sincronizan desde la cola del equipo que las capturó.
  if (
    own &&
    !capturedAt &&
    !options.closing &&
    actor.terminalId &&
    session.registerId !== actor.terminalId
  ) {
    conflict(
      `Tu caja está abierta en el equipo «${await terminalName(tx, session.registerId)}». ` +
        "Ciérrala en ese equipo o trasládala a este desde Caja.",
    );
  }
  return session;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Las cajas anteriores a los equipos guardan un nombre libre en registerId.
export async function terminalName(tx: any, registerId: string) {
  if (!UUID.test(registerId)) return registerId;
  const terminal = await tx.terminal.findUnique({ where: { id: registerId } });
  return terminal?.name ?? "otro equipo";
}
function promotionDiscount(promo: any, variant: any, qty: number) {
  const scope = promo.scope as any;
  if (scope.variantId && scope.variantId !== variant.id) return 0;
  if (scope.productId && scope.productId !== variant.productId) return 0;
  if (scope.categoryId && scope.categoryId !== variant.product.categoryId)
    return 0;
  if (scope.brand && scope.brand !== variant.product.brand) return 0;
  if (scope.lotId) return 0; // Las ofertas por lote sólo se autorizan después de asignar FEFO.
  if (promo.type === "percent") return Number(promo.value);
  if (promo.type === "amount")
    return Math.min(100, (Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "special_price")
    return Math.max(0, (1 - Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "nxm") {
    const buy = scope.buy || 2,
      pay = scope.pay || 1;
    return ((Math.floor(qty / buy) * (buy - pay)) / qty) * 100;
  }
  if (promo.type === "second_half")
    return ((Math.floor(qty / 2) * 0.5) / qty) * 100;
  return 0;
}

import { refreshClosedCash } from "./cash";
import { verifyPinAttempt } from "./security";

@Controller()
export class SalesController {
  constructor(@Inject(Database) private db: Database) {}
  private async approve(actor: Actor, input: SaleInput) {
    const setting = await this.db.settings.findUnique({
      where: { id: actor.branchId },
    });
    const limit = Number((setting?.data as any)?.sellerDiscountLimit ?? 10);

    const variants = await this.db.variant.findMany({
      where: {
        id: { in: input.items.map((i) => i.variantId) },
        branchId: actor.branchId,
      },
      select: { id: true, price: true },
    });
    const exceeds = input.items.some(
      (i) =>
        100 -
          ((100 -
            Math.max(
              i.discountPercent,
              ((i.discountAmount ?? 0) /
                Math.max(
                  0.01,
                  i.qty *
                    Number(
                      variants.find((v) => v.id === i.variantId)?.price ?? 0,
                    ),
                )) *
                100,
            )) *
            (100 - input.globalDiscount)) /
            100 >
        limit,
    );
    const credit = input.payments
      .filter((p) => p.method === "credit")
      .reduce((sum, p) => sum + p.amount, 0);
    const needsCreditApproval =
      credit > Number((setting?.data as any)?.creditApprovalThreshold ?? 1000);
    const needsNoteApproval = input.payments.some(
      (p) => p.method === "credit_note" && !p.creditNoteCode,
    );
    if (
      (!exceeds || can(actor.permissions, "sale:manage")) &&
      !needsCreditApproval &&
      !needsNoteApproval
    )
      return null;
    if (!input.managerPin) bad("Esta operación requiere el PIN de un gerente.");
    const managers = await this.db.user.findMany({
      where: { active: true, branchId: actor.branchId },
      include: { role: true },
    });
    return verifyPinAttempt(this.db, "approval:" + actor.id, async () => {
      for (const manager of managers.filter((m) =>
        can(m.role.permissions, "sale:manage"),
      ))
        if (await compare(input.managerPin!, manager.pinHash))
          return manager.id;
      return null;
    });
  }
  async complete(actor: Actor, input: SaleInput, offline = false) {
    const { managerPin: ignored, ...fingerprint } = input;
    void ignored;
    const requestHash = createHash("sha256")
      .update(JSON.stringify(fingerprint))
      .digest("hex");
    const completed = await this.db.sale.findUnique({
      where: { offlineUuid: input.offlineUuid },
      include: { items: true, payments: true },
    });
    if (completed) {
      if (
        completed.sellerId !== actor.id ||
        completed.branchId !== actor.branchId
      )
        denied();
      if (completed.requestHash && completed.requestHash !== requestHash)
        bad("El UUID ya corresponde a otra venta.");
      return safe(completed, actor);
    }
    const approvedBy = await this.approve(actor, input);
    const result = await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.offlineUuid}))::text AS locked`;
        const existing = await tx.sale.findUnique({
          where: { offlineUuid: input.offlineUuid },
          include: { items: true, payments: true },
        });
        if (existing) {
          if (
            existing.sellerId !== actor.id ||
            existing.branchId !== actor.branchId
          )
            denied();
          if (existing.requestHash && existing.requestHash !== requestHash)
            bad("El UUID ya corresponde a otra venta.");
          return existing;
        }
        const capturedAt =
          offline && input.capturedAt ? new Date(input.capturedAt) : undefined;
        if (capturedAt && Date.now() - capturedAt.getTime() > 48 * 3600000)
          bad("La venta offline supera el plazo máximo de 48 horas.");
        const cashSession = await cashLock(
          tx,
          actor,
          input.cashSessionId,
          false,
          capturedAt,
        );
        if (input.customerId)
          await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${input.customerId}::uuid FOR UPDATE`;
        const customer = input.customerId
          ? await tx.customer.findFirstOrThrow({
              where: {
                id: input.customerId,
                branchId: actor.branchId,
                active: true,
              },
            })
          : null;
        const settings = await tx.settings.findUnique({
          where: { id: actor.branchId },
        });
        const config = settings?.data as any;
        const components = await tx.kitComponent.findMany({
          where: { kitVariantId: { in: input.items.map((i) => i.variantId) } },
        });
        const ids = [
          ...new Set([
            ...input.items.map((i) => i.variantId),
            ...components.map((c) => c.componentVariantId),
          ]),
        ].sort();
        const variants = new Map<string, any>();
        for (const id of ids)
          variants.set(id, await lockVariant(tx, id, actor));
        const promos = await tx.promotion.findMany({
          where: {
            branchId: actor.branchId,
            active: true,
            startsAt: { lte: new Date() },
            endsAt: { gte: new Date() },
          },
        });
        const lines = input.items.map((item) => {
          const variant = variants.get(item.variantId)!;
          const gross = Number(variant.price) * item.qty;
          if ((item.discountAmount ?? 0) > gross)
            bad("El descuento por monto supera el importe de la línea.");
          const lineDiscount = Math.max(
            item.discountPercent,
            gross ? ((item.discountAmount ?? 0) / gross) * 100 : 0,
          );
          const manual =
            100 - ((100 - lineDiscount) * (100 - input.globalDiscount)) / 100;
          const promo = Math.max(
            0,
            ...promos.map((p) => promotionDiscount(p, variant, item.qty)),
          );
          const totals = lineTotals(
            item.qty,
            Number(variant.price),
            Math.max(manual, promo),
            Number(variant.product.taxRate),
            config?.taxIncluded !== false,
          );
          const kit = components.filter((c) => c.kitVariantId === variant.id);
          // Combos (R6-01): se venden por unidades enteras y cada consumo
          // derivado debe ser exacto antes de cobrar; nunca se redondea.
          if (kit.length && !Number.isInteger(item.qty))
            bad(
              "Los combos se venden por unidades enteras: " +
                variant.product.name +
                ".",
            );
          const consumption = kit.map((c) => {
            const qty = derivedStockQty(c.qty, item.qty);
            if (qty === null)
              bad(
                "El consumo de un componente de " +
                  variant.product.name +
                  " no es una cantidad válida (mínimo 0.001 y 3 decimales).",
              );
            return { component: c, qty };
          });
          const cost = kit.length
            ? kit.reduce(
                (a, c) =>
                  a.plus(
                    d(variants.get(c.componentVariantId)!.costAvg).times(c.qty),
                  ),
                d(0),
              )
            : d(variant.costAvg);
          return { item, variant, totals, kit, consumption, cost };
        });
        const total = money(
          lines.reduce((a, l) => a.plus(l.totals.total), d(0)),
        );
        if (
          input.expectedTotal !== undefined &&
          Math.abs(input.expectedTotal - total) > 0.01
        )
          bad(
            "Los precios o promociones cambiaron. Revisa el total antes de cobrar.",
          );
        let payment: ReturnType<typeof paymentTotals>;
        try {
          payment = paymentTotals(total, input.payments);
        } catch (e: any) {
          bad(e.message);
        }
        if (payment.pending > 0) bad("Falta completar el pago de la factura.");
        for (const p of input.payments) {
          if (p.creditNoteId && p.method !== "credit_note")
            bad("La nota de crédito sólo se usa con su método de pago.");
          if (p.method === "card" && (!p.approvalCode || !p.cardLast4))
            bad("Indica los últimos 4 dígitos y la aprobación de tarjeta.");
          if (p.method === "transfer" && (!p.reference || !p.bank))
            bad("Indica banco y referencia de transferencia.");
        }
        const credit = money(
          input.payments
            .filter((p) => p.method === "credit")
            .reduce((sum, p) => sum + p.amount, 0),
        );
        // Contraentrega: queda por cobrar en la venta (como un crédito), con
        // el cliente opcional; se cobra después como un abono.
        const cod = money(
          input.payments
            .filter((p) => p.method === "cod")
            .reduce((sum, p) => sum + p.amount, 0),
        );
        if (credit && cod)
          bad("Una venta no puede ser a crédito y contraentrega a la vez.");
        if (credit && customer) {
          // La deuda del cliente es la de sus ventas a crédito, no las
          // contraentregas pendientes.
          const debt = await tx.sale.aggregate({
            where: {
              customerId: customer.id,
              branchId: actor.branchId,
              status: "completed",
              payments: { some: { method: "credit", entryType: "sale" } },
            },
            _sum: { creditBalance: true },
          });
          if (
            d(debt._sum.creditBalance ?? 0)
              .plus(credit)
              .gt(customer.creditLimit)
          )
            bad("La venta supera el límite de crédito del cliente.");
        }
        if (credit && config?.allowCreditSales !== true)
          bad("Las ventas a crédito están desactivadas en Ajustes.");
        if (credit && (!input.customerId || !input.creditDueDate))
          bad("La venta a crédito requiere cliente y fecha de vencimiento.");
        if (input.creditDueDate && expired(input.creditDueDate))
          bad("La fecha del crédito no puede estar en el pasado.");
        if (input.ncfType && config?.ncfMode !== "prepared")
          bad("Activa la preparación de NCF en Ajustes.");
        if (
          ["B01", "E31"].includes(input.ncfType ?? "") &&
          !input.recipientLegalId
        )
          bad("Indica el RNC o cédula del cliente.");
        for (const p of input.payments
          .filter((p) => p.method === "credit_note")
          .sort((a, b) =>
            (a.creditNoteId ?? "").localeCompare(b.creditNoteId ?? ""),
          )) {
          if (!p.creditNoteId) bad("Selecciona una nota de crédito.");
          await tx.$queryRaw`SELECT id FROM "CreditNote" WHERE id=${p.creditNoteId}::uuid FOR UPDATE`;
          const note = await tx.creditNote.findUnique({
            where: { id: p.creditNoteId },
          });
          const returned =
            note &&
            (await tx.saleReturn.findFirst({
              where: { id: note.returnId, branchId: actor.branchId },
            }));
          if (
            !note ||
            !returned ||
            (note.customerId && note.customerId !== input.customerId)
          )
            bad("La nota de crédito no corresponde a este cliente o sucursal.");
          const codeMatches =
            !!p.creditNoteCode && p.creditNoteCode === note.redemptionCode;
          if (!note.customerId && !codeMatches)
            bad("Las notas sin cliente requieren su código impreso.");
          if (p.creditNoteCode && !codeMatches)
            bad("Código de nota de crédito incorrecto.");
          if (!codeMatches && !approvedBy)
            bad(
              "La nota de crédito requiere su código o aprobación de gerente.",
            );
          if (d(note.balance).lt(p.amount))
            bad("Saldo insuficiente en la nota de crédito.");
          await tx.creditNote.update({
            where: { id: note.id },
            data: { balance: { decrement: p.amount } },
          });
        }
        const counter = await tx.counter.upsert({
          where: { key: "sale:" + actor.branchId },
          create: { key: "sale:" + actor.branchId, value: 1 },
          update: { value: { increment: 1 } },
        });
        const sale = await tx.sale.create({
          data: {
            number: "FS-" + String(counter.value).padStart(7, "0"),
            offlineUuid: input.offlineUuid,
            requestHash,
            customerId: input.customerId,
            sellerId: actor.id,
            cashSessionId: input.cashSessionId,
            subtotal: money(
              lines.reduce((a, l) => a.plus(l.totals.subtotal), d(0)),
            ),
            discountTotal: money(
              lines.reduce((a, l) => a.plus(l.totals.discount), d(0)),
            ),
            taxTotal: money(lines.reduce((a, l) => a.plus(l.totals.tax), d(0))),
            total,
            creditBalance: money(d(credit).plus(cod)),
            creditDueDate:
              credit && input.creditDueDate
                ? new Date(input.creditDueDate)
                : null,
            ncfType: input.ncfType,
            recipientLegalId: input.recipientLegalId,
            costTotal: money(
              lines.reduce((a, l) => a.plus(l.cost.times(l.item.qty)), d(0)),
            ),
            notes: input.notes || "",
            ...(capturedAt ? { createdAt: capturedAt } : {}),
            branchId: actor.branchId,
          },
        });
        // Costo registrado = suma del costo redondeado de cada línea guardada
        // (lotes y combos incluidos): así cada devolución, que redondea por
        // línea, deja el costo de la venta exactamente en cero.
        let booked = d(0);
        for (const { item, variant, totals, kit, consumption, cost } of lines) {
          if (kit.length) {
            const allocations: any[] = [];
            for (const { component, qty } of consumption) {
              const v = variants.get(component.componentVariantId);
              const parts = await takeStock(tx, actor, v, qty, "sale", sale.id);
              allocations.push(
                ...parts.map((p) => ({
                  ...p,
                  variantId: v.id,
                  unitCost: Number(v.costAvg),
                  // Cantidad exacta (ronda 7): su valor es el costo real.
                  exact: true,
                })),
              );
            }
            await tx.saleItem.create({
              data: {
                saleId: sale.id,
                variantId: variant.id,
                qty: item.qty,
                unitPrice: variant.price,
                unitCost: money(cost),
                discount: totals.discount,
                tax: totals.tax,
                lineTotal: totals.total,
                stockAllocations: allocations,
              },
            });
            booked = booked.plus(
              money(
                allocationCost({
                  qty: item.qty,
                  unitCost: money(cost),
                  variantId: variant.id,
                  stockAllocations: allocations,
                }),
              ),
            );
          } else {
            const parts = await takeStock(
              tx,
              actor,
              variant,
              item.qty,
              "sale",
              sale.id,
            );
            let allocatedDiscount = d(0),
              allocatedTax = d(0),
              allocatedTotal = d(0);
            for (const [index, part] of parts.entries()) {
              const last = index === parts.length - 1;
              const fraction = d(part.qty).div(item.qty);
              const discount = last
                ? money(d(totals.discount).minus(allocatedDiscount))
                : money(d(totals.discount).times(fraction));
              const tax = last
                ? money(d(totals.tax).minus(allocatedTax))
                : money(d(totals.tax).times(fraction));
              const lineTotal = last
                ? money(d(totals.total).minus(allocatedTotal))
                : money(d(totals.total).times(fraction));
              allocatedDiscount = allocatedDiscount.plus(discount);
              allocatedTax = allocatedTax.plus(tax);
              allocatedTotal = allocatedTotal.plus(lineTotal);
              await tx.saleItem.create({
                data: {
                  saleId: sale.id,
                  variantId: variant.id,
                  lotId: part.lotId,
                  qty: part.qty,
                  unitPrice: variant.price,
                  unitCost: variant.costAvg,
                  discount,
                  tax,
                  lineTotal,
                  stockAllocations: json([
                    {
                      ...part,
                      variantId: variant.id,
                      unitCost: Number(variant.costAvg),
                    },
                  ]),
                },
              });
              booked = booked.plus(money(d(variant.costAvg).times(part.qty)));
            }
          }
        }
        if (!booked.eq(sale.costTotal))
          await tx.sale.update({
            where: { id: sale.id },
            data: { costTotal: money(booked) },
          });
        if (capturedAt && capturedAt < new Date())
          await audit(
            tx,
            actor,
            "offline_backdated",
            "sale",
            sale.id,
            undefined,
            {
              capturedAt: capturedAt.toISOString(),
              receivedAt: new Date().toISOString(),
              cashSessionId: cashSession.id,
            },
          );
        if (credit && approvedBy)
          await audit(
            tx,
            actor,
            "credit_approved",
            "sale",
            sale.id,
            undefined,
            { approvedBy, amount: credit },
          );
        let change = d(payment.change);
        for (const p of input.payments) {
          const paymentChange =
            p.method === "cash"
              ? money(d(p.amount).lt(change) ? p.amount : change)
              : 0;
          change = change.minus(paymentChange);
          const { creditNoteCode: ignoredCode, ...paymentData } = p;
          void ignoredCode;
          if (p.method === "credit_note")
            await audit(
              tx,
              actor,
              "credit_note_used",
              "credit_note",
              p.creditNoteId!,
              undefined,
              {
                saleId: sale.id,
                amount: p.amount,
                approvedBy,
                authorization: p.creditNoteCode ? "code" : "manager",
              },
            );
          await tx.payment.create({
            data: {
              ...paymentData,
              saleId: sale.id,
              cashSessionId: cashSession.id,
              tendered: p.amount,
              amount: money(d(p.amount).minus(paymentChange)),
              change: paymentChange,
              feeAmount:
                p.method === "card"
                  ? money(
                      d(p.amount)
                        .times(config?.cardFeePercent ?? 2.5)
                        .div(100),
                    )
                  : 0,
              status:
                p.method === "transfer"
                  ? "pending_verification"
                  : p.method === "credit" || p.method === "cod"
                    ? "pending"
                    : "ok",
            },
          });
        }
        if (cashSession.closedAt) {
          const differences = await refreshClosedCash(tx, cashSession);
          await audit(
            tx,
            actor,
            "offline_after_close",
            "cash",
            cashSession.id,
            cashSession,
            { saleId: sale.id, ...differences },
          );
        }
        await audit(tx, actor, "complete", "sale", sale.id, undefined, {
          number: sale.number,
          total,
          approvedBy,
        });
        if (
          Number(sale.discountTotal) > 0 &&
          (approvedBy || can(actor.permissions, "sale:manage"))
        )
          await audit(
            tx,
            actor,
            "discount_approved",
            "sale",
            sale.id,
            undefined,
            {
              approvedBy: approvedBy ?? actor.id,
              discount: sale.discountTotal,
            },
          );
        return tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          include: { items: true, payments: true },
        });
      },
      { timeout: 20000 },
    );
    return safe(result, actor);
  }
  @Post("sales") @Permit("sale:write") @RequireTerminal() sale(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    return this.complete(actor, parse(saleSchema, body));
  }
  @Post("sales/sync")
  @RequireTerminal()
  @Permit("sale:write")
  async sync(@Body() body: unknown, @CurrentUser() actor: Actor) {
    // Cada venta se valida por separado: una con datos inválidos queda como
    // conflicto, con su alerta, y no impide sincronizar las demás ventas que
    // la caja ya entregó (R9-dinero-5-pos).
    const input = parse(
      z.object({
        sales: z.array(z.object({ offlineUuid: uuid }).passthrough()).max(100),
      }),
      body,
    );
    const results = [];
    for (const sale of input.sales)
      try {
        const valid = saleSchema.safeParse(sale);
        if (!valid.success)
          bad(
            "Revisa los campos: " +
              valid.error.issues
                .slice(0, 5)
                .map((i) => fieldLabel(i.path) + " " + i.message)
                .join("; ") +
              ".",
          );
        results.push({
          offlineUuid: sale.offlineUuid,
          status: "synced",
          sale: await this.complete(actor, valid.data, true),
        });
      } catch (e: any) {
        const message = safeErrorMessage(e);
        results.push({
          offlineUuid: sale.offlineUuid,
          status: "conflict",
          message,
        });
        await this.db.alert.upsert({
          where: { key: "offline:" + sale.offlineUuid },
          create: {
            key: "offline:" + sale.offlineUuid,
            type: "offline_conflict",
            severity: "high",
            entityId: sale.offlineUuid,
            message: "Venta offline pendiente: " + message,
            branchId: actor.branchId,
          },
          update: {
            message: "Venta offline pendiente: " + message,
            status: "new",
          },
        });
      }
    return { results };
  }
  @Get("sales")
  @Permit("sale:write")
  async list(@CurrentUser() actor: Actor) {
    return safe(
      await this.db.sale.findMany({
        where: {
          branchId: actor.branchId,
          ...(can(actor.permissions, "sale:manage")
            ? {}
            : { sellerId: actor.id }),
        },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          payments: true,
          returns: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      actor,
    );
  }
  @Post("sales/:id/void")
  @RequireTerminal()
  @Permit("sale:manage")
  async voidSale(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(z.object({ reason, cashSessionId: uuid }), body);
    return this.db.$transaction(async (tx) => {
      const session = await cashLock(tx, actor, data.cashSessionId, true);
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${parse(uuid, id)}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirstOrThrow({
        where: { id, branchId: actor.branchId },
        include: { items: true, payments: true, returns: true },
      });
      if (sale.status !== "completed" || sale.returns.length)
        bad("La venta ya está anulada o tiene devoluciones.");
      if (sale.payments.some((p) => p.entryType === "installment"))
        bad("La venta tiene abonos. Usa una devolución.");
      const notes = await tx.creditNote.findMany({
        where: {
          id: {
            in: sale.payments.flatMap((p) =>
              p.creditNoteId ? [p.creditNoteId] : [],
            ),
          },
        },
      });
      for (const note of notes) {
        const restored = sale.payments
          .filter((p) => p.creditNoteId === note.id)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        await tx.creditNote.update({
          where: { id: note.id },
          data: { balance: { increment: restored } },
        });
      }
      if (sale.cashSessionId !== session.id)
        bad("Usa una devolución para ventas de cajas anteriores.");
      const allocations = sale.items.flatMap(
        (i) => i.stockAllocations as any[],
      );
      const variants = new Map<string, any>();
      for (const variantId of [
        ...new Set(allocations.map((a) => a.variantId as string)),
      ].sort())
        variants.set(variantId, await lockVariant(tx, variantId, actor));
      for (const allocation of allocations) {
        const variant = variants.get(allocation.variantId);
        if (allocation.lotId)
          await tx.lot.update({
            where: { id: allocation.lotId },
            data: { qty: { increment: allocation.qty } },
          });
        // Lo anulado vuelve a su costo, igual que en una devolución: si entre
        // la venta y la anulación se recibió mercancía a otro costo, el
        // promedio debe ponderar ambas (R9-dinero-4).
        const newCost = weightedReturn(
          variant,
          allocation.qty,
          allocation.unitCost,
        );
        await tx.variant.update({
          where: { id: variant.id },
          data: { costAvg: newCost },
        });
        variant.costAvg = newCost;
        await stockChange(
          tx,
          actor,
          variant,
          allocation.qty,
          "void",
          data.reason,
          id,
          allocation.lotId,
          allocation.unitCost,
        );
      }
      await tx.sale.update({
        where: { id },
        data: {
          status: "voided",
          creditBalance: 0,
          voidedReason: data.reason,
          voidedBy: actor.id,
        },
      });
      await audit(tx, actor, "void", "sale", id, sale, { reason: data.reason });
      return { ok: true };
    });
  }
  @Post("payments/:id/verify")
  @RequireTerminal()
  @Permit("sale:manage")
  async verify(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.db.$transaction(async (tx) => {
      const found = await tx.payment.findFirstOrThrow({
        where: {
          id: parse(uuid, id),
          sale: { branchId: actor.branchId },
          method: "transfer",
        },
      });
      if (found.cashSessionId)
        await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id=${found.cashSessionId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${found.saleId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${id}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (payment.status === "ok") return { ok: true };
      if (payment.status === "rejected")
        bad("La transferencia fue rechazada; registra un abono nuevo.");
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: payment.saleId },
      });
      if (sale.status !== "completed") bad("La venta ya no está completada.");
      if (payment.entryType === "installment") {
        if (d(sale.creditBalance).lt(payment.amount))
          bad("El abono requiere revisión: supera la deuda pendiente.");
        await tx.sale.update({
          where: { id: sale.id },
          data: { creditBalance: { decrement: payment.amount } },
        });
      }
      await tx.payment.update({ where: { id }, data: { status: "ok" } });
      if (payment.cashSessionId) {
        const cash = await tx.cashSession.findUnique({
          where: { id: payment.cashSessionId },
        });
        if (cash?.closedAt) {
          const differences = await refreshClosedCash(tx, cash);
          await audit(
            tx,
            actor,
            "verified_after_close",
            "cash",
            cash.id,
            cash,
            { paymentId: id, ...differences },
          );
        }
      }
      await audit(tx, actor, "verify", "payment", id, payment, {
        status: "ok",
      });
      return { ok: true };
    });
  }
  // Un abono por transferencia que nunca llegó se rechaza: no descuenta la
  // deuda ni entra a la caja, y deja de bloquear devoluciones y abonos de la
  // venta (R9-dinero-3).
  @Post("payments/:id/reject")
  @RequireTerminal()
  @Permit("sale:manage")
  async reject(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(z.object({ reason }), body);
    return this.db.$transaction(async (tx) => {
      const found = await tx.payment.findFirstOrThrow({
        where: {
          id: parse(uuid, id),
          sale: { branchId: actor.branchId },
          method: "transfer",
          entryType: "installment",
        },
      });
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${found.saleId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${id}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (payment.status === "rejected") return { ok: true };
      if (payment.status !== "pending_verification")
        bad("Sólo se rechaza un abono pendiente de verificar.");
      await tx.payment.update({
        where: { id },
        data: { status: "rejected" },
      });
      await audit(tx, actor, "reject", "payment", id, payment, {
        status: "rejected",
        reason: data.reason,
      });
      return { ok: true };
    });
  }
  @Post("returns")
  @RequireTerminal()
  @Permit("sale:manage")
  async returnSale(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        saleId: uuid,
        cashSessionId: uuid,
        reason,
        refundMethod: z.enum(["cash", "card", "transfer", "credit_note"]),
        items: z
          .array(
            z.object({
              saleItemId: uuid,
              qty: stockQty(10000),
              restock: z.boolean(),
              opened: z.boolean().default(false),
              damaged: z.boolean().default(false),
            }),
          )
          .min(1),
      }),
      body,
    );
    if (new Set(data.items.map((i) => i.saleItemId)).size !== data.items.length)
      bad("No repitas artículos en la devolución.");
    return this.db.$transaction(async (tx) => {
      await cashLock(tx, actor, data.cashSessionId, true);
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${data.saleId}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirstOrThrow({
        where: { id: data.saleId, branchId: actor.branchId },
        include: {
          items: {
            include: {
              variant: {
                include: { product: { include: { category: true } } },
              },
            },
          },
          returns: true,
        },
      });
      if (sale.status !== "completed")
        bad("Sólo se devuelven ventas completadas.");
      const settings = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      if (
        Date.now() - sale.createdAt.getTime() >
        Number((settings?.data as any)?.returnDays ?? 30) * 86400000
      )
        bad("La venta excede el plazo de devolución.");
      const lines = data.items.map((i) => {
        const line = sale.items.find((l) => l.id === i.saleItemId);
        if (!line || d(i.qty).plus(line.returnedQty).gt(line.qty))
          bad("Cantidad de devolución inválida.");
        // Un combo vendido se devuelve por unidades enteras (R6-01).
        const isKit = (line.stockAllocations as any[]).some(
          (a) => a.variantId !== line.variantId,
        );
        // Una venta anterior a la ronda 7 pudo vender una fracción de combo:
        // su saldo completo sí se puede devolver.
        const remaining = d(line.qty).minus(line.returnedQty);
        if (isKit && !Number.isInteger(i.qty) && !remaining.eq(i.qty))
          bad("Los combos se devuelven por unidades enteras.");
        if (
          i.restock &&
          (i.damaged || (i.opened && line.variant.product.category.requiresLot))
        )
          bad(
            "Un producto abierto o dañado no puede volver al stock vendible.",
          );
        return { ...i, line };
      });
      const ids = [
        ...new Set(
          lines.flatMap((i) =>
            (i.line.stockAllocations as any[]).map(
              (a) => a.variantId as string,
            ),
          ),
        ),
      ].sort();
      const variants = new Map<string, any>();
      for (const variantId of ids)
        variants.set(variantId, await lockVariant(tx, variantId, actor));
      let total = d(0),
        tax = d(0),
        cost = d(0);
      // Importes devueltos por línea: quedan en la devolución para que los
      // reportes usen exactamente lo registrado (R7-04).
      const parts: { cost: number; total: number; tax: number }[] = [];
      // Lo que ya contabilizaron las devoluciones anteriores, línea por línea.
      const history = replayReturns(sale, sale.returns);
      for (const i of lines) {
        const before = d(i.line.returnedQty),
          after = before.plus(i.qty);
        const back = (value: ReturnType<typeof d>) =>
          returnedAt(value, i.line.qty, after).minus(
            returnedAt(value, i.line.qty, before),
          );
        // Total e ITBIS con redondeo acumulado, como el costo: devolver de a
        // una unidad suma exactamente lo cobrado (R9-dinero-2).
        const lineTotal = back(d(i.line.lineTotal)),
          lineTax = back(d(i.line.tax));
        total = total.plus(lineTotal);
        tax = tax.plus(lineTax);
        // Costo devuelto: valor de las asignaciones (exacto en combos), con
        // redondeo acumulado para que varias devoluciones sumen exactamente el
        // costo de la venta.
        let lineCost = d(0);
        if (i.restock) {
          lineCost = back(allocationCost(i.line));
          // La devolución que completa la línea cierra contra lo contabilizado
          // de verdad: el costo registrado de la línea en la venta, menos lo
          // que ya repusieron las devoluciones anteriores y lo que quedó como
          // pérdida. Con devoluciones o ventas antiguas (rondas 3 a 7) eso
          // difiere del redondeo acumulado; con datos nuevos es lo mismo
          // (R9-dinero-1, R9-dinero-7).
          const past = history.lines.get(i.line.id) ?? {
            returned: d(0),
            restocked: d(0),
            waste: d(0),
          };
          if (after.eq(i.line.qty) && past.returned.eq(before))
            lineCost = history.booked
              .get(i.line.id)!
              .minus(past.restocked)
              .minus(past.waste);
          cost = cost.plus(lineCost);
        }
        parts.push({
          cost: lineCost.toNumber(),
          total: lineTotal.toNumber(),
          tax: lineTax.toNumber(),
        });
        await tx.saleItem.update({
          where: { id: i.line.id },
          data: { returnedQty: { increment: i.qty } },
        });
        for (const { allocation, qty } of returnShares(
          i.line.stockAllocations as any[],
          i.line.qty,
          i.line.returnedQty,
          i.qty,
        )) {
          const variant = variants.get(allocation.variantId);
          if (i.restock) {
            if (allocation.lotId) {
              const lot = await tx.lot.findUniqueOrThrow({
                where: { id: allocation.lotId },
              });
              if (expired(lot.expiryDate))
                bad("El lote ya venció. Registra la devolución como merma.");
              await tx.lot.update({
                where: { id: allocation.lotId },
                data: { qty: { increment: qty } },
              });
            }
            const newCost = weightedReturn(variant, qty, allocation.unitCost);
            await tx.variant.update({
              where: { id: variant.id },
              data: { costAvg: newCost },
            });
            variant.costAvg = newCost;
            await stockChange(
              tx,
              actor,
              variant,
              qty,
              "return",
              data.reason,
              sale.id,
              allocation.lotId,
            );
          } else
            await tx.inventoryMovement.create({
              data: {
                variantId: variant.id,
                lotId: allocation.lotId,
                type: "return_waste",
                qty: 0,
                unitCost: allocation.unitCost,
                balanceAfter: variant.stock,
                refId: sale.id,
                reason: data.reason + " (no vendible)",
                userId: actor.id,
                branchId: actor.branchId,
              },
            });
        }
      }
      const counter = await tx.counter.upsert({
        where: { key: "return:" + actor.branchId },
        create: { key: "return:" + actor.branchId, value: 1 },
        update: { value: { increment: 1 } },
      });
      const debtReduction = money(
        d(sale.creditBalance).lt(total) ? sale.creditBalance : total,
      );
      // Un abono por transferencia pendiente todavía no descontó la deuda. Si
      // la devolución la deja por debajo de ese abono, al verificarlo no
      // cabría y el cliente no recibiría su dinero: primero se verifica o se
      // rechaza (R9-dinero-3).
      const pending = await tx.payment.aggregate({
        where: {
          saleId: sale.id,
          entryType: "installment",
          status: "pending_verification",
        },
        _sum: { amount: true },
      });
      if (
        d(pending._sum.amount ?? 0).gt(0) &&
        d(sale.creditBalance)
          .minus(debtReduction)
          .lt(pending._sum.amount ?? 0)
      )
        bad(
          "Verifica o rechaza primero los abonos por transferencia pendientes de esta venta.",
        );
      const refundAmount = money(total.minus(debtReduction));
      if (debtReduction)
        await tx.sale.update({
          where: { id: sale.id },
          data: { creditBalance: { decrement: debtReduction } },
        });
      const row = await tx.saleReturn.create({
        data: {
          saleId: sale.id,
          number: "NC-" + String(counter.value).padStart(6, "0"),
          reason: data.reason,
          total: money(total),
          taxTotal: money(tax),
          costTotal: money(cost),
          refundMethod: data.refundMethod,
          refundAmount,
          cashSessionId: data.cashSessionId,
          userId: actor.id,
          items: json(data.items.map((it, k) => ({ ...it, ...parts[k] }))),
          branchId: actor.branchId,
        },
      });
      await tx.creditNote.create({
        data: {
          returnId: row.id,
          redemptionCode: randomBytes(16).toString("hex").toUpperCase(),
          customerId: sale.customerId,
          amount: refundAmount,
          balance: data.refundMethod === "credit_note" ? refundAmount : 0,
        },
      });
      await audit(tx, actor, "return", "sale", sale.id, undefined, row);
      return safe(row, actor);
    });
  }
  @Get("credit-notes")
  @Permit("sale:write")
  async creditNotes(
    @CurrentUser() actor: Actor,
    @Query("customerId") customerId?: string,
    @Query("code") code?: string,
  ) {
    const manager = can(actor.permissions, "sale:manage");
    const normalized = code?.trim().toUpperCase();
    if (normalized && !/^[0-9A-F]{32}$/.test(normalized)) return [];
    if (!manager && !customerId && !normalized) return [];
    if (customerId) parse(uuid, customerId);
    const returns = await this.db.saleReturn.findMany({
      where: { branchId: actor.branchId },
      select: { id: true, number: true },
    });
    const notes = await this.db.creditNote.findMany({
      where: {
        returnId: { in: returns.map((r) => r.id) },
        balance: { gt: 0 },
        ...(customerId ? { customerId } : {}),
        ...(normalized ? { redemptionCode: normalized } : {}),
        ...(!manager && !normalized ? { customerId: customerId! } : {}),
      },
    });
    return notes.map((n) => {
      const { redemptionCode, ...publicNote } = n;
      return {
        ...publicNote,
        ...(manager ? { redemptionCode } : {}),
        number: returns.find((r) => r.id === n.returnId)?.number,
      };
    });
  }
  @Get("returns/:id/credit-note.pdf")
  @Permit("sale:manage")
  async creditNotePdf(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const returned = await this.db.saleReturn.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    const note = await this.db.creditNote.findUniqueOrThrow({
      where: { returnId: returned.id },
    });
    res.setHeader("Content-Type", "application/pdf");
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.pipe(res);
    doc
      .fontSize(22)
      .text("FitStore · " + returned.number)
      .fontSize(12)
      .text("Nota interna de crédito · no fiscal")
      .text("Importe: RD$ " + note.amount)
      .text("Saldo: RD$ " + note.balance)
      .moveDown()
      .text("Código para presentar en caja:")
      .fontSize(14)
      .text(note.redemptionCode)
      .fontSize(10)
      .text("Conserva este código. Permite usar el saldo de la nota.");
    doc.end();
  }
  @Post("sales/:id/installments")
  @RequireTerminal()
  @Permit("sale:write")
  async installment(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    return this.collect(actor, id, parse(installmentSchema, body), false);
  }
  // Cobro de una contraentrega cuando el mensajero trae el dinero: es un abono
  // de la venta (idempotente por offlineUuid) en la caja abierta de quien lo
  // recibe, en efectivo o por transferencia (ésta, pendiente de verificar).
  @Post("sales/:id/cod-collections")
  @RequireTerminal()
  @Permit("sale:write")
  async codCollection(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      installmentSchema.extend({ method: z.enum(["cash", "transfer"]) }),
      body,
    );
    return this.collect(actor, id, data, true);
  }
  // Contraentregas pendientes de cobro de la sucursal: cualquier cajera puede
  // recibir el dinero de una venta de otra caja.
  @Get("cod/pending")
  @Permit("sale:write")
  async codPending(@CurrentUser() actor: Actor) {
    const sales = await this.db.sale.findMany({
      where: {
        branchId: actor.branchId,
        status: "completed",
        creditBalance: { gt: 0 },
        payments: { some: { method: "cod", entryType: "sale" } },
      },
      include: { payments: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    const [customers, sellers] = await Promise.all([
      this.db.customer.findMany({
        where: {
          id: { in: sales.flatMap((s) => (s.customerId ? [s.customerId] : [])) },
        },
        select: { id: true, name: true, phone: true },
      }),
      this.db.user.findMany({
        where: { id: { in: sales.map((s) => s.sellerId) } },
        select: { id: true, name: true },
      }),
    ]);
    const sum = (rows: { amount: unknown }[]) =>
      money(rows.reduce((a, p) => a.plus(p.amount as any), d(0)));
    return sales.map((s) => ({
      saleId: s.id,
      number: s.number,
      createdAt: s.createdAt,
      cashSessionId: s.cashSessionId,
      total: Number(s.total),
      codAmount: sum(
        s.payments.filter((p) => p.method === "cod" && p.entryType === "sale"),
      ),
      pending: Number(s.creditBalance),
      // Transferencias del mensajero registradas que falta verificar.
      pendingVerification: sum(
        s.payments.filter(
          (p) =>
            p.entryType === "installment" &&
            p.status === "pending_verification",
        ),
      ),
      customer: customers.find((c) => c.id === s.customerId) ?? null,
      seller: sellers.find((u) => u.id === s.sellerId) ?? null,
      notes: s.notes,
    }));
  }
  private async collect(
    actor: Actor,
    id: string,
    data: z.infer<typeof installmentSchema>,
    codOnly: boolean,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.offlineUuid}))::text AS locked`;
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: data.offlineUuid },
      });
      if (existing) {
        if (
          existing.saleId !== id ||
          Number(existing.amount) !== data.amount ||
          existing.method !== data.method ||
          existing.cashSessionId !== data.cashSessionId
        )
          bad("El UUID ya corresponde a otro abono.");
        const own = await tx.cashSession.findFirst({
          where: {
            id: existing.cashSessionId!,
            branchId: actor.branchId,
            userId: actor.id,
          },
        });
        if (!own) denied();
        return existing;
      }
      await cashLock(tx, actor, data.cashSessionId);
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${parse(uuid, id)}::uuid FOR UPDATE`;
      const sale = await tx.sale.findFirstOrThrow({
        where: { id, branchId: actor.branchId, status: "completed" },
      });
      const cod = !!(await tx.payment.count({
        where: { saleId: id, method: "cod", entryType: "sale" },
      }));
      if (codOnly && !cod) bad("Esta venta no es contraentrega.");
      const pending = await tx.payment.aggregate({
        where: {
          saleId: id,
          entryType: "installment",
          status: "pending_verification",
        },
        _sum: { amount: true },
      });
      if (
        d(sale.creditBalance)
          .minus(pending._sum.amount ?? 0)
          .lt(data.amount)
      )
        bad(
          cod
            ? "El cobro supera lo pendiente de la contraentrega."
            : "El abono supera el saldo pendiente.",
        );
      if (data.method === "card" && (!data.cardLast4 || !data.approvalCode))
        bad("Indica los últimos 4 dígitos y la aprobación de tarjeta.");
      if (data.method === "transfer" && (!data.bank || !data.reference))
        bad("Indica banco y referencia de transferencia.");
      const settings = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      const { offlineUuid, ...payment } = data;
      const row = await tx.payment.create({
        data: {
          ...payment,
          saleId: id,
          idempotencyKey: offlineUuid,
          entryType: "installment",
          tendered: data.amount,
          feeAmount:
            data.method === "card"
              ? money(
                  d(data.amount)
                    .times(
                      Number((settings?.data as any)?.cardFeePercent ?? 2.5),
                    )
                    .div(100),
                )
              : 0,
          status: data.method === "transfer" ? "pending_verification" : "ok",
        },
      });
      if (data.method !== "transfer")
        await tx.sale.update({
          where: { id },
          data: { creditBalance: { decrement: data.amount } },
        });
      await audit(
        tx,
        actor,
        cod ? "cod_collected" : "installment",
        "sale",
        id,
        undefined,
        row,
      );
      return row;
    });
  }
  @Get("sales/:id/receipt.pdf")
  @Permit("sale:write")
  async receipt(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
    @Res() res: Response,
  ) {
    const sale = await this.db.sale.findFirstOrThrow({
      where: {
        id: parse(uuid, id),
        branchId: actor.branchId,
        ...(can(actor.permissions, "sale:manage")
          ? {}
          : { sellerId: actor.id }),
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
      },
    });
    const settings = await this.db.settings.findUnique({
      where: { id: actor.branchId },
    });
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${sale.number}.pdf"`,
    );
    doc.pipe(res);
    doc.fontSize(24).text((settings?.data as any)?.name || "FitStore POS");
    doc
      .fontSize(10)
      .text("Documento interno — no fiscal")
      .text(
        sale.number +
          " · " +
          sale.createdAt.toLocaleDateString("es-DO", {
            timeZone: BUSINESS_TIME_ZONE,
          }),
      )
      .moveDown();
    if (sale.status === "voided") doc.text("ANULADA · " + sale.voidedReason);
    for (const item of sale.items)
      doc.text(
        `${item.variant.product.name} / ${item.variant.sku}   ${item.qty} × RD$ ${item.unitPrice}   RD$ ${item.lineTotal}`,
      );
    doc
      .moveDown()
      .text("ITBIS incluido: RD$ " + sale.taxTotal)
      .fontSize(18)
      .text("Total: RD$ " + sale.total);
    doc.fontSize(10);
    if (sale.ncfType)
      doc.text(
        "Solicitud NCF: " + sale.ncfType + " · pendiente de emisión fiscal",
      );
    if (Number(sale.creditBalance) > 0)
      doc.text(
        (sale.payments.some((p) => p.method === "cod")
          ? "Pendiente contraentrega: RD$ "
          : "Saldo a crédito: RD$ ") + sale.creditBalance,
      );
    for (const p of sale.payments)
      doc.text(`${p.method}: RD$ ${p.amount} · Cambio: RD$ ${p.change}`);
    doc.moveDown().text("Gracias por elegirnos.");
    doc.end();
  }
}
const installmentSchema = z.object({
  offlineUuid: uuid,
  cashSessionId: uuid,
  // Centavos exactos (R9-dinero-5): lo guardado en el pago es lo que
  // descuenta la deuda y lo que compara un reintento.
  amount: moneyAmount().transform((v) => money(v)),
  method: z.enum(["cash", "card", "transfer"]),
  bank: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
  cardLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  approvalCode: z.string().max(100).optional(),
});
function weightedReturn(variant: any, qty: number, cost: number) {
  if (Number(variant.stock) <= 0) return money(cost);
  return money(
    d(variant.stock)
      .times(variant.costAvg)
      .plus(d(qty).times(cost))
      .div(d(variant.stock).plus(qty)),
  );
}

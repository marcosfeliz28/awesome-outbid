// Incentivos por cajera (docs/INCENTIVOS.md).
//
// Cada cajera gana un monto por unidad vendida según la categoría del
// producto (Suplementos RD$ 50, Fajas RD$ 50, Maquillaje RD$ 25 y las demás 0
// por defecto; la administración las cambia en Configuración). «Venta al por
// mayor» reduce el incentivo de toda la venta a la mitad; no toca precios ni
// totales.
//
// Diseño:
// - Atribución: la usuaria que registra la venta (Sale.sellerId).
// - Instantánea: en la MISMA transacción de la venta se guarda una
//   IncentiveEntry por línea con la tarifa y el monto ya calculados. Un
//   reintento offline con el mismo offlineUuid devuelve la venta existente y
//   no vuelve a pasar por aquí; además (saleItemId, kind, refId) es único.
// - Devoluciones y anulaciones crean entradas negativas proporcionales a las
//   unidades devueltas, a nombre de la cajera que ganó el incentivo, en el mes
//   en que ocurren.
// - Cada entrada cuenta en un mes (period, America/Santo_Domingo). Un mes
//   cerrado no recibe entradas nuevas: una venta tardía o una devolución cae
//   en el siguiente mes abierto, con una nota.
// - El cierre guarda una instantánea inmutable por cajera
//   (IncentiveSettlement); el informe de un mes cerrado se lee de ahí.
import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import {
  BUSINESS_TIME_ZONE,
  businessDate,
  d,
  formatMoney,
  money,
  moneyAmount,
  quantity,
  returnedAt,
  z,
} from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  conflict,
  json,
  parse,
  uuid,
} from "./common";

// ---------------------------------------------------------------------------
// Cálculo puro (tests/incentives.test.ts)

/** Factor del incentivo en una «Venta al por mayor». */
export const WHOLESALE_FACTOR = 0.5;
const DEFAULT_RATES: Record<string, number> = {
  suplemento: 50,
  suplementos: 50,
  faja: 50,
  fajas: 50,
  maquillaje: 25,
  maquillajes: 25,
};
/** Nombre de categoría sin acentos, mayúsculas ni espacios repetidos. */
export const normalizeCategoryName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
/** Tarifa por defecto de una categoría según su nombre (RD$ por unidad). */
export const defaultIncentiveRate = (categoryName: string) =>
  DEFAULT_RATES[normalizeCategoryName(categoryName)] ?? 0;
/** Tarifa vigente: la configurada para la categoría o la de su nombre. */
export function rateFor(
  category: { id: string; name: string },
  configured: { categoryId: string; amount: unknown }[],
) {
  const row = configured.find((r) => r.categoryId === category.id);
  return row ? money(row.amount as any) : defaultIncentiveRate(category.name);
}
/** cantidad × tarifa (× 0.5 si mayorista), redondeado a centavos. */
export const incentiveAmount = (
  qty: number | string,
  rate: number | string,
  wholesale: boolean,
) =>
  money(
    d(qty)
      .times(rate)
      .times(wholesale ? WHOLESALE_FACTOR : 1),
  );
/**
 * Reverso de una devolución parcial, con redondeo acumulado: devolver de a
 * una unidad suma exactamente lo ganado por la línea. Devuelve un número ≤ 0.
 */
export function reversalAmount(
  earned: number | string,
  lineQty: number | string,
  returnedBefore: number | string,
  returning: number | string,
) {
  const after = d(returnedBefore).plus(returning);
  return money(
    returnedAt(earned, lineQty, returnedBefore)
      .minus(returnedAt(earned, lineQty, after))
      .toNumber(),
  );
}
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Mes de negocio (YYYY-MM) en America/Santo_Domingo. */
export const businessMonth = (value: Date | string | number = new Date()) =>
  businessDate(value).slice(0, 7);
export function nextMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}
export const monthLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("es-DO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};
/** Primer mes abierto desde `month` (los cerrados se saltan). */
export function firstOpenPeriod(month: string, closed: Iterable<string>) {
  const set = new Set(closed);
  let period = month;
  while (set.has(period)) period = nextMonth(period);
  return period;
}

export type EntryLike = {
  kind: string;
  saleId: string;
  userId: string;
  categoryName: string;
  qty: unknown;
  amount: unknown;
  wholesale: boolean;
  period: string;
  originPeriod: string;
  note?: string | null;
};
export type UnitsRow = { category: string; sold: number; returned: number };
export type IncentiveSummary = {
  userId: string;
  units: UnitsRow[];
  salesCount: number;
  wholesaleSales: number;
  gross: number;
  deductions: number;
  net: number;
  pendingCollection: number;
  priorDeductions: number;
  entryCount: number;
  lateEntries: number;
  negative: boolean;
};
/**
 * Cuadre de un mes por cajera a partir de sus entradas. `pendingSales` son las
 * ventas que todavía tienen saldo por cobrar (crédito / contraentrega): su
 * incentivo se cuenta pero se informa aparte para que la dueña decida.
 */
export function summarize(
  entries: EntryLike[],
  pendingSales: Set<string> = new Set(),
): IncentiveSummary[] {
  const byUser = new Map<string, EntryLike[]>();
  for (const e of entries)
    byUser.set(e.userId, [...(byUser.get(e.userId) ?? []), e]);
  return [...byUser.entries()].map(([userId, rows]) => {
    const units = new Map<string, { sold: any; returned: any }>();
    let gross = d(0),
      deductions = d(0),
      pending = d(0),
      prior = d(0);
    const sales = new Set<string>(),
      wholesale = new Set<string>();
    for (const e of rows) {
      const amount = d(e.amount as any);
      const unit = units.get(e.categoryName) ?? {
        sold: d(0),
        returned: d(0),
      };
      if (e.kind === "sale") {
        gross = gross.plus(amount);
        unit.sold = unit.sold.plus(e.qty as any);
        sales.add(e.saleId);
        if (e.wholesale) wholesale.add(e.saleId);
      } else {
        deductions = deductions.plus(amount);
        unit.returned = unit.returned.minus(e.qty as any);
        if (e.originPeriod < e.period) prior = prior.plus(amount);
      }
      units.set(e.categoryName, unit);
      if (pendingSales.has(e.saleId)) pending = pending.plus(amount);
    }
    const net = gross.plus(deductions);
    return {
      userId,
      units: [...units.entries()]
        .map(([category, u]) => ({
          category,
          sold: quantity(u.sold),
          returned: quantity(u.returned),
        }))
        .sort((a, b) => a.category.localeCompare(b.category, "es")),
      salesCount: sales.size,
      wholesaleSales: wholesale.size,
      gross: money(gross),
      deductions: money(deductions),
      net: money(net),
      pendingCollection: money(pending),
      priorDeductions: money(prior),
      entryCount: rows.length,
      lateEntries: rows.filter((e) => e.note).length,
      negative: net.lt(0),
    };
  });
}

// ---------------------------------------------------------------------------
// Enganches dentro de las transacciones de venta, devolución y anulación

// El cierre de un mes toma este candado en exclusiva; ventas y devoluciones lo
// toman compartido, así no se bloquean entre sí y ninguna entrada cae en un mes
// que se está cerrando.
async function closeLock(tx: any, branchId: string, exclusive: boolean) {
  if (exclusive)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7301, hashtext(${branchId}))::text AS locked`;
  else
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(7301, hashtext(${branchId}))::text AS locked`;
}
async function openPeriod(tx: any, branchId: string, month: string) {
  const closed = await tx.incentivePeriodClose.findMany({
    where: { branchId, period: { gte: month } },
    select: { period: true },
  });
  return firstOpenPeriod(
    month,
    closed.map((c: { period: string }) => c.period),
  );
}

/** Instantánea del incentivo de cada línea de una venta recién registrada. */
export async function recordSaleIncentives(
  tx: any,
  actor: Actor,
  saleId: string,
) {
  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      sellerId: true,
      branchId: true,
      createdAt: true,
      wholesale: true,
      items: {
        select: {
          id: true,
          qty: true,
          variant: {
            select: {
              product: {
                select: { category: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
  await closeLock(tx, sale.branchId, false);
  const rates = await tx.incentiveRate.findMany({
    where: { branchId: sale.branchId },
  });
  const origin = businessMonth(sale.createdAt);
  const period = await openPeriod(tx, sale.branchId, origin);
  const note =
    period === origin
      ? null
      : `Venta de ${origin} registrada después del cierre de ese mes: cuenta en ${period}.`;
  const data = sale.items.map((item: any) => {
    const category = item.variant.product.category;
    const rate = rateFor(category, rates);
    return {
      kind: "sale",
      refId: sale.id,
      saleId: sale.id,
      saleItemId: item.id,
      userId: sale.sellerId,
      categoryId: category.id,
      categoryName: category.name,
      qty: item.qty,
      rateAtSale: rate,
      wholesale: sale.wholesale,
      amount: incentiveAmount(String(item.qty), rate, sale.wholesale),
      period,
      originPeriod: origin,
      note,
      branchId: sale.branchId,
    };
  });
  if (data.length)
    await tx.incentiveEntry.createMany({ data, skipDuplicates: true });
  // Control de abuso: la marca mayorista queda en la bitácora.
  if (sale.wholesale)
    await audit(tx, actor, "wholesale_marked", "sale", sale.id, undefined, {
      number: sale.number,
      factor: WHOLESALE_FACTOR,
      incentive: money(
        data.reduce((sum: any, row: any) => sum.plus(row.amount), d(0)),
      ),
    });
}

/**
 * Reverso del incentivo por una devolución (`items`: líneas y unidades
 * devueltas, ya sumadas a SaleItem.returnedQty) o por una anulación (todo lo
 * que queda de cada línea). Las ventas anteriores a los incentivos no tienen
 * entradas y no se tocan.
 */
export async function reverseIncentives(
  tx: any,
  actor: Actor,
  kind: "return" | "void",
  saleId: string,
  refId: string,
  items?: { saleItemId: string; qty: number }[],
) {
  void actor;
  const entries = await tx.incentiveEntry.findMany({ where: { saleId } });
  const earned = new Map<string, any>(
    entries
      .filter((e: any) => e.kind === "sale")
      .map((e: any) => [e.saleItemId, e]),
  );
  if (!earned.size) return;
  const first = [...earned.values()][0];
  await closeLock(tx, first.branchId, false);
  const month = businessMonth(new Date());
  const period = await openPeriod(tx, first.branchId, month);
  const rows: any[] = [];
  const push = (sale: any, qty: any, amount: number) => {
    const notes = [
      ...(sale.originPeriod < period
        ? [
            `${kind === "void" ? "Anulación" : "Devolución"} de una venta de ${sale.originPeriod}: se descuenta en ${period}.`,
          ]
        : []),
      ...(period !== month
        ? [`El mes ${month} ya estaba cerrado: cuenta en ${period}.`]
        : []),
    ];
    rows.push({
      kind,
      refId,
      saleId,
      saleItemId: sale.saleItemId,
      userId: sale.userId,
      categoryId: sale.categoryId,
      categoryName: sale.categoryName,
      qty,
      rateAtSale: sale.rateAtSale,
      wholesale: sale.wholesale,
      amount,
      period,
      originPeriod: sale.originPeriod,
      note: notes.length ? notes.join(" ") : null,
      branchId: sale.branchId,
    });
  };
  if (kind === "void") {
    for (const sale of earned.values()) {
      const line = entries.filter((e: any) => e.saleItemId === sale.saleItemId);
      const amount = line.reduce((s: any, e: any) => s.plus(e.amount), d(0));
      const qty = line.reduce((s: any, e: any) => s.plus(e.qty), d(0));
      if (qty.gt(0) || !amount.isZero())
        push(sale, quantity(qty.negated()), money(amount.negated()));
    }
  } else {
    for (const item of items ?? []) {
      const sale = earned.get(item.saleItemId);
      if (!sale) continue;
      const line = await tx.saleItem.findUniqueOrThrow({
        where: { id: item.saleItemId },
        select: { qty: true, returnedQty: true },
      });
      const before = d(line.returnedQty).minus(item.qty);
      push(
        sale,
        quantity(d(item.qty).negated()),
        reversalAmount(
          String(sale.amount),
          String(line.qty),
          String(before),
          item.qty,
        ),
      );
    }
  }
  if (rows.length)
    await tx.incentiveEntry.createMany({ data: rows, skipDuplicates: true });
}

/** Suma del incentivo de una venta (para el aviso de Telegram). */
export async function saleIncentive(db: any, saleId: string) {
  const sum = await db.incentiveEntry.aggregate({
    where: { saleId, kind: "sale" },
    _sum: { amount: true },
  });
  return sum._sum.amount === null ? null : money(sum._sum.amount);
}

// ---------------------------------------------------------------------------
// Pantalla «Incentivos», cuadro de la cajera, tarifas, cierre y exportes

const monthQuery = z.object({
  month: z.string().regex(MONTH_PATTERN, "debe ser un mes AAAA-MM").optional(),
});
const ratesBody = z.object({
  rates: z
    .array(
      z.object({
        categoryId: uuid,
        amount: moneyAmount(100000, true),
      }),
    )
    .max(500),
});
const KIND_LABEL: Record<string, string> = {
  sale: "Venta",
  return: "Devolución",
  void: "Anulación",
};

@Controller()
export class IncentivesController {
  constructor(@Inject(Database) private db: Database) {}

  // Mes pedido (por defecto, el actual; para la cajera, el mes abierto donde
  // cuentan sus ventas nuevas). Nunca uno posterior al mes abierto.
  private async month(
    query: unknown,
    branchId: string,
    fallback: "current" | "open" = "current",
  ) {
    const open = await openPeriod(this.db, branchId, businessMonth());
    const requested = parse(monthQuery, query).month;
    const month = requested ?? (fallback === "open" ? open : businessMonth());
    if (month > open && month > businessMonth())
      bad("Ese mes todavía no empieza.");
    return month;
  }

  /** Cuadre de un mes: del cierre si está cerrado, de las entradas si no. */
  private async report(branchId: string, period: string, userId?: string) {
    const close = await this.db.incentivePeriodClose.findUnique({
      where: { branchId_period: { branchId, period } },
    });
    if (close) {
      const rows = await this.db.incentiveSettlement.findMany({
        where: { branchId, period, ...(userId ? { userId } : {}) },
        orderBy: { userName: "asc" },
      });
      const closer =
        rows[0]?.closedByName ?? (await this.userName(close.closedBy));
      return {
        month: period,
        label: monthLabel(period),
        closed: { closedAt: close.closedAt, closedByName: closer },
        rows: rows.map((s) => ({
          userId: s.userId,
          name: s.userName,
          units: s.units as UnitsRow[],
          salesCount: s.salesCount,
          wholesaleSales: s.wholesaleSales,
          gross: Number(s.gross),
          deductions: Number(s.deductions),
          net: Number(s.net),
          pendingCollection: Number(s.pendingCollection),
          priorDeductions: Number(s.priorDeductions),
          entryCount: s.entryCount,
          lateEntries: 0,
          negative: Number(s.net) < 0,
        })),
      };
    }
    const rows = await this.live(branchId, period, userId);
    return { month: period, label: monthLabel(period), closed: null, rows };
  }

  private async live(
    branchId: string,
    period: string,
    userId?: string,
    db: any = this.db,
  ) {
    const entries: any[] = await db.incentiveEntry.findMany({
      where: { branchId, period, ...(userId ? { userId } : {}) },
    });
    const saleIds = [...new Set(entries.map((e) => e.saleId))];
    const pending = saleIds.length
      ? await db.sale.findMany({
          where: {
            id: { in: saleIds },
            status: "completed",
            creditBalance: { gt: 0 },
          },
          select: { id: true },
        })
      : [];
    const summaries = summarize(
      entries,
      new Set(pending.map((s: { id: string }) => s.id)),
    );
    const users: { id: string; name: string }[] = await db.user.findMany({
      where: { id: { in: summaries.map((s) => s.userId) } },
      select: { id: true, name: true },
    });
    return summaries
      .map((s) => ({
        ...s,
        name: users.find((u) => u.id === s.userId)?.name ?? "Usuaria eliminada",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  private async userName(id: string) {
    return (
      (await this.db.user.findUnique({ where: { id }, select: { name: true } }))
        ?.name ?? "—"
    );
  }

  // Gerencia y administración: todas las cajeras.
  @Get("incentives")
  @Permit("sale:manage")
  async monthly(@CurrentUser() actor: Actor, @Query() query: unknown) {
    const period = await this.month(query, actor.branchId);
    return {
      ...(await this.report(actor.branchId, period)),
      openPeriod: await openPeriod(this.db, actor.branchId, businessMonth()),
    };
  }

  // Cualquier cajera: SÓLO lo suyo. No acepta otra usuaria por parámetro.
  @Get("incentives/me")
  @Permit("sale:write")
  async mine(@CurrentUser() actor: Actor, @Query() query: unknown) {
    const report = await this.report(
      actor.branchId,
      await this.month(query, actor.branchId, "open"),
      actor.id,
    );
    return {
      month: report.month,
      label: report.label,
      closed: !!report.closed,
      row: report.rows.find((r) => r.userId === actor.id) ?? null,
    };
  }

  @Get("incentives/rates")
  @Permit("sale:manage")
  async rates(@CurrentUser() actor: Actor) {
    const [categories, configured] = await Promise.all([
      this.db.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      this.db.incentiveRate.findMany({ where: { branchId: actor.branchId } }),
    ]);
    return categories.map((c) => {
      const row = configured.find((r) => r.categoryId === c.id);
      return {
        categoryId: c.id,
        name: c.name,
        amount: rateFor(c, configured),
        isDefault: !row,
        defaultAmount: defaultIncentiveRate(c.name),
      };
    });
  }

  // Sólo la administración cambia tarifas. Lo ya ganado no cambia.
  @Put("incentives/rates")
  @Permit("*")
  async saveRates(@CurrentUser() actor: Actor, @Body() body: unknown) {
    const data = parse(ratesBody, body);
    if (new Set(data.rates.map((r) => r.categoryId)).size !== data.rates.length)
      bad("No repitas categorías.");
    await this.db.$transaction(async (tx) => {
      const categories = await tx.category.findMany({
        where: { id: { in: data.rates.map((r) => r.categoryId) } },
        select: { id: true, name: true },
      });
      if (categories.length !== data.rates.length)
        bad("Una de las categorías ya no existe.");
      const before = await tx.incentiveRate.findMany({
        where: { branchId: actor.branchId },
      });
      for (const rate of data.rates)
        await tx.incentiveRate.upsert({
          where: {
            branchId_categoryId: {
              branchId: actor.branchId,
              categoryId: rate.categoryId,
            },
          },
          create: {
            branchId: actor.branchId,
            categoryId: rate.categoryId,
            amount: rate.amount,
            updatedBy: actor.id,
          },
          update: { amount: rate.amount, updatedBy: actor.id },
        });
      await audit(
        tx,
        actor,
        "incentive_rates",
        "settings",
        actor.branchId,
        before.map((r) => ({
          categoryId: r.categoryId,
          amount: Number(r.amount),
        })),
        data.rates.map((r) => ({
          ...r,
          category: categories.find((c) => c.id === r.categoryId)?.name,
        })),
      );
    });
    return this.rates(actor);
  }

  // Cerrar el mes: instantánea inmutable por cajera. Sólo la administración.
  @Post("incentives/close")
  @Permit("*")
  async close(@CurrentUser() actor: Actor, @Body() body: unknown) {
    const period = parse(
      z.object({ month: z.string().regex(MONTH_PATTERN) }),
      body,
    ).month;
    if (period > businessMonth()) bad("Ese mes todavía no empieza.");
    // B-3 / D-M8 (auditorías 01 y 06): el cierre es irreversible y movía al
    // mes siguiente todas las ventas que faltaban del mes en curso. Sólo se
    // cierra un mes terminado.
    if (period === businessMonth())
      bad(
        "Sólo se cierra un mes terminado: este mes sigue en curso. Ciérralo a partir del día 1 del mes siguiente.",
      );
    await this.db.$transaction(
      async (tx) => {
        await closeLock(tx, actor.branchId, true);
        const existing = await tx.incentivePeriodClose.findUnique({
          where: {
            branchId_period: { branchId: actor.branchId, period },
          },
        });
        if (existing) conflict("Ese mes ya está cerrado.");
        const rows = await this.live(actor.branchId, period, undefined, tx);
        const closedAt = new Date();
        await tx.incentivePeriodClose.create({
          data: {
            branchId: actor.branchId,
            period,
            closedBy: actor.id,
            closedAt,
          },
        });
        if (rows.length)
          await tx.incentiveSettlement.createMany({
            data: rows.map((r) => ({
              branchId: actor.branchId,
              period,
              userId: r.userId,
              userName: r.name,
              units: json(r.units),
              salesCount: r.salesCount,
              wholesaleSales: r.wholesaleSales,
              gross: r.gross,
              deductions: r.deductions,
              net: r.net,
              pendingCollection: r.pendingCollection,
              priorDeductions: r.priorDeductions,
              entryCount: r.entryCount,
              closedBy: actor.id,
              closedByName: actor.name,
              closedAt,
            })),
          });
        await audit(
          tx,
          actor,
          "incentive_month_closed",
          "incentives",
          period,
          undefined,
          {
            period,
            cashiers: rows.length,
            net: money(rows.reduce((s, r) => s.plus(r.net), d(0))),
          },
        );
      },
      { timeout: 20000 },
    );
    return this.report(actor.branchId, period);
  }

  @Get("incentives/export.xlsx")
  @Permit("sale:manage")
  async export(
    @CurrentUser() actor: Actor,
    @Query() query: unknown,
    @Res() res: Response,
  ) {
    const period = await this.month(query, actor.branchId);
    const report = await this.report(actor.branchId, period);
    const entries = await this.db.incentiveEntry.findMany({
      where: { branchId: actor.branchId, period },
      orderBy: { createdAt: "asc" },
    });
    const [sales, users] = await Promise.all([
      this.db.sale.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.saleId))] } },
        select: { id: true, number: true },
      }),
      this.db.user.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.userId))] } },
        select: { id: true, name: true },
      }),
    ]);
    const book = new ExcelJS.Workbook();
    const summary = book.addWorksheet("Cuadre");
    summary.addRow([
      `Incentivos de ${report.label}` +
        (report.closed ? " · mes cerrado" : " · mes abierto (preliminar)"),
    ]);
    summary.addRow([]);
    summary.addRow([
      "Cajera",
      "Ventas",
      "Ventas mayoristas",
      "Unidades",
      "Incentivo bruto",
      "Devoluciones y anulaciones",
      "Neto",
      "De ventas por cobrar",
      "Reversos de meses anteriores",
    ]);
    for (const r of report.rows)
      summary.addRow([
        r.name,
        r.salesCount,
        r.wholesaleSales,
        r.units.map((u) => `${u.category}: ${u.sold - u.returned}`).join(" · "),
        r.gross,
        r.deductions,
        r.net,
        r.pendingCollection,
        r.priorDeductions,
      ]);
    summary.columns.forEach((c, n) => (c.width = n === 3 ? 48 : 18));
    const detail = book.addWorksheet("Detalle");
    detail.addRow([
      "Fecha",
      "Factura",
      "Cajera",
      "Tipo",
      "Categoría",
      "Cantidad",
      "Tarifa por unidad",
      "Mayorista",
      "Monto",
      "Mes de la venta",
      "Nota",
    ]);
    for (const e of entries)
      detail.addRow([
        e.createdAt.toLocaleString("es-DO", { timeZone: BUSINESS_TIME_ZONE }),
        sales.find((s) => s.id === e.saleId)?.number ?? "",
        users.find((u) => u.id === e.userId)?.name ?? "",
        KIND_LABEL[e.kind] ?? e.kind,
        e.categoryName,
        Number(e.qty),
        Number(e.rateAtSale),
        e.wholesale ? "Sí" : "No",
        Number(e.amount),
        e.originPeriod,
        e.note ?? "",
      ]);
    detail.columns.forEach((c) => (c.width = 18));
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="incentivos-${period}.xlsx"`,
    );
    res.end(Buffer.from(await book.xlsx.writeBuffer()));
  }

  // Recibo por cajera para firmar.
  @Get("incentives/receipt.pdf")
  @Permit("sale:manage")
  async receipt(
    @CurrentUser() actor: Actor,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const period = await this.month({ month: query.month }, actor.branchId);
    const userId = parse(uuid, query.userId);
    const report = await this.report(actor.branchId, period, userId);
    const row = report.rows[0];
    if (!row) bad("Esa cajera no tiene incentivos en este mes.");
    const settings = await this.db.settings.findUnique({
      where: { id: actor.branchId },
    });
    const business = (settings?.data as any) ?? {};
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="incentivo-${period}.pdf"`,
    );
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.pipe(res);
    doc.fontSize(18).text(business.name || "Nexora POS", { align: "center" });
    if (business.branchName)
      doc.fontSize(10).text(business.branchName, { align: "center" });
    doc
      .moveDown()
      .fontSize(15)
      .text(`Recibo de incentivos · ${report.label}`)
      .fontSize(11)
      .text(
        report.closed
          ? `Mes cerrado el ${new Date(report.closed.closedAt).toLocaleString("es-DO", { timeZone: BUSINESS_TIME_ZONE, dateStyle: "short", timeStyle: "short" })} por ${report.closed.closedByName}.`
          : "PRELIMINAR: el mes sigue abierto y puede cambiar.",
      )
      .moveDown()
      .text("Cajera: " + row.name)
      .text(
        `Ventas: ${row.salesCount} · Ventas al por mayor (incentivo a la mitad): ${row.wholesaleSales}`,
      )
      .moveDown()
      .text("Unidades por categoría (vendidas / devueltas):");
    for (const u of row.units)
      doc.text(`   ${u.category}: ${u.sold} / ${u.returned}`);
    doc
      .moveDown()
      .text("Incentivo bruto: " + formatMoney(row.gross))
      .text("Devoluciones y anulaciones: " + formatMoney(row.deductions));
    if (row.priorDeductions)
      doc.text(
        "   de ventas de meses anteriores: " + formatMoney(row.priorDeductions),
      );
    doc
      .fontSize(14)
      .text("Neto a pagar: " + formatMoney(row.net))
      .fontSize(11);
    if (row.negative)
      doc.text(
        "Saldo negativo: las devoluciones del mes superan lo ganado. La administración decide cómo se compensa.",
      );
    if (row.pendingCollection)
      doc.text(
        "Incluye " +
          formatMoney(row.pendingCollection) +
          " de ventas aún por cobrar (crédito / contraentrega).",
      );
    doc
      .moveDown(3)
      .text(
        "______________________________          ______________________________",
      )
      .text(
        "Firma de la cajera                                   Firma de la administración",
      )
      .moveDown()
      .fontSize(9)
      .text(
        "Documento interno. Tarifas por unidad según la categoría al momento de cada venta; «Venta al por mayor» paga la mitad.",
      );
    doc.end();
  }
}

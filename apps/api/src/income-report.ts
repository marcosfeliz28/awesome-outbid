import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { once } from "node:events";
import { businessDate } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  bad,
  parse,
  uuid,
  canViewCashExpected,
  denied,
} from "./common";
import { groupIncomeDays } from "./income-day";
import { tenantUnique } from "./tenant-context";

type QueryInput = {
  from?: string;
  to?: string;
  scope?: string;
  scopeId?: string;
  day?: string;
  page?: string;
  format?: string;
};
type Event = {
  id: string;
  date: Date;
  day: string;
  kind: string;
  amount: unknown;
  number: string | null;
  method: string | null;
  cardLast4: string | null;
  approvalCode: string | null;
  bank: string | null;
  reference: string | null;
  cashSessionId: string | null;
};
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const utc = (date: Date) =>
  Prisma.sql`(${date}::timestamptz AT TIME ZONE 'UTC')`;
const businessDay = (column: Prisma.Sql) =>
  Prisma.sql`to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD')`;
const isoDate = (value: string) => {
  if (
    !dayPattern.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    bad("Indica fechas válidas con formato AAAA-MM-DD.");
  return value;
};
export function incomeOptions(query: QueryInput) {
  const from = isoDate(query.from ?? "");
  const to = isoDate(query.to ?? "");
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  if (days < 0 || days > 365) bad("El rango debe ser de 1 a 366 días.");
  const scope = query.scope ?? "all";
  if (!["all", "session", "user", "equipment"].includes(scope))
    bad("Alcance inválido.");
  const scopeId = scope === "all" ? "" : String(query.scopeId ?? "");
  if (scope !== "all" && !scopeId)
    bad("Selecciona una caja, usuario o equipo.");
  if (["session", "user"].includes(scope)) parse(uuid, scopeId);
  if (scopeId.length > 100) bad("Identificador demasiado largo.");
  if (query.day && (isoDate(query.day) < from || isoDate(query.day) > to))
    bad("El día está fuera del rango.");
  return {
    from,
    to,
    scope,
    scopeId,
    start: new Date(from + "T00:00:00-04:00"),
    end: new Date(to + "T23:59:59.999-04:00"),
  };
}
type Opt = ReturnType<typeof incomeOptions> & { excludeTest?: boolean };
function scopeSql(opt: Opt, kind: "sale" | "payment" | "return") {
  if (opt.scope === "all") return Prisma.empty;
  if (opt.scope === "session")
    return Prisma.sql`AND ${kind === "return" ? Prisma.sql`r."cashSessionId"` : kind === "payment" ? Prisma.sql`p."cashSessionId"` : Prisma.sql`s."cashSessionId"`} = ${opt.scopeId}::uuid`;
  if (opt.scope === "user")
    return Prisma.sql`AND ${kind === "return" ? Prisma.sql`r."userId"` : kind === "payment" ? Prisma.sql`CASE WHEN p."entryType" = 'installment' THEN p."receivedById"::text ELSE s."sellerId"::text END` : Prisma.sql`s."sellerId"::text`} = ${opt.scopeId}`;
  return Prisma.sql`AND cs."registerId" = ${opt.scopeId}`;
}
// Fuente única de resumen, detalle y exportación. Los pagos de crédito al
// vender figuran como deuda, no como dinero recibido. Sólo abonos verificados
// entran al día en que se cobraron; una transferencia sin verificar (venta o
// abono) va aparte como «por verificar» y no suma al dinero ingresado.
// Devolución y reembolso tienen signo menos.
function eventsSql(actor: Actor, opt: Opt) {
  const soldDate = businessDay(Prisma.sql`s."createdAt"`);
  const paymentTime = Prisma.sql`CASE WHEN p."entryType"='sale' THEN s."createdAt" ELSE p."createdAt" END`;
  const paymentDate = businessDay(paymentTime);
  const returnDate = businessDay(Prisma.sql`r."createdAt"`);
  const saleScope = scopeSql(opt, "sale");
  const paymentScope = scopeSql(opt, "payment");
  const returnScope = scopeSql(opt, "return");
  const testFilter = opt.excludeTest
    ? Prisma.sql`AND COALESCE(cs."registerId",'') !~* '^(qa|test|prueba)[-_]'`
    : Prisma.empty;
  return Prisma.sql`
    SELECT s.id::text AS id, s."createdAt" AS date, ${soldDate} AS day,
      'sold'::text AS kind, s.total AS amount, s.number,
      NULL::text AS method, NULL::text AS "cardLast4", NULL::text AS "approvalCode",
      NULL::text AS bank, NULL::text AS reference, s."cashSessionId"::text AS "cashSessionId"
    FROM "Sale" s LEFT JOIN "CashSession" cs ON cs.id=s."cashSessionId"
    WHERE s."branchId"=${actor.branchId} AND s.status='completed'
      AND s."createdAt">=${utc(opt.start)} AND s."createdAt"<=${utc(opt.end)} ${saleScope} ${testFilter}
    UNION ALL
    SELECT p.id::text, ${paymentTime}, ${paymentDate},
      CASE WHEN p.status='pending_verification' THEN 'pending_transfer'
           WHEN p."entryType"='installment' THEN 'collection_'||p.method
           WHEN p.status='rejected' THEN 'credit_generated'
           WHEN p.method IN ('cod','credit') THEN 'credit_generated'
           ELSE 'sale_'||p.method END,
      p.amount, s.number, p.method, p."cardLast4", p."approvalCode", p.bank, p.reference,
      p."cashSessionId"::text
    FROM "Payment" p JOIN "Sale" s ON s.id=p."saleId"
      LEFT JOIN "CashSession" cs ON cs.id=COALESCE(p."cashSessionId",s."cashSessionId")
    WHERE s."branchId"=${actor.branchId} AND s.status='completed'
      AND p."entryType" IN ('sale','installment')
      AND p.method IN ('cash','card','transfer','cod','credit')
      AND (p."entryType"='sale' OR p.status IN ('ok','pending_verification'))
      AND ${paymentTime}>=${utc(opt.start)} AND ${paymentTime}<=${utc(opt.end)} ${paymentScope} ${testFilter}
    UNION ALL
    SELECT r.id::text, r."createdAt", ${returnDate}, 'return_total',
      -r.total, r.number, r."refundMethod", NULL::text, NULL::text,
      NULL::text, NULL::text, r."cashSessionId"::text
    FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId"
      LEFT JOIN "CashSession" cs ON cs.id=COALESCE(r."cashSessionId",s."cashSessionId")
    WHERE r."branchId"=${actor.branchId} AND s.status='completed'
      AND r."createdAt">=${utc(opt.start)} AND r."createdAt"<=${utc(opt.end)} ${returnScope} ${testFilter}
    UNION ALL
    SELECT r.id::text, r."createdAt", ${returnDate}, 'return_'||r."refundMethod",
      -r."refundAmount", r.number, r."refundMethod", NULL::text, NULL::text,
      NULL::text, NULL::text, r."cashSessionId"::text
    FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId"
      LEFT JOIN "CashSession" cs ON cs.id=COALESCE(r."cashSessionId",s."cashSessionId")
    WHERE r."branchId"=${actor.branchId} AND s.status='completed' AND r."refundAmount">0
      AND r."refundMethod" IN ('cash','card','transfer')
      AND r."createdAt">=${utc(opt.start)} AND r."createdAt"<=${utc(opt.end)} ${returnScope} ${testFilter}`;
}
const fields = [
  "day",
  "cash",
  "card",
  "transfer",
  "pendingTransfer",
  "creditGenerated",
  "collectionCash",
  "collectionCard",
  "collectionTransfer",
  "returns",
  "moneyIn",
  "sold",
] as const;
const labels = [
  "Fecha ISO",
  "Efectivo",
  "Tarjeta",
  "Transferencia",
  "Transferencia por verificar",
  "Crédito generado",
  "Cobro crédito efectivo",
  "Cobro crédito tarjeta",
  "Cobro crédito transferencia",
  "Devoluciones",
  "Dinero ingresado",
  "Vendido neto",
];
const amount = (value: unknown) => Number(value ?? 0).toFixed(2);
function csvCell(value: unknown) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function csvLine(values: unknown[]) {
  return values.map(csvCell).join(",") + "\r\n";
}
const localDate = (day: string) =>
  day.slice(8, 10) + "/" + day.slice(5, 7) + "/" + day.slice(0, 4);

export async function incomeSummary(db: Database, actor: Actor, opt: Opt) {
  const raw = await db.$queryRaw<
    { day: string; kind: string; amount: unknown }[]
  >(Prisma.sql`
    SELECT day, kind, SUM(amount) AS amount FROM (${eventsSql(actor, opt)}) events GROUP BY day, kind ORDER BY day, kind`);
  return groupIncomeDays(raw.map((r) => ({ ...r, amount: String(r.amount) })));
}

@Controller()
export class IncomeReportController {
  constructor(@Inject(Database) private db: Database) {}
  private async countDetail(actor: Actor, opt: Opt, day?: string) {
    const rows = await this.db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total FROM (${eventsSql(actor, opt)}) events
      WHERE kind NOT IN ('sold','return_total') ${day ? Prisma.sql`AND day=${day}` : Prisma.empty}`);
    return Number(rows[0]?.total ?? 0);
  }
  private async detail(
    actor: Actor,
    opt: Opt,
    offset: number,
    limit: number,
    day?: string,
  ) {
    return this.db.$queryRaw<Event[]>(Prisma.sql`
      SELECT * FROM (${eventsSql(actor, opt)}) events
      WHERE kind NOT IN ('sold','return_total') ${day ? Prisma.sql`AND day=${day}` : Prisma.empty}
      ORDER BY date, id, kind LIMIT ${limit} OFFSET ${offset}`);
  }
  private async *exportDetail(actor: Actor, opt: Opt, max: number) {
    let cursor: Event | null = null;
    let emitted = 0;
    while (emitted < max) {
      const after = cursor;
      const batch: Event[] = await this.db.$queryRaw<Event[]>(Prisma.sql`
        SELECT * FROM (${eventsSql(actor, opt)}) events
        WHERE kind NOT IN ('sold','return_total')
        ${after ? Prisma.sql`AND (date,id,kind) > (${utc(after.date)},${after.id},${after.kind})` : Prisma.empty}
        ORDER BY date,id,kind LIMIT 500`);
      if (!batch.length) break;
      for (const event of batch) {
        yield event;
        emitted++;
        if (emitted >= max) break;
      }
      cursor = batch[batch.length - 1];
      if (batch.length < 500) break;
    }
  }
  private async reconciliation(
    actor: Actor,
    opt: Opt,
    rows: ReturnType<typeof groupIncomeDays>,
  ) {
    if (opt.scope !== "session") return null;
    const session = await this.db.cashSession.findFirst({
      where: { id: opt.scopeId, branchId: actor.branchId },
    });
    if (
      !session ||
      !session.closedAt ||
      businessDate(session.openedAt) !== businessDate(session.closedAt)
    )
      return {
        comparable: false,
        message:
          "Esta caja está abierta o abarca más de un día; el cierre no se compara con un solo día.",
      };
    const row = rows.find((r) => r.day === businessDate(session.openedAt));
    if (!row)
      return {
        comparable: false,
        message: "Esta caja no tiene movimientos en el período.",
      };
    const moves = await this.db.cashMovement.findMany({
      where: { sessionId: session.id },
      select: { type: true, amount: true },
    });
    const movementNet = moves.reduce(
      (sum, m) => sum + (m.type === "in" ? 1 : -1) * Number(m.amount),
      0,
    );
    const expected = {
      cash:
        Number(session.expectedCash ?? 0) -
        Number(session.openingAmount) -
        movementNet,
      card: Number(session.expectedCard ?? 0),
      transfer: Number(session.expectedTransfer ?? 0),
    };
    const report = {
      cash: row.cash + row.collectionCash,
      card: row.card + row.collectionCard,
      // El esperado de la caja incluye las transferencias por verificar.
      transfer: row.transfer + row.pendingTransfer + row.collectionTransfer,
    };
    const difference = {
      cash: Number((report.cash - expected.cash).toFixed(2)),
      card: Number((report.card - expected.card).toFixed(2)),
      transfer: Number((report.transfer - expected.transfer).toFixed(2)),
    };
    return {
      comparable: true,
      day: row.day,
      report,
      expected,
      difference,
      matches: Object.values(difference).every((value) => value === 0),
    };
  }
  @Get("reports/income-by-day")
  @Permit("reports:read")
  async get(
    @CurrentUser() actor: Actor,
    @Query() query: QueryInput,
    @Res() res: Response,
  ) {
    const opt = incomeOptions(query);
    res.setHeader("Cache-Control", "private, no-store");
    if (!canViewCashExpected(actor)) {
      const open = await this.db.cashSession.findFirst({
        where: { branchId: actor.branchId, closedAt: null },
        select: { id: true },
      });
      if (open) denied();
    }
    const rows = await incomeSummary(this.db, actor, opt);
    const totals = rows.reduce(
      (sum, row) => {
        for (const field of fields.slice(1) as Exclude<
          (typeof fields)[number],
          "day"
        >[])
          sum[field] = Number((sum[field] + row[field]).toFixed(2));
        return sum;
      },
      {
        day: "Total",
        cash: 0,
        card: 0,
        transfer: 0,
        pendingTransfer: 0,
        creditGenerated: 0,
        collectionCash: 0,
        collectionCard: 0,
        collectionTransfer: 0,
        returns: 0,
        moneyIn: 0,
        sold: 0,
      },
    );
    if (!query.format) {
      const page = Math.max(
        1,
        Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1),
      );
      const total = query.day
        ? await this.countDetail(actor, opt, query.day)
        : 0;
      const details = query.day
        ? await this.detail(actor, opt, (page - 1) * 100, 100, query.day)
        : [];
      const reconciliation = await this.reconciliation(actor, opt, rows);
      return res.json({
        rows,
        totals,
        reconciliation,
        detail: details.map((e) => ({ ...e, amount: Number(e.amount) })),
        detailTotal: total,
        page,
      });
    }
    if (!["csv", "xlsx", "pdf"].includes(query.format))
      bad("Formato de exportación inválido.");
    const total = await this.countDetail(actor, opt);
    if (total > 50000)
      bad("El detalle supera 50,000 movimientos; divide el período.");
    const name = `ingresos-${opt.from}-${opt.to}.${query.format}`;
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    if (query.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.write("\uFEFF");
      res.write(csvLine([...labels, "Fecha local"]));
      for (const row of rows)
        res.write(
          csvLine([
            ...fields.map((f, i) => (i === 0 ? row.day : amount(row[f]))),
            localDate(row.day),
          ]),
        );
      res.write("\r\n");
      res.write(
        csvLine([
          "Fecha ISO",
          "Fecha local",
          "Hora RD",
          "Documento",
          "Tipo",
          "Método",
          "Importe",
          "Caja",
          "Últimos 4",
          "Aprobación",
          "Banco",
          "Referencia",
        ]),
      );
      for await (const e of this.exportDetail(actor, opt, total)) {
        if (
          !res.write(
            csvLine([
              e.day,
              localDate(e.day),
              e.date.toLocaleTimeString("es-DO", {
                timeZone: "America/Santo_Domingo",
              }),
              e.number,
              e.kind,
              e.method,
              amount(e.amount),
              e.cashSessionId,
              e.cardLast4,
              e.approvalCode,
              e.bank,
              e.reference,
            ]),
          )
        )
          await once(res, "drain");
      }
      res.end();
      return;
    }
    if (query.format === "xlsx") {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      const book = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const sheet = book.addWorksheet("Resumen por día");
      sheet.addRow([...labels, "Fecha local"]).commit();
      for (const row of rows)
        sheet
          .addRow([
            ...fields.map((f, i) => (i === 0 ? row.day : row[f])),
            localDate(row.day),
          ])
          .commit();
      sheet.commit();
      const detail = book.addWorksheet("Detalle de movimientos");
      detail
        .addRow([
          "Fecha ISO",
          "Fecha local",
          "Hora RD",
          "Documento",
          "Tipo",
          "Método",
          "Importe",
          "Caja",
          "Últimos 4",
          "Aprobación",
          "Banco",
          "Referencia",
        ])
        .commit();
      for await (const e of this.exportDetail(actor, opt, total)) {
        detail
          .addRow([
            e.day,
            localDate(e.day),
            e.date.toLocaleTimeString("es-DO", {
              timeZone: "America/Santo_Domingo",
            }),
            e.number,
            e.kind,
            e.method,
            Number(e.amount),
            e.cashSessionId,
            e.cardLast4,
            e.approvalCode,
            e.bank,
            e.reference,
          ])
          .commit();
      }
      detail.commit();
      await book.commit();
      return;
    }
    if (total > 10000)
      bad("El PDF supera 10,000 movimientos; divide el período.");
    const settings = await this.db.settings.findUnique({
      where: tenantUnique("id", actor.branchId),
      select: { data: true },
    });
    const businessName = String((settings?.data as any)?.name || "Norexos");
    res.setHeader("Content-Type", "application/pdf");
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
    });
    doc.pipe(res);
    doc.fontSize(16).text(`${businessName} · Ingresos por día y forma de pago`);
    doc
      .fontSize(9)
      .text(
        `${opt.from} a ${opt.to} · Fecha de emisión ${new Date().toLocaleDateString("es-DO")}`,
      )
      .moveDown();
    for (const row of rows) {
      if (doc.y > 520) doc.addPage();
      doc
        .font("Helvetica-Bold")
        .text(
          `${localDate(row.day)} · Vendido ${amount(row.sold)} · Ingresó ${amount(row.moneyIn)}`,
        );
      doc
        .font("Helvetica")
        .text(
          `Venta: efectivo ${amount(row.cash)} · tarjeta ${amount(row.card)} · transferencia ${amount(row.transfer)} · transferencia por verificar ${amount(row.pendingTransfer)} · crédito ${amount(row.creditGenerated)}`,
        );
      doc
        .text(
          `Cobros de crédito: efectivo ${amount(row.collectionCash)} · tarjeta ${amount(row.collectionCard)} · transferencia ${amount(row.collectionTransfer)} · devoluciones ${amount(row.returns)}`,
        )
        .moveDown(0.5);
    }
    doc.addPage().fontSize(12).text("Detalle de movimientos").moveDown();
    doc.fontSize(8);
    for await (const event of this.exportDetail(actor, opt, total)) {
      if (doc.y > 520) doc.addPage();
      doc.text(
        `${event.day} ${event.date.toLocaleTimeString("es-DO", { timeZone: "America/Santo_Domingo" })} · ${event.number ?? ""} · ${event.kind} · ${amount(event.amount)} · ${event.bank ?? ""} ${event.reference ?? ""}`,
      );
    }
    doc.fontSize(8).text("Documento interno, sin valor fiscal");
    doc.end();
  }
}

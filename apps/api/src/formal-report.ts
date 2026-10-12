import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import { can, formatMoney } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  bad,
  canViewCashExpected,
  denied,
} from "./common";
import { cashExpectedMany } from "./cash";
import { incomeOptions, incomeSummary } from "./income-report";
import { formalPeriod, reportMargin, isTestRegister } from "./formal-period";

type FormalInput = { period?: string; date?: string; format?: string };
const testStarts = ["qa-", "qa_", "test-", "test_", "prueba-", "prueba_"];
const testSessionWhere: Prisma.CashSessionWhereInput = {
  OR: testStarts.map((prefix) => ({
    registerId: { startsWith: prefix, mode: "insensitive" },
  })),
};
const realSaleWhere: Prisma.SaleWhereInput = {
  OR: [
    { cashSessionId: null },
    { cashSession: { is: { NOT: testSessionWhere } } },
  ],
};
const utc = (date: Date) =>
  Prisma.sql`(${date}::timestamptz AT TIME ZONE 'UTC')`;
const real = Prisma.sql`COALESCE(cs."registerId",'') !~* '^(qa|test|prueba)[-_]'`;
const num = (v: unknown) => Number(v ?? 0);
const capped = 500;
const money2 = (value: unknown) => formatMoney(num(value));

@Controller()
export class FormalReportController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("reports/formal")
  @Permit("reports:read")
  async get(
    @CurrentUser() actor: Actor,
    @Query() query: FormalInput,
    @Res() res: Response,
  ) {
    if (!can(actor.permissions, "profit:read") || !canViewCashExpected(actor))
      denied();
    res.setHeader("Cache-Control", "private, no-store");
    let period: ReturnType<typeof formalPeriod>;
    try {
      period = formalPeriod(query.period ?? "", query.date ?? "");
    } catch (error) {
      bad((error as Error).message);
    }
    const opt = {
      ...incomeOptions({ from: period.from, to: period.to }),
      excludeTest: true,
    };
    const range = { gte: opt.start, lte: opt.end };
    const [
      daily,
      salesAmounts,
      returnsAmounts,
      sellerRows,
      categoryRows,
      productRows,
    ] = await Promise.all([
      incomeSummary(this.db, actor, opt),
      this.db.$queryRaw<
        {
          sold: unknown;
          cost: unknown;
          tax: unknown;
          discount: unknown;
          count: bigint;
        }[]
      >(Prisma.sql`
        SELECT COALESCE(SUM(s.total),0) sold,COALESCE(SUM(s."costTotal"),0) cost,
          COALESCE(SUM(s."taxTotal"),0) tax,COALESCE(SUM(s."discountTotal"),0) discount,COUNT(*)::bigint count
        FROM "Sale" s LEFT JOIN "CashSession" cs ON cs.id=s."cashSessionId"
        WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND ${real}
          AND s."createdAt">=${utc(opt.start)} AND s."createdAt"<=${utc(opt.end)}`),
      this.db.$queryRaw<
        { total: unknown; cost: unknown; tax: unknown; count: bigint }[]
      >(Prisma.sql`
        SELECT COALESCE(SUM(r.total),0) total,COALESCE(SUM(r."costTotal"),0) cost,
          COALESCE(SUM(r."taxTotal"),0) tax,COUNT(*)::bigint count
        FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId"
          LEFT JOIN "CashSession" cs ON cs.id=COALESCE(r."cashSessionId",s."cashSessionId")
        WHERE r."branchId"=${actor.branchId} AND s.status='completed' AND ${real}
          AND r."createdAt">=${utc(opt.start)} AND r."createdAt"<=${utc(opt.end)}`),
      this.db.$queryRaw<
        { userId: string; sold: unknown; count: bigint }[]
      >(Prisma.sql`
        SELECT s."sellerId"::text AS "userId",SUM(s.total) sold,COUNT(*)::bigint count
        FROM "Sale" s LEFT JOIN "CashSession" cs ON cs.id=s."cashSessionId"
        WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND ${real}
          AND s."createdAt">=${utc(opt.start)} AND s."createdAt"<=${utc(opt.end)}
        GROUP BY s."sellerId" ORDER BY SUM(s.total) DESC LIMIT 500`),
      this.db.$queryRaw<
        { categoryId: string; sold: unknown; soldProducts: bigint }[]
      >(Prisma.sql`
        SELECT c.id::text AS "categoryId",COALESCE(SUM(i."lineTotal"),0) sold,
          COUNT(DISTINCT p.id)::bigint AS "soldProducts"
        FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId"
          JOIN "Variant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId"
          JOIN "Category" c ON c.id=p."categoryId"
          LEFT JOIN "CashSession" cs ON cs.id=s."cashSessionId"
        WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND ${real}
          AND p.active=true AND s."createdAt">=${utc(opt.start)} AND s."createdAt"<=${utc(opt.end)}
        GROUP BY c.id ORDER BY sold DESC`),
      this.db.$queryRaw<
        { categoryId: string; name: string; products: bigint }[]
      >(Prisma.sql`
        SELECT c.id::text AS "categoryId",c.name,COUNT(p.id)::bigint products
        FROM "Category" c LEFT JOIN "Product" p ON p."categoryId"=c.id AND p.active=true AND p."branchId"=${actor.branchId}
        WHERE c."branchId"=${actor.branchId} GROUP BY c.id,c.name ORDER BY c.name`),
    ]);
    const sales = salesAmounts[0],
      returned = returnsAmounts[0];
    const sold = num(sales?.sold) - num(returned?.total);
    const cost = num(sales?.cost) - num(returned?.cost);
    const moneyIn = daily.reduce((sum, row) => sum + row.moneyIn, 0);
    const cashIn = daily.reduce(
      (sum, row) => sum + row.cash + row.collectionCash,
      0,
    );
    const bankIn = daily.reduce(
      (sum, row) =>
        sum +
        row.card +
        row.transfer +
        row.collectionCard +
        row.collectionTransfer,
      0,
    );
    const [
      cashSessions,
      openCredits,
      openCreditTotals,
      closedCredits,
      closedCreditCount,
      voids,
      costChanges,
      discounts,
      users,
      settings,
    ] = await Promise.all([
      this.db.cashSession.findMany({
        where: {
          branchId: actor.branchId,
          OR: [{ openedAt: range }, { closedAt: range }],
          NOT: testSessionWhere,
        },
        orderBy: { openedAt: "asc" },
        take: 1001,
      }),
      this.db.sale.findMany({
        where: {
          ...realSaleWhere,
          branchId: actor.branchId,
          status: "completed",
          creditBalance: { gt: 0 },
          payments: {
            some: { entryType: "sale", method: { in: ["cod", "credit"] } },
          },
        },
        select: {
          id: true,
          number: true,
          customerId: true,
          createdAt: true,
          creditBalance: true,
        },
        orderBy: { createdAt: "asc" },
        take: capped + 1,
      }),
      this.db.sale.aggregate({
        where: {
          ...realSaleWhere,
          branchId: actor.branchId,
          status: "completed",
          creditBalance: { gt: 0 },
          payments: {
            some: { entryType: "sale", method: { in: ["cod", "credit"] } },
          },
        },
        _sum: { creditBalance: true },
        _count: { id: true },
      }),
      this.db.sale.findMany({
        where: {
          ...realSaleWhere,
          branchId: actor.branchId,
          status: "completed",
          creditClosedAt: range,
        },
        select: {
          id: true,
          number: true,
          customerId: true,
          createdAt: true,
          creditBalance: true,
          creditClosedAt: true,
        },
        orderBy: { creditClosedAt: "desc" },
        take: capped + 1,
      }),
      this.db.sale.count({
        where: {
          ...realSaleWhere,
          branchId: actor.branchId,
          status: "completed",
          creditClosedAt: range,
        },
      }),
      this.db.sale.findMany({
        where: {
          ...realSaleWhere,
          branchId: actor.branchId,
          status: "voided",
          updatedAt: range,
        },
        select: {
          number: true,
          voidedReason: true,
          total: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: capped + 1,
      }),
      this.db.auditLog.findMany({
        where: {
          branchId: actor.branchId,
          action: "cost_change",
          createdAt: range,
        },
        select: {
          createdAt: true,
          entityId: true,
          userId: true,
          before: true,
          after: true,
        },
        orderBy: { createdAt: "desc" },
        take: capped + 1,
      }),
      this.db.sale.findMany({
        where: {
          ...realSaleWhere,
          branchId: actor.branchId,
          status: "completed",
          createdAt: range,
          discountTotal: { gt: 0 },
        },
        select: { number: true, discountTotal: true, discountReason: true },
        orderBy: { discountTotal: "desc" },
        take: capped + 1,
      }),
      this.db.user.findMany({
        where: { branchId: actor.branchId },
        select: { id: true, name: true },
      }),
      this.db.settings.findUnique({ where: { id: actor.branchId } }),
    ]);
    const person = new Map(users.map((u) => [u.id, u.name]));
    const sessions = cashSessions.filter((s) => !isTestRegister(s.registerId));
    const expected = await cashExpectedMany(this.db, sessions.slice(0, capped));
    const cash = sessions.slice(0, capped).map((s) => {
      const e = expected.get(s.id);
      return {
        id: s.id,
        register: s.registerId,
        user: person.get(s.userId) ?? s.userId,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        expectedCash: e?.cash ?? 0,
        countedCash: s.countedCash === null ? null : num(s.countedCash),
        differenceCash:
          s.differenceCash === null ? null : num(s.differenceCash),
        expectedCard: e?.card ?? 0,
        countedCard: s.countedCard === null ? null : num(s.countedCard),
        differenceCard:
          s.differenceCard === null ? null : num(s.differenceCard),
        expectedTransfer: e?.transfer ?? 0,
        countedTransfer:
          s.countedTransfer === null ? null : num(s.countedTransfer),
        differenceTransfer:
          s.differenceTransfer === null ? null : num(s.differenceTransfer),
      };
    });
    const sessionMoney = sessions.slice(0, capped).reduce((sum, s) => {
      const e = expected.get(s.id);
      if (!e) return sum;
      const movementNet = e.movements.reduce(
        (subtotal: number, m: { type: string; amount: unknown }) =>
          subtotal + (m.type === "in" ? 1 : -1) * num(m.amount),
        0,
      );
      return (
        sum +
        num(e.cash) -
        num(s.openingAmount) -
        movementNet +
        num(e.card) +
        num(e.transfer)
      );
    }, 0);
    const cashReconciliation = {
      moneyIn: Number(moneyIn.toFixed(2)),
      sessionMoney: Number(sessionMoney.toFixed(2)),
      difference: Number((moneyIn - sessionMoney).toFixed(2)),
      comparable:
        sessions.length <= capped &&
        sessions.every(
          (s) => s.closedAt && s.openedAt >= opt.start && s.closedAt <= opt.end,
        ),
      note: "La comparación de caja excluye fondo inicial y movimientos manuales. Pagos sin caja, turnos abiertos o turnos que cruzan el período pueden causar diferencia.",
    };
    const customerIds = [
      ...new Set(
        [...openCredits, ...closedCredits].flatMap((s) =>
          s.customerId ? [s.customerId] : [],
        ),
      ),
    ];
    const customers = await this.db.customer.findMany({
      where: { id: { in: customerIds }, branchId: actor.branchId },
      select: { id: true, name: true },
    });
    const customer = new Map(customers.map((c) => [c.id, c.name]));
    const open = openCredits.slice(0, capped).map((s) => ({
      number: s.number,
      customer: customer.get(s.customerId ?? "") ?? "Sin cliente",
      balance: num(s.creditBalance),
      ageDays: Math.max(
        0,
        Math.floor((Date.now() - s.createdAt.getTime()) / 86400000),
      ),
    }));
    const closed = closedCredits.slice(0, capped).map((s) => ({
      number: s.number,
      customer: customer.get(s.customerId ?? "") ?? "Sin cliente",
      closedAt: s.creditClosedAt,
    }));
    const categories = productRows.map((p) => {
      const sold = categoryRows.find((c) => c.categoryId === p.categoryId);
      return {
        name: p.name,
        sold: num(sold?.sold),
        soldProducts: Number(sold?.soldProducts ?? 0),
        notSoldProducts: Math.max(
          0,
          Number(p.products) - Number(sold?.soldProducts ?? 0),
        ),
      };
    });
    const rotationStart = new Date(opt.end.getTime() - 60 * 86400000);
    const rotationRows =
      period.to >= "2026-10-27"
        ? await this.db.$queryRaw<
            {
              sku: string;
              product: string;
              stock: unknown;
              sold: unknown;
            }[]
          >(Prisma.sql`
      SELECT v.sku,p.name AS product,v.stock,COALESCE(m.sold,0) AS sold
      FROM "Variant" v JOIN "Product" p ON p.id=v."productId"
      LEFT JOIN (
        SELECT i."variantId",SUM(i.qty) sold FROM "SaleItem" i
        JOIN "Sale" s ON s.id=i."saleId"
        LEFT JOIN "CashSession" cs ON cs.id=s."cashSessionId"
        WHERE s."branchId"=${actor.branchId} AND s.status='completed' AND ${real}
          AND s."createdAt">=${utc(rotationStart)} AND s."createdAt"<=${utc(opt.end)}
        GROUP BY i."variantId"
      ) m ON m."variantId"=v.id
      WHERE v."branchId"=${actor.branchId} AND v.active=true AND p.active=true AND v.stock>0
      ORDER BY COALESCE(m.sold,0) ASC,v.stock DESC LIMIT 201`)
        : [];
    const rotation = rotationRows.slice(0, 200).map((row) => {
      const perMonth = num(row.sold) / 2;
      return {
        sku: row.sku,
        product: row.product,
        storeStock: num(row.stock),
        sold60Days: num(row.sold),
        suggestedMin: Math.ceil(perMonth * 1000) / 1000,
        suggestedMax: Math.ceil(perMonth * 2000) / 1000,
      };
    });
    const findings: string[] = [];
    if (cashReconciliation.difference !== 0)
      findings.push(
        `Dinero ingresado menos suma de cajas: ${money2(cashReconciliation.difference)}. ${cashReconciliation.note}`,
      );
    for (const s of cash.filter((c) =>
      [c.differenceCash, c.differenceCard, c.differenceTransfer].some(
        (v) => v !== null && v !== 0,
      ),
    ))
      findings.push(
        `${s.register}: diferencias de cierre E ${money2(s.differenceCash)} / T ${money2(s.differenceCard)} / Tr ${money2(s.differenceTransfer)}.`,
      );
    if (voids.length)
      findings.push(
        `${voids.length}${voids.length > capped ? " o más" : ""} ventas anuladas en el período; motivos en la sección de anulaciones.`,
      );
    if (discounts.length)
      findings.push(
        `${discounts.length}${discounts.length > capped ? " o más" : ""} ventas con descuento; revisar motivo y autorización.`,
      );
    if (costChanges.length)
      findings.push(
        `${costChanges.length}${costChanges.length > capped ? " o más" : ""} cambios manuales de costo; revisar la bitácora.`,
      );
    if (
      sold > 0 &&
      reportMargin(sold, cost) <
        Number((settings?.data as any)?.lowMargin ?? 15)
    )
      findings.push(
        `Margen global ${reportMargin(sold, cost)} % por debajo del margen bajo configurado.`,
      );
    const report = {
      title: `Informe formal · ${period.label}`,
      business: {
        name: (settings?.data as any)?.name || "Grupo Macgen",
        branch: (settings?.data as any)?.branchName || "",
      },
      from: period.from,
      to: period.to,
      issuedAt: new Date(),
      daily,
      totals: {
        sold,
        cost,
        margin: reportMargin(sold, cost),
        tax: num(sales?.tax) - num(returned?.tax),
        discounts: num(sales?.discount),
        sales: Number(sales?.count ?? 0),
        returns: Number(returned?.count ?? 0),
        moneyIn,
        cashIn,
        bankIn,
        creditGenerated: daily.reduce((sum, r) => sum + r.creditGenerated, 0),
      },
      cash,
      cashReconciliation,
      findings,
      users: sellerRows.map((r) => ({
        name: person.get(r.userId) ?? r.userId,
        sold: num(r.sold),
        sales: Number(r.count),
      })),
      categories,
      rotation,
      credits: {
        open,
        closed,
        openTotal: num(openCreditTotals._sum.creditBalance),
        openCount: openCreditTotals._count.id,
        closedCount: closedCreditCount,
      },
      voids: voids.slice(0, capped),
      discounts: discounts.slice(0, capped),
      costChanges: costChanges.slice(0, capped).map((c) => ({
        at: c.createdAt,
        variantId: c.entityId,
        user: person.get(c.userId) ?? c.userId,
        before: c.before,
        after: c.after,
      })),
      excludedTestSessions: "QA-, TEST- y PRUEBA-",
      truncated: {
        cash: sessions.length > capped,
        open: openCredits.length > capped,
        closed: closedCredits.length > capped,
        voids: voids.length > capped,
        discounts: discounts.length > capped,
        costChanges: costChanges.length > capped,
        rotation: rotationRows.length > 200,
      },
      note: "Saldo de créditos abiertos al momento de emitir; no reconstruye el saldo histórico. Cajas de prueba identificadas con QA-, TEST- o PRUEBA- excluidas. La rotación es una propuesta basada en ventas brutas de 60 días y stock vendible de Tienda; no cambia precios ni inventario.",
    };
    if (!query.format || query.format === "json") return res.json(report);
    if (query.format !== "pdf") bad("El informe formal se descarga en PDF.");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="informe-${query.period}-${query.date}.pdf"`,
    );
    renderFormalPdf(res, report);
  }
}

export function renderFormalPdf(res: NodeJS.WritableStream, report: any) {
  const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
  doc.pipe(res);
  const fmt = (v: unknown) => money2(v);
  const when = (v: unknown) =>
    v
      ? new Date(String(v)).toLocaleString("es-DO", {
          timeZone: "America/Santo_Domingo",
        })
      : "Abierta";
  const header = () => {
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Grupo Macgen", { align: "center" });
    if (report.business.name !== "Grupo Macgen")
      doc
        .font("Helvetica")
        .fontSize(9)
        .text(report.business.name, { align: "center" });
    if (report.business.branch)
      doc.fontSize(9).text(report.business.branch, { align: "center" });
    doc.font("Helvetica").fontSize(9).text(report.title, { align: "center" });
    doc.text(
      `Período: ${report.from} a ${report.to} · Emitido: ${when(report.issuedAt)}`,
      { align: "center" },
    );
    doc.moveDown();
  };
  doc.on("pageAdded", header);
  header();
  const line = (value: string, bold = false) => {
    if (doc.y > 735) doc.addPage();
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .text(value, { width: 510 });
  };
  const section = (title: string) => {
    if (doc.y > 690) doc.addPage();
    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(11).text(title);
    doc.moveDown(0.25);
  };
  section("Resumen de ventas e ingresos");
  line(
    `Vendido neto: ${fmt(report.totals.sold)} · Dinero ingresado: ${fmt(report.totals.moneyIn)} · Crédito generado: ${fmt(report.totals.creditGenerated)}`,
    true,
  );
  line(
    `Costo: ${fmt(report.totals.cost)} · Margen: ${report.totals.margin} % (precio menos costo / precio; ITBIS no descontado) · ITBIS informativo: ${fmt(report.totals.tax)}`,
  );
  line(
    `Banco esperado por pagos: ${fmt(report.totals.bankIn)} · Efectivo ingresado para caja: ${fmt(report.totals.cashIn)} · Devoluciones: ${report.totals.returns} · Descuentos: ${fmt(report.totals.discounts)}`,
  );
  section("Por día y forma de pago");
  for (const row of report.daily) {
    line(
      `${row.day} · Vendido ${fmt(row.sold)} · Entró ${fmt(row.moneyIn)} · Crédito ${fmt(row.creditGenerated)}`,
      true,
    );
    line(
      `  Ventas: efectivo ${fmt(row.cash)}, tarjeta ${fmt(row.card)}, transferencia ${fmt(row.transfer)}. Cobros previos: efectivo ${fmt(row.collectionCash)}, tarjeta ${fmt(row.collectionCard)}, transferencia ${fmt(row.collectionTransfer)}. Devoluciones ${fmt(row.returns)}.`,
    );
  }
  section("Cajas y arqueo");
  line(
    `Ingresó ${fmt(report.cashReconciliation.moneyIn)} · Según cajas ${fmt(report.cashReconciliation.sessionMoney)} · Diferencia ${fmt(report.cashReconciliation.difference)}`,
    true,
  );
  if (!report.cashReconciliation.comparable)
    line(
      "Comparación parcial: existen turnos abiertos, turnos cruzados o más de 500 cajas.",
    );
  if (!report.cash.length) line("Sin cajas reales en este período.");
  for (const c of report.cash) {
    line(
      `${c.register} · ${c.user} · ${when(c.openedAt)} → ${when(c.closedAt)}`,
      true,
    );
    // Filas separadas para que los encabezados no se monten en papel.
    line(
      `  Efectivo esperado: ${fmt(c.expectedCash)} · Efectivo contado: ${c.countedCash === null ? "Sin cierre" : fmt(c.countedCash)} · Diferencia: ${c.differenceCash === null ? "—" : fmt(c.differenceCash)}`,
    );
    line(
      `  Tarjeta esperada: ${fmt(c.expectedCard)} · Tarjeta contada: ${c.countedCard === null ? "Sin cierre" : fmt(c.countedCard)} · Diferencia: ${c.differenceCard === null ? "—" : fmt(c.differenceCard)}`,
    );
    line(
      `  Transferencia esperada: ${fmt(c.expectedTransfer)} · Transferencia contada: ${c.countedTransfer === null ? "Sin cierre" : fmt(c.countedTransfer)} · Diferencia: ${c.differenceTransfer === null ? "—" : fmt(c.differenceTransfer)}`,
    );
  }
  section("Por usuario");
  for (const u of report.users)
    line(`${u.name} · ${u.sales} ventas · ${fmt(u.sold)}`);
  section("Por categoría: vendidos y sin vender");
  for (const c of report.categories)
    line(
      `${c.name} · ${c.soldProducts} productos vendidos · ${c.notSoldProducts} sin vender · ${fmt(c.sold)}`,
    );
  if (report.rotation.length) {
    section("Rotación de 60 días · propuesta de stock para 1–2 meses");
    for (const item of report.rotation)
      line(
        `${item.product} · ${item.sku} · Tienda ${item.storeStock} · Vendidas ${item.sold60Days} · Propuesta ${item.suggestedMin} a ${item.suggestedMax}`,
      );
  }
  section("Créditos abiertos (saldo actual)");
  line(
    `${report.credits.openCount} créditos abiertos · Saldo total ${fmt(report.credits.openTotal)}`,
    true,
  );
  for (const c of report.credits.open)
    line(
      `${c.customer} · ${c.number} · Debe ${fmt(c.balance)} · ${c.ageDays} días`,
    );
  section("Créditos cerrados en el período");
  line(`${report.credits.closedCount} créditos cerrados en el período`, true);
  for (const c of report.credits.closed)
    line(`${c.customer} · ${c.number} · Cerrado ${when(c.closedAt)}`);
  section("Ventas anuladas");
  for (const v of report.voids)
    line(
      `${v.number} · ${fmt(v.total)} · ${v.voidedReason ?? "Sin motivo registrado"}`,
    );
  section("Descuentos");
  for (const d of report.discounts)
    line(
      `${d.number} · ${fmt(d.discountTotal)} · ${d.discountReason ?? "Sin motivo registrado"}`,
    );
  section("Cambios de costo");
  for (const c of report.costChanges)
    line(
      `${when(c.at)} · ${c.variantId} · ${c.user} · ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`,
    );
  if (report.findings.length) {
    section("Señales para revisar");
    for (const item of report.findings) line(item);
  }
  section("Notas de control");
  line(report.note);
  if (Object.values(report.truncated).some(Boolean))
    line(
      "Alguna sección supera 500 filas y está resumida: consulta el sistema para el historial completo.",
      true,
    );
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Grupo Macgen · Control interno · Página ${i - pages.start + 1} de ${pages.count}`,
        42,
        780,
        { width: 510, align: "center" },
      );
  }
  doc.end();
}

import {
  BUSINESS_TIME_ZONE,
  courierCharge,
  paymentReceiptLine,
  privacyNoticeText,
  returnPolicyText,
} from "@fitstore/shared";

const PAGE_MARGIN = 42;
const FOOTER_RESERVE = 34;
const INK = "#172033";
const MUTED = "#536174";
const BORDER = "#d8dee8";
const BAND = "#f1f5f9";
const BLUE = "#173b75";

type ReceiptValue = number | string | { toString(): string } | null | undefined;

export type SaleReceiptInput = {
  sale: any;
  business?: any;
  customer?: any;
  seller?: any;
};

const cleanText = (value: unknown, max = 4000) =>
  String(value ?? "")
    // Strip PDF control characters before writing user-controlled text.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const amount = (value: ReceiptValue) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function formatReceiptMoney(value: ReceiptValue) {
  return (
    "RD$ " +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount(value))
  );
}

export function formatReceiptQuantity(value: ReceiptValue) {
  const n = amount(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("es-DO", {
        maximumFractionDigits: 3,
      }).format(n)
    : "0";
}

const masked = (value: unknown) => {
  const source = cleanText(value, 120).replace(/[\s\-().]/g, "");
  if (!source) return "";
  const tail = source.slice(-3);
  return "•••••••" + tail;
};

function safeDate(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("es-DO", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const methodNames: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Crédito",
};

function methodName(value: unknown) {
  const key = cleanText(value, 24).toLowerCase();
  return methodNames[key] ?? "Otro medio de pago";
}

function moneyPayments(sale: any) {
  return (Array.isArray(sale?.payments) ? sale.payments : []).filter(
    (payment: any) =>
      (payment?.entryType ?? "sale") === "sale" &&
      (payment?.status ?? "ok") === "ok" &&
      String(payment?.method ?? "").toLowerCase() !== "cod",
  );
}

const lineSum = (items: any[], key: string) =>
  items.reduce((sum, item) => sum + amount(item?.[key]), 0);

function drawText(
  doc: PDFKit.PDFDocument,
  value: unknown,
  x: number,
  y: number,
  width: number,
  options: Record<string, unknown> = {},
) {
  const text = cleanText(value);
  if (!text) return y;
  const { color, font, fontSize, ...textOptions } = options as any;
  if (font) doc.font(font);
  if (fontSize) doc.fontSize(fontSize);
  if (color) doc.fillColor(color);
  doc.text(text, x, y, { width, ...textOptions } as any);
  const height = doc.heightOfString(text, { width, ...textOptions } as any);
  if (color) doc.fillColor(INK);
  return y + height;
}

function logoBuffer(value: unknown): Buffer | null {
  if (typeof value !== "string" || value.length > 300_000) return null;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  try {
    const data = Buffer.from(match[2], "base64");
    return data.length > 0 && data.length <= 200 * 1024 ? data : null;
  } catch {
    return null;
  }
}

function drawLogo(doc: PDFKit.PDFDocument, business: any, top: number) {
  const image = logoBuffer(business?.logo);
  if (!image) return 0;
  try {
    doc.image(image, PAGE_MARGIN, top, { fit: [68, 48], align: "center" });
    return 82;
  } catch {
    return 0;
  }
}

/** Renderiza un recibo de cliente con PDFKit, preservando los importes persistidos. */
export function drawSaleReceipt(
  doc: PDFKit.PDFDocument,
  input: SaleReceiptInput,
) {
  const { sale, customer, seller } = input;
  const business = input.business ?? {};
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const width = right - left;
  const bodyBottom = doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
  let y = 0;

  const header = (continuation = false) => {
    const top = PAGE_MARGIN;
    const logoWidth = drawLogo(doc, business, top);
    const textX = left + logoWidth;
    const textWidth = width - logoWidth;
    let cursor = top;
    const businessName = cleanText(business?.name) || "Nexora POS";
    cursor = drawText(doc, businessName, textX, cursor, textWidth, {
      font: "Helvetica-Bold",
      fontSize: 16,
      color: INK,
      align: logoWidth ? "left" : "center",
    });
    for (const value of [business?.branchName, business?.address])
      cursor = drawText(doc, value, textX, cursor + 2, textWidth, {
        font: "Helvetica",
        fontSize: 9,
        color: MUTED,
        align: logoWidth ? "left" : "center",
      });
    if (business?.phone)
      cursor = drawText(
        doc,
        "Tel.: " + cleanText(business.phone, 100),
        textX,
        cursor + 2,
        textWidth,
        {
          font: "Helvetica",
          fontSize: 9,
          color: MUTED,
          align: logoWidth ? "left" : "center",
        },
      );
    cursor += 7;
    doc
      .moveTo(left, cursor)
      .lineTo(right, cursor)
      .lineWidth(1)
      .strokeColor(BORDER)
      .stroke();
    cursor += 12;
    const credit = amount(sale?.creditBalance) > 0;
    cursor = drawText(
      doc,
      continuation
        ? `${credit ? "Venta a crédito" : "Recibo de venta"} · continuación`
        : credit
          ? "Venta a crédito"
          : "Recibo de venta",
      left,
      cursor,
      width,
      { font: "Helvetica-Bold", fontSize: 16, color: BLUE },
    );
    cursor = drawText(
      doc,
      cleanText(sale?.number, 80),
      left,
      cursor + 2,
      width,
      {
        font: "Helvetica-Bold",
        fontSize: 11,
        color: INK,
      },
    );
    if (sale?.ncfType)
      cursor = drawText(
        doc,
        // Con ncfMode «sequences» la venta ya trae su NCF asignado.
        sale.ncf
          ? `NCF: ${cleanText(sale.ncf, 20)}`
          : `Solicitud NCF: ${cleanText(sale.ncfType, 20)} · pendiente de emisión fiscal`,
        left,
        cursor + 2,
        width,
        { font: "Helvetica", fontSize: 9, color: MUTED },
      );
    const date = safeDate(sale?.createdAt);
    if (date)
      cursor = drawText(doc, "Fecha: " + date, left, cursor + 2, width, {
        font: "Helvetica",
        fontSize: 10,
        color: INK,
      });
    const sellerName = cleanText(seller?.name, 160);
    if (sellerName)
      cursor = drawText(
        doc,
        "Vendedor: " + sellerName,
        left,
        cursor + 2,
        width,
        {
          font: "Helvetica",
          fontSize: 10,
          color: INK,
        },
      );
    const customerName = cleanText(customer?.name, 180) || "Consumidor final";
    if (customerName)
      cursor = drawText(
        doc,
        "Vendido a: " + customerName,
        left,
        cursor + 2,
        width,
        {
          font: "Helvetica",
          fontSize: 10,
          color: INK,
        },
      );
    const phone = masked(customer?.phone);
    const legalId = masked(customer?.legalId);
    if (phone || legalId)
      cursor = drawText(
        doc,
        [phone && "Tel. " + phone, legalId && "RNC/Cédula " + legalId]
          .filter(Boolean)
          .join(" · "),
        left,
        cursor + 2,
        width,
        { font: "Helvetica", fontSize: 9, color: MUTED },
      );
    y = cursor + 12;
  };

  const newPage = () => {
    doc.addPage({ size: "A4", margin: PAGE_MARGIN });
    header(true);
  };

  header();
  if (sale?.status === "voided") {
    const reason = cleanText(sale?.voidedReason, 1000);
    const label = "ANULADA" + (reason ? " · " + reason : "");
    const h =
      doc.heightOfString(label, { width: width - 20, fontSize: 11 } as any) +
      16;
    if (y + h > bodyBottom) newPage();
    doc.roundedRect(left, y, width, h, 4).fillAndStroke("#fff1f0", "#b42318");
    doc.fillColor("#8a1c13").font("Helvetica-Bold").fontSize(11);
    doc.text(label || "ANULADA", left + 10, y + 8, { width: width - 20 });
    doc.fillColor(INK);
    y += h + 10;
  }

  const items = Array.isArray(sale?.items) ? sale.items : [];
  const columns = [
    { key: "description", label: "Producto", width: 145, align: "left" },
    { key: "qty", label: "Cant.", width: 45, align: "right" },
    { key: "unit", label: "Precio unit.", width: 90, align: "right" },
    { key: "discount", label: "Descuento", width: 80, align: "right" },
    { key: "total", label: "Total", width: width - 360, align: "right" },
  ];
  const tableX = left;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const drawTableHeader = () => {
    const h = 22;
    doc.roundedRect(tableX, y, tableWidth, h, 3).fill(BAND);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK);
    let x = tableX;
    for (const column of columns) {
      doc.text(column.label, x + 4, y + 6, {
        width: column.width - 8,
        align: column.align as any,
        lineBreak: false,
      });
      x += column.width;
    }
    y += h + 4;
    doc.font("Helvetica").fontSize(10).fillColor(INK);
  };
  drawTableHeader();

  items.forEach((item: any, index: number) => {
    const productName =
      cleanText(item?.variant?.product?.name, 360) || "Artículo";
    const promotion = cleanText(item?.promotionName, 100);
    const description = promotion
      ? `${productName}\nPromoción: ${promotion}`
      : productName;
    const values = [
      description,
      formatReceiptQuantity(item?.qty),
      formatReceiptMoney(item?.unitPrice),
      formatReceiptMoney(item?.discount),
      formatReceiptMoney(item?.lineTotal),
    ];
    // Medir cada celda evita que un importe/cantidad largo invada la fila
    // siguiente. Los importes normales caben en las columnas financieras a 9 pt.
    const cellHeights = values.map((value, columnIndex) =>
      doc.heightOfString(value, {
        width: columns[columnIndex].width - 8,
        font: "Helvetica",
        fontSize: 10,
        lineGap: 1,
      } as any),
    );
    const rowHeight = Math.max(19, ...cellHeights) + 8;
    if (y + rowHeight > bodyBottom) {
      newPage();
      drawTableHeader();
    }
    if (index % 2 === 1)
      doc.rect(tableX, y, tableWidth, rowHeight).fill("#f8fafc");
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    let x = tableX;
    columns.forEach((column, columnIndex) => {
      doc.text(values[columnIndex], x + 4, y + 4, {
        width: column.width - 8,
        align: column.align as any,
        lineGap: 1,
      });
      x += column.width;
    });
    doc
      .moveTo(tableX, y + rowHeight)
      .lineTo(tableX + tableWidth, y + rowHeight)
      .lineWidth(0.35)
      .strokeColor(BORDER)
      .stroke();
    y += rowHeight;
  });

  y += 14;
  const summaries = [
    [
      "Subtotal",
      formatReceiptMoney(
        sale?.subtotal ??
          items.reduce(
            (sum: number, item: any) =>
              sum + amount(item?.qty) * amount(item?.unitPrice),
            0,
          ),
      ),
    ],
    [
      "Descuento",
      formatReceiptMoney(sale?.discountTotal ?? lineSum(items, "discount")),
    ],
    [
      sale?.taxIncluded === false ? "ITBIS adicional" : "ITBIS incluido",
      formatReceiptMoney(sale?.taxTotal),
    ],
    ["Total", formatReceiptMoney(sale?.total)],
  ];
  const courier = courierCharge(sale ?? {});
  if (courier)
    summaries.push(
      [`Envío (mensajero ${courier.name})`, formatReceiptMoney(courier.fee)],
      ["Total pagado", formatReceiptMoney(courier.paid)],
    );
  const drawSummary = () => {
    let cursor = y;
    for (const [label, value] of summaries) {
      const strong = label === "Total" || label === "Total pagado";
      const fontSize = strong ? 12 : 10;
      const rowHeight = Math.max(
        strong ? 20 : 16,
        doc.heightOfString(value, {
          width: 145,
          font: strong ? "Helvetica-Bold" : "Helvetica",
          fontSize,
        } as any),
      );
      if (strong) {
        doc
          .moveTo(right - 270, cursor - 4)
          .lineTo(right, cursor - 4)
          .lineWidth(1)
          .strokeColor(BORDER)
          .stroke();
      }
      doc
        .font(strong ? "Helvetica-Bold" : "Helvetica")
        .fontSize(fontSize)
        .fillColor(INK)
        .text(label, right - 265, cursor, { width: 115 });
      doc.text(value, right - 145, cursor, {
        width: 145,
        align: "right",
      });
      cursor += rowHeight + 2;
    }
    y = cursor + 6;
  };
  if (y + 80 > bodyBottom) newPage();
  drawSummary();

  const creditBalance = amount(sale?.creditBalance);
  if (creditBalance > 0 && sale?.status !== "voided") {
    const paid = moneyPayments(sale).reduce(
      (sum: number, payment: any) => sum + amount(payment?.amount),
      0,
    );
    const dueDate = safeDate(sale?.creditDueDate);
    const paymentBreakdown = moneyPayments(sale).map(
      (payment: any) =>
        `${methodName(payment?.method)} ${formatReceiptMoney(payment?.amount)}`,
    );
    const panelLines = [
      `Pagado hoy: ${formatReceiptMoney(paid)} · Saldo pendiente: ${formatReceiptMoney(creditBalance)}`,
      dueDate ? `Vencimiento: ${dueDate}` : "",
      "Pague el saldo en la tienda: efectivo, tarjeta o transferencia. Los pagos los registra administración.",
      paymentBreakdown.length
        ? `Pagado por: ${paymentBreakdown.join(" · ")}`
        : "",
    ].filter(Boolean);
    const panelHeight =
      panelLines.reduce(
        (sum, line) =>
          sum +
          doc.heightOfString(line, {
            width: width - 24,
            font: "Helvetica",
            fontSize: 10,
          } as any) +
          4,
        0,
      ) + 20;
    if (y + panelHeight + 100 > bodyBottom) newPage();
    doc
      .roundedRect(left, y, width, panelHeight, 5)
      .fillAndStroke("#eff6ff", "#b7cae8");
    let cursor = y + 10;
    panelLines.forEach((line, index) => {
      cursor = drawText(doc, line, left + 12, cursor, width - 24, {
        font: index === 0 ? "Helvetica-Bold" : "Helvetica",
        fontSize: index === 0 ? 11 : 10,
        color: index === 0 ? BLUE : INK,
      });
      cursor += 4;
    });
    y += panelHeight + 14;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(INK)
      .text("Reconocimiento del cliente", left, y, { width });
    y += 22;
    const lineWidth = (width - 36) / 3;
    for (const label of ["Nombre", "Firma", "Fecha"]) {
      const x =
        left +
        [0, 1, 2][["Nombre", "Firma", "Fecha"].indexOf(label)] *
          (lineWidth + 18);
      doc
        .moveTo(x, y + 18)
        .lineTo(x + lineWidth, y + 18)
        .lineWidth(0.6)
        .strokeColor(MUTED)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(label, x, y + 21);
    }
    y += 40;
  } else if (sale?.status !== "voided") {
    const payments = moneyPayments(sale);
    if (payments.length) {
      const grouped = new Map<string, number>();
      for (const payment of payments) {
        const name = methodName(payment?.method);
        grouped.set(name, (grouped.get(name) ?? 0) + amount(payment?.amount));
      }
      const line =
        "Forma de pago: " +
        [...grouped]
          .map(([name, value]) => `${name} ${formatReceiptMoney(value)}`)
          .join(" · ");
      if (y + 40 > bodyBottom) newPage();
      y =
        drawText(doc, line, left, y, width, {
          font: "Helvetica",
          fontSize: 10,
          color: INK,
        }) + 10;
      for (const payment of payments) {
        const tendered = amount(payment?.tendered ?? payment?.amount);
        const applied = amount(payment?.amount);
        const change = amount(payment?.change);
        const hasTenderDetail = tendered !== applied || change > 0;
        if (!hasTenderDetail) continue;
        const noCurrency = (value: ReceiptValue) =>
          formatReceiptMoney(value).replace(/^RD\$\s*/, "");
        const detail = paymentReceiptLine({
          method: methodName(payment?.method),
          tendered: noCurrency(tendered),
          amount: noCurrency(applied),
          change: noCurrency(change),
        });
        if (y + 28 > bodyBottom) newPage();
        y =
          drawText(doc, detail, left, y, width, {
            font: "Helvetica",
            fontSize: 9,
            color: MUTED,
          }) + 6;
      }
    }
  }

  const discount = amount(sale?.discountTotal);
  const reason = cleanText(sale?.discountReason, 300);
  if (discount > 0) {
    const line =
      `Descuento comercial: ${formatReceiptMoney(discount)}` +
      (reason ? ` · Motivo: ${reason}` : "");
    const height = doc.heightOfString(line, { width, fontSize: 10 } as any) + 5;
    if (y + height > bodyBottom) newPage();
    y =
      drawText(doc, line, left, y, width, {
        font: "Helvetica",
        fontSize: 10,
        color: INK,
      }) + 8;
  }

  const returns = Array.isArray(sale?.returns) ? sale.returns : [];
  const refunded = returns.reduce(
    (sum: number, row: any) => sum + amount(row?.refundAmount),
    0,
  );
  if (returns.length && refunded > 0) {
    const returnLine = `Devoluciones registradas: ${formatReceiptMoney(refunded)}`;
    if (y + 25 > bodyBottom) newPage();
    y =
      drawText(doc, returnLine, left, y, width, {
        font: "Helvetica",
        fontSize: 9,
        color: MUTED,
      }) + 8;
  }

  const footer = [
    returnPolicyText(business),
    privacyNoticeText(business),
    // NCF-06: con NCF asignado la venta está emitida; no se contradice.
    sale?.ncf
      ? `Comprobante emitido con NCF ${cleanText(sale.ncf, 20)}`
      : "Documento interno, sin valor fiscal",
  ];
  const footerHeight =
    footer.reduce(
      (sum, line) =>
        sum +
        doc.heightOfString(cleanText(line), {
          width,
          font: "Helvetica",
          fontSize: 8,
        } as any) +
        3,
      0,
    ) + 28;
  if (y + footerHeight > bodyBottom) newPage();
  y += 5;
  footer.forEach((line) => {
    y =
      drawText(doc, line, left, y, width, {
        font: "Helvetica",
        fontSize: 8,
        color: MUTED,
      }) + 3;
  });
  y = drawText(
    doc,
    cleanText(business?.receiptFooter, 200) || "Gracias por elegirnos.",
    left,
    y + 4,
    width,
    {
      font: "Helvetica-Bold",
      fontSize: 9,
      color: INK,
    },
  );

  const range = (doc as any).bufferedPageRange?.();
  if (range) {
    const pageCount = range.count;
    for (let index = range.start; index < range.start + range.count; index++) {
      (doc as any).switchToPage(index);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `Página ${index + 1} de ${pageCount}`,
          left,
          doc.page.height - PAGE_MARGIN - 12,
          {
            width,
            align: "right",
            lineBreak: false,
          },
        );
    }
  }
  doc.fillColor(INK);
}

/** Texto contractual que se conserva en el pie del documento para el cliente. */
export const receiptFooterLines = (business: any) => [
  returnPolicyText(business),
  privacyNoticeText(business),
];

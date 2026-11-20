const MONEY_COLUMN =
  /(^|_)(total|monto|importe|ingreso|revenue|venta_bruta|venta_neta|bruta|neta|costo|precio|utilidad|ganancia|itbis|descuento|saldo|deuda|valor|efectivo|tarjeta|transferencia|credito|comisiones?|gastos?)(_|$)/i;

export function isReportMoneyColumn(key: string) {
  return MONEY_COLUMN.test(key.trim().replace(/\s+/g, "_"));
}

export function formatReportCell(key: string, value: unknown) {
  if (typeof value !== "number") return String(value ?? "—");
  if (isReportMoneyColumn(key)) {
    return `RD$ ${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return value.toLocaleString("es-DO", { maximumFractionDigits: 2 });
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Crédito",
  cod: "Contraentrega",
  credit_note: "Nota de crédito",
};

const KARDEX_LABELS: Record<string, string> = {
  purchase: "Entrada",
  sale: "Venta",
  adjustment: "Ajuste",
  count: "Conteo físico",
  waste: "Merma",
  supplier_return: "Devolución a proveedor",
  return: "Devolución",
  return_waste: "Merma por devolución",
  void: "Anulación (vuelve al stock)",
  transfer_in: "Traspaso recibido",
  transfer_out: "Traspaso enviado",
};

const EVENT_LABELS: Record<string, string> = {
  void: "Anulación",
  return: "Devolución",
  discount_approved: "Descuento aprobado",
};

export function reportDisplayRows(
  report: string,
  rows: Record<string, unknown>[],
) {
  const [column, labels] =
    report === "by-payment"
      ? (["Método", PAYMENT_LABELS] as const)
      : report === "kardex"
        ? (["Tipo", KARDEX_LABELS] as const)
        : report === "returns-discounts"
          ? (["Evento", EVENT_LABELS] as const)
          : [null, null];
  if (column === null || labels === null) return rows;

  // El Producto antiguo entrega el número legible en Referencia. Solo se
  // oculta el campo interno si todas las filas traen Factura aparte.
  const hideReference =
    report === "returns-discounts" &&
    rows.every((row) => Object.hasOwn(row, "Factura"));
  return rows.map((row) => {
    const value = row[column];
    const display = { ...row };
    if (typeof value === "string" && Object.hasOwn(labels, value)) {
      display[column] = labels[value];
    }
    if (hideReference) delete display.Referencia;
    return display;
  });
}

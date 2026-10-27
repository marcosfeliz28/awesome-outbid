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

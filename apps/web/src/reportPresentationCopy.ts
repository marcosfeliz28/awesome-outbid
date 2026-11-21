import { reportCellText } from "@fitstore/shared";

/** UI labels only. Never translate or rewrite cell values supplied by the server. */
const copy: Record<string, string> = {
  Ventas: "Sales",
  "Caja y pagos": "Register and payments",
  "Contraentregas y crédito": "Delivery and credit",
  Clientes: "Customers",
  Inventario: "Inventory",
  Vendedoras: "Sales staff",
  "Margen y resultados": "Margin and results",
  "Ventas detalladas": "Detailed sales",
  "Consumo mensual": "Monthly consumption",
  "Utilidad por producto": "Profit by product",
  "Inventario valorizado": "Inventory value",
  Kardex: "Stock ledger",
  "Stock bajo y reposición": "Low stock and replenishment",
  "Productos sin movimiento": "Products without movement",
  "Lotes próximos a vencer": "Expiring batches",
  "Clasificación ABC": "ABC classification",
  "Gastos y presupuesto": "Expenses and budget",
  "Estado de resultados": "Income statement",
  "Cierres y diferencias": "Closings and discrepancies",
  "Ventas por vendedor": "Sales by salesperson",
  "Ventas por método de pago": "Sales by payment method",
  "Ventas por categoría y forma de pago (% y monto)":
    "Sales by category and payment method (% and amount)",
  "Ingresos por día y método": "Income by day and method",
  "Informe formal diario/mensual": "Formal daily/monthly report",
  "Devoluciones y descuentos": "Returns and discounts",
  "Mejores clientes": "Top customers",
  "Compras y cuentas por pagar": "Purchases and payables",
  Factura: "Invoice",
  Fecha: "Date",
  Vendedor: "Salesperson",
  Total: "Total",
  ITBIS: "ITBIS",
  "Saldo crédito": "Credit balance",
  NCF: "NCF",
  "Tipo NCF": "NCF type",
  "Estado fiscal": "Fiscal status",
  Devoluciones: "Returns",
  Producto: "Product",
  Código: "Code",
  Unidades: "Units",
  Costo: "Cost",
  Margen: "Margin",
  Ganancia: "Profit",
  Cliente: "Customer",
  Cantidad: "Quantity",
  Monto: "Amount",
  Estado: "Status",
  Categoría: "Category",
  Sucursal: "Branch",
  Método: "Method",
  Banco: "Bank",
  Referencia: "Reference",
};

const methodCopy: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Bank transfer",
  credit: "Credit",
  cod: "Cash on delivery",
  credit_note: "Credit note",
};

const eventCopy: Record<string, string> = {
  void: "Void",
  return: "Return",
  discount_approved: "Discount approved",
};

const kardexCopy: Record<string, string> = {
  purchase: "Stock received",
  sale: "Sale",
  adjustment: "Adjustment",
  count: "Physical count",
  waste: "Write-off",
  supplier_return: "Return to supplier",
  return: "Return",
  return_waste: "Returned item written off",
  void: "Void (returned to stock)",
  transfer_in: "Transfer received",
  transfer_out: "Transfer sent",
};

const englishCodeColumns: Record<
  string,
  Record<string, Record<string, string> | undefined> | undefined
> = {
  "by-payment": { Método: methodCopy },
  "returns-discounts": { Evento: eventCopy },
  kardex: { Tipo: kardexCopy },
};

export function reportLabel(value: string, english: boolean) {
  return english ? (copy[value] ?? value) : value;
}

/**
 * Presentation-only translation for report codes. The API response remains
 * untouched so exports and callers keep receiving the original code.
 */
export function reportCellTextForLanguage(
  report: string,
  key: string,
  value: unknown,
  english: boolean,
) {
  if (!english) return reportCellText(report, key, value);
  if (typeof value !== "string") return value;
  return englishCodeColumns[report]?.[key]?.[value] ?? value;
}

const nonMoneyColumn =
  /(?:^|\s)(?:facturas?|unidades?|cantidad|días?|mes(?:es)?|años?|horas?|productos?|clientes?|transacciones?|movimientos?|margen|porcentaje)(?:\s|$)|%/i;
const moneyColumn =
  /(?:^|\s)(?:total|itbis|monto|importe|costo|precio|valor|utilidad|ganancia|ingresos?|egresos?|vendido|ventas?|efectivo|tarjeta|transferencia|devoluciones?|descuentos?|saldo|presupuesto|gastos?|cobrado|deuda|capital)(?:\s|$)/i;

/** Identifies numeric report columns that represent DOP, not counts or rates. */
export function reportColumnIsMoney(report: string, key: string) {
  const label = key.replace(/_/g, " ").trim();
  if (report === "kardex" && label === "Saldo") return false;
  if (nonMoneyColumn.test(label)) return false;
  return moneyColumn.test(label);
}

const BILINGUAL_ALERT_LABELS: Record<
  string,
  { es: string; en: string }
> = {
  opening_shortfall: {
    es: "Fondo de apertura menor",
    en: "Opening fund shortfall",
  },
  cash_payments_replaced: {
    es: "Pagos corregidos en caja",
    en: "Register payments corrected",
  },
  cash_after_close: {
    es: "Caja modificada después del cierre",
    en: "Register changed after closing",
  },
  zero_cost_sale: {
    es: "Venta sin costo sincronizada",
    en: "Synced sale without cost",
  },
  offline_zero_cost_sale: {
    es: "Venta sin costo sincronizada",
    en: "Synced sale without cost",
  },
  low_margin_discount: {
    es: "Margen menor a 15 %",
    en: "Margin below 15%",
  },
  terminal_auto_limit: {
    es: "Equipos de más",
    en: "Extra devices",
  },
};

// Etiquetas existentes que no forman parte de A7. Se mantienen tal como se
// mostraban para no cambiar nombres de avisos ajenos a esta corrección.
const LEGACY_ALERT_LABELS: Record<string, string> = {
  offline_conflict: "Venta sin conexión",
  receivable: "Por cobrar",
  credit_reminder: "Créditos por cobrar",
  gv_cash_open_night: "Caja GV abierta de noche",
  gv_day_no_close: "Día de GV sin cierre",
  cash_difference: "Diferencia de caja",
  return_waste: "Merma por devolución",
  expense_budget: "Presupuesto de gastos",
  expired: "Vencido",
  expiring: "Por vencer",
  low_margin: "Margen bajo",
  low_sales: "Ventas bajas",
  low_stock: "Stock bajo",
  negative_stock: "Stock negativo",
  no_movement: "Sin movimiento",
  out_of_stock: "Agotado",
  overstock: "Exceso de stock",
  unusual_discount: "Descuento inusual",
  sale_void_request: "Solicitud de anulación",
};

export function alertTypeLabel(type: string, english = false): string {
  const translated = BILINGUAL_ALERT_LABELS[type];
  if (translated) return english ? translated.en : translated.es;
  return LEGACY_ALERT_LABELS[type] ?? type.replace(/_+/g, " ").trim();
}

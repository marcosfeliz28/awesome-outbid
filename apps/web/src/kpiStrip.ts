import { formatMoney } from "@fitstore/shared";

export type DayData = {
  revenue?: number;
  costTotal?: number;
  margin?: number;
  invoices?: number;
  alerts?: { type?: string }[];
};
export type Kpi = { key: string; label: string; value: string; note: string };

const STOCK_ALERTS = ["low_stock", "out_of_stock"];

// Solo lectura de lo que ya devuelven /dashboard/summary y /cash-sessions.
// La utilidad usa el margen que calcula la API: (venta − costo) / venta, sin restar ITBIS.
export function buildKpis({
  day,
  sessions,
  showProfit,
}: {
  day?: DayData;
  sessions?: { closedAt?: string | null }[];
  showProfit: boolean;
}): Kpi[] {
  const revenue = Number(day?.revenue ?? 0);
  const cost = Number(day?.costTotal ?? 0);
  const kpis: Kpi[] = [
    {
      key: "ventas",
      label: "Ventas de hoy",
      value: formatMoney(revenue),
      note: `${day?.invoices ?? 0} facturas`,
    },
  ];
  if (showProfit)
    kpis.push({
      key: "utilidad",
      label: "Utilidad de hoy",
      value: formatMoney(Math.round((revenue - cost) * 100) / 100),
      note: `${day?.margin ?? 0}% de margen`,
    });
  if (sessions) {
    const open = sessions.filter((s) => !s.closedAt).length;
    kpis.push({
      key: "cajas",
      label: "Cajas activas",
      value: String(open),
      note: open === 1 ? "caja abierta" : "cajas abiertas",
    });
  }
  const stock = (day?.alerts ?? []).filter((a) =>
    STOCK_ALERTS.includes(a.type ?? ""),
  ).length;
  kpis.push({
    key: "inventario",
    label: "Alertas de inventario",
    value: String(stock),
    note: stock === 0 ? "Sin faltantes" : "agotados o por agotarse",
  });
  return kpis;
}

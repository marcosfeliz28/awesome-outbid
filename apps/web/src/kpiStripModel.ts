import { can, formatMoney } from "@fitstore/shared";

export type DayData = {
  revenue?: number;
  invoices?: number;
  alerts?: { type?: string }[];
};
export type Kpi = { key: string; label: string; value: string; note: string };

const STOCK_ALERTS = ["low_stock", "out_of_stock"];

// La franja consulta /dashboard/summary, que exige reports:read: sin ese permiso no se muestra.
export function kpiStripVisible(permissions: string[]): boolean {
  return can(permissions, "reports:read");
}

// Solo presentación de lo que ya devuelven /dashboard/summary y /cash-sessions.
// No calcula utilidad, margen ni costo: ese dato no se muestra en la franja.
export function buildKpis({
  day,
  sessions,
}: {
  day?: DayData;
  sessions?: { closedAt?: string | null }[];
}): Kpi[] {
  const revenue = Number(day?.revenue ?? 0);
  const kpis: Kpi[] = [
    {
      key: "ventas",
      label: "Ventas de hoy",
      value: formatMoney(revenue),
      note: `${day?.invoices ?? 0} facturas`,
    },
  ];
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

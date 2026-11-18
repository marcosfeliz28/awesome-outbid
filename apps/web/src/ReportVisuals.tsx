import { BarChart3 } from "lucide-react";
import { formatMoney } from "@fitstore/shared";
export function ReportEmblem() {
  return <span className="report-emblem" aria-hidden="true"><BarChart3 strokeWidth={2.4} /></span>;
}
export function CategoryRevenueBars({ rows, english }: { rows: { name: string; revenue: number }[]; english: boolean }) {
  const usable = rows.filter(row => Number.isFinite(row.revenue));
  const maximum = Math.max(0, ...usable.map(row => Math.abs(row.revenue)));
  return <div className="report-category-bars" role="list" aria-label={english ? "Sales by category" : "Ventas por categoría"}>
    {usable.map((row, i) => <div className="report-category-bar" role="listitem" key={`${row.name}-${i}`}>
      <div><span>{row.name}</span><strong>{formatMoney(row.revenue)}</strong></div>
      <div className="report-bar-track" aria-hidden="true"><span data-negative={row.revenue < 0 || undefined} style={{ width: `${maximum ? Math.abs(row.revenue) / maximum * 100 : 0}%` }} /></div>
    </div>)}
  </div>;
}

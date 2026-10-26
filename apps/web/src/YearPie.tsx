import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { can, formatMoney } from "@fitstore/shared";
import { api, useStore } from "./api";
import { today, QueryState } from "./helpers";
import { AskNexora } from "./ExecutiveDashboard";
import type { AskDashboard } from "./dashboardQuestions";
import { monthNames, monthRange, monthShares } from "./year-report-utils";

type Month = {
  month: number;
  invoices?: number;
  revenue: number;
  profit?: number;
  margin?: number;
};
const colors = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#f43f5e",
  "#4f46e5",
  "#0d9488",
];

export function YearPie({
  go,
  onAsk,
  quiet = false,
}: {
  go: (page: string) => void;
  onAsk?: AskDashboard;
  quiet?: boolean;
}) {
  const user = useStore((s) => s.user)!;
  const showProfit = can(user.permissions, "profit:read");
  const thisYear = Number(today().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  // Tocar o pasar sobre un mes solo lo muestra; ir al detalle es un botón
  // (orden 18-oct: antes un toque en el celular abría otra página).
  const [picked, setPicked] = useState<Month | null>(null);
  const query = useQuery({
    queryKey: ["dashboard-year", year],
    queryFn: () => api<any>("/dashboard/year?year=" + year),
    enabled: can(user.permissions, "reports:read"),
    refetchInterval: 60000,
  });
  const months: Month[] = query.data?.months ?? [];
  const shares = monthShares(months.map((m) => m.revenue));
  const slices = months
    .map((m, i) => ({ ...m, share: shares[i], color: colors[i] }))
    .filter((m) => m.share > 0);
  const open = (month: number) => {
    const range = monthRange(year, month);
    go(`month-report?from=${range.from}&to=${range.to}`);
  };
  return (
    <section className="panel year-pie" aria-labelledby="year-pie-title">
      <div className="panel-heading">
        <div>
          <h2 id="year-pie-title">Ventas del año por mes</h2>
          <p>
            El círculo es el 100 % de {year}. Toca un mes para ver su desglose.
          </p>
        </div>
        <select
          aria-label="Año"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {onAsk && (
          <AskNexora
            label={`Ventas del año ${year}`}
            topic="year"
            from={`${year}-01-01`}
            to={`${year}-12-31`}
            onAsk={onAsk}
          />
        )}
      </div>
      {quiet && (query.isPending || query.error) ? (
        <QueryState query={query}>{null}</QueryState>
      ) : (
        <>
          <div className="year-pie-body">
            <div
              className="year-pie-chart"
              role="img"
              aria-label="Ventas por mes"
            >
              {slices.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="revenue"
                      isAnimationActive={!quiet}
                      nameKey="month"
                      outerRadius={125}
                      stroke="var(--surface, #fff)"
                      onClick={(slice: any) => setPicked(slice)}
                    >
                      {slices.map((m) => (
                        <Cell
                          key={m.month}
                          fill={m.color}
                          style={{ cursor: "pointer" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ payload }: any) => {
                        const m: Month | undefined = payload?.[0]?.payload;
                        if (!m) return null;
                        return (
                          <div className="year-pie-tip">
                            <strong>{monthNames[m.month - 1]}</strong>
                            <span>{m.invoices ?? 0} ventas</span>
                            <span>Bruta {formatMoney(m.revenue)}</span>
                            {showProfit && (
                              <span>Neta {formatMoney(m.profit ?? 0)}</span>
                            )}
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted">Sin ventas en {year}.</p>
              )}
            </div>
            {picked && (
              <div className="year-pie-tip" role="status">
                <strong>{monthNames[picked.month - 1]}</strong>
                <span>{picked.invoices ?? 0} ventas</span>
                <span>Bruta {formatMoney(picked.revenue)}</span>
                {showProfit && (
                  <span>Neta {formatMoney(picked.profit ?? 0)}</span>
                )}
                <button type="button" onClick={() => open(picked.month)}>
                  Ver detalle del mes
                </button>
              </div>
            )}
            <ul className="year-pie-list">
              {months.map((m, i) => (
                <li key={m.month}>
                  <button
                    type="button"
                    onClick={() => open(m.month)}
                    aria-label={`Ver el desglose de ${monthNames[m.month - 1]}`}
                  >
                    <span
                      className="year-pie-dot"
                      style={{ background: colors[i] }}
                      aria-hidden="true"
                    />
                    <strong>{monthNames[m.month - 1]}</strong>
                    <span>Bruta {formatMoney(m.revenue)}</span>
                    {showProfit && (
                      <span>Neta {formatMoney(m.profit ?? 0)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {showProfit && (
            <p className="muted year-pie-note">
              Bruta = lo vendido (devoluciones descontadas). Neta = bruta −
              costo, sin restar ITBIS ni gastos.
            </p>
          )}
        </>
      )}
    </section>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, useStore } from "./api";
import { QueryState, today } from "./helpers";
import { monthNames, reportCsv } from "./year-report-utils";
import { MIX_LABEL, PaymentMixPie, type MixRow } from "./PaymentMixPie";

const params = () => {
  const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const t = today();
  return {
    from: q.get("from") || t.slice(0, 8) + "01",
    to: q.get("to") || t,
  };
};
type TopGroup = { category: string; byUnits: Line[]; byAmount: Line[] };
type Line = {
  name: string;
  sku?: string;
  revenue: number;
  units: number;
  profit?: number;
  margin?: number;
};

// Mes completo a `delta` meses de `from`; el mes en curso termina hoy.
const monthFrom = (from: string, delta: number) => {
  const d = new Date(
    Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1 + delta, 1),
  );
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(d), to: iso(end) < today() ? iso(end) : today() };
};

export function MonthReport({ go }: { go: (page: string) => void }) {
  const user = useStore((s) => s.user)!;
  const showProfit = can(user.permissions, "profit:read");
  const initial = params();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const query = useQuery({
    queryKey: ["dashboard-breakdown", from, to],
    queryFn: () => api<any>("/dashboard/breakdown?from=" + from + "&to=" + to),
    enabled: !!from && !!to && from <= to,
    refetchInterval: 60000,
  });
  const [topCategory, setTopCategory] = useState("");
  const [topBy, setTopBy] = useState<"byUnits" | "byAmount">("byUnits");
  const data = query.data;
  const topGroup =
    data?.topByCategory?.find((g: TopGroup) => g.category === topCategory) ??
    data?.topByCategory?.[0];
  const goMonth = (delta: number) => {
    const m = monthFrom(from, delta);
    setFrom(m.from);
    setTo(m.to);
  };
  const nextDisabled = monthFrom(from, 1).from > today();
  const title = (() => {
    const m = Number(from.slice(5, 7));
    const whole = from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01");
    return whole && m >= 1 && m <= 12
      ? `${monthNames[m - 1]} ${from.slice(0, 4)}`
      : `${from} al ${to}`;
  })();
  const download = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Reporte de ventas", title],
      [],
      [
        "Categoría",
        "Vendido",
        "Unidades",
        ...(showProfit ? ["Ganancia", "Margen %"] : []),
      ],
      ...data.categories.map((c: Line) => [
        c.name,
        c.revenue,
        c.units,
        ...(showProfit ? [c.profit ?? 0, c.margin ?? 0] : []),
      ]),
      ...(data.payments
        ? [
            [],
            ["Forma de pago por categoría", "Forma de pago", "Banco", "Monto"],
            ...data.payments.map((p: MixRow) => [
              p.category,
              MIX_LABEL[p.method] ?? p.method,
              p.bank ?? "",
              p.amount,
            ]),
          ]
        : []),
      [],
      ["Las 10 más vendidas", "Código", "Unidades", "Vendido"],
      ...data.top.map((t: Line) => [t.name, t.sku ?? "", t.units, t.revenue]),
    ];
    const url = URL.createObjectURL(
      new Blob([reportCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const kpi = (label: string, value: string, note?: string) => (
    <article className="kpi-card" key={label}>
      <div className="kpi-top">
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {note && <div className="kpi-note">{note}</div>}
    </article>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DESGLOSE DE VENTAS</div>
          <h1>{title}</h1>
          <p>Se actualiza solo cada minuto con las ventas de hoy.</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => go("dashboard")}>
            Volver al inicio
          </Button>
          <Button onClick={download} disabled={!data}>
            Exportar CSV
          </Button>
        </div>
      </div>
      <section className="panel month-range" aria-label="Fechas del reporte">
        <Button variant="secondary" onClick={() => goMonth(-1)}>
          ← Mes anterior
        </Button>
        <Button
          variant="secondary"
          onClick={() => goMonth(1)}
          disabled={nextDisabled}
        >
          Mes siguiente →
        </Button>
        <label>
          Desde
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            min={from}
            max={today()}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </label>
      </section>
      <QueryState query={query}>
        {data && (
          <>
            <div className="kpi-grid">
              {kpi("Venta bruta", formatMoney(data.revenue))}
              {showProfit &&
                kpi(
                  "Ganancia neta",
                  formatMoney(data.profit ?? 0),
                  "Venta − costo, sin restar ITBIS",
                )}
              {showProfit && kpi("Margen promedio", `${data.margin ?? 0} %`)}
              {kpi(
                "Promedio por día",
                formatMoney(data.averagePerDay),
                `${data.days} día${data.days === 1 ? "" : "s"}`,
              )}
              {kpi(
                "Promedio por venta",
                formatMoney(data.averageTicket),
                `${data.invoices} facturas`,
              )}
              {kpi("Unidades vendidas", data.units.toLocaleString("es-DO"))}
            </div>
            <section className="panel">
              <div className="panel-heading">
                <h2>Por categoría</h2>
              </div>
              <div className="table-scroll">
                <table className="month-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Vendido</th>
                      <th>Unidades</th>
                      {showProfit && <th>Ganancia neta</th>}
                      {showProfit && <th>Margen</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((c: Line) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>{formatMoney(c.revenue)}</td>
                        <td>{c.units.toLocaleString("es-DO")}</td>
                        {showProfit && <td>{formatMoney(c.profit ?? 0)}</td>}
                        {showProfit && <td>{c.margin ?? 0} %</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {data.payments && (
              <PaymentMixPie
                rows={data.payments as MixRow[]}
                categories={data.categories.map((c: Line) => c.name)}
              />
            )}
            {topGroup && (
              <section
                className="panel month-top-panel"
                aria-labelledby="top-category-title"
              >
                <div className="panel-heading">
                  <h2 id="top-category-title">Top 10 por categoría</h2>
                  <select
                    aria-label="Categoría del top 10"
                    value={topGroup.category}
                    onChange={(e) => setTopCategory(e.target.value)}
                  >
                    {data.topByCategory.map((g: TopGroup) => (
                      <option key={g.category} value={g.category}>
                        {g.category}
                      </option>
                    ))}
                  </select>
                  {(["byUnits", "byAmount"] as const).map((k) => (
                    <Button
                      key={k}
                      variant={topBy === k ? "primary" : "secondary"}
                      aria-pressed={topBy === k}
                      onClick={() => setTopBy(k)}
                    >
                      {k === "byUnits" ? "Por unidades" : "Por monto"}
                    </Button>
                  ))}
                </div>
                <div className="table-scroll">
                  <table className="month-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Producto</th>
                        <th>Unidades</th>
                        <th>Vendido</th>
                        {showProfit && <th>Ganancia</th>}
                        {showProfit && <th>Margen</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {topGroup[topBy].map((t: Line, i: number) => (
                        <tr key={t.sku ?? t.name}>
                          <td>{i + 1}</td>
                          <td>{t.name}</td>
                          <td>{t.units.toLocaleString("es-DO")}</td>
                          <td>{formatMoney(t.revenue)}</td>
                          {showProfit && <td>{formatMoney(t.profit ?? 0)}</td>}
                          {showProfit && <td>{t.margin ?? 0} %</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <section className="panel">
              <div className="panel-heading">
                <h2>Las 10 más vendidas (por unidades)</h2>
              </div>
              <div className="table-scroll">
                <table className="month-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th>Vendido</th>
                      {showProfit && <th>Ganancia</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top.map((t: Line, i: number) => (
                      <tr key={t.sku ?? t.name}>
                        <td>{i + 1}</td>
                        <td>{t.name}</td>
                        <td>{t.units.toLocaleString("es-DO")}</td>
                        <td>{formatMoney(t.revenue)}</td>
                        {showProfit && <td>{formatMoney(t.profit ?? 0)}</td>}
                      </tr>
                    ))}
                    {!data.top.length && (
                      <tr>
                        <td colSpan={5}>Sin ventas en estas fechas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </QueryState>
    </>
  );
}

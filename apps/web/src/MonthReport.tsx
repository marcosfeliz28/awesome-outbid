import { ReportEmblem, CategoryRevenueBars } from "./ReportVisuals";
import { useLanguage } from "./inicioLanguage";
import { PremiumWorkspace } from "./PremiumWorkspace";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, useStore } from "./api";
import { QueryState, today } from "./helpers";
import { monthNames, reportCsv } from "./year-report-utils";
import { mixLabel, PaymentMixPie, type MixRow } from "./PaymentMixPie";

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
  const en = useLanguage() === "en";
  const t = (es: string, english: string) => en ? english : es;
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
      ? `${en ? new Intl.DateTimeFormat("en", {month: "long", timeZone: "UTC"}).format(new Date(`${from}T12:00:00Z`)) : monthNames[m - 1]} ${from.slice(0, 4)}`
      : `${from} ${en ? "to" : "al"} ${to}`;
  })();
  const download = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      [t("Reporte de ventas", "Sales report"), title],
      [],
      [
        t("Categor\u00eda", "Category"),
        t("Vendido", "Sales"),
        t("Unidades", "Units"),
        ...(showProfit ? [t("Ganancia", "Profit"), t("Margen %", "Margin %")] : []),
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
            [t("Forma de pago por categor\u00eda", "Payment method by category"), t("Forma de pago", "Payment method"), t("Banco", "Bank"), t("Monto", "Amount")],
            ...data.payments.map((p: MixRow) => [
              p.category,
              mixLabel(p.method, en),
              p.bank ?? "",
              p.amount,
            ]),
          ]
        : []),
      [],
      [t("Las 10 m\u00e1s vendidas", "Top 10 best sellers"), t("C\u00f3digo", "Code"), t("Unidades", "Units"), t("Vendido", "Sales")],
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
    <PremiumWorkspace area="month-report">
      <div className="page-heading report-premium-heading">
        <ReportEmblem />
        <div>
          <div className="eyebrow">{t("DESGLOSE DE VENTAS", "SALES BREAKDOWN")}</div>
          <h1>{t("Informe mensual", "Monthly report")}</h1>
          <div className="report-period-title">{title}</div>
          <p>{t("Se actualiza solo cada minuto con las ventas de hoy.", "Refreshes automatically every minute for the selected period.")}</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => go("dashboard")}>
            {t("Volver al inicio", "Back to overview")}
          </Button>
          <Button onClick={download} disabled={!data}>
            {t("Exportar CSV", "Export CSV")}
          </Button>
        </div>
      </div>
      <section className="panel month-range" aria-label={t("Fechas del reporte", "Report dates")}>
        <Button variant="secondary" onClick={() => goMonth(-1)}>
          {t("\u2190 Mes anterior", "\u2190 Previous month")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => goMonth(1)}
          disabled={nextDisabled}
        >
          {t("Mes siguiente \u2192", "Next month \u2192")}
        </Button>
        <label>
          {t("Desde", "From")}
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label>
          {t("Hasta", "To")}
          <input
            type="date"
            value={to}
            min={from}
            max={today()}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </label>
      </section>
      <QueryState query={query} english={en}>
        {data && (
          <>
            <div className="kpi-grid">
              {kpi(t("Venta bruta", "Gross sales"), formatMoney(data.revenue))}
              {showProfit &&
                kpi(
                  t("Ganancia neta", "Net profit"),
                  formatMoney(data.profit ?? 0),
                  t("Venta \u2212 costo, sin restar ITBIS", "Sales minus cost, before ITBIS"),
                )}
              {showProfit && kpi(t("Margen promedio", "Average margin"), `${data.margin ?? 0} %`)}
              {kpi(
                t("Promedio por d\u00eda", "Daily average"),
                formatMoney(data.averagePerDay),
                `${data.days} ${en ? "day" : "día"}${data.days === 1 ? "" : "s"}`,
              )}
              {kpi(
                t("Promedio por venta", "Average ticket"),
                formatMoney(data.averageTicket),
                `${data.invoices} ${en ? "invoices" : "facturas"}`,
              )}
              {kpi(t("Unidades vendidas", "Units sold"), data.units.toLocaleString("es-DO"))}
            </div>
            <div className="month-insights-grid">
            <section className="panel month-category-panel">
              <div className="panel-heading">
                <h2>{t("Por categor\u00eda", "By category")}</h2>
              </div>
              <CategoryRevenueBars rows={data.categories} english={en} />
              <div className="table-scroll">
                <table className="month-table">
                  <thead>
                    <tr>
                      <th>{t("Categor\u00eda", "Category")}</th>
                      <th>{t("Vendido", "Sales")}</th>
                      <th>{t("Unidades", "Units")}</th>
                      {showProfit && <th>{t("Ganancia neta", "Net profit")}</th>}
                      {showProfit && <th>{t("Margen", "Margin")}</th>}
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
                english={en}
                rows={data.payments as MixRow[]}
                categories={data.categories.map((c: Line) => c.name)}
              />
            )}
            </div>
            {topGroup && (
              <section
                className="panel month-top-panel"
                aria-labelledby="top-category-title"
              >
                <div className="panel-heading">
                  <h2 id="top-category-title">{t("Top 10 por categor\u00eda", "Top 10 by category")}</h2>
                  <select
                    aria-label={t("Categor\u00eda del top 10", "Top 10 category")}
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
                      {k === "byUnits" ? t("Por unidades", "By units") : t("Por monto", "By amount")}
                    </Button>
                  ))}
                </div>
                <div className="table-scroll">
                  <table className="month-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t("Producto", "Product")}</th>
                        <th>{t("Unidades", "Units")}</th>
                        <th>{t("Vendido", "Sales")}</th>
                        {showProfit && <th>{t("Ganancia", "Profit")}</th>}
                        {showProfit && <th>{t("Margen", "Margin")}</th>}
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
                <h2>{t("Las 10 m\u00e1s vendidas (por unidades)", "Top 10 best sellers (by units)")}</h2>
              </div>
              <div className="table-scroll">
                <table className="month-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("Producto", "Product")}</th>
                      <th>{t("Unidades", "Units")}</th>
                      <th>{t("Vendido", "Sales")}</th>
                      {showProfit && <th>{t("Ganancia", "Profit")}</th>}
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
                        <td colSpan={5}>{t("Sin ventas en estas fechas.", "No sales for these dates.")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </QueryState>
    </PremiumWorkspace>
  );
}

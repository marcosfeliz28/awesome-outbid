import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@fitstore/shared";
import { METHOD_LABEL } from "./Prints";

export type MixRow = { category: string; method: string; amount: number };
const COLORS: Record<string, string> = {
  cash: "#059669",
  transfer: "#2563eb",
  card: "#7c3aed",
  cod: "#ea580c",
  credit: "#ea580c",
  credit_note: "#64748b",
};

// Orden 18-oct: cómo se pagó el mes (o una categoría), en % y monto.
export function PaymentMixPie({
  rows,
  categories,
}: {
  rows: MixRow[];
  categories: string[];
}) {
  const [category, setCategory] = useState("");
  const byMethod = new Map<string, number>();
  for (const r of rows)
    if (!category || r.category === category) {
      const key = METHOD_LABEL[r.method] ?? r.method;
      byMethod.set(key, (byMethod.get(key) ?? 0) + Number(r.amount));
    }
  const total = [...byMethod.values()].reduce((a, b) => a + b, 0);
  const slices = [...byMethod.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({
      name,
      amount: Math.round(amount * 100) / 100,
      share: total ? Math.round((amount / total) * 1000) / 10 : 0,
      color:
        COLORS[
          Object.keys(METHOD_LABEL).find((k) => METHOD_LABEL[k] === name) ?? ""
        ] ?? "#94a3b8",
    }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <section className="panel" aria-labelledby="payment-mix-title">
      <div className="panel-heading">
        <h2 id="payment-mix-title">Formas de pago</h2>
        <select
          aria-label="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {slices.length ? (
        <div className="year-pie-body">
          <div
            className="year-pie-chart"
            role="img"
            aria-label="Formas de pago"
          >
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  outerRadius={100}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [
                    formatMoney(Number(value)),
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="year-pie-list">
            {slices.map((s) => (
              <li key={s.name}>
                <span>
                  <span
                    className="year-pie-dot"
                    style={{ background: s.color }}
                    aria-hidden="true"
                  />
                  <strong>{s.name}</strong> {s.share} % ·{" "}
                  {formatMoney(s.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">Sin pagos en estas fechas.</p>
      )}
    </section>
  );
}

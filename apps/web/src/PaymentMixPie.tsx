import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@fitstore/shared";
import { METHOD_LABEL } from "./Prints";

export type MixRow = {
  category: string;
  method: string;
  bank?: string | null;
  amount: number;
};
// Renglones de lo no cobrado (cuadran con la venta bruta del mes).
export const MIX_LABEL: Record<string, string> = {
  ...METHOD_LABEL,
  credit: "Por cobrar (crédito y contraentrega)",
  credit_paid: "Crédito ya cobrado",
  transfer_pending: "Transferencias por verificar",
  unrecorded: "Sin cobro registrado",
};
export const MIX_LABEL_EN: Record<string, string> = {
  cash: "Cash", card: "Card", transfer: "Transfer", cod: "Cash on delivery",
  credit: "Receivables (credit and delivery)", credit_paid: "Credit collected",
  transfer_pending: "Transfers pending verification", unrecorded: "No payment recorded",
  credit_note: "Credit note",
};
export function mixLabel(method: string, english = false) {
  return (english ? MIX_LABEL_EN[method] : MIX_LABEL[method]) ?? method;
}
const COLORS: Record<string, string> = {
  cash: "#059669",
  transfer: "#2563eb",
  card: "#7c3aed",
  cod: "#ea580c",
  credit: "#ea580c",
  credit_paid: "#0d9488",
  transfer_pending: "#0ea5e9",
  unrecorded: "#dc2626",
  credit_note: "#64748b",
};

// Orden 18-oct: cómo se pagó el mes (o una categoría), en % y monto.
export function PaymentMixPie({
  rows,
  categories,
  english = false,
}: {
  rows: MixRow[];
  categories: string[];
  english?: boolean;
}) {
  const labels = english ? MIX_LABEL_EN : MIX_LABEL;
  const [category, setCategory] = useState("");
  const byMethod = new Map<string, number>();
  for (const r of rows)
    if (!category || r.category === category) {
      const key = mixLabel(r.method, english);
      byMethod.set(key, (byMethod.get(key) ?? 0) + Number(r.amount));
    }
  // Por banco: transferencias (y tarjetas con banco). Tarjeta crédito y débito van juntas.
  const byBank = new Map<string, number>();
  for (const r of rows)
    if (r.bank && (!category || r.category === category)) {
      const key = `${mixLabel(r.method, english)} · ${r.bank}`;
      byBank.set(key, (byBank.get(key) ?? 0) + Number(r.amount));
    }
  const banks = [...byBank.entries()].sort((a, b) => b[1] - a[1]);
  const total = [...byMethod.values()].reduce((a, b) => a + b, 0);
  const slices = [...byMethod.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({
      name,
      amount: Math.round(amount * 100) / 100,
      share: total ? Math.round((amount / total) * 1000) / 10 : 0,
      color:
        COLORS[
          Object.keys(labels).find((k) => labels[k] === name) ?? ""
        ] ?? "#94a3b8",
    }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <section className="panel" aria-labelledby="payment-mix-title">
      <div className="panel-heading">
        <h2 id="payment-mix-title">{english ? "Payment methods" : "Formas de pago"}</h2>
        <select
          aria-label={english ? "Category" : "Categoría"}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{english ? "All categories" : "Todas las categorías"}</option>
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
            aria-label={english ? "Payment methods" : "Formas de pago"}
          >
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  outerRadius={100}
                  isAnimationActive={false}
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
        <p className="muted">{english ? "No payments for these dates." : "Sin pagos en estas fechas."}</p>
      )}
      {banks.length > 0 && (
        <ul className="year-pie-list" aria-label={english ? "Payments by bank" : "Cobros por banco"}>
          {banks.map(([name, amount]) => (
            <li key={name}>
              <span>
                <strong>{name}</strong>{" "}
                {formatMoney(Math.round(amount * 100) / 100)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

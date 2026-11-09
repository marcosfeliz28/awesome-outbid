// Demostración para vender: datos de ejemplo fijos, sin llamar a la API ni
// mezclarse con las cifras reales. Solo el administrador la abre (#demo).
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Empty } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { CountUp } from "./impacto";

const DAYS = [
  18400, 21250, 19800, 24600, 23100, 27900, 31200, 26500, 29800, 33400, 30100,
  35600, 38200, 36900,
].map((total, i) => ({ day: `Día ${i + 1}`, total }));
const KPIS = [
  {
    label: "Ventas del mes",
    value: formatMoney(412850),
    note: "+18 % vs. mes anterior",
  },
  {
    label: "Facturas",
    value: (1284).toLocaleString("es-DO"),
    note: "42 por día",
  },
  { label: "Ticket promedio", value: formatMoney(3215.5), note: "+6 %" },
  { label: "Clientes nuevos", value: "96", note: "Este mes" },
];
const TOP = [
  ["Proteína whey 2 lb", 148],
  ["Faja colombiana talla M", 96],
  ["Base líquida tono 220", 81],
  ["Creatina 300 g", 74],
  ["Tenis de entrenamiento", 52],
] as const;

export function Demo() {
  return (
    <>
      <div className="demo-banner" role="note">
        Modo demostración: datos de ejemplo. No son las cifras de tu negocio y
        nada de esta pantalla se guarda.
      </div>
      <div className="page-heading">
        <div>
          <h1>Así se ve tu negocio con Norexos</h1>
          <p>Ventas, inventario y caja en una sola pantalla.</p>
        </div>
      </div>
      <div className="kpi-grid tablero-kpis">
        {KPIS.map((k) => (
          <article className="kpi-card" key={k.label}>
            <div className="kpi-top">
              <span>{k.label}</span>
            </div>
            <strong>
              <CountUp text={k.value} />
            </strong>
            <div className="kpi-note">
              <span>{k.note}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="demo-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Ventas de las últimas dos semanas</h2>
              <p>Ejemplo de una tienda de suplementos y belleza.</p>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={DAYS} margin={{ top: 10, right: 16, left: 16 }}>
                <defs>
                  <linearGradient id="demoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Ventas"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  fill="url(#demoFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Lo más vendido</h2>
              <p>Unidades del mes.</p>
            </div>
          </div>
          <ol className="demo-list">
            {TOP.map(([name, units]) => (
              <li key={name}>
                <span>{name}</span>
                <strong>{units}</strong>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <Empty
            title="Sin alertas de inventario"
            description="Cuando un producto se esté acabando, aparecerá aquí."
          />
        </section>
      </div>
    </>
  );
}

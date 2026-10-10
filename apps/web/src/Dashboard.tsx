import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  TrendingUp,
  ReceiptText,
  Wallet,
  Download,
  ChevronRight,
  TriangleAlert,
  Clock3,
  Package,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Button, Badge } from "@fitstore/ui";
import { formatMoney, can, weekStart } from "@fitstore/shared";
import { api, download, useStore } from "./api";
import { QueryState, today, toast } from "./helpers";

export function Dashboard({ go }: { go: (page: string) => void }) {
  const user = useStore((s) => s.user)!;
  const [period, setPeriod] = useState("month");
  const to = today(),
    from =
      period === "today"
        ? to
        : period === "week"
          ? weekStart()
          : to.slice(0, 8) + "01";
  const query = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => api("/dashboard/summary?from=" + from + "&to=" + to),
  });
  const data = query.data;
  const showProfit = can(user.permissions, "profit:read");
  const metric = [
    {
      label: "Ventas del período",
      value: formatMoney(data?.revenue ?? 0),
      icon: ShoppingBag,
      tone: "violet",
      note: "vs. período anterior",
      trend: data?.trend,
    },
    {
      label: showProfit ? "Ganancia bruta" : "Inventario a la venta",
      value: formatMoney(
        showProfit ? (data?.grossProfit ?? 0) : (data?.inventoryRetail ?? 0),
      ),
      icon: TrendingUp,
      tone: "green",
      note: showProfit
        ? `${data?.margin ?? 0}% de margen`
        : "Valor del stock disponible",
    },
    {
      label: "Ventas registradas",
      value: (data?.invoices ?? 0).toLocaleString("es-DO"),
      icon: ReceiptText,
      tone: "pink",
      note: "Cada venta cuenta",
    },
    {
      label: "Ticket promedio",
      value: formatMoney(data?.ticketAverage ?? 0),
      icon: Wallet,
      tone: "orange",
      note: "Por cada visita a tu tienda",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EL PULSO DE TU NEGOCIO</div>
          <h1>
            Hola, {user.name.split(" ")[0]} <span className="wave">✦</span>
          </h1>
          <p>Un vistazo a tu tienda. Un paso más hacia tus metas.</p>
        </div>
        <div className="heading-actions">
          <select
            aria-label="Período del resumen"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="month">Este mes</option>
            <option value="week">Últimos 7 días</option>
            <option value="today">Hoy</option>
          </select>
          <Button
            variant="secondary"
            onClick={() =>
              download(
                "/reports/sales?format=xlsx&from=" + from + "&to=" + to,
                "ventas.xlsx",
              ).catch((e) => toast(e.message, true))
            }
          >
            <Download size={16} />
            Exportar
          </Button>
          {can(user.permissions, "sale:write") && (
            <Button onClick={() => go("pos")}>
              <Plus size={17} />
              Nueva venta
            </Button>
          )}
        </div>
      </div>
      <QueryState query={query}>
        <div className="welcome-banner">
          <div>
            <span className="banner-chip">
              <span className="live-dot" />
              Tu tienda está en movimiento
            </span>
            <h2>
              Pequeñas decisiones.
              <br />
              <span>Grandes resultados.</span>
            </h2>
            <p>Todo lo que necesitas para vender mejor, en un solo lugar.</p>
            <button onClick={() => go("reports")}>
              Explorar mis reportes <ArrowRight size={16} />
            </button>
          </div>
          {/* Ilustración decorativa: el lector de pantalla la omite. */}
          <div className="banner-illustration" aria-hidden="true">
            <div className="floating-tag">
              <TrendingUp size={20} />
              <span>
                Tu siguiente meta<strong>Seguir creciendo</strong>
              </span>
            </div>
            <div className="bag-shape">
              <div className="bag-handle" />
              <span>
                n<span>•</span>
              </span>
            </div>
            <div className="banner-spark one">✦</div>
            <div className="banner-spark two">✧</div>
            <div className="floating-ticket">
              <ReceiptText />
              <div />
              <div />
              <i />
            </div>
          </div>
        </div>
        <div className="kpi-grid">
          {metric.map((m) => (
            <article className="kpi-card" key={m.label}>
              <div className="kpi-top">
                <span>{m.label}</span>
                <div className={`metric-icon ${m.tone}`}>
                  <m.icon size={19} />
                </div>
              </div>
              <strong>{m.value}</strong>
              <div className="kpi-note">
                {m.trend !== undefined && (
                  <span
                    className={`trend ${m.trend >= 0 ? "positive" : "negative"}`}
                  >
                    {m.trend >= 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}{" "}
                    {Math.abs(m.trend)}%
                  </span>
                )}
                <span>{m.note}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="dashboard-main-grid">
          <section className="panel sales-chart">
            <div className="panel-heading">
              <div>
                <h2>Así van tus ventas</h2>
                <p>Una historia de crecimiento, día a día.</p>
              </div>
              <Badge tone="violet">
                <span className="chart-key" />
                Ventas
              </Badge>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={265}>
                <AreaChart
                  data={data?.daily || []}
                  margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.23}
                      />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 5"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => String(v).slice(8)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    minTickGap={20}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      v >= 1000 ? `${v / 1000}k` : String(v)
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    width={42}
                  />
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v))}
                    labelFormatter={(v) => "Día " + String(v).slice(8)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fill="url(#salesFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-bottom">
              <span>
                <span className="live-dot" />
                Datos de ventas registradas
              </span>
              <button onClick={() => go("reports")}>
                Ver detalle <ChevronRight size={15} />
              </button>
            </div>
          </section>
          <section className="panel alerts-panel">
            <div className="panel-heading">
              <div>
                <h2>Un poco de atención</h2>
                <p>Lo importante, antes de que sea urgente.</p>
              </div>
              <span className="alert-counter">{data?.alerts?.length || 0}</span>
            </div>
            <div className="dashboard-alerts">
              {data?.alerts?.slice(0, 4).map((a: any) => (
                <button
                  key={a.id}
                  className="dashboard-alert"
                  onClick={() => go("alerts")}
                >
                  <span
                    className={`alert-symbol ${a.severity === "high" ? "orange" : "violet"}`}
                  >
                    {a.type === "low_stock" ? (
                      <Package size={17} />
                    ) : a.type === "expiring" ? (
                      <Clock3 size={17} />
                    ) : (
                      <TriangleAlert size={17} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {a.type === "low_stock"
                        ? "Stock para reponer"
                        : a.type === "expiring"
                          ? "Fecha de vencimiento cerca"
                          : a.type === "no_movement"
                            ? "Tiempo de una nueva oportunidad"
                            : a.type === "expense_budget"
                              ? "Revisa tu presupuesto"
                              : "Requiere tu atención"}
                    </strong>
                    <p>{a.message}</p>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!data?.alerts?.length && (
                <p className="empty-small">
                  Todo en orden. Tu tienda está al día.
                </p>
              )}
            </div>
            <button className="panel-link" onClick={() => go("alerts")}>
              Ver todas las alertas <ArrowRight size={16} />
            </button>
          </section>
        </div>
        <div className="dashboard-bottom-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Los favoritos de tu tienda</h2>
                <p>Productos que tus clientes eligen una y otra vez.</p>
              </div>
              <button className="text-link" onClick={() => go("products")}>
                Ver productos <ChevronRight size={15} />
              </button>
            </div>
            <div className="table-wrap" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>PRODUCTO</th>
                    <th>CATEGORÍA</th>
                    <th>UNIDADES</th>
                    <th className="right">VENTAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.top?.slice(0, 5).map((p: any, i: number) => (
                    <tr key={p.name}>
                      <td>
                        <div className="rank-product">
                          <span className={`rank ${i === 0 ? "first" : ""}`}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td>
                        <Badge>{p.category}</Badge>
                      </td>
                      <td>{p.units}</td>
                      <td className="right amount">{formatMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel category-panel">
            <div className="panel-heading">
              <div>
                <h2>Cada categoría cuenta</h2>
                <p>La mezcla que mueve tu tienda.</p>
              </div>
            </div>
            {data?.category?.map((c: any) => {
              const total = data.category.reduce(
                  (a: number, i: any) => a + i.total,
                  0,
                ),
                percent = total ? (c.total / total) * 100 : 0;
              return (
                <div className="category-row" key={c.name}>
                  <div>
                    <span>
                      <i style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <strong>{percent.toFixed(0)}%</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{ width: `${percent}%`, background: c.color }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="insight-note">
              <Sparkles size={19} />
              <p>
                Conoce tu mezcla de ventas y dale espacio a lo que funciona.
              </p>
            </div>
          </section>
        </div>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Comparativo anual</h2>
              <p>Mismo período del año anterior</p>
            </div>
          </div>
          <p>
            {formatMoney(data?.previousYearRevenue ?? 0)} ·{" "}
            {data?.yearOverYear == null
              ? "Sin base comparable"
              : data.yearOverYear + "% de variación"}
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Horas pico</h2>
              <p>Ventas por día y hora · Santo Domingo</p>
            </div>
          </div>
          <div
            className="heatmap"
            role="table"
            aria-label="Ventas por día y hora"
            tabIndex={0}
          >
            <div className="heatmap-row" role="row">
              <span role="columnheader">Hora</span>
              {Array.from({ length: 24 }, (_, hour) => (
                <span role="columnheader" key={hour}>
                  {hour}
                </span>
              ))}
            </div>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
              (day, index) => (
                <div className="heatmap-row" role="row" key={day}>
                  <strong role="rowheader">{day}</strong>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count =
                      data?.peakHours?.find(
                        (r: any) => r.day === index + 1 && r.hour === hour,
                      )?.invoices ?? 0;
                    const max = Math.max(
                      1,
                      ...(data?.peakHours ?? []).map((r: any) => r.invoices),
                    );
                    return (
                      <span
                        key={hour}
                        role="cell"
                        title={day + " " + hour + ":00 · " + count + " ventas"}
                        style={{
                          background: `rgba(124,58,237,${count ? 0.15 + (count / max) * 0.65 : 0.04})`,
                        }}
                      >
                        {count}
                      </span>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        </section>
        {showProfit && (
          <div className="financial-strip">
            <div>
              <span>Gastos del período</span>
              <strong>{formatMoney(data?.expenses ?? 0)}</strong>
            </div>
            <div>
              <span>Comisiones bancarias</span>
              <strong>{formatMoney(data?.fees ?? 0)}</strong>
            </div>
            <div>
              <span>Ganancia neta</span>
              <strong
                className={
                  (data?.netProfit ?? 0) >= 0 ? "green-text" : "danger-text"
                }
              >
                {formatMoney(data?.netProfit ?? 0)}
              </strong>
            </div>
            <div>
              <span>Inventario a costo</span>
              <strong>{formatMoney(data?.inventoryCost ?? 0)}</strong>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}

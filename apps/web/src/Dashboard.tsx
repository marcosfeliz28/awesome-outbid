import { t, useLanguage, money as formatMoney, locale, dateLabel, invoiceLabel } from "./inicioLanguage";
import "./fusion-inicio-integrado.css";
import "./fusion-higgsfield.css";
import { QuickAccessOverview } from "./QuickAccessOverview";
import { chartSalesLabel } from "./chartSalesLabel";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button, Badge, Modal } from "@fitstore/ui";
import { can, weekStart } from "@fitstore/shared";
import { api, download, post, useStore } from "./api";
import { QueryState, today, toast } from "./helpers";
import { YearPie } from "./YearPie";
import { KpiStrip } from "./KpiStrip";
import { CountUp } from "./impacto";
import { kpiStripVisible } from "./kpiStripModel";

const dayBefore = (date: string) =>
  new Date(Date.parse(date + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);

function DayFigures({
  date,
  title,
  tone,
}: {
  date: string;
  title: string;
  tone: "yesterday" | "today" | "other";
}) {
  useLanguage();
  const user = useStore((s) => s.user)!;
  const showProfit = can(user.permissions, "profit:read");
  const query = useQuery({
    queryKey: ["dashboard-day", date],
    queryFn: () => api("/dashboard/summary?from=" + date + "&to=" + date),
    enabled: can(user.permissions, "reports:read"),
  });
  const data = query.data;
  const revenue = Number(data?.revenue ?? 0),
    cost = Number(data?.costTotal ?? 0);
  // DIS-01: sin respuesta no se muestran ceros como si fueran datos. Tras un
  // error la consulta queda en reposo («idle»), así que se mira el error.
  if (!data && (query.isError || query.fetchStatus !== "idle"))
    return (
      <div className={"day-figures day-" + tone}>
        <span className="day-title">{title}</span>
        <strong>—</strong>
        {query.isError ? (
          <small role="alert">
            {t("No se pudo cargar.")}{" "}
            <button type="button" onClick={() => query.refetch()}>
              {t("Reintentar")}
            </button>
          </small>
        ) : (
          <small>{t("Cargando…")}</small>
        )}
      </div>
    );
  return (
    <div className={"day-figures day-" + tone}>
      <span className="day-title">{title}</span>
      <strong>{formatMoney(revenue)}</strong>
      <small>{invoiceLabel(data?.invoices ?? 0)}</small>
      {showProfit && (
        <>
          <small>{t("Costo")} {formatMoney(cost)}</small>
          <small className="day-profit">
            {t("Ganancia (venta − costo)")} <b>{formatMoney(revenue - cost)}</b>
          </small>
        </>
      )}
    </div>
  );
}

function DayCard() {
  useLanguage();
  const to = today(),
    yesterday = dayBefore(to);
  const [day, setDay] = useState(yesterday);
  return (
    <section className="panel day-card" aria-label={t("Ventas por día")}>
      <div className="day-card-row">
        <DayFigures date={yesterday} title={t("Ayer")} tone="yesterday" />
        <DayFigures date={to} title={t("Hoy")} tone="today" />
        <div className="day-figures day-other">
          <label>
            {t("Buscar otro día")}
            <input
              type="date"
              value={day}
              max={to}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </label>
          <DayFigures
            date={day}
            title={dateLabel(day)}
            tone="other"
          />
        </div>
      </div>
    </section>
  );
}

export function Dashboard({ go }: { go: (page: string) => void }) {
  const language = useLanguage();
  const user = useStore((s) => s.user)!;
  const [period, setPeriod] = useState("month");
  const [day, setDay] = useState(today());
  const [voidToApprove, setVoidToApprove] = useState<any>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState("");
  const queryClient = useQueryClient();
  const to = period === "day" ? day : today(),
    from =
      period === "today"
        ? to
        : period === "day"
          ? day
          : period === "week"
            ? weekStart()
            : to.slice(0, 8) + "01";
  const query = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => api("/dashboard/summary?from=" + from + "&to=" + to),
    // 05-B4: quien no ve reportes (la cajera) pasa por aquí al entrar y la
    // API le contestaba 403 en cada inicio de sesión.
    enabled: can(user.permissions, "reports:read"),
  });
  const voidRequests = useQuery<any[]>({
    queryKey: ["void-requests", "pending"],
    queryFn: () => api("/void-requests?status=pending"),
    enabled: can(user.permissions, "*"),
    refetchInterval: 15000,
  });
  const data = query.data;
  const showProfit = can(user.permissions, "profit:read");
  const metric = [
    {
      label: t("Ventas del período"),
      value: formatMoney(data?.revenue ?? 0),
      icon: ShoppingBag,
      tone: "violet",
      note: t("vs. período anterior"),
      trend: data?.trend,
    },
    {
      label: showProfit ? t("Ganancia bruta") : t("Inventario a la venta"),
      value: formatMoney(
        showProfit ? (data?.profit ?? 0) : (data?.inventoryRetail ?? 0),
      ),
      icon: TrendingUp,
      tone: "green",
      note: showProfit
        ? `${data?.margin ?? 0}% ${language === "en" ? "margin" : "de margen"}`
        : t("Valor del stock disponible"),
    },
    {
      label: t("Ventas registradas"),
      value: (data?.invoices ?? 0).toLocaleString(locale()),
      icon: ReceiptText,
      tone: "pink",
      note: t("Cada venta cuenta"),
    },
    {
      label: t("Ticket promedio"),
      value: formatMoney(data?.ticketAverage ?? 0),
      icon: Wallet,
      tone: "orange",
      note: t("Por cada visita a tu tienda"),
    },
  ];
  return (
    <div className="fusion-inicio-integrado" lang={language}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("EL PULSO DE TU NEGOCIO")}</div>
          <h1>
            {t("Resumen")} <span className="fi-heading-divider" aria-hidden="true">/</span> <span className="fi-heading-subtitle">{t("Tu negocio, de un vistazo")}</span>
          </h1>
          <p>{t("Un vistazo a tu tienda. Un paso más hacia tus metas.")}</p>
        </div>
        <div className="heading-actions">
          <select
            aria-label={t("Período del resumen")}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="month">{t("Este mes")}</option>
            <option value="week">{t("Últimos 7 días")}</option>
            <option value="today">{t("Hoy")}</option>
            <option value="day">{t("Otro día…")}</option>
          </select>
          {period === "day" && (
            <input
              type="date"
              aria-label={t("Día del resumen")}
              value={day}
              max={today()}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          )}
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
            {t("Exportar")}
          </Button>
          {can(user.permissions, "sale:write") && (
            <Button onClick={() => go("pos")}>
              <Plus size={17} />
              {t("Nueva venta")}
            </Button>
          )}
        </div>
      </div>
      {can(user.permissions, "*") && !!voidRequests.data?.length && (
        <section
          className="void-request-dashboard"
          aria-label={t("Solicitudes de anulación pendientes")}
        >
          <div>
            <strong>
              {language === "en" ? `${voidRequests.data.length} pending cancellation request${voidRequests.data.length === 1 ? "" : "s"}` : <>
              {voidRequests.data.length} solicitud
              {voidRequests.data.length === 1 ? "" : "es"} de anulación
              pendiente{voidRequests.data.length === 1 ? "" : "s"}
              </>}
            </strong>
            <p>{t("Revisa la venta antes de aprobar o rechazar.")}</p>
          </div>
          <Button onClick={() => go("void-requests")}>
            {t("Revisar solicitudes")}
          </Button>
          {voidRequests.data.slice(0, 3).map((row) => (
            <div className="void-request-dashboard-row" key={row.id}>
              <span>
                {t("Factura")} {row.sale.number} · {row.requester.name}
              </span>
              <Button
                variant="secondary"
                disabled={!!row.approvalBlocker}
                onClick={() => {
                  setVoidError("");
                  setVoidToApprove(row);
                }}
              >
                {t("Anular venta")}
              </Button>
              {row.approvalBlocker && (
                <small>{t("No se puede anular:")} {row.approvalBlocker}</small>
              )}
            </div>
          ))}
        </section>
      )}
      {voidToApprove && (
        <Modal
          open
          title={t("Anular factura ") + voidToApprove.sale.number}
          onClose={() => setVoidToApprove(null)}
        >
          <p>
            {t("Confirma la anulación. Se revertirán los movimientos de esta venta.")}
          </p>
          {voidError && (
            <p role="alert" className="danger-text">
              {voidError}
            </p>
          )}
          <div className="void-request-actions">
            <Button variant="secondary" onClick={() => setVoidToApprove(null)}>
              {t("Cancelar")}
            </Button>
            <Button
              disabled={voidBusy}
              onClick={async () => {
                setVoidBusy(true);
                setVoidError("");
                try {
                  await post(
                    "/void-requests/" + voidToApprove.id + "/approve",
                    {},
                  );
                  await queryClient.invalidateQueries();
                  setVoidToApprove(null);
                  toast(t("Venta anulada y solicitud aprobada."));
                } catch (error: any) {
                  setVoidError(error.message);
                } finally {
                  setVoidBusy(false);
                }
              }}
            >
              {t("Confirmar anulación")}
            </Button>
          </div>
        </Modal>
      )}
      <QueryState query={query}>
        {kpiStripVisible(user.permissions) && <KpiStrip />}
        <div className="kpi-grid tablero-kpis">
          {metric.map((m) => (
            <article className="kpi-card" key={m.label} tabIndex={0}>
              <div className="kpi-top">
                <span>{m.label}</span>
                <div className={`metric-icon ${m.tone}`}>
                  <m.icon size={19} />
                </div>
              </div>
              <strong>
                <CountUp text={m.value} />
              </strong>
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
                <h2>{t("Así van tus ventas")}</h2>
                <p>{t("Una historia de crecimiento, día a día.")}</p>
              </div>
              <Badge tone="violet">
                <span className="chart-key" />
                {t("Ventas")}
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
                        stopColor="var(--fi-accent, #8b5cf6)"
                        stopOpacity={0.23}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--fi-accent, #8b5cf6)"
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
                    labelFormatter={(v) => t("Día ") + String(v).slice(8)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--fi-accent, #8b5cf6)"
                    strokeWidth={3}
                    fill="url(#salesFill)"
                    dot={(point: {
                      cx?: number;
                      cy?: number;
                      value?: unknown;
                      payload?: { total?: unknown };
                    }) => (
                      <circle
                        cx={point.cx}
                        cy={point.cy}
                        r={5}
                        className="fi-chart-point"
                        tabIndex={0}
                        aria-label={chartSalesLabel(point, formatMoney, language)}
                      >
                        <title>{chartSalesLabel(point, formatMoney, language)}</title>
                      </circle>
                    )}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-bottom">
              <span>
                <span className="live-dot" />
                {t("Datos de ventas registradas")}
              </span>
              <button onClick={() => go("reports")}>
                {t("Ver detalle")} <ChevronRight size={15} />
              </button>
            </div>
          </section>
          <QuickAccessOverview permissions={user.permissions} go={go} />
          <section className="panel alerts-panel">
            <div className="panel-heading">
              <div>
                <h2>{t("Un poco de atención")}</h2>
                <p>{t("Lo importante, antes de que sea urgente.")}</p>
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
                        ? t("Stock para reponer")
                        : a.type === "expiring"
                          ? t("Fecha de vencimiento cerca")
                          : a.type === "no_movement"
                            ? t("Tiempo de una nueva oportunidad")
                            : a.type === "expense_budget"
                              ? t("Revisa tu presupuesto")
                              : t("Requiere tu atención")}
                    </strong>
                    <p>{a.message}</p>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!data?.alerts?.length && (
                <p className="empty-small">
                  {t("Todo en orden. Tu tienda está al día.")}
                </p>
              )}
            </div>
            <button className="panel-link" onClick={() => go("alerts")}>
              {t("Ver todas las alertas")} <ArrowRight size={16} />
            </button>
          </section>
        </div>
        <div className="dashboard-bottom-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t("Los favoritos de tu tienda")}</h2>
                <p>{t("Productos que tus clientes eligen una y otra vez.")}</p>
              </div>
              <button className="text-link" onClick={() => go("products")}>
                {t("Ver productos")} <ChevronRight size={15} />
              </button>
            </div>
            <div className="table-wrap" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>{t("PRODUCTO")}</th>
                    <th>{t("CATEGORÍA")}</th>
                    <th>{t("UNIDADES")}</th>
                    <th className="right">{t("VENTAS")}</th>
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
                <h2>{t("Cada categoría cuenta")}</h2>
                <p>{t("La mezcla que mueve tu tienda.")}</p>
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
                {t("Conoce tu mezcla de ventas y dale espacio a lo que funciona.")}
              </p>
            </div>
          </section>
        </div>
        <div className="welcome-banner">
          <div>
            <span className="banner-chip">
              <span className="live-dot" />
              {t("Tu tienda está en movimiento")}
            </span>
            <h2>
              {t("Pequeñas decisiones.")}
              <br />
              <span>{t("Grandes resultados.")}</span>
            </h2>
            <p>{t("Todo lo que necesitas para vender mejor, en un solo lugar.")}</p>
            <button onClick={() => go("reports")}>
              {t("Explorar mis reportes")} <ArrowRight size={16} />
            </button>
          </div>
          {/* Ilustración decorativa: el lector de pantalla la omite. */}
          <div className="banner-illustration" aria-hidden="true">
            <div className="floating-tag">
              <TrendingUp size={20} />
              <span>
                {t("Tu siguiente meta")}<strong>{t("Seguir creciendo")}</strong>
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
        <YearPie go={go} />
        <DayCard />
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{t("Comparativo anual")}</h2>
              <p>{t("Mismo período del año anterior")}</p>
            </div>
          </div>
          <p>
            {formatMoney(data?.previousYearRevenue ?? 0)} ·{" "}
            {data?.yearOverYear == null
              ? t("Sin base comparable")
              : data.yearOverYear + t("% de variación")}
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{t("Horas pico")}</h2>
              <p>{t("Ventas por día y hora · Santo Domingo")}</p>
            </div>
          </div>
          <div
            className="heatmap"
            role="table"
            aria-label={t("Ventas por día y hora")}
            tabIndex={0}
          >
            <div className="heatmap-row" role="row">
              <span role="columnheader">{t("Hora")}</span>
              {Array.from({ length: 24 }, (_, hour) => (
                <span role="columnheader" key={hour}>
                  {hour}
                </span>
              ))}
            </div>
            {[t("Lun"), t("Mar"), t("Mié"), t("Jue"), t("Vie"), t("Sáb"), t("Dom")].map(
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
                        title={day + " " + hour + ":00 · " + count + t(" ventas")}
                        style={{
                          // Tope de 0.62: con más color, el número de la celda más
                          // fuerte pasaba de 4.5:1 a unos 4.4:1 según los datos.
                          background: `rgba(124,58,237,${count ? 0.12 + (count / max) * 0.5 : 0.04})`,
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
              <span>{t("Gastos del período")}</span>
              <strong>{formatMoney(data?.expenses ?? 0)}</strong>
            </div>
            <div>
              <span>{t("Comisiones bancarias")}</span>
              <strong>{formatMoney(data?.fees ?? 0)}</strong>
            </div>
            <div>
              <span>{t("Mermas, ajustes y devoluciones a proveedor (a costo)")}</span>
              <strong>{formatMoney(data?.inventoryLoss ?? 0)}</strong>
            </div>
            {!!data?.countCorrections && (
              <div>
                <span>{t("Correcciones del conteo de inventario (no restan)")}</span>
                <strong>{formatMoney(data.countCorrections)}</strong>
              </div>
            )}
            <div>
              <span>{t("Ganancia neta")}</span>
              <strong
                className={
                  (data?.netProfit ?? 0) >= 0 ? "green-text" : "danger-text"
                }
              >
                {formatMoney(data?.netProfit ?? 0)}
              </strong>
            </div>
            <div>
              <span>{t("Inventario a costo")}</span>
              <strong>{formatMoney(data?.inventoryCost ?? 0)}</strong>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

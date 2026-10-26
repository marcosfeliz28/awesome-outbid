import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { api, useStore } from "./api";
import { QueryState, today } from "./helpers";
import {
  dailyBriefQuestion,
  dashboardQuestion,
  type AskDashboard,
  type DashboardTopic,
} from "./dashboardQuestions";
import "./ExecutiveDashboard.css";

export type DashboardSummary = {
  revenue?: number;
  grossProfit?: number;
  invoices?: number;
  ticketAverage?: number;
  margin?: number;
  inventoryRetail?: number;
};
export function useBusinessDay() {
  const [date, setDate] = useState(today);
  useEffect(() => {
    const timer = setInterval(() => setDate(today()), 30000);
    return () => clearInterval(timer);
  }, []);
  return date;
}
export function AskNexora({
  label,
  topic,
  from,
  to,
  onAsk,
}: {
  label: string;
  topic: DashboardTopic;
  from: string;
  to: string;
  onAsk: AskDashboard;
}) {
  return (
    <button
      type="button"
      className="nexora-card-question"
      aria-label={`Pregúntale a Nexora: ${label}`}
      onClick={() => onAsk(label, dashboardQuestion(topic, from, to))}
    >
      <Sparkles size={15} aria-hidden="true" /> Pregúntale a Nexora
    </button>
  );
}
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const money = (value: unknown) =>
  number(value) ? formatMoney(value) : "No disponible";
const dateLabel = (date: string) => date.split("-").reverse().join("/");

export function ExecutiveMetrics({
  data,
  showProfit,
  from,
  to,
  onAsk,
}: {
  data: DashboardSummary;
  showProfit: boolean;
  from: string;
  to: string;
  onAsk: AskDashboard;
}) {
  const metrics: {
    label: string;
    value: string;
    note: string;
    topic: DashboardTopic;
  }[] = [
    {
      label: "Ventas del período",
      value: money(data.revenue),
      note: "Devoluciones descontadas · incluye ITBIS. No equivale a cobros.",
      topic: "sales",
    },
    showProfit
      ? {
          label: "Ganancia bruta",
          value: money(data.grossProfit),
          note: "Después de ITBIS neto y costo; antes de gastos y comisiones.",
          topic: "profit",
        }
      : {
          label: "Inventario actual a la venta",
          value: money(data.inventoryRetail),
          note: "Foto actual de almacenes. No es inventario histórico.",
          topic: "inventory",
        },
    {
      label: "Ventas registradas",
      value: number(data.invoices)
        ? data.invoices.toLocaleString("es-DO")
        : "No disponible",
      note: "Ventas completadas en el período seleccionado.",
      topic: "invoices",
    },
    {
      label: "Ticket promedio",
      value: money(data.ticketAverage),
      note: "Ventas netas de devoluciones / ventas completadas.",
      topic: "ticket",
    },
  ];
  return (
    <section aria-label="Indicadores del período" className="executive-metrics">
      {metrics.map((m) => (
        <article className="panel executive-metric" key={m.label}>
          <h2>{m.label}</h2>
          <strong className="amount">{m.value}</strong>
          <p>{m.note}</p>
          <AskNexora
            label={m.label}
            topic={m.topic}
            from={from}
            to={to}
            onAsk={onAsk}
          />
        </article>
      ))}
    </section>
  );
}

/** Las cifras vienen del reporte por fecha. La lectura de IA es independiente. */
export function DailyBrief({
  showProfit,
  onAsk,
}: {
  showProfit: boolean;
  onAsk: AskDashboard;
}) {
  const date = useBusinessDay();
  const { user, online } = useStore();
  const query = useQuery<DashboardSummary>({
    queryKey: ["dashboard", date, date],
    queryFn: () => api(`/dashboard/summary?from=${date}&to=${date}`),
    refetchInterval: 60000,
  });
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    generation.current++;
    inFlight.current = false;
    setAnswer("");
    setError("");
    setBusy(false);
    setRemaining(null);
    setGeneratedAt(null);
    return () => {
      generation.current++;
    };
  }, [date, user?.id, user?.branchId, showProfit]);
  async function generate() {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      const result = await api<{ answer: string; remaining: number | null }>(
        "/assistant/ask",
        {
          method: "POST",
          body: JSON.stringify({
            messages: [{ role: "user", content: dailyBriefQuestion(date) }],
          }),
        },
      );
      if (current !== generation.current) return;
      if (!result.answer?.trim())
        throw new Error(
          "Nexora no devolvió una lectura. Puedes intentarlo de nuevo.",
        );
      setAnswer(result.answer);
      setRemaining(result.remaining);
      setGeneratedAt(new Date());
    } catch (cause) {
      if (current === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo preparar la lectura.",
        );
    } finally {
      if (current === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section className="panel daily-brief" aria-labelledby="daily-brief-title">
      <header className="executive-card-heading">
        <div>
          <span className="eyebrow">
            HOY · {dateLabel(date)} · SANTO DOMINGO
          </span>
          <h2 id="daily-brief-title">Tu día, en claro</h2>
        </div>
        <Sparkles size={21} aria-hidden="true" />
      </header>
      <QueryState query={query}>
        <p className="daily-brief-facts">
          {number(query.data?.invoices) && query.data.invoices === 0
            ? "Todavía no hay ventas completadas hoy."
            : `${number(query.data?.invoices) ? query.data.invoices.toLocaleString("es-DO") : "Cantidad no disponible"} ventas completadas hoy.`}{" "}
          Venta neta de devoluciones:{" "}
          <strong>{money(query.data?.revenue)}</strong>.
          {showProfit && (
            <>
              {" "}
              Ganancia bruta: <strong>{money(query.data?.grossProfit)}</strong>.
            </>
          )}
        </p>
        <p className="executive-source">
          Fuente: Resumen de ventas del {dateLabel(date)}. Las ventas no
          equivalen al efectivo cobrado.
        </p>
      </QueryState>
      <div className="daily-brief-ai">
        <h3>Lectura con IA</h3>
        <p>
          Consulta facturación por persona, descuentos y anulaciones del día.
          Sus reportes pueden tener definiciones distintas a estas cifras.
        </p>
        <p className="executive-source">
          Se prepara solo cuando lo solicitas y utiliza la cuota de tu plan.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !online}
          onClick={() => void generate()}
        >
          <Sparkles size={16} aria-hidden="true" />
          {busy
            ? "Preparando lectura…"
            : answer
              ? "Actualizar lectura de IA"
              : "Preparar resumen con IA"}
        </Button>
        {!online && <p role="status">Conéctate para consultar a Nexora.</p>}
        {busy && <div role="status">Consultando las fuentes disponibles…</div>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {answer && (
          <div
            className="daily-ai-answer"
            aria-label="Lectura generada por Nexora"
          >
            <p className="executive-source">
              Interpretación de IA ·{" "}
              {generatedAt?.toLocaleTimeString("es-DO", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Santo_Domingo",
              })}
              . Contrasta sus cifras, fuentes y fechas con los reportes.
            </p>
            <p>{answer}</p>
            {remaining !== null && (
              <small>
                {remaining} consultas restantes según la última respuesta.
              </small>
            )}
          </div>
        )}
      </div>
      <AskNexora
        label="Resumen de hoy"
        topic="sales"
        from={date}
        to={date}
        onAsk={onAsk}
      />
    </section>
  );
}

type DashboardAlert = {
  id: string;
  type: string;
  severity: string;
  status?: string;
  message: string;
  createdAt?: string;
};
const alertLabels: Record<string, string> = {
  low_stock: "Existencias bajas",
  expiring: "Vencimiento cercano",
  no_movement: "Producto sin movimiento",
  expense_budget: "Presupuesto de gastos",
  low_margin: "Margen bajo",
};
export function IntelligentAlerts({
  alerts,
  canReview,
  from,
  to,
  onAsk,
  go,
}: {
  alerts: DashboardAlert[];
  canReview: boolean;
  from: string;
  to: string;
  onAsk: AskDashboard;
  go: (page: string) => void;
}) {
  const ranked = alerts
    .map((alert, index) => ({ alert, index }))
    .sort(
      (a, b) =>
        (({ high: 0, medium: 1, low: 2 })[a.alert.severity] ?? 3) -
          ({ high: 0, medium: 1, low: 2 }[b.alert.severity] ?? 3) ||
        a.index - b.index,
    );
  return (
    <section
      className="panel intelligent-alerts"
      aria-labelledby="intelligent-alerts-title"
    >
      <header className="executive-card-heading">
        <div>
          <span className="eyebrow">PENDIENTES ACTUALES</span>
          <h2 id="intelligent-alerts-title">Necesita atención</h2>
        </div>
        <Badge>{alerts.length} visibles</Badge>
      </header>
      <p className="executive-source">
        Hasta 6 alertas guardadas sin resolver, priorizadas por severidad dentro
        de esta muestra. No se filtran por el período de ventas.
      </p>
      {ranked.length ? (
        <ul className="intelligent-alert-list">
          {ranked.map(({ alert }) => (
            <li key={alert.id}>
              <div className="intelligent-alert-meta">
                <Badge tone={alert.severity === "high" ? "danger" : "warning"}>
                  {{
                    high: "Prioridad alta",
                    medium: "Prioridad media",
                    low: "Prioridad baja",
                  }[alert.severity] || "Por revisar"}
                </Badge>
                <span>
                  {alert.status === "seen"
                    ? "Vista"
                    : alert.status === "new"
                      ? "Nueva"
                      : "Sin resolver"}
                </span>
              </div>
              <h3>{alertLabels[alert.type] || "Revisión operativa"}</h3>
              <p>{alert.message}</p>
              <small>
                Origen: regla del sistema. Revisa el detalle antes de actuar.
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="executive-empty">
          No hay alertas en la muestra recibida. Esto no garantiza que no
          existan otros pendientes.
        </p>
      )}
      <div className="executive-actions">
        {canReview && (
          <Button variant="secondary" onClick={() => go("alerts")}>
            Revisar alertas <ArrowUpRight size={15} />
          </Button>
        )}
        <AskNexora
          label="Alertas"
          topic="alerts"
          from={from}
          to={to}
          onAsk={onAsk}
        />
      </div>
      <small className="executive-source">
        Nexora explica cómo priorizar alertas; esta pregunta no verifica la
        muestra visible ni cambia sus estados.
      </small>
    </section>
  );
}

export function DashboardFreshness({
  updatedAt,
  refreshing,
  refresh,
}: {
  updatedAt: number;
  refreshing: boolean;
  refresh: () => void;
}) {
  return (
    <div className="dashboard-freshness">
      <span>
        Actualizado{" "}
        {updatedAt
          ? new Date(updatedAt).toLocaleTimeString("es-DO", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Santo_Domingo",
            })
          : "—"}{" "}
        · Santo Domingo
      </span>
      <button type="button" onClick={refresh} disabled={refreshing}>
        <RefreshCw size={14} aria-hidden="true" />
        {refreshing ? "Actualizando…" : "Actualizar datos"}
      </button>
    </div>
  );
}

import { AlertTriangle, ArrowRight, ScanSearch } from "lucide-react";
import "./AnomalyScanner.css";

export type AuditFact = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  createdAt: string;
  saleId?: string | null;
  after?: unknown;
};

type FactDefinition = {
  singular: string;
  plural: string;
};

const DEFINITIONS: Record<string, FactDefinition> = {
  "sale:payment_method_corrected": {
    singular: "cambio de método de pago",
    plural: "cambios de método de pago",
  },
  "sale:sale_seller_changed": {
    singular: "cambio de vendedora",
    plural: "cambios de vendedora",
  },
  "cash:close_difference": {
    singular: "cierre con diferencia",
    plural: "cierres con diferencia",
  },
  "cash:close_on_behalf": {
    singular: "cierre realizado por otra persona",
    plural: "cierres realizados por otra persona",
  },
  "cash:close_vouchers": {
    singular: "cierre con vale de caja",
    plural: "cierres con vale de caja",
  },
  "sale:discount_approved": {
    singular: "descuento aprobado",
    plural: "descuentos aprobados",
  },
  "sale:void": { singular: "anulación", plural: "anulaciones" },
  "payment:verify": {
    singular: "transferencia verificada",
    plural: "transferencias verificadas",
  },
  "payment:reject": {
    singular: "transferencia rechazada",
    plural: "transferencias rechazadas",
  },
};

export type AuditSummary = {
  action: string;
  count: number;
  label: string;
};

export function summarizeAuditFacts(rows: AuditFact[]): AuditSummary[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.entity}:${row.action}`;
    if (!DEFINITIONS[key]) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([action, count]) => ({
      action,
      count,
      label: `${count} ${count === 1 ? DEFINITIONS[action].singular : DEFINITIONS[action].plural}`,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function AnomalyScanner({
  rows,
  busy = false,
  onOpenSale,
}: {
  rows: AuditFact[];
  busy?: boolean;
  onOpenSale: (saleId: string) => void;
}) {
  const summaries = summarizeAuditFacts(rows);
  const facts = rows
    .filter((row) => DEFINITIONS[`${row.entity}:${row.action}`] && row.saleId)
    .slice(0, 8);

  return (
    <article
      className="admin-card anomaly-scanner"
      aria-labelledby="anomaly-title"
    >
      <header>
        <span className="admin-card-icon" aria-hidden="true">
          <ScanSearch size={20} />
        </span>
        <div>
          <h2 id="anomaly-title">Movimientos para revisar</h2>
          <p>Hechos registrados hoy, sin calificar a ninguna persona.</p>
        </div>
      </header>

      {busy ? (
        <p role="status">Cargando movimientos…</p>
      ) : summaries.length === 0 ? (
        <p className="anomaly-empty">No hay movimientos de este tipo hoy.</p>
      ) : (
        <>
          <ul className="anomaly-summary" aria-label="Resumen del día">
            {summaries.map((summary) => (
              <li key={summary.action}>
                <AlertTriangle size={16} aria-hidden="true" />
                {summary.label}
              </li>
            ))}
          </ul>
          <ul className="anomaly-list" aria-label="Detalle de movimientos">
            {facts.map((row) => {
              const saleId = row.saleId!;
              const definition = DEFINITIONS[`${row.entity}:${row.action}`];
              return (
                <li key={row.id}>
                  <div>
                    <strong>{definition.singular}</strong>
                    <time dateTime={row.createdAt}>
                      {new Intl.DateTimeFormat("es-DO", {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(row.createdAt))}
                    </time>
                  </div>
                  <button type="button" onClick={() => onOpenSale(saleId)}>
                    Abrir venta <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}

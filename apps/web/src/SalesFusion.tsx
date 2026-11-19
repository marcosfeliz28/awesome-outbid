import type { ReactNode } from "react";
import { FileText, ShoppingBag, CheckCircle2, Ban } from "lucide-react";
import { useLanguage } from "./inicioLanguage";
import "./fusion-ventas.css";

/** Counts describe only the rows loaded by the existing query, not period totals. */
export function SalesFusionStats({ rows }: { rows: { status: string }[] }) {
  const en = useLanguage() === "en";
  return (
    <div
      className="sales-fusion-stats"
      aria-label={en ? "Loaded results" : "Resultados cargados"}
    >
      {[
        [
          ShoppingBag,
          en ? "Results loaded" : "Resultados cargados",
          rows.length,
        ],
        [
          CheckCircle2,
          en ? "Completed" : "Completadas",
          rows.filter((r) => r.status === "completed").length,
        ],
        [
          Ban,
          en ? "Voided" : "Anuladas",
          rows.filter((r) => r.status === "voided").length,
        ],
      ].map(([Icon, label, count]) => {
        const Glyph = Icon as typeof ShoppingBag;
        return (
          <div className="sales-fusion-stat" key={String(label)}>
            <Glyph aria-hidden="true" size={30} />
            <div>
              <span>{String(label)}</span>
              <strong>{String(count)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SalesFusionPreview({
  number,
  total,
  status,
  customer,
  onOpen,
}: {
  number?: string;
  total?: ReactNode;
  status?: string;
  customer?: string;
  onOpen: () => void;
}) {
  const en = useLanguage() === "en";
  return (
    <aside
      className="sales-fusion-preview"
      aria-label={en ? "Sale preview" : "Vista previa de venta"}
    >
      <h2>{en ? "Sale details" : "Detalle de venta"}</h2>
      <p>
        {number
          ? en
            ? "Selected sale. Open the full details to review its items and payments."
            : "Venta seleccionada. Abre el detalle completo para revisar sus artículos y pagos."
          : en
            ? "Choose a sale number to preview it."
            : "Elige un número de venta para ver su resumen."}
      </p>
      <div className="sales-fusion-receipt">
        <FileText size={68} aria-hidden="true" />
      </div>
      {number ? (
        <>
          <span>{en ? "Receipt" : "Folio"}</span>
          <h3>{number}</h3>
          <dl>
            <div>
              <dt>{en ? "Customer" : "Cliente"}</dt>
              <dd>{customer ?? "—"}</dd>
            </div>
            <div>
              <dt>{en ? "Status" : "Estado"}</dt>
              <dd>
                {status === "voided"
                  ? en
                    ? "Voided"
                    : "Anulada"
                  : en
                    ? "Completed"
                    : "Completada"}
              </dd>
            </div>
            <div className="sales-fusion-total">
              <dt>Total</dt>
              <dd>{total}</dd>
            </div>
          </dl>
          <button type="button" className="sales-fusion-open" onClick={onOpen}>
            <FileText size={20} aria-hidden="true" />
            {en ? "View full details" : "Ver detalle completo"}
          </button>
          <small>
            {en
              ? "Payments, items and available actions appear in the full details."
              : "Los pagos, artículos y acciones disponibles se muestran en el detalle completo."}
          </small>
        </>
      ) : (
        <p>
          {en
            ? "Select a sale from the list."
            : "Selecciona una venta de la lista."}
        </p>
      )}
    </aside>
  );
}

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { QueryState } from "./helpers";
import { courierCsv, expectedCents, type CourierRow } from "./courier-utils";
import "./transferReconciliation.css";

type Pending = { total: string; rows: (CourierRow & { id: string })[] };
type Payout = {
  operationId: string;
  date: string;
  paidBy: string;
  note: string | null;
  total: string;
  sales: { invoice: string; courierName: string; fee: string }[];
};
const dateText = (date: string) =>
  new Date(date).toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "short",
  });

export function CourierPayouts() {
  const user = useStore((state) => state.user)!;
  const admin = can(user.permissions, "*");
  const client = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const suffix = params.size ? `?${params}` : "";
  const pending = useQuery<Pending>({
    queryKey: ["courier-pending", from, to],
    queryFn: () => api("/courier/pending" + suffix),
    enabled: admin,
  });
  const history = useQuery<Payout[]>({
    queryKey: ["courier-payouts", from, to],
    queryFn: () => api("/courier/payouts" + suffix),
    enabled: admin,
  });
  if (!admin)
    return <p role="alert">Esta pantalla es solo para administración.</p>;
  const rows = pending.data?.rows ?? [];
  const picked = rows.filter((row) => selected.has(row.id));
  const selectedCents = picked.reduce(
    (sum, row) => sum + expectedCents("0", row.courierFee),
    0,
  );
  const resetSelection = () => {
    setSelected(new Set());
    setOperationId(crypto.randomUUID());
    setMessage("");
    setError("");
  };
  const toggle = (id: string) => {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setOperationId(crypto.randomUUID());
  };
  const exportCsv = () => {
    const blob = new Blob([courierCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "envios-pendientes.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  const pay = async () => {
    if (busyRef.current || !picked.length) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await post<{ total: string; replayed: boolean }>(
        "/courier/payouts",
        {
          saleIds: picked.map((row) => row.id),
          operationId,
          note: note.trim() || undefined,
        },
      );
      setMessage(
        `Pago registrado: ${formatMoney(Number(result.total))}${result.replayed ? " (operación ya registrada)" : ""}. No se movió dinero de caja.`,
      );
      setNote("");
      setSelected(new Set());
      setOperationId(crypto.randomUUID());
      await Promise.all([
        client.invalidateQueries({ queryKey: ["courier-pending"] }),
        client.invalidateQueries({ queryKey: ["courier-payouts"] }),
        client.invalidateQueries({ queryKey: ["sales"] }),
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar el pago.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="transfer-reconciliation courier-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRACIÓN</div>
          <h1>Envíos del mensajero</h1>
          <p>
            Consulta cuánto se debe y registra los envíos pagados. Este registro
            no mueve la caja.
          </p>
        </div>
      </div>
      <div className="panel reconciliation-toolbar">
        <label className="field">
          <span>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetSelection();
            }}
          />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              resetSelection();
            }}
          />
        </label>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
          Exportar CSV
        </Button>
      </div>
      {message && (
        <p className="panel reconciliation-ok" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="panel reconciliation-error" role="alert">
          {error}
        </p>
      )}
      <QueryState query={pending}>
        <div className="panel">
          <h2>Pendientes</h2>
          <p>
            <strong>Total a pagar:</strong>{" "}
            {formatMoney(Number(pending.data?.total ?? 0))}
          </p>
          {rows.length ? (
            <div className="reconciliation-list">
              {rows.map((row) => (
                <label className="reconciliation-row courier-pick" key={row.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    disabled={busy}
                    onChange={() => toggle(row.id)}
                    aria-label={`Seleccionar envío de ${row.invoice}`}
                  />
                  <span className="reconciliation-details">
                    <strong>
                      {row.invoice} · {formatMoney(Number(row.courierFee))}
                    </strong>
                    <span>
                      {dateText(row.date)} · {row.customer || "Sin cliente"}
                    </span>
                    <span>Mensajero: {row.courierName}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p>No hay envíos pendientes en este período.</p>
          )}
          <div className="reconciliation-totals">
            <p>
              <strong>Seleccionados:</strong> {picked.length} ·{" "}
              {formatMoney(selectedCents / 100)}
            </p>
            <label className="field">
              <span>Nota del pago (opcional)</span>
              <input
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <Button
              disabled={!picked.length || busy}
              onClick={() => void pay()}
            >
              {busy ? "Registrando…" : "Marcar como pagado"}
            </Button>
          </div>
        </div>
      </QueryState>
      <QueryState query={history}>
        <div className="panel">
          <h2>Historial de pagados</h2>
          {history.data?.length ? (
            <div className="reconciliation-list">
              {history.data.map((payout) => (
                <article
                  className="reconciliation-row"
                  key={payout.operationId}
                >
                  <div className="reconciliation-details">
                    <strong>
                      {dateText(payout.date)} ·{" "}
                      {formatMoney(Number(payout.total))}
                    </strong>
                    <span>Registró: {payout.paidBy}</span>
                    <span>
                      Facturas:{" "}
                      {payout.sales
                        .map(
                          (sale) =>
                            `${sale.invoice} (${sale.courierName}: ${formatMoney(Number(sale.fee))})`,
                        )
                        .join(", ")}
                    </span>
                    {payout.note && <span>Nota: {payout.note}</span>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>No hay pagos registrados en este período.</p>
          )}
        </div>
      </QueryState>
    </section>
  );
}

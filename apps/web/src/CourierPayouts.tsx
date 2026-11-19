import { usePremiumWorkspace } from "./PremiumWorkspace";
import { useLanguage } from "./inicioLanguage";
import { operationalAuxText } from "./operationalAuxLanguage";
import { Truck } from "lucide-react";
import "./operationalAux.css";
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
const dateText = (date: string, english = false) =>
  new Date(date).toLocaleString(english ? "en-US" : "es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "short",
  });

export function CourierPayouts() {
  usePremiumWorkspace();
  const english = useLanguage() === "en";
  const t = (text: string) => operationalAuxText(english, text);
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
    return (
      <p role="alert">{t("Esta pantalla es solo para administración.")}</p>
    );
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
    <section className="transfer-reconciliation courier-page operational-aux operational-aux-courier norexos-premium-workspace">
      <div className="page-heading">
        <span className="operational-aux-emblem" aria-hidden="true">
          <Truck size={34} strokeWidth={1.6} />
        </span>
        <div>
          <div className="eyebrow">{t("ADMINISTRACIÓN")}</div>
          <h1>{t("Envíos del mensajero")}</h1>
          <p>
            {t(
              "Consulta cuánto se debe y registra los envíos pagados. Este registro no mueve la caja.",
            )}
          </p>
        </div>
      </div>
      <div className="panel reconciliation-toolbar">
        <label className="field">
          <span>{t("Desde")}</span>
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
          <span>{t("Hasta")}</span>
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
          {t("Exportar CSV")}
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
      <QueryState english={english} query={pending}>
        <div className="panel">
          <h2>{t("Pendientes")}</h2>
          <p>
            <strong>{t("Total a pagar:")}</strong>{" "}
            <span className="operational-aux-money">
              {formatMoney(Number(pending.data?.total ?? 0))}
            </span>
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
                    aria-label={`${t("Seleccionar envío de ")}${row.invoice}`}
                  />
                  <span className="reconciliation-details">
                    <strong>
                      {row.invoice} ·{" "}
                      <span className="operational-aux-money">
                        {formatMoney(Number(row.courierFee))}
                      </span>
                    </strong>
                    <span>
                      {dateText(row.date, english)} ·{" "}
                      {row.customer || t("Sin cliente")}
                    </span>
                    <span>
                      {t("Mensajero:")} {row.courierName}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p>{t("No hay envíos pendientes en este período.")}</p>
          )}
          <div className="reconciliation-totals">
            <p>
              <strong>{t("Seleccionados:")}</strong> {picked.length} ·{" "}
              <span className="operational-aux-money">
                {formatMoney(selectedCents / 100)}
              </span>
            </p>
            <label className="field">
              <span>{t("Nota del pago (opcional)")}</span>
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
              {busy ? t("Registrando…") : t("Marcar como pagado")}
            </Button>
          </div>
        </div>
      </QueryState>
      <QueryState english={english} query={history}>
        <div className="panel">
          <h2>{t("Historial de pagados")}</h2>
          {history.data?.length ? (
            <div className="reconciliation-list">
              {history.data.map((payout) => (
                <article
                  className="reconciliation-row"
                  key={payout.operationId}
                >
                  <div className="reconciliation-details">
                    <strong>
                      {dateText(payout.date, english)} ·{" "}
                      <span className="operational-aux-money">
                        {formatMoney(Number(payout.total))}
                      </span>
                    </strong>
                    <span>
                      {t("Registró:")} {payout.paidBy}
                    </span>
                    <span>
                      {t("Facturas:")}{" "}
                      {payout.sales.map((sale, index) => (
                        <span key={`${sale.invoice}:${index}`}>
                          {index > 0 ? ", " : ""}
                          {sale.invoice} ({sale.courierName}:{" "}
                          <span className="operational-aux-money">
                            {formatMoney(Number(sale.fee))}
                          </span>
                          )
                        </span>
                      ))}
                    </span>
                    {payout.note && (
                      <span>
                        {t("Nota:")} {payout.note}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>{t("No hay pagos registrados en este período.")}</p>
          )}
        </div>
      </QueryState>
    </section>
  );
}

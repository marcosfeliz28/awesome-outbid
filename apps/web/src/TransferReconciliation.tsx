import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { QueryState } from "./helpers";
import {
  amountCents,
  bankGroup,
  BANK_GROUPS,
  reconciliationCsv,
  selectedTotalCents,
  verifyOneByOne,
  type PendingTransfer,
  type VerifyResult,
} from "./transfer-reconciliation-utils";
import "./transferReconciliation.css";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "short",
  });

export function TransferReconciliation() {
  const user = useStore((state) => state.user)!;
  const admin = can(user.permissions, "*");
  const client = useQueryClient();
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bankTotals, setBankTotals] = useState<Record<string, string>>({});
  const [results, setResults] = useState<
    (VerifyResult & { invoice: string })[]
  >([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const query = useQuery<PendingTransfer[]>({
    queryKey: ["pending-transfers", date],
    queryFn: () =>
      api(
        "/payments/pending-transfers" +
          (date ? "?date=" + encodeURIComponent(date) : ""),
      ),
    enabled: admin,
    refetchInterval: 30000,
  });

  if (!admin)
    return <p role="alert">Esta pantalla es solo para administración.</p>;

  const rows = query.data ?? [];
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["pending-transfers"] });
  const exportCsv = () => {
    const blob = new Blob([reconciliationCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transferencias-pendientes${date ? "-" + date : ""}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  const verifyGroup = async (groupRows: PendingTransfer[]) => {
    if (busyRef.current) return;
    const picked = groupRows.filter((row) => selected.has(row.id));
    if (!picked.length) return;
    busyRef.current = true;
    setBusy(true);
    setResults([]);
    try {
      const output = await verifyOneByOne(
        picked.map((row) => row.id),
        (id) => post("/payments/" + id + "/verify", {}),
      );
      setResults(
        output.map((result) => ({
          ...result,
          invoice: picked.find((row) => row.id === result.id)!.invoice,
        })),
      );
      setSelected((old) => {
        const next = new Set(old);
        for (const result of output) if (result.ok) next.delete(result.id);
        return next;
      });
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const reject = async (id: string) => {
    if (busyRef.current || rejectReason.trim().length < 3) return;
    busyRef.current = true;
    setBusy(true);
    const invoice = rows.find((row) => row.id === id)?.invoice ?? "";
    try {
      await post("/payments/" + id + "/reject", {
        reason: rejectReason.trim(),
      });
      setResults([{ id, invoice, ok: true, message: "Rechazada con motivo" }]);
      setSelected((old) => {
        const next = new Set(old);
        next.delete(id);
        return next;
      });
      setRejectId(null);
      setRejectReason("");
      await refresh();
    } catch (error) {
      setResults([
        {
          id,
          invoice,
          ok: false,
          message:
            error instanceof Error ? error.message : "No se pudo rechazar.",
        },
      ]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="transfer-reconciliation">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRACIÓN</div>
          <h1>Conciliar transferencias</h1>
          <p>
            Compara cada factura con el banco antes de verificarla. El total
            ayuda a revisar; no verifica pagos por sí solo.
          </p>
        </div>
      </div>
      <div className="panel reconciliation-toolbar">
        <label className="field">
          <span>Fecha del pago (opcional)</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSelected(new Set());
              setBankTotals({});
              setResults([]);
            }}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            setDate("");
            setSelected(new Set());
            setBankTotals({});
            setResults([]);
          }}
        >
          Todas las fechas
        </Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
          Exportar lista a CSV
        </Button>
      </div>
      {results.length > 0 && (
        <div className="panel" role="status" aria-live="polite">
          <h2>Resultado de cada transferencia</h2>
          <ul>
            {results.map((result) => (
              <li
                key={result.id}
                className={
                  result.ok ? "reconciliation-ok" : "reconciliation-error"
                }
              >
                {result.invoice}: {result.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <QueryState query={query}>
        {rows.length === 0 ? (
          <div className="panel">
            No hay transferencias pendientes para esta fecha.
          </div>
        ) : (
          BANK_GROUPS.map((group) => {
            const groupRows = rows.filter(
              (row) => bankGroup(row.bank) === group,
            );
            if (!groupRows.length) return null;
            const selectedCount = groupRows.filter((row) =>
              selected.has(row.id),
            ).length;
            const total = selectedTotalCents(groupRows, selected);
            const rawBankTotal = bankTotals[group] ?? "";
            const validBankTotal = /^\d{1,12}(?:\.\d{1,2})?$/.test(
              rawBankTotal,
            );
            const difference = validBankTotal
              ? amountCents(rawBankTotal) - total
              : null;
            return (
              <section
                className="panel reconciliation-bank"
                key={group}
                aria-label={`Banco ${group}`}
              >
                <h2>
                  {group} <small>({groupRows.length} pendientes)</small>
                </h2>
                <div className="reconciliation-list">
                  {groupRows.map((row) => (
                    <article className="reconciliation-row" key={row.id}>
                      <label className="reconciliation-select">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          disabled={busy}
                          onChange={() => toggle(row.id)}
                        />
                        <span className="sr-only">
                          Seleccionar factura {row.invoice}
                        </span>
                      </label>
                      <div className="reconciliation-details">
                        <strong>
                          {row.invoice} · {formatMoney(Number(row.amount))}
                        </strong>
                        <span>
                          {dateTime(row.date)} · {row.customer || "Sin cliente"}
                        </span>
                        <span>
                          Banco: {row.bank || "Sin banco"} · Referencia:{" "}
                          {row.reference || "Sin referencia"}
                        </span>
                        <span>Cajera: {row.cashier || "Sin identificar"}</span>
                        {rejectId === row.id && (
                          <form
                            className="reconciliation-reject"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void reject(row.id);
                            }}
                          >
                            <label className="field">
                              <span>Motivo del rechazo</span>
                              <input
                                autoFocus
                                required
                                minLength={3}
                                maxLength={1000}
                                value={rejectReason}
                                onChange={(event) =>
                                  setRejectReason(event.target.value)
                                }
                              />
                            </label>
                            <Button
                              type="submit"
                              disabled={busy || rejectReason.trim().length < 3}
                            >
                              Confirmar rechazo
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setRejectId(null);
                                setRejectReason("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </form>
                        )}
                      </div>
                      {rejectId !== row.id && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setRejectId(row.id);
                            setRejectReason("");
                          }}
                        >
                          Rechazar
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
                <div className="reconciliation-totals">
                  <p>
                    <strong>Seleccionadas:</strong> {selectedCount} ·{" "}
                    <strong>Total seleccionado:</strong>{" "}
                    {formatMoney(total / 100)}
                  </p>
                  <label className="field">
                    <span>Total del banco (RD$)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={15}
                      pattern="[0-9]{1,12}([.][0-9]{1,2})?"
                      placeholder="0.00"
                      value={rawBankTotal}
                      onChange={(event) =>
                        setBankTotals((old) => ({
                          ...old,
                          [group]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <p role="status">
                    <strong>Diferencia:</strong>{" "}
                    {difference === null
                      ? rawBankTotal
                        ? "Usa números y punto decimal, sin separador de miles."
                        : "Escribe el total del banco"
                      : formatMoney(difference / 100)}
                  </p>
                  <Button
                    disabled={!selectedCount || busy}
                    onClick={() => void verifyGroup(groupRows)}
                  >
                    {busy ? "Procesando…" : "Verificar seleccionadas"}
                  </Button>
                </div>
              </section>
            );
          })
        )}
      </QueryState>
    </section>
  );
}

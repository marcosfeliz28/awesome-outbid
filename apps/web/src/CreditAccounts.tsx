import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Modal } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { api, apiBlob, post } from "./api";
import { QueryState, toast } from "./helpers";

type Method = "cash" | "card" | "transfer";
const methodName: Record<Method, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};
type Statement = {
  customer: { id: string; name: string; phone?: string; legalId?: string };
  balance: number;
  truncated: boolean;
  sales: {
    id: string;
    number: string;
    createdAt: string;
    total: number;
    balance: number;
    closedAt?: string;
    payments: {
      id: string;
      date: string;
      method: string;
      amount: number;
      status: string;
      receivedBy?: string;
    }[];
  }[];
};

export function CreditAccounts({ session }: { session: any }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("amount");
  // «open»: con deuda; «paid»: ya pagaron o se cerraron (dueña, 15-oct).
  const [view, setView] = useState<"open" | "paid">("open");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: ["credit-accounts", search, sort, page, view],
    queryFn: () =>
      api<{ total: number; rows: any[] }>(
        `/credit-accounts?search=${encodeURIComponent(search)}&sort=${sort}&page=${page}&view=${view}`,
      ),
  });
  const detail = useQuery({
    queryKey: ["credit-account", selected],
    queryFn: () => api<Statement>(`/credit-accounts/${selected}`),
    enabled: !!selected,
  });
  const statement = detail.data;
  // Primero lo pendiente (con saldo o con una transferencia por verificar); lo
  // ya pagado o cerrado va aparte (dueña, 15-oct).
  const isPending = (sale: Statement["sales"][number]) =>
    sale.balance > 0 ||
    sale.payments.some((p) => p.status === "pending_verification");
  const pendingSales = (statement?.sales ?? []).filter(isPending);
  const paidSales = (statement?.sales ?? []).filter((x) => !isPending(x));
  const saleRow = (sale: Statement["sales"][number]) => (
    <div className="cod-row" key={sale.id}>
      <div>
        <strong>{sale.number}</strong>
        <small>
          {new Date(sale.createdAt).toLocaleDateString("es-DO")} · Total{" "}
          {formatMoney(sale.total)}
        </small>
        {sale.payments.map((p) => (
          <small key={p.id}>
            {new Date(p.date).toLocaleString("es-DO", {
              timeZone: "America/Santo_Domingo",
            })}{" "}
            · {methodName[p.method as Method] ?? p.method} ·{" "}
            {formatMoney(p.amount)} · {p.receivedBy ?? ""}
            {p.status === "pending_verification" ? " · Por verificar" : ""}
          </small>
        ))}
      </div>
      <strong>Saldo {formatMoney(sale.balance)}</strong>
    </div>
  );
  const cents = Math.round(Number(amount) * 100);
  let left = cents;
  const preview = (statement?.sales ?? [])
    .filter((sale) => sale.balance > 0)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
    .flatMap((sale) => {
      const reserved = sale.payments
        .filter((p) => p.status === "pending_verification")
        .reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
      const part = Math.min(
        Math.max(0, left),
        Math.max(0, Math.round(sale.balance * 100) - reserved),
      );
      left -= part;
      return part ? [{ number: sale.number, amount: part / 100 }] : [];
    });
  const change = () => {
    setOperationId(crypto.randomUUID());
    setError("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !statement || busy) return;
    if (!Number.isSafeInteger(cents) || cents <= 0 || left > 0) {
      setError(
        "El monto debe ser mayor que cero y no superar el saldo disponible.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post(`/credit-accounts/${selected}/collections`, {
        operationId,
        ...(session ? { cashSessionId: session.id } : {}),
        lines: [
          {
            method,
            amount: cents / 100,
            ...(method === "transfer"
              ? {
                  bank: bank.trim() || undefined,
                  reference: reference.trim() || undefined,
                  ownerConfirmed: true,
                }
              : method === "card"
                ? { reference }
                : // Sin caja abierta, la dueña tiene el efectivo en la mano.
                  session
                  ? {}
                  : { ownerConfirmed: true }),
          },
        ],
      });
      setOperationId(crypto.randomUUID());
      setAmount("");
      await client.invalidateQueries({ queryKey: ["credit-accounts"] });
      await client.invalidateQueries({
        queryKey: ["credit-account", selected],
      });
      await client.invalidateQueries({ queryKey: ["cod-pending"] });
      toast(
        method === "transfer"
          ? "Transferencia registrada y cerrada."
          : "Cobro registrado.",
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!selected) return;
    try {
      const blob = await apiBlob(`/credit-accounts/${selected}/statement.pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "estado-de-cuenta.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      toast(err.message, true);
    }
  };
  return (
    <div className="credit-accounts">
      <div className="tabs" role="tablist" aria-label="Ver clientes">
        <Button
          variant={view === "open" ? "primary" : "secondary"}
          onClick={() => {
            setView("open");
            setPage(1);
          }}
        >
          Pendientes
        </Button>
        <Button
          variant={view === "paid" ? "primary" : "secondary"}
          onClick={() => {
            setView("paid");
            setPage(1);
          }}
        >
          Ya pagaron
        </Button>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Buscar por nombre</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span>Ordenar</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="amount">Mayor deuda</option>
            <option value="age">Más antiguo</option>
          </select>
        </label>
      </div>
      {view === "open" && (
        <p>
          Total general por cobrar:{" "}
          <strong>{formatMoney(list.data?.total ?? 0)}</strong>
        </p>
      )}
      <QueryState query={list}>
        <div className="cod-list">
          {(list.data?.rows ?? []).map((row) => (
            <div className="cod-row" key={row.customer.id}>
              <div>
                <strong>{row.customer.name}</strong>
                <small>
                  {view === "paid"
                    ? row.openSales +
                      " ventas pagadas" +
                      (row.lastClosedAt
                        ? " · Último cierre " +
                          new Date(row.lastClosedAt).toLocaleDateString("es-DO")
                        : "")
                    : row.openSales +
                      " ventas abiertas · La más antigua hace " +
                      row.oldestDays +
                      " días"}
                </small>
                <small>{row.customer.phone ?? ""}</small>
              </div>
              {view === "open" && <strong>{formatMoney(row.balance)}</strong>}
              <Button onClick={() => setSelected(row.customer.id)}>
                Ver estado de cuenta
              </Button>
            </div>
          ))}
        </div>
        {!list.data?.rows?.length && (
          <p>
            {view === "paid"
              ? "Sin clientes con ventas ya pagadas."
              : "Sin clientes con deuda abierta."}
          </p>
        )}
      </QueryState>
      {page > 1 && (
        <Button variant="secondary" onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
      )}
      {(list.data?.rows?.length ?? 0) === 50 && (
        <Button variant="secondary" onClick={() => setPage(page + 1)}>
          Siguiente
        </Button>
      )}
      {selected && (
        <Modal open onClose={() => setSelected(null)} title="Estado de cuenta">
          <QueryState query={detail}>
            {statement && (
              <div className="credit-statement">
                <p>
                  <strong>{statement.customer.name}</strong> ·{" "}
                  {statement.customer.phone ?? ""} ·{" "}
                  {statement.customer.legalId ?? ""}
                </p>
                <p>
                  Saldo total: <strong>{formatMoney(statement.balance)}</strong>
                </p>
                {statement.truncated && (
                  <p role="alert">
                    El historial supera 1000 ventas; consulta soporte para
                    obtenerlo completo.
                  </p>
                )}
                <Button
                  variant="secondary"
                  onClick={download}
                  disabled={statement.truncated}
                >
                  Descargar estado de cuenta PDF
                </Button>
                <h3>Pendientes</h3>
                <div className="cod-list">
                  {pendingSales.map((sale) => saleRow(sale))}
                </div>
                {!pendingSales.length && <p>Nada pendiente.</p>}
                {!!paidSales.length && (
                  <details>
                    <summary>
                      Ya pagadas o cerradas ({paidSales.length})
                    </summary>
                    <div className="cod-list">
                      {paidSales.map((sale) => saleRow(sale))}
                    </div>
                  </details>
                )}
                {statement.balance > 0 && (
                  <form className="form-grid" onSubmit={submit}>
                    <h3 className="full">Registrar pago</h3>
                    <label className="field">
                      <span>Monto</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          change();
                        }}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Forma de pago</span>
                      <select
                        value={method}
                        onChange={(e) => {
                          setMethod(e.target.value as Method);
                          change();
                        }}
                      >
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                      </select>
                    </label>
                    {method === "transfer" && (
                      <label className="field">
                        <span>Banco donde cayó</span>
                        <input
                          required
                          value={bank}
                          onChange={(e) => {
                            setBank(e.target.value);
                            change();
                          }}
                        />
                      </label>
                    )}
                    {method !== "cash" && (
                      <label className="field">
                        <span>
                          {method === "transfer"
                            ? "Referencia (opcional)"
                            : "Referencia"}
                        </span>
                        <input
                          value={reference}
                          onChange={(e) => {
                            setReference(e.target.value);
                            change();
                          }}
                          required={method === "card"}
                        />
                      </label>
                    )}
                    <p className="full">
                      Reparto previsto:{" "}
                      {preview
                        .map((p) => `${p.number}: ${formatMoney(p.amount)}`)
                        .join(" · ") || "Indica un monto"}
                    </p>
                    {left > 0 && cents > 0 && (
                      <p className="form-error full">
                        El monto supera el saldo disponible por{" "}
                        {formatMoney(left / 100)}.
                      </p>
                    )}
                    {error && (
                      <p className="form-error full" role="alert">
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={busy || left > 0 || cents <= 0}
                    >
                      Registrar pago
                    </Button>
                  </form>
                )}
              </div>
            )}
          </QueryState>
        </Modal>
      )}
    </div>
  );
}

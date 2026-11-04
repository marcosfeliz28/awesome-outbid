// GV · caja propia: abrir, ver cobros del día y cerrar con arqueo ciego
// (la vendedora declara; el sistema muestra las diferencias al cerrar).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { api, post } from "./api";
import { QueryState, toast } from "./helpers";

type Cash = {
  id: string;
  openingAmount: string;
  openedAt: string;
  payments: number;
  overdue: boolean;
  expected?: Record<string, string>;
};
type Closed = {
  differences: Record<"cash" | "card" | "transfer" | "total", string>;
  receipts: { receiptNumber: string; method: string }[];
};
type Alerts = {
  cashOverdue: boolean;
  staleBalances: {
    enrollmentId: string;
    clientName: string;
    course: string;
    pending: string;
    daysSinceLastPayment: number;
  }[];
};

const LABEL = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };

export function GvCaja() {
  const client = useQueryClient();
  const current = useQuery<Cash | null>({
    queryKey: ["gv-cash"],
    queryFn: async () => (await api("/gv/cash/current")) || null,
  });
  const alerts = useQuery<Alerts>({
    queryKey: ["gv-alerts"],
    queryFn: () => api("/gv/alerts"),
  });
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState({ cash: "", card: "", transfer: "" });
  const [result, setResult] = useState<Closed | null>(null);
  const run = async (work: () => Promise<unknown>) => {
    try {
      await work();
      await client.invalidateQueries({ queryKey: ["gv-cash"] });
    } catch (cause: any) {
      toast(cause.message, true);
    }
  };
  return (
    <QueryState query={current}>
      <div className="gv-toolbar">
        {alerts.data?.staleBalances.length ? (
          <p role="alert">
            {alerts.data.staleBalances.length} inscrita(s) con saldo y último
            abono de más de 15 días.
          </p>
        ) : null}
        {!current.data ? (
          <>
            <label className="field">
              <span>Fondo inicial (RD$)</span>
              <input
                inputMode="decimal"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
              />
            </label>
            <Button
              onClick={() =>
                run(async () => {
                  setResult(null);
                  await post("/gv/cash/open", {
                    openingAmount: Number(opening),
                  });
                })
              }
            >
              Abrir caja GV
            </Button>
          </>
        ) : (
          <>
            <p>
              Caja abierta con fondo de{" "}
              {formatMoney(Number(current.data.openingAmount))} ·{" "}
              {current.data.payments} cobro(s).
              {current.data.overdue && " Es de un día anterior: ciérrala."}
            </p>
            {(["cash", "card", "transfer"] as const).map((k) => (
              <label className="field" key={k}>
                <span>Contado en {LABEL[k].toLowerCase()} (RD$)</span>
                <input
                  inputMode="decimal"
                  value={counted[k]}
                  onChange={(e) =>
                    setCounted((c) => ({ ...c, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
            <Button
              onClick={() =>
                run(async () => {
                  setResult(
                    await post<Closed>("/gv/cash/close", {
                      countedCash: Number(counted.cash || 0),
                      countedCard: Number(counted.card || 0),
                      countedTransfer: Number(counted.transfer || 0),
                    }),
                  );
                  setCounted({ cash: "", card: "", transfer: "" });
                })
              }
            >
              Cerrar caja GV
            </Button>
          </>
        )}
      </div>
      {result && (
        <div className="gv-card">
          <h3>Cierre hecho · {result.receipts.length} recibo(s)</h3>
          {(["cash", "card", "transfer"] as const).map((k) => (
            <p key={k}>
              {LABEL[k]}: diferencia{" "}
              {formatMoney(Number(result.differences[k]))}
            </p>
          ))}
          <p>
            <strong>
              Diferencia total: {formatMoney(Number(result.differences.total))}
            </strong>
          </p>
        </div>
      )}
    </QueryState>
  );
}

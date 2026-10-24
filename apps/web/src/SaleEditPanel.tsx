import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { api } from "./api";

// Orden de la dueña (18-oct): corregir vendedora y «al por mayor» de una
// factura vigente, hasta 7 días después. Solo administración; nunca borra.
export const EDIT_DAYS = 7;
export const editableNow = (sale: { status: string; createdAt: string }) =>
  sale.status === "completed" &&
  Date.now() - new Date(sale.createdAt).getTime() <= EDIT_DAYS * 86400000;

// Métodos que se pueden corregir después de la venta (dueña, 23-oct).
const PAYMENT_METHODS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  cod: "Contraentrega",
  credit: "Crédito",
};

export function SaleEditPanel({
  sale,
  onSaved,
}: {
  sale: {
    id: string;
    sellerId: string;
    wholesale: boolean;
    payments?: {
      id: string;
      method: string;
      amount: string | number;
      entryType: string;
      status: string;
    }[];
  };
  onSaved: (change: { sellerId?: string; wholesale?: boolean }) => void;
}) {
  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<{ id: string; name: string }[]>("/staff"),
  });
  const [sellerId, setSellerId] = useState(sale.sellerId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const salePayments = (sale.payments ?? []).filter(
    (p) =>
      p.entryType === "sale" &&
      p.status !== "rejected" &&
      p.method in PAYMENT_METHODS,
  );
  const send = async (path: string, body: object) => {
    if (reason.trim().length < 3) {
      setError("Escribe el motivo del cambio.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/sales/${sale.id}/${path}`, {
        method: "POST",
        body: JSON.stringify({ ...body, reason: reason.trim() }),
      });
      setReason("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel">
      <h3>Corregir factura</h3>
      <p>Hasta 7 días después de la venta. Queda en la bitácora.</p>
      <label className="field">
        <span>Motivo</span>
        <input
          value={reason}
          maxLength={200}
          disabled={busy}
          placeholder="Ej.: la vendió Manuela"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Vendedora</span>
        <select
          value={sellerId}
          disabled={busy || !staff.data}
          onChange={(event) => setSellerId(event.target.value)}
        >
          {(staff.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <Button
          disabled={busy || sellerId === sale.sellerId}
          onClick={async () => {
            if (await send("seller", { sellerId })) onSaved({ sellerId });
          }}
        >
          Cambiar vendedora
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            const wholesale = !sale.wholesale;
            if (await send("mark-wholesale", { wholesale }))
              onSaved({ wholesale });
          }}
        >
          {sale.wholesale ? "Quitar «al por mayor»" : "Marcar «al por mayor»"}
        </Button>
      </div>
      {salePayments.map((p) => {
        const method = methods[p.id] ?? p.method;
        return (
          <div className="row" key={p.id}>
            <label className="field">
              <span>
                Pago de {Number(p.amount).toFixed(2)} (
                {PAYMENT_METHODS[p.method]})
              </span>
              <select
                value={method}
                disabled={busy}
                onChange={(event) =>
                  setMethods({ ...methods, [p.id]: event.target.value })
                }
              >
                {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {method === "transfer" && method !== p.method && (
              <>
                <label className="field">
                  <span>Banco</span>
                  <input
                    value={bank}
                    maxLength={80}
                    disabled={busy}
                    onChange={(event) => setBank(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Referencia</span>
                  <input
                    value={reference}
                    maxLength={120}
                    disabled={busy}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </label>
              </>
            )}
            <Button
              variant="secondary"
              disabled={busy || method === p.method}
              onClick={async () => {
                if (
                  await send(`payments/${p.id}/correct-method`, {
                    method,
                    ...(method === "transfer" ? { bank, reference } : {}),
                  })
                )
                  onSaved({});
              }}
            >
              Cambiar método de pago
            </Button>
          </div>
        );
      })}
      {error && (
        <p className="reconciliation-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

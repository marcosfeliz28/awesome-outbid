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

export function SaleEditPanel({
  sale,
  onSaved,
}: {
  sale: { id: string; sellerId: string; wholesale: boolean };
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
      {error && (
        <p className="reconciliation-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

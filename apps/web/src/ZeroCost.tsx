import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { api } from "./api";

// Venta sin costo (dueña, 8-nov): un producto activo sin costo no se vende
// hasta completarlo. Esta tarjeta los lista para quien ve costos.
type WithoutCost = {
  total: number;
  withStock: number;
  items: {
    variantId: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
  }[];
};

export function WithoutCostCard() {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["without-cost"],
    queryFn: () => api<WithoutCost>("/inventory/without-cost"),
  });
  if (!query.data?.total) return null;
  const { total, withStock, items } = query.data;
  return (
    <div className="panel" role="region" aria-label="Productos sin costo">
      <h3>Productos sin costo</h3>
      <p>
        {total} activos sin costo, {withStock} con existencia. No se pueden
        vender hasta completar su costo en el producto.
      </p>
      <Button variant="secondary" onClick={() => setOpen(!open)}>
        {open ? "Ocultar lista" : "Ver lista"}
      </Button>
      {open && (
        <ul>
          {items.map((i) => (
            <li key={i.variantId}>
              <strong>{i.name}</strong>
              <small>
                {" "}
                {i.sku} · existencia {i.stock} · precio {i.price.toFixed(2)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Corregir el costo de líneas vendidas sin costo. Solo administración, con
// PIN de gerencia y motivo; no toca totales, pagos ni la caja.
export function SaleCostPanel({
  sale,
  onSaved,
}: {
  sale: {
    id: string;
    items?: {
      id: string;
      qty: string | number;
      unitPrice: string | number;
      unitCost?: string | number;
      returnedQty?: string | number;
      variant?: { product?: { name: string } | null } | null;
    }[];
  };
  onSaved: () => void;
}) {
  const lines = (sale.items ?? []).filter(
    (i) => i.unitCost !== undefined && Number(i.unitCost) <= 0,
  );
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Un identificador por línea: un reintento tras un corte no corrige dos veces.
  const operations = useRef<Record<string, string>>({});
  if (!lines.length) return null;
  const save = async (line: (typeof lines)[number]) => {
    const itemId = line.id;
    const cost = Number(costs[itemId]);
    const abovePrice = cost > Number(line.unitPrice);
    if (
      abovePrice &&
      !window.confirm(
        "El costo es mayor que el precio de venta. ¿Confirmas que es correcto?",
      )
    )
      return;
    operations.current[itemId] ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      await api(`/sales/${sale.id}/items/${itemId}/cost`, {
        method: "POST",
        body: JSON.stringify({
          unitCost: cost,
          expectedUnitCost: Number(line.unitCost ?? 0),
          operationId: operations.current[itemId],
          ...(abovePrice ? { confirmAbovePrice: true } : {}),
          reason: reason.trim(),
          managerPin: pin,
        }),
      });
      delete operations.current[itemId];
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel">
      <h3>Costo pendiente</h3>
      <p>
        Estas líneas se vendieron sin costo y la ganancia sale inflada.
        Corregirlo cambia el costo y la ganancia en reportes; no cambia lo
        cobrado ni la caja.
      </p>
      <label className="field">
        <span>Motivo</span>
        <input
          value={reason}
          maxLength={500}
          disabled={busy}
          placeholder="Ej.: costo de la factura del proveedor"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <label className="field">
        <span>PIN de gerencia</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          maxLength={6}
          disabled={busy}
          onChange={(e) => setPin(e.target.value)}
        />
      </label>
      {lines.map((i) => (
        <div className="row" key={i.id}>
          <label className="field">
            <span>
              {i.variant?.product?.name ?? "Producto"} · {Number(i.qty)} u.
              {Number(i.returnedQty ?? 0) > 0 ? " (con devolución)" : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={costs[i.id] ?? ""}
              disabled={busy}
              placeholder="Costo unitario"
              onChange={(e) => setCosts({ ...costs, [i.id]: e.target.value })}
            />
          </label>
          <Button
            disabled={
              busy ||
              !(Number(costs[i.id]) > 0) ||
              reason.trim().length < 8 ||
              !/^\d{4,6}$/.test(pin)
            }
            onClick={() => save(i)}
          >
            Guardar costo
          </Button>
        </div>
      ))}
      {error && (
        <p className="reconciliation-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

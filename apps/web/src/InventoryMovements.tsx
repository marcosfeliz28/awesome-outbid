import { useQuery } from "@tanstack/react-query";
import { can } from "@fitstore/shared";
import { ArrowDownToLine, ArrowUpFromLine, Activity } from "lucide-react";
import { api, useStore } from "./api";

type Movement = {
  id: string;
  type: string;
  qty: unknown;
  createdAt: string;
  variant?: { product?: { name?: string } };
};
const labels: Record<string, [string, string]> = {
  purchase: ["Entrada", "Incoming"],
  sale: ["Venta", "Sale"],
  adjustment: ["Ajuste", "Adjustment"],
  count: ["Conteo físico", "Physical count"],
  waste: ["Merma", "Waste"],
  supplier_return: ["Devolución a proveedor", "Supplier return"],
  return: ["Devolución", "Return"],
  transfer_in: ["Traspaso recibido", "Transfer in"],
  transfer_out: ["Traspaso enviado", "Transfer out"],
};

/** Read-only branch-scoped history. No costs, reasons, people or invented daily totals. */
export function InventoryMovements({ en }: { en: boolean }) {
  const user = useStore((state) => state.user);
  const allowed = !!user && can(user.permissions, "catalog:read");
  const query = useQuery({
    queryKey: ["inventory-recent-movements", user?.branchId, user?.id],
    queryFn: () => api<Movement[]>("/inventory/movements"),
    enabled: allowed,
    staleTime: 60_000,
    refetchInterval: false,
  });
  if (!allowed) return null;
  const formatter = new Intl.NumberFormat(en ? "en-US" : "es-DO", {
    maximumFractionDigits: 3,
    signDisplay: "exceptZero",
  });
  const dates = new Intl.DateTimeFormat(en ? "en-US" : "es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santo_Domingo",
  });
  const rows = Array.isArray(query.data) ? query.data.slice(0, 5) : null;
  return (
    <section
      className="inventory-movements panel"
      aria-label={en ? "Recent movements" : "Movimientos recientes"}
    >
      <h2>
        <Activity aria-hidden="true" />{" "}
        {en ? "Recent movements" : "Movimientos recientes"}
      </h2>
      <p>
        {en
          ? "Latest 5 from up to 200 loaded records for your branch. Times in Santo Domingo."
          : "Últimos 5 de hasta 200 registros cargados de tu sucursal. Hora de Santo Domingo."}
      </p>
      {query.isPending ? (
        <p role="status">
          {query.fetchStatus === "paused"
            ? en
              ? "Offline. Connect to load movements."
              : "Sin conexión. Conéctate para cargar movimientos."
            : en
              ? "Loading movements…"
              : "Cargando movimientos…"}
        </p>
      ) : query.error || !rows ? (
        <div role="alert">
          <p>
            {en
              ? "Movements could not be loaded."
              : "No se pudieron cargar los movimientos."}
          </p>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {en ? "Retry" : "Reintentar"}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p>
          {en
            ? "No movements in the loaded history."
            : "No hay movimientos en el historial cargado."}
        </p>
      ) : (
        <ul>
          {rows.map((movement) => {
            const raw = movement.qty;
            const value =
              raw === null || raw === undefined || raw === ""
                ? null
                : Number(raw);
            const qty = value !== null && Number.isFinite(value) ? value : null;
            const date = new Date(movement.createdAt);
            const Glyph =
              qty === null || qty === 0
                ? Activity
                : qty > 0
                  ? ArrowDownToLine
                  : ArrowUpFromLine;
            return (
              <li key={movement.id}>
                <Glyph aria-hidden="true" />
                <div>
                  <strong>
                    {movement.variant?.product?.name ||
                      (en ? "Product" : "Producto")}
                  </strong>
                  <span>
                    {labels[movement.type]?.[en ? 1 : 0] ?? movement.type}
                  </span>
                  <time
                    dateTime={
                      Number.isNaN(date.getTime())
                        ? undefined
                        : movement.createdAt
                    }
                  >
                    {Number.isNaN(date.getTime()) ? "—" : dates.format(date)}
                  </time>
                </div>
                <span className="inventory-movement-qty" data-direction={qty === null || qty === 0 ? "neutral" : qty > 0 ? "incoming" : "outgoing"}>
                  {qty === null ? "—" : formatter.format(qty)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

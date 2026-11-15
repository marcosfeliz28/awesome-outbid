import type { QueryClient } from "@tanstack/react-query";

// EFI-01: tras vender no se vuelve a bajar el catálogo completo. Su stock ya
// llega por `stock.changed` (realtime.tsx); estas claves cambian poco y el
// precio en conflicto se relee aparte con `reprice`.
const NO_REFRESCAR = new Set(["catalog", "categories", "settings", "promotions"]);

export function refreshAfterSale(client: QueryClient) {
  // Todo lo derivado de la venta (caja, ventas, pendientes, créditos,
  // resumen, alertas…) se refresca, sin retener el recibo.
  void client.invalidateQueries({
    predicate: (q) => !NO_REFRESCAR.has(String(q.queryKey[0])),
  });
  // El catálogo queda marcado como viejo, sin descargarlo ahora: se relee la
  // próxima vez que se necesite si el aviso de stock no llegó.
  void client.invalidateQueries({ queryKey: ["catalog"], refetchType: "none" });
}

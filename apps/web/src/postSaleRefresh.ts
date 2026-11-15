import type { QueryClient } from "@tanstack/react-query";

// EFI-01: tras vender se refresca lo derivado de la venta sin retener el
// recibo. Categorías, ajustes y promociones no se releen (el conflicto de
// precio las relee aparte con `reprice`). El catálogo SÍ se recarga, en
// segundo plano: es la red de seguridad del stock si un aviso en vivo se
// perdió, y tests/e2e/stock-en-vivo.spec.ts depende de esa recarga.
const NO_REFRESCAR = new Set(["categories", "settings", "promotions"]);

export function refreshAfterSale(client: QueryClient): void {
  void client.invalidateQueries({
    predicate: (q) => !NO_REFRESCAR.has(String(q.queryKey[0])),
  });
}

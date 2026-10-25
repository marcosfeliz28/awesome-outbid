import type { QueryClient } from "@tanstack/react-query";
import type { Product } from "./api";

let catalogRevision = 0;
export const currentCatalogRevision = () => catalogRevision;

/** Aplica la existencia confirmada por el servidor al catálogo de la caja. */
export async function applyRealtimeStock(client: QueryClient, id: string, stock: number) {
  // Una descarga antigua tampoco debe reemplazar la copia para uso offline.
  catalogRevision++;
  // Dos cajas pueden vender a la vez: una recarga iniciada tras la primera
  // venta puede responder después del evento de la segunda con stock viejo.
  // React Query debe ignorar ese GET antes de aplicar el evento confirmado.
  await client.cancelQueries({ queryKey: ["catalog"] });
  client.setQueryData<Product[]>(["catalog"], (old) =>
    old?.map((product) => ({
      ...product,
      variants: product.variants.map((variant) =>
        variant.id === id ? { ...variant, stock: String(stock) } : variant),
    })));
}

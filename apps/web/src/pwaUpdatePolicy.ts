// M7 (auditoría de infraestructura): cuándo se puede aplicar una versión
// nueva de la PWA. Aplicarla recarga la página, así que nunca se hace con una
// venta en curso (carrito con artículos) ni mientras alguien está usando la
// caja. Sin dependencias del navegador para poder probarla.

/** Sin uso (ni teclado, ni lector, ni toques) durante este tiempo. */
export const PWA_UPDATE_IDLE_MS = 5 * 60_000;
/** Con la app en segundo plano basta una pausa corta. */
export const PWA_UPDATE_HIDDEN_IDLE_MS = 30_000;
/** Cada cuánto se pregunta al servidor si hay versión nueva. */
export const PWA_UPDATE_CHECK_MS = 60 * 60_000;

export type PwaUpdateState = {
  /** Artículos en el carrito de la caja. */
  cartItems: number;
  /** Milisegundos desde la última interacción. */
  idleMs: number;
  /** La pestaña o la app instalada no está a la vista. */
  hidden: boolean;
};

/** Se aplica sola sólo con el carrito vacío y la caja sin usar. */
export function canApplyPwaUpdate(state: PwaUpdateState): boolean {
  if (state.cartItems > 0) return false;
  return state.hidden
    ? state.idleMs >= PWA_UPDATE_HIDDEN_IDLE_MS
    : state.idleMs >= PWA_UPDATE_IDLE_MS;
}

/** Texto del aviso según haya o no una venta en curso. */
export function pwaUpdateMessage(cartItems: number): string {
  return cartItems > 0
    ? "Hay una versión nueva de Nexora. Podrás instalarla al terminar esta venta."
    : "Hay una versión nueva de Nexora. Se instala sola si la caja queda libre unos minutos.";
}

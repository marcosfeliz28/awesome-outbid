// 05 v2 (N2, N3b): reglas del borrador del carrito y del cierre por
// inactividad cuando hay trabajo sin terminar. Sin dependencias del navegador
// para poder probarlas.

/** Un borrador más viejo que esto ya no es «la venta en curso» de nadie. */
export const DRAFT_MAX_AGE_MS = 12 * 3_600_000;
/** Tope absoluto de un carrito o una cola abandonados sin ninguna persona. */
export const IDLE_WORK_CAP_MS = 2 * 3_600_000;

/** ¿Se descarta el borrador guardado en `savedAt`? Sin fecha válida, sí. */
export function draftExpired(savedAt: unknown, now: number) {
  const at = Number(savedAt);
  return !Number.isFinite(at) || at <= 0 || now - at > DRAFT_MAX_AGE_MS;
}

export type IdleWork = {
  /** Artículos en el carrito. */
  cartItems: number;
  /** Ventas sin conexión de esta persona que el servidor aún no recibe. */
  pendingSales: number;
  /** Hay conexión con el servidor. */
  online: boolean;
  /** Milisegundos desde la última persona que tocó la pantalla. */
  untouchedMs: number;
  /** Plazo de inactividad de la sesión, en milisegundos. */
  timeoutMs: number;
};

/**
 * ¿La inactividad debe esperar? Sí mientras haya una venta en curso, pero con
 * un tope: un carrito olvidado ya no deja la sesión abierta toda la noche.
 * Las ventas guardadas sin conexión sí esperan sin tope: sin internet no se
 * puede volver a entrar y la cola es la única copia del dinero cobrado.
 */
export function inactivityWaits(work: IdleWork) {
  if (work.pendingSales > 0 && !work.online) return true;
  if (work.cartItems <= 0 && work.pendingSales <= 0) return false;
  return work.untouchedMs < Math.max(IDLE_WORK_CAP_MS, work.timeoutMs);
}

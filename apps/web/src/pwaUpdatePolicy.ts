// M7 (auditoría de infraestructura): cuándo se puede aplicar una versión
// nueva de la PWA. Aplicarla recarga la página, así que nunca se hace con una
// venta en curso (carrito con artículos) ni mientras alguien está usando la
// caja. Sin dependencias del navegador para poder probarla.

/** Sin uso (ni teclado, ni lector, ni toques) durante este tiempo. */
export const PWA_UPDATE_IDLE_MS = 5 * 60_000;
/** Con la app en segundo plano basta una pausa corta. */
export const PWA_UPDATE_HIDDEN_IDLE_MS = 30_000;
/** 05-N9: tras escribir en un campo, un formulario puede estar a medias. */
export const PWA_UPDATE_FORM_MS = 30 * 60_000;
/** Cada cuánto se pregunta al servidor si hay versión nueva. */
export const PWA_UPDATE_CHECK_MS = 60 * 60_000;

export type PwaUpdateState = {
  /** Artículos en el carrito de la caja. */
  cartItems: number;
  /** Milisegundos desde la última interacción. */
  idleMs: number;
  /** La pestaña o la app instalada no está a la vista. */
  hidden: boolean;
  /** 05-N9: hay una ventana abierta (cobro, formulario, conteo de cierre). */
  dialogOpen?: boolean;
  /** 05-N9: milisegundos desde que se escribió en un campo (compra, recepción). */
  sinceInputMs?: number;
};

/** Se aplica sola sólo con el carrito vacío, sin ventanas ni formularios a medias y la caja sin usar. */
export function canApplyPwaUpdate(state: PwaUpdateState): boolean {
  if (state.cartItems > 0) return false;
  // 05-N9: no se recarga con una ventana abierta ni con un formulario en el
  // que se escribió hace poco, aunque la pestaña esté oculta.
  if (state.dialogOpen) return false;
  if ((state.sinceInputMs ?? Infinity) < PWA_UPDATE_FORM_MS) return false;
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

/** Sólo la cuenta administradora puede programar instalaciones en este equipo. */
export function canSchedulePwaUpdate(permissions: readonly string[]): boolean {
  return permissions.includes("*");
}

type ScheduleStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const scheduleKey = (scope: string) => `nexora:pwa-update-at:${scope}`;

/** La clave incluye la sucursal del usuario; una empresa no hereda la hora de otra. */
export function readPwaUpdateSchedule(
  storage: ScheduleStorage,
  scope: string,
): number | null {
  if (!scope) return null;
  try {
    const value = Number(storage.getItem(scheduleKey(scope)));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function savePwaUpdateSchedule(
  storage: ScheduleStorage,
  scope: string,
  scheduledAt: number,
  now = Date.now(),
): boolean {
  if (!scope || !Number.isSafeInteger(scheduledAt) || scheduledAt <= now)
    return false;
  try {
    storage.setItem(scheduleKey(scope), String(scheduledAt));
    return true;
  } catch {
    return false;
  }
}

export function clearPwaUpdateSchedule(
  storage: ScheduleStorage,
  scope: string,
): void {
  if (!scope) return;
  try {
    storage.removeItem(scheduleKey(scope));
  } catch {
    /* almacenamiento deshabilitado */
  }
}

/** Llegar a la hora no anula la política de carrito, diálogo, formulario ni inactividad. */
export function canApplyScheduledPwaUpdate(
  state: PwaUpdateState,
  scheduledAt: number | null,
  now = Date.now(),
): boolean {
  return scheduledAt !== null && now >= scheduledAt && canApplyPwaUpdate(state);
}

// 05-A3 y 05-M1: el carrito en curso se guarda en este equipo, por usuario.
// Antes vivía sólo en memoria y se perdía con F5, con la recarga automática
// de una versión nueva, al cambiar de vendedor con PIN o al cerrarse la
// sesión. Se guarda en la tabla `cache` de IndexedDB (clave
// «cart-draft:<usuario>»), que cerrar sesión borra completa (G9): el borrador
// no sobrevive a un cierre de sesión ni lo ve otra persona.
import { localDB, useStore, type CartItem, type Variant } from "./api";
import { useWholesale } from "./Incentives";
import { toast } from "./helpers";
import { draftExpired } from "./cartDraftPolicy";

export const draftKey = (userId: string) => "cart-draft:" + userId;
export type CartDraft = {
  items: CartItem[];
  customerId: string | null;
  globalDiscount: number;
  wholesale: boolean;
  savedAt: number;
  revision?: string;
  // 05-N3: el cobro que se estaba enviando (su offlineUuid). Si la recarga
  // llega justo después de cobrar, la venta no se vuelve a ofrecer y, si el
  // carrito vuelve, el cobro reutiliza el mismo offlineUuid: la API devuelve
  // la venta ya registrada en vez de cobrar otra vez.
  attempt?: SaleAttempt;
};
export type SaleAttempt = { key: string; uuid: string; capturedAt: string };

// Lo justo para dibujar la línea hasta que llegue el catálogo (refreshCart
// pone entonces la variante y el producto vigentes): sin costo ni lotes y sin
// las demás variantes del producto. Así la copia es pequeña y guardarla no
// frena la caja mientras el lector escribe.
const lean = (variant: Variant): Variant => {
  const { costAvg: removed, lots: unused, ...rest } = variant;
  void removed;
  void unused;
  return rest;
};
export const leanItem = (item: CartItem): CartItem => ({
  ...item,
  variant: lean(item.variant),
  product: { ...item.product, variants: [] },
});

let attempt: SaleAttempt | null = null;
/** Cobro recuperado junto con el carrito, para reusar su offlineUuid. */
export const restoredAttempt = (key: string) =>
  attempt && attempt.key === key ? attempt : null;
// Tras cobrar, ningún guardado diferido (ya en cola) puede volver a escribir
// el carrito vendido: queda sellado hasta que el carrito esté vacío.
let sealed = false;
// Cada venta cobrada abre una generación nueva: un guardado que ya estaba en
// cola (temporizador o instante libre del navegador) y es de una generación
// anterior se descarta aunque llegue después del borrado.
let generation = 0;
// Sólo esta pestaña puede drenar su propia transición a vacío. Inicio vacío
// no debe borrar el borrador que conserva otra pestaña del mismo usuario.
let emptyDraftOwner: string | null = null;
let knownRevision: string | null = null;
const revisionOf = (draft: CartDraft) =>
  draft.revision ?? `legacy:${draft.savedAt}`;
async function deleteKnownDraft(
  userId: string,
  expected = knownRevision,
): Promise<boolean> {
  return localDB.transaction("rw", localDB.cache, async () => {
    const row = await localDB.cache.get(draftKey(userId));
    if (!row) return true;
    if (!expected || revisionOf(row.data as CartDraft) !== expected)
      return false;
    await localDB.cache.delete(draftKey(userId));
    return true;
  });
}
let lastWrite: Promise<unknown> = Promise.resolve();

/** Barrera durable para la recarga PWA; un fallo de almacenamiento la bloquea. */
export async function flushEmptyDraftBeforeReload(): Promise<boolean> {
  // PWA se suscribe antes que keepCartDraft: dejar terminar todos los listeners.
  await Promise.resolve();
  const userId = useStore.getState().user?.id ?? null;
  const currentGeneration = generation;
  if (restoring || attempt || useStore.getState().cart.length) return false;
  if (!emptyDraftOwner) return true;
  if (!userId || emptyDraftOwner !== userId || owner !== userId) return false;
  cancelPending();
  try {
    await lastWrite;
    if (
      generation !== currentGeneration ||
      owner !== userId ||
      useStore.getState().user?.id !== userId ||
      useStore.getState().cart.length ||
      restoring ||
      attempt
    )
      return false;
    if (!(await deleteKnownDraft(userId))) return false;
    if (
      generation !== currentGeneration ||
      owner !== userId ||
      useStore.getState().user?.id !== userId ||
      useStore.getState().cart.length ||
      restoring ||
      attempt
    )
      return false;
    emptyDraftOwner = null;
    return true;
  } catch {
    return false;
  }
}
let idleHandle: number | undefined;
const cancelPending = () => {
  clearTimeout(timer);
  if (idleHandle !== undefined && typeof cancelIdleCallback === "function")
    cancelIdleCallback(idleHandle);
  idleHandle = undefined;
};

function write(userId: string, state = useStore.getState()) {
  // Vendido y sellado: un carrito con artículos ya no se guarda.
  if (sealed && state.cart.length) return Promise.resolve();
  if (attempt && !state.cart.length) return Promise.resolve(false);
  const data: CartDraft = {
    items: state.cart.map(leanItem),
    customerId: state.customerId,
    globalDiscount: state.globalDiscount,
    wholesale: useWholesale.getState().on,
    savedAt: Date.now(),
    revision: crypto.randomUUID(),
    ...(attempt ? { attempt } : {}),
  };
  if (state.cart.length && owner === userId) knownRevision = data.revision!;
  const saving: Promise<unknown> = state.cart.length
    ? localDB.cache.put({ key: draftKey(userId), data })
    : deleteKnownDraft(userId);
  lastWrite = saving;
  return saving.catch(() => {
    /* Sin IndexedDB (modo privado): el carrito sigue en memoria. */
  });
}

/**
 * 05-N3: se va a enviar el cobro. Su offlineUuid se guarda con el borrador
 * antes de la petición, para que una recarga a mitad del cobro no cobre dos
 * veces.
 */
export async function rememberAttempt(next: SaleAttempt) {
  attempt = next;
  const userId = useStore.getState().user?.id;
  if (!userId || sealed) return;
  cancelPending();
  await write(userId);
}

/**
 * 05-N3: la venta quedó registrada. El borrador se borra aquí mismo, antes de
 * mostrar el recibo, y no por el guardado diferido (600 ms más un instante
 * libre del navegador): una recarga, un apagón o la impresión automática en
 * ese intervalo resucitaban la venta ya cobrada.
 */
export async function discardCartDraft() {
  const userId = useStore.getState().user?.id ?? owner;
  generation++;
  cancelPending();
  attempt = null;
  sealed = true;
  if (!userId) return;
  await deleteKnownDraft(userId).catch(() => {
    /* Sin IndexedDB: no hay borrador que borrar. */
  });
}

/**
 * 05-N2: la sesión se cierra por inactividad con un carrito a medias. Cerrar
 * la sesión borra la tabla `cache` (G9); el borrador del propio usuario se
 * conserva en la misma transacción del borrado, para que lo encuentre al
 * volver a entrar aunque la página se recargue enseguida (sólo lo recupera
 * él, y caduca a las 12 h).
 */
export async function keepDraftThrough(
  close: (keep: { key: string; data: any }[]) => Promise<void>,
) {
  const userId = useStore.getState().user?.id;
  if (userId && useStore.getState().cart.length && !sealed) {
    cancelPending();
    await write(userId);
  }
  const saved = userId
    ? await localDB.cache.get(draftKey(userId)).catch(() => undefined)
    : undefined;
  await close(saved ? [saved] : []);
  if (saved) {
    await localDB.cache.put(saved).catch(() => {});
    // El formulario puede aparecer antes de terminar la limpieza de caché.
    // Si la misma persona ya volvió a entrar, su primera lectura pudo ocurrir
    // antes de restaurar el borrador; repetirla nunca reemplaza un carrito nuevo.
    if (userId && useStore.getState().user?.id === userId && owner === userId)
      await restore(userId);
  }
}

let owner: string | null = null;
let restoring = false;
let timer: ReturnType<typeof setTimeout> | undefined;

async function restore(userId: string) {
  const restoreGeneration = generation;
  const isCurrent = () =>
    generation === restoreGeneration &&
    owner === userId &&
    useStore.getState().user?.id === userId;
  restoring = true;
  try {
    const saved = await localDB.cache
      .get(draftKey(userId))
      .catch(() => undefined);
    if (!isCurrent()) return;
    const draft = saved?.data as CartDraft | undefined;
    // 05-N3b: un carrito de hace más de 12 h es de otro turno, no una venta
    // en curso: se descarta.
    if (draft && draftExpired(draft.savedAt, Date.now())) {
      await deleteKnownDraft(userId, revisionOf(draft)).catch(() => {});
      return;
    }
    // 05-N3: el cobro de ese carrito ya quedó guardado en este equipo (venta
    // sin conexión o con respuesta incierta): no se vuelve a ofrecer.
    if (
      draft?.attempt?.uuid &&
      (await localDB.sales.get(draft.attempt.uuid).catch(() => undefined))
    ) {
      if (isCurrent())
        await deleteKnownDraft(userId, revisionOf(draft)).catch(() => {});
      return;
    }
    // Otra persona entró mientras se leía, o ya se escaneó algo nuevo.
    if (!isCurrent() || !draft?.items?.length) return;
    if (useStore.getState().cart.length) return;
    knownRevision = revisionOf(draft);
    attempt = draft.attempt ?? null;
    sealed = false;
    useStore.setState({
      cart: draft.items,
      customerId: draft.customerId ?? null,
      globalDiscount: Number(draft.globalDiscount) || 0,
    });
    if (draft.wholesale) useWholesale.getState().set(true);
    const units = draft.items.reduce((a, i) => a + Number(i.qty), 0);
    toast(
      "Se recuperó tu venta en curso (" +
        units +
        (units === 1 ? " artículo)." : " artículos)."),
    );
  } finally {
    if (isCurrent()) restoring = false;
  }
}

/** Guarda el carrito de quien tiene la sesión y lo recupera al volver. */
export function keepCartDraft() {
  return useStore.subscribe((state, previous) => {
    const userId = state.user?.id ?? null;
    if (userId !== owner) {
      const before = owner;
      owner = userId;
      emptyDraftOwner = null;
      knownRevision = null;
      generation++;
      cancelPending();
      attempt = null;
      sealed = false;
      // Cambio de vendedor con PIN: el carrito en pantalla es de quien
      // salió; se guarda a su nombre y la nueva persona ve el suyo.
      if (before && userId) {
        void write(before, previous);
        restoring = true;
        useStore.setState({ cart: [], customerId: null, globalDiscount: 0 });
        restoring = false;
      }
      if (userId) void restore(userId);
      return;
    }
    if (!userId || restoring) return;
    if (previous.cart.length && !state.cart.length) emptyDraftOwner = userId;
    // El carrito vendido ya está vacío: se acabó el sello.
    if (sealed && !state.cart.length) {
      sealed = false;
      // Borrado inmediato, sin esperar al temporizador.
      cancelPending();
      void write(userId, state);
      return;
    }
    if (sealed) return;
    if (
      state.cart !== previous.cart ||
      state.customerId !== previous.customerId ||
      state.globalDiscount !== previous.globalDiscount
    ) {
      cancelPending();
      const scheduled = generation;
      timer = setTimeout(() => {
        const save = () => {
          idleHandle = undefined;
          if (scheduled !== generation || sealed) return;
          if (useStore.getState().user?.id === userId) void write(userId);
        };
        // Cuando el navegador esté libre: nunca en medio de un escaneo.
        if (typeof requestIdleCallback === "function")
          idleHandle = requestIdleCallback(save, { timeout: 2000 });
        else save();
      }, 600);
    }
  });
}

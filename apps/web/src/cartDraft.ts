// 05-A3 y 05-M1: el carrito en curso se guarda en este equipo, por usuario.
// Antes vivía sólo en memoria y se perdía con F5, con la recarga automática
// de una versión nueva, al cambiar de vendedor con PIN o al cerrarse la
// sesión. Se guarda en la tabla `cache` de IndexedDB (clave
// «cart-draft:<usuario>»), que cerrar sesión borra completa (G9): el borrador
// no sobrevive a un cierre de sesión ni lo ve otra persona.
import { localDB, useStore, type CartItem, type Variant } from "./api";
import { useWholesale } from "./Incentives";
import { toast } from "./helpers";

export const draftKey = (userId: string) => "cart-draft:" + userId;
export type CartDraft = {
  items: CartItem[];
  customerId: string | null;
  globalDiscount: number;
  wholesale: boolean;
  savedAt: number;
};

// Sin el costo: la copia local del catálogo tampoco lo guarda.
const lean = (variant: Variant): Variant => {
  const { costAvg: removed, lots, ...rest } = variant;
  void removed;
  return {
    ...rest,
    lots: lots?.map(({ cost: unused, ...lot }: any) => {
      void unused;
      return lot;
    }),
  };
};
export const leanItem = (item: CartItem): CartItem => ({
  ...item,
  variant: lean(item.variant),
  product: { ...item.product, variants: item.product.variants.map(lean) },
});

function write(userId: string, state = useStore.getState()) {
  const data: CartDraft = {
    items: state.cart.map(leanItem),
    customerId: state.customerId,
    globalDiscount: state.globalDiscount,
    wholesale: useWholesale.getState().on,
    savedAt: Date.now(),
  };
  const saving: Promise<unknown> = state.cart.length
    ? localDB.cache.put({ key: draftKey(userId), data })
    : localDB.cache.delete(draftKey(userId));
  return saving.catch(() => {
    /* Sin IndexedDB (modo privado): el carrito sigue en memoria. */
  });
}

let owner: string | null = null;
let restoring = false;
let timer: ReturnType<typeof setTimeout> | undefined;

async function restore(userId: string) {
  restoring = true;
  try {
    const saved = await localDB.cache
      .get(draftKey(userId))
      .catch(() => undefined);
    const draft = saved?.data as CartDraft | undefined;
    // Otra persona entró mientras se leía, o ya se escaneó algo nuevo.
    if (owner !== userId || !draft?.items?.length) return;
    if (useStore.getState().cart.length) return;
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
    restoring = false;
  }
}

/** Guarda el carrito de quien tiene la sesión y lo recupera al volver. */
export function keepCartDraft() {
  return useStore.subscribe((state, previous) => {
    const userId = state.user?.id ?? null;
    if (userId !== owner) {
      const before = owner;
      owner = userId;
      clearTimeout(timer);
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
    if (
      state.cart !== previous.cart ||
      state.customerId !== previous.customerId ||
      state.globalDiscount !== previous.globalDiscount
    ) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (useStore.getState().user?.id === userId) void write(userId);
      }, 200);
    }
  });
}

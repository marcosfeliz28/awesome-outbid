import Dexie, { type Table } from "dexie";
import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import type { SaleInput } from "@fitstore/shared";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branchId: string;
  sessionTimeoutMinutes?: number;
};
export type Variant = {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  price: string;
  costAvg?: string;
  stock: string;
  attributes: Record<string, string>;
  lots?: any[];
  product?: Product;
};
export type Product = {
  id: string;
  name: string;
  sku: string;
  brand: string;
  imageUrl: string;
  taxRate: string;
  minStock: string;
  maxStock: string;
  categoryId: string;
  category: { name: string; color: string; requiresLot: boolean };
  variants: Variant[];
};
export type CartItem = {
  variant: Variant;
  product: Product;
  qty: number;
  discountPercent: number;
  discountAmount?: number;
};
export type PendingSale = {
  id: string;
  userId: string;
  branchId: string;
  input: SaleInput;
  status: "pending" | "conflict";
  message?: string;
  createdAt: number;
  receipt: any;
};
class LocalDB extends Dexie {
  cache!: Table<{ key: string; data: any }, string>;
  sales!: Table<PendingSale, string>;
  merchandise!: Table<
    {
      id: string;
      userId: string;
      branchId: string;
      input: any;
      status: string;
      message?: string;
      createdAt: number;
    },
    string
  >;
  constructor() {
    super("fitstore-pos-v1");
    this.version(1).stores({
      cache: "key",
      sales: "id,userId,status,createdAt",
    });
    this.version(2).stores({
      cache: "key",
      sales: "id,userId,status,createdAt",
      merchandise: "id,userId,branchId,status,createdAt",
    });
  }
}
export const localDB = new LocalDB();
export const useStore = create<{
  user: User | null;
  token: string | null;
  cart: CartItem[];
  customerId: string | null;
  globalDiscount: number;
  online: boolean;
  theme: string;
  setSession: (user: User, token: string | null) => void;
  clearSession: () => void;
  add: (variant: Variant, product: Product) => void;
  setCart: (cart: CartItem[]) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (percent: number) => void;
  setOnline: (online: boolean) => void;
  toggleTheme: () => void;
}>((set) => ({
  user: null,
  token: null,
  cart: [],
  customerId: null,
  globalDiscount: 0,
  online: navigator.onLine,
  theme: localStorage.getItem("fitstore-theme") || "light",
  setSession: (user, token) => set({ user, token }),
  clearSession: () =>
    set({
      user: null,
      token: null,
      cart: [],
      customerId: null,
      globalDiscount: 0,
    }),
  add: (variant, product) =>
    set((state) => {
      const existing = state.cart.find((i) => i.variant.id === variant.id);
      return {
        cart: existing
          ? state.cart.map((i) =>
              // La línea toma la variante recién elegida: si el precio
              // cambió, se cobra el vigente (R9-offline-3).
              i.variant.id === variant.id
                ? { ...i, variant, product, qty: i.qty + 1 }
                : i,
            )
          : [...state.cart, { variant, product, qty: 1, discountPercent: 0 }],
      };
    }),
  setCart: (cart) => set({ cart }),
  updateQty: (id, qty) =>
    set((state) => ({
      cart:
        qty <= 0
          ? state.cart.filter((i) => i.variant.id !== id)
          : state.cart.map((i) => (i.variant.id === id ? { ...i, qty } : i)),
    })),
  clearCart: () => set({ cart: [], globalDiscount: 0, customerId: null }),
  setCustomer: (customerId) => set({ customerId }),
  setDiscount: (globalDiscount) => set({ globalDiscount }),
  setOnline: (online) => set({ online }),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("fitstore-theme", theme);
      return { theme };
    }),
}));
// El servidor no responde: fetch sin red (TypeError) o el proxy sin la API
// (502/503/504). Con el router encendido y sin internet, navigator.onLine
// sigue en true: la caja se marca sin conexión al primer fallo y vende con
// sus copias locales. Hereda de TypeError, lo que lanza fetch sin red, para
// que todos los respaldos sin conexión lo traten igual (R9-offline-1).
export class NetworkError extends TypeError {
  constructor() {
    super("Sin conexión con el servidor.");
    this.name = "NetworkError";
  }
}
export const isNetworkError = (e: unknown): e is NetworkError =>
  e instanceof NetworkError;
// Hay red y el servidor respondió la última vez.
export const isOnline = () => navigator.onLine && useStore.getState().online;
async function send(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    useStore.getState().setOnline(false);
    throw new NetworkError();
  }
  if ([502, 503, 504].includes(response.status)) {
    useStore.getState().setOnline(false);
    throw new NetworkError();
  }
  return response;
}
let refreshPromise: Promise<void> | null = null;
export async function refreshSession() {
  if (!refreshPromise)
    refreshPromise = (async () => {
      const response = await send("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Inicia sesión para continuar.");
      const result = await response.json();
      await saveSession(result.user, result.accessToken, false);
    })().finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
export const sessionDeadline = (user: User) =>
  Date.now() + (user.sessionTimeoutMinutes ?? 30) * 60000;
// activity = false al renovar el token: una consulta automática no es
// actividad de la persona y no alarga el plazo de inactividad (R9-offline-5).
export async function saveSession(
  user: User,
  token: string | null,
  activity = true,
) {
  useStore.getState().setSession(user, token);
  const saved = activity ? undefined : await localDB.cache.get("session");
  await localDB.cache.put({
    key: "session",
    data: {
      user,
      expiresAt:
        saved?.data?.user?.id === user.id &&
        typeof saved.data.expiresAt === "number"
          ? saved.data.expiresAt
          : sessionDeadline(user),
    },
  });
}
// Cierra la sesión también en el servidor: sólo borrar el estado del
// navegador dejaba viva la cookie de renovación y al recargar volvía a entrar
// el usuario anterior. Si el servidor no responde, la sesión guardada queda
// vencida para pedir la contraseña e intentarlo otra vez al abrir
// (R9-offline-5).
export async function endSession() {
  let revoked = true;
  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    revoked = !isNetworkError(e);
  }
  useStore.getState().clearSession();
  if (revoked) await localDB.cache.delete("session");
  else await localDB.cache.update("session", { "data.expiresAt": 0 });
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = useStore.getState().token;
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await send("/api" + path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && retry) {
    await refreshSession();
    return api(path, options, false);
  }
  if (!response.ok) {
    const result = await response
      .json()
      .catch(() => ({ message: "No se pudo completar la operación." }));
    throw new Error(result.message);
  }
  return response.json();
}
export const post = <T = any>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
// Datos que la caja necesita para vender: se guarda una copia y, sin conexión
// o si el servidor no responde, se usa la última (R9-offline-1).
export async function cachedApi<T>(
  path: string,
  key: string,
  fallback: T,
): Promise<T> {
  if (isOnline()) {
    try {
      const data = await api<T>(path);
      await localDB.cache.put({ key, data });
      return data;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  return ((await localDB.cache.get(key))?.data as T | undefined) ?? fallback;
}
// El catálogo llega en páginas de 200 ordenadas por nombre. Si alguien crea o
// desactiva un producto durante la descarga, las páginas se corren y un
// producto llegaba dos veces («el código es de 2 productos»). Se junta por
// id, se corta con una página incompleta y, si el total cambió entre páginas,
// se descarga otra vez (R9-offline-4).
async function fetchCatalog() {
  const limit = 200;
  for (let attempt = 1; ; attempt++) {
    const byId = new Map<string, Product>();
    let total: number | undefined,
      stable = true;
    for (let page = 1; ; page++) {
      const result = await api<{ items: Product[]; total: number }>(
        "/products?limit=" + limit + "&page=" + page,
      );
      if (total !== undefined && result.total !== total) stable = false;
      total = result.total;
      for (const p of result.items) byId.set(p.id, p);
      if (result.items.length < limit || page * limit >= result.total) break;
    }
    if (stable || attempt === 3) return [...byId.values()];
  }
}
export async function loadCatalog() {
  const user = useStore.getState().user;
  if (!user) throw new Error("Inicia sesión.");
  const key = "catalog:" + user.branchId;
  if (isOnline()) {
    try {
      const products = await fetchCatalog();
      const cached = products.map((p) => ({
        ...p,
        variants: p.variants.map(({ costAvg: removed, lots, ...v }) => {
          void removed;
          return {
            ...v,
            lots: lots?.map(({ cost: unused, ...l }) => {
              void unused;
              return l;
            }),
          };
        }),
      }));
      await localDB.cache.put({ key, data: cached });
      return products;
    } catch (e) {
      // Sin respuesta del servidor se vende con la copia local (R9-offline-1).
      if (!isNetworkError(e)) throw e;
    }
  }
  const cached = await localDB.cache.get(key);
  if (!cached) throw new Error("Conéctate una vez para descargar el catálogo.");
  return cached.data as Product[];
}
// Lo vendido sin conexión se descuenta del catálogo de la pantalla y del de
// este equipo: sin esto la caja volvía a vender las mismas unidades y la
// segunda venta quedaba en conflicto con el dinero ya cobrado (R9-offline-2).
export async function discountLocalStock(
  client: QueryClient,
  lines: { variantId: string; qty: number }[],
) {
  const sold = new Map<string, number>();
  for (const l of lines)
    sold.set(l.variantId, (sold.get(l.variantId) ?? 0) + l.qty);
  const discount = (products: Product[]) =>
    products.map((p) =>
      p.variants.some((v) => sold.has(v.id))
        ? {
            ...p,
            variants: p.variants.map((v) =>
              sold.has(v.id)
                ? {
                    ...v,
                    stock: String(
                      Math.max(0, Number(v.stock) - sold.get(v.id)!),
                    ),
                  }
                : v,
            ),
          }
        : p,
    );
  client.setQueryData<Product[]>(["catalog"], (old) => old && discount(old));
  const user = useStore.getState().user;
  const cached = user && (await localDB.cache.get("catalog:" + user.branchId));
  if (cached)
    await localDB.cache.put({ key: cached.key, data: discount(cached.data) });
}
// Las líneas del carrito toman la variante y el producto vigentes del
// catálogo: un precio cambiado en otro equipo bloqueaba el cobro y volver a
// escanear sumaba unidades al precio viejo. Devuelve las líneas cuyo precio
// cambió con el precio anterior (R9-offline-3).
export function refreshCart(products: Product[]) {
  const fresh = new Map<string, { variant: Variant; product: Product }>();
  for (const product of products)
    for (const variant of product.variants)
      fresh.set(variant.id, { variant, product });
  const state = useStore.getState();
  const changes: { item: CartItem; before: number }[] = [];
  let changed = false;
  const cart = state.cart.map((i) => {
    const current = fresh.get(i.variant.id);
    if (
      !current ||
      (current.variant === i.variant && current.product === i.product)
    )
      return i;
    changed = true;
    const item = { ...i, ...current };
    if (Number(current.variant.price) !== Number(i.variant.price))
      changes.push({ item, before: Number(i.variant.price) });
    return item;
  });
  if (changed) state.setCart(cart);
  return changes;
}
export async function syncSales() {
  const user = useStore.getState().user;
  if (!user || !navigator.onLine) return { synced: 0, conflicts: 0 };
  const pending = await localDB.sales
    .where("userId")
    .equals(user.id)
    .filter((s) => s.status === "pending")
    .sortBy("createdAt");
  if (!pending.length) return { synced: 0, conflicts: 0 };
  let synced = 0,
    conflicts = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const result = await post("/sales/sync", {
      sales: pending.slice(i, i + 100).map((s) => s.input),
    });
    for (const item of result.results) {
      if (item.status === "synced") {
        await localDB.sales.delete(item.offlineUuid);
        synced++;
      } else {
        await localDB.sales.update(item.offlineUuid, {
          status: "conflict",
          message: item.message,
        });
        conflicts++;
      }
    }
  }
  return { synced, conflicts };
}
export async function download(path: string, filename: string) {
  const response = await fetch("/api" + path, {
    headers: { Authorization: "Bearer " + useStore.getState().token },
    credentials: "include",
  });
  if (response.status === 401) {
    await refreshSession();
    return download(path, filename);
  }
  if (!response.ok) throw new Error("No se pudo descargar el archivo.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

let goodsSync: Promise<void> | null = null;
export async function syncMerchandise() {
  if (goodsSync) return goodsSync;
  goodsSync = (async () => {
    const user = useStore.getState().user;
    if (!user || !navigator.onLine) return;
    const pending = await localDB.merchandise
      .where("userId")
      .equals(user.id)
      .filter((r) => r.branchId === user.branchId && r.status === "pending")
      .sortBy("createdAt");
    for (const row of pending) {
      try {
        await post("/merchandise/operations", row.input);
        await localDB.merchandise.delete(row.id);
      } catch (e: any) {
        if (!navigator.onLine || e instanceof TypeError) break;
        await localDB.merchandise.update(row.id, {
          status: "conflict",
          message: e.message,
        });
      }
    }
  })().finally(() => {
    goodsSync = null;
  });
  return goodsSync;
}

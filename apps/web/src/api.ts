import Dexie, { type Table } from "dexie";
import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import type { SaleInput } from "@fitstore/shared";
import { applySyncResults } from "./pendingSales";
import { businessOperationName, traceBusinessOperation } from "./monitoring";

export type User = {
  id: string;
  name: string;
  username?: string;
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
  // 05-A2: el nombre de quien cobró, para que gerencia la reconozca en el
  // equipo (las ventas guardadas antes no lo tienen).
  userName?: string;
  branchId: string;
  input: SaleInput;
  status: "pending" | "conflict";
  message?: string;
  createdAt: number;
  receipt: any;
};
type CacheRow = { key: string; data: any; owner?: string };
class LocalDB extends Dexie {
  cache!: Table<CacheRow, string>;
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
// El token vive sólo en memoria. Las copias sin conexión pertenecen a la
// persona, sucursal, rol y permisos que las descargaron; una sesión con menos
// acceso nunca reutiliza la copia de gerencia, tampoco al cambiar por PIN.
const principal = (user: User) => JSON.stringify([user.branchId, user.id]);
const cacheOwner = (user: User) =>
  JSON.stringify([
    user.branchId,
    user.id,
    user.role,
    [...user.permissions].sort(),
  ]);
let sessionGeneration = 0;
let sessionClosing = false;
export class SessionChangedError extends Error {
  readonly status = 401;
  constructor() {
    super("La sesión cambió. Vuelve a intentar la operación.");
  }
}
const checkSession = (generation: number) => {
  if (!stillSignedIn(generation)) throw new SessionChangedError();
};
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
  setSession: (user, token) => {
    const previous = useStore.getState().user;
    if (!previous || cacheOwner(previous) !== cacheOwner(user))
      sessionGeneration++;
    sessionClosing = false;
    set({ user, token });
  },
  clearSession: () => {
    sessionGeneration++;
    sessionClosing = false;
    set({
      user: null,
      token: null,
      cart: [],
      customerId: null,
      globalDiscount: 0,
    });
  },
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
/** Limpia consultas en memoria al cambiar de persona, rol o permisos. */
export function isolateQueryClient(client: QueryClient) {
  return useStore.subscribe((state, previous) => {
    const current = state.user && cacheOwner(state.user);
    const before = previous.user && cacheOwner(previous.user);
    if (current !== before) client.clear();
  });
}
const checkPrivateSession = (user: User, generation: number) => {
  checkSession(generation);
  const current = useStore.getState().user;
  if (!current || cacheOwner(current) !== cacheOwner(user))
    throw new SessionChangedError();
};
// Las claves siguen siendo las del catálogo/caja. El dueño es obligatorio
// para datos de negocio: una fila heredada sin owner nunca sirve de respaldo.
// Sesión y borradores conservan su propio protocolo de restauración y cierre.
export async function readPrivateCache(
  key: string,
  user: User,
  generation = sessionGeneration,
) {
  checkPrivateSession(user, generation);
  const row = await localDB.cache.get(key);
  checkPrivateSession(user, generation);
  return row?.owner === cacheOwner(user) ? row : undefined;
}
export async function writePrivateCache(
  key: string,
  data: unknown,
  user: User,
  generation = sessionGeneration,
) {
  checkPrivateSession(user, generation);
  await localDB.transaction("rw", localDB.cache, async () => {
    checkPrivateSession(user, generation);
    await localDB.cache.put({ key, data, owner: cacheOwner(user) });
    // Si cambió la sesión durante el put, Dexie aborta la transacción. Un
    // clear de logout sobre esta misma tabla tampoco puede adelantársele.
    checkPrivateSession(user, generation);
  });
}
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
// Plazo para que el servidor conteste al cobrar o al abrir la aplicación. En
// un corte real con el router encendido los paquetes se pierden y fetch
// esperaba el plazo del sistema (de 20 s a más de 2 min): «Finalizar venta»
// seguía ocupado y al recargar la app se quedaba cargando. Vencido el plazo
// es sin conexión; es seguro para las ventas porque la sincronización las
// reconoce por offlineUuid (R9-offline-1).
export const ANSWER_TIMEOUT = 12000;
async function send(url: string, init: RequestInit, timeout = 0) {
  let expired = false,
    signal = init.signal;
  if (timeout) {
    // A mano y no con AbortSignal.any/timeout, que faltan en Safari viejos.
    const controller = new AbortController(),
      caller = init.signal;
    setTimeout(() => {
      expired = true;
      controller.abort();
    }, timeout);
    if (caller?.aborted) controller.abort();
    else
      caller?.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    signal = controller.signal;
  }
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal, cache: "no-store" });
  } catch (e) {
    if (!expired && e instanceof DOMException && e.name === "AbortError")
      throw e;
    useStore.getState().setOnline(false);
    throw new NetworkError();
  }
  if ([502, 503, 504].includes(response.status)) {
    useStore.getState().setOnline(false);
    throw new NetworkError();
  }
  return response;
}
// La conexión se cortó, o venció el plazo, mientras llegaba la respuesta: es
// sin conexión, no un error del servidor (R9-offline-1).
async function readJson(response: Response) {
  try {
    return await response.json();
  } catch (e) {
    if (e instanceof SyntaxError) throw e;
    useStore.getState().setOnline(false);
    throw new NetworkError();
  }
}
let refreshPromise: { generation: number; promise: Promise<void> } | null =
  null;
export async function refreshSession() {
  const generation = sessionGeneration;
  checkSession(generation);
  if (!refreshPromise || refreshPromise.generation !== generation) {
    const entry = { generation, promise: Promise.resolve() };
    entry.promise = (async () => {
      // También al recargar: una respuesta HTTP tardía de otra pestaña puede
      // haber reemplazado la cookie. No cambia la persona guardada por ella.
      const saved = await localDB.cache.get("session");
      const savedIsValid =
        typeof saved?.data?.expiresAt === "number" &&
        saved.data.expiresAt > Date.now();
      const expected =
        useStore.getState().user ?? (savedIsValid ? saved?.data?.user : null);
      checkSession(generation);
      // Tras salir (incluso sin red), una cookie aún viva no autoriza a
      // reabrir la sesión. Se exige usuario activo o restauración vigente.
      if (!expected?.id || !expected.branchId) throw new SessionChangedError();
      const response = await send(
        "/api/auth/refresh",
        { method: "POST", credentials: "include" },
        ANSWER_TIMEOUT,
      );
      checkSession(generation);
      if (!response.ok) throw new Error("Inicia sesión para continuar.");
      const result = await readJson(response);
      checkSession(generation);
      if (principal(expected) !== principal(result.user))
        throw new SessionChangedError();
      await saveSession(result.user, result.accessToken, false);
    })().finally(() => {
      if (refreshPromise === entry) refreshPromise = null;
    });
    refreshPromise = entry;
  }
  return refreshPromise.promise;
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
  const generation = sessionGeneration;
  const saved = activity ? undefined : await localDB.cache.get("session");
  checkSession(generation);
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
  // Invalida inmediatamente las consultas y renovaciones que ya estaban en
  // vuelo. El cierre no intenta renovar un token que acaba de invalidarse.
  const token = useStore.getState().token;
  const generation = ++sessionGeneration;
  sessionClosing = true;
  let revoked = false;
  try {
    const response = await send(
      "/api/auth/logout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: "{}",
        credentials: "include",
      },
      8000,
    );
    revoked = response.ok;
  } catch {
    /* Se conserva el marcador vencido hasta revocar en el servidor. */
  }
  if (generation !== sessionGeneration) return;
  useStore.getState().clearSession();
  await forgetSessionData(revoked);
}
// Privacidad al salir (G9). Se borra lo que el servidor puede volver a dar al
// iniciar sesión: la tabla `cache` completa (catálogo, clientes, caja,
// categorías, promociones, ajustes y listas de Mercancía) y las cachés del
// navegador que no son las de la aplicación (Workbox sólo precachea los
// archivos de la PWA; ninguna respuesta de /api se guarda allí).
// Se conserva, a propósito:
// - `sales` y `merchandise`: ventas y entradas hechas sin conexión (pendientes
//   o en conflicto). Son la única copia hasta que el servidor las acepte; al
//   volver a entrar su dueño se sincronizan por su offlineUuid, sin duplicar.
//   Borrarlas perdería dinero cobrado o mercancía recibida.
// - Si el servidor no respondió al cerrar, un registro «session» vencido y sin
//   datos de la persona: al abrir la app se pide la contraseña y se reintenta
//   revocar la cookie de renovación (R9-offline-5).
// - localStorage: el tema y la identidad de este equipo, que no son datos de
//   clientes ni de la sesión.
export async function forgetSessionData(revoked = true) {
  await localDB.transaction("rw", localDB.cache, async () => {
    await localDB.cache.clear();
    if (!revoked)
      await localDB.cache.put({ key: "session", data: { expiresAt: 0 } });
  });
  if (typeof caches === "undefined") return;
  try {
    for (const name of await caches.keys())
      if (!/precache/i.test(name)) await caches.delete(name);
  } catch {
    /* Sin Cache Storage (modo privado): no hay nada que borrar. */
  }
}
// Una respuesta que llega después de cerrar la sesión no se guarda: si no, una
// consulta en curso volvería a dejar clientes o catálogo en el equipo (G9).
// Las filas antiguas, sin dueño, no se leen. Se borran al cerrar sesión.
const stillSignedIn = (generation: number) =>
  generation === sessionGeneration && !sessionClosing;
// timeout: milisegundos sin respuesta para tratarlo como sin conexión.
export async function api<T = any>(
  path: string,
  options: RequestInit & { timeout?: number } = {},
  retry = true,
): Promise<T> {
  const generation = sessionGeneration;
  checkSession(generation);
  const request = async () => {
    const token = useStore.getState().token;
    const { timeout, ...init } = options;
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", "Bearer " + token);
    const response = await send(
      "/api" + path,
      { ...init, headers, credentials: "include" },
      timeout,
    );
    checkSession(generation);
    if (response.status === 401 && retry) {
      await refreshSession();
      return api(path, options, false);
    }
    if (!response.ok) {
      const result = await response
        .json()
        .catch(() => ({ message: "No se pudo completar la operación." }));
      // El código de estado permite distinguir sesión vencida (401) y falta
      // de permiso (403) de una caída de red (managementMessages.ts).
      throw Object.assign(new Error(result.message), {
        status: response.status,
      });
    }
    const data = await readJson(response);
    checkSession(generation);
    return data;
  };

  return traceBusinessOperation(
    businessOperationName(path, options.method),
    request,
  );
}

/** Descarga autenticada para evidencias y otros archivos binarios. */
export async function apiBlob(path: string, retry = true): Promise<Blob> {
  const generation = sessionGeneration;
  checkSession(generation);
  const request = async (): Promise<Blob> => {
    const token = useStore.getState().token;
    const headers = new Headers();
    if (token) headers.set("Authorization", "Bearer " + token);
    const response = await send(
      "/api" + path,
      { headers, credentials: "include" },
      20_000,
    );
    checkSession(generation);
    if (response.status === 401 && retry) {
      await refreshSession();
      return apiBlob(path, false);
    }
    if (!response.ok) {
      const result = await response
        .json()
        .catch(() => ({ message: "No se pudo descargar el archivo." }));
      throw new Error(result.message);
    }
    const blob = await response.blob();
    checkSession(generation);
    return blob;
  };
  return traceBusinessOperation("GET " + path, request);
}
export const post = <T = any>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
// Datos que la caja necesita para vender: se guarda una copia y, sin conexión
// o si el servidor no responde, se usa la última. Sin copia se lanza el
// error: React Query conserva lo que ya estaba en pantalla (R9-offline-1).
export async function cachedApi<T>(path: string, key: string): Promise<T> {
  const user = useStore.getState().user;
  if (!user) throw new SessionChangedError();
  const generation = sessionGeneration;
  if (isOnline()) {
    try {
      const data = await api<T>(path);
      checkSession(generation);
      await writePrivateCache(key, data, user, generation);
      checkSession(generation);
      return data;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  const cached = await readPrivateCache(key, user, generation);
  checkSession(generation);
  if (!cached) throw new NetworkError();
  return cached.data as T;
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
  const generation = sessionGeneration;
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
      checkSession(generation);
      await writePrivateCache(key, cached, user, generation);
      checkSession(generation);
      return products;
    } catch (e) {
      // Sin respuesta del servidor se vende con la copia local (R9-offline-1).
      if (!isNetworkError(e)) throw e;
    }
  }
  const cached = await readPrivateCache(key, user, generation);
  checkSession(generation);
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
  const generation = sessionGeneration;
  const cached =
    user &&
    (await readPrivateCache("catalog:" + user.branchId, user, generation));
  checkSession(generation);
  if (cached)
    await writePrivateCache(
      cached.key,
      discount(cached.data),
      user!,
      generation,
    );
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
  const generation = sessionGeneration;
  if (!user || !navigator.onLine) return { synced: 0, conflicts: 0, retry: 0 };
  const pending = await localDB.sales
    .where("userId")
    .equals(user.id)
    .filter((s) => s.branchId === user.branchId && s.status === "pending")
    .sortBy("createdAt");
  if (!pending.length) return { synced: 0, conflicts: 0, retry: 0 };
  const total = { synced: 0, conflicts: 0, retry: 0 };
  for (let i = 0; i < pending.length; i += 100) {
    checkSession(generation);
    const result = await post("/sales/sync", {
      sales: pending.slice(i, i + 100).map((s) => s.input),
    });
    // N-M3: sólo «conflict» pide revisión; «retry» la deja pendiente.
    const part = await applySyncResults(result.results, {
      deleteLocal: (id) => localDB.sales.delete(id),
      markConflict: (id, message) =>
        localDB.sales.update(id, { status: "conflict", message }),
    });
    total.synced += part.synced;
    total.conflicts += part.conflicts;
    total.retry += part.retry;
  }
  return total;
}
export const DOWNLOAD_FAILED = "No se pudo descargar el archivo.";
export async function download(path: string, filename: string, retry = true) {
  const generation = sessionGeneration;
  checkSession(generation);
  const response = await fetch("/api" + path, {
    headers: { Authorization: "Bearer " + useStore.getState().token },
    credentials: "include",
    cache: "no-store",
  });
  checkSession(generation);
  if (response.status === 401 && retry) {
    await refreshSession();
    return download(path, filename, false);
  }
  if (!response.ok) {
    // Un 400 dice qué cambiar (por ejemplo, un período que supera el máximo
    // exportable); cualquier otro fallo, el aviso genérico.
    const body =
      response.status === 400 ? await response.json().catch(() => null) : null;
    throw new Error(
      typeof body?.message === "string" ? body.message : DOWNLOAD_FAILED,
    );
  }
  const blob = await response.blob();
  checkSession(generation);
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
    const generation = sessionGeneration;
    if (!user || !navigator.onLine) return;
    const pending = await localDB.merchandise
      .where("userId")
      .equals(user.id)
      .filter((r) => r.branchId === user.branchId && r.status === "pending")
      .sortBy("createdAt");
    for (const row of pending) {
      try {
        checkSession(generation);
        await post("/merchandise/operations", row.input);
        await localDB.merchandise.delete(row.id);
      } catch (e: any) {
        if (
          !navigator.onLine ||
          e instanceof TypeError ||
          e instanceof SessionChangedError
        )
          break;
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

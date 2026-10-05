import Dexie, { type Table } from "dexie";
import { create } from "zustand";
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
              i.variant.id === variant.id ? { ...i, qty: i.qty + 1 } : i,
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
let refreshPromise: Promise<void> | null = null;
export async function refreshSession() {
  if (!refreshPromise)
    refreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Inicia sesión para continuar.");
      const result = await response.json();
      await saveSession(result.user, result.accessToken);
    })().finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
export async function saveSession(user: User, token: string | null) {
  useStore.getState().setSession(user, token);
  await localDB.cache.put({
    key: "session",
    data: {
      user,
      expiresAt: Date.now() + (user.sessionTimeoutMinutes ?? 30) * 60000,
    },
  });
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
  const response = await fetch("/api" + path, {
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
export async function loadCatalog() {
  const user = useStore.getState().user;
  if (!user) throw new Error("Inicia sesión.");
  const key = "catalog:" + user.branchId;
  if (navigator.onLine) {
    const products: Product[] = [];
    let page = 1,
      total = 0;
    do {
      const result = await api<{ items: Product[]; total: number }>(
        "/products?limit=200&page=" + page++,
      );
      products.push(...result.items);
      total = result.total;
    } while (products.length < total);
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
  }
  const cached = await localDB.cache.get(key);
  if (!cached) throw new Error("Conéctate una vez para descargar el catálogo.");
  return cached.data as Product[];
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

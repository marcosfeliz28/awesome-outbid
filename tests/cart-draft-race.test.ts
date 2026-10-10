// 05-N3 (revisión externa, P1): un guardado diferido (instante libre del
// navegador) que ya estaba en cola no puede reescribir el carrito vendido
// después del borrado. Usa el módulo real de apps/web/src/cartDraft.ts con una
// base y un almacén falsos; el instante libre NO se neutraliza: se deja en cola
// y se ejecuta justo entre el borrado y el vaciado del carrito.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, any>();
let releaseDelete: (() => void) | undefined;
let holdDelete = false;
const listeners = new Set<(s: any, p: any) => void>();
let state: any = {
  user: { id: "u1" },
  cart: [],
  customerId: null,
  globalDiscount: 0,
};

vi.mock("../apps/web/src/api", () => ({
  localDB: {
    cache: {
      get: async (k: string) => rows.get(k),
      put: async (row: any) => void rows.set(row.key, structuredClone(row)),
      delete: (k: string) =>
        holdDelete
          ? new Promise<void>((done) => {
              releaseDelete = () => {
                rows.delete(k);
                done();
              };
            })
          : Promise.resolve(void rows.delete(k)),
    },
    sales: { get: async () => undefined },
  },
  useStore: {
    getState: () => state,
    setState: (patch: any) => {
      const previous = state;
      state = { ...state, ...patch };
      for (const l of [...listeners]) l(state, previous);
    },
    subscribe: (l: any) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));
vi.mock("../apps/web/src/Incentives", () => ({
  useWholesale: { getState: () => ({ on: false, set: () => {} }) },
}));
vi.mock("../apps/web/src/helpers", () => ({ toast: () => {} }));

const line = {
  variant: { id: "v1", price: 10 },
  product: { id: "p1", variants: [] },
  qty: 1,
  discountPercent: 0,
};
const idle: (() => void)[] = [];

describe("cartDraft · carrera entre el borrado y un guardado en cola", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    rows.clear();
    idle.length = 0;
    listeners.clear();
    holdDelete = false;
    state = {
      user: { id: "u1" },
      cart: [],
      customerId: null,
      globalDiscount: 0,
    };
    (globalThis as any).requestIdleCallback = (cb: () => void) => idle.push(cb);
    (globalThis as any).cancelIdleCallback = (id: number) => {
      idle[id - 1] = () => {};
    };
  });
  afterEach(() => vi.useRealTimers());

  it("el callback pendiente que corre tras el borrado no resucita la venta", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    // Primer cambio: el módulo registra a quien tiene la sesión.
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    // Un artículo: el temporizador de 600 ms deja un callback en cola.
    store.setState({ cart: [line] });
    vi.advanceTimersByTime(700);
    expect(idle).toHaveLength(1);
    expect(rows.size).toBe(0);
    // Se cobra: el borrado queda esperando y, en ese intervalo, corre el
    // callback que ya estaba en cola (el carrito sigue con artículos).
    holdDelete = true;
    const discarding = mod.discardCartDraft();
    for (const cb of idle) cb();
    releaseDelete!();
    await discarding;
    expect(rows.size).toBe(0);
    // Y después, el vaciado del carrito: tampoco queda nada guardado.
    holdDelete = false;
    store.setState({ cart: [] });
    await vi.advanceTimersByTimeAsync(5000);
    for (const cb of idle) cb();
    await vi.advanceTimersByTimeAsync(5000);
    expect(rows.size).toBe(0);
    stop();
  });

  it("un callback que corre DESPUÉS del borrado y antes de vaciar tampoco escribe", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    // Primer cambio: el módulo registra a quien tiene la sesión.
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ cart: [line] });
    vi.advanceTimersByTime(700);
    await mod.discardCartDraft();
    for (const cb of idle) cb();
    await Promise.resolve();
    expect(rows.size).toBe(0);
    stop();
  });

  it("sin venta, el guardado diferido sigue funcionando", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    // Primer cambio: el módulo registra a quien tiene la sesión.
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ cart: [line] });
    vi.advanceTimersByTime(700);
    for (const cb of idle) cb();
    await Promise.resolve();
    expect([...rows.keys()]).toEqual(["cart-draft:u1"]);
    stop();
  });
});

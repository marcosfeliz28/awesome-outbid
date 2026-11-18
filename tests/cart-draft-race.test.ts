// 05-N3 (revisión externa, P1): un guardado diferido (instante libre del
// navegador) que ya estaba en cola no puede reescribir el carrito vendido
// después del borrado. Usa el módulo real de apps/web/src/cartDraft.ts con una
// base y un almacén falsos; el instante libre NO se neutraliza: se deja en cola
// y se ejecuta justo entre el borrado y el vaciado del carrito.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, any>();
let releaseDelete: (() => void) | undefined;
let holdDelete = false;
let failDelete = false;
const listeners = new Set<(s: any, p: any) => void>();
let state: any = {
  user: { id: "u1" },
  cart: [],
  customerId: null,
  globalDiscount: 0,
};

vi.mock("../apps/web/src/api", () => ({
  localDB: {
    transaction: async (
      _mode: string,
      _table: unknown,
      run: () => Promise<unknown>,
    ) => run(),
    cache: {
      get: async (k: string) => rows.get(k),
      put: async (row: any) => void rows.set(row.key, structuredClone(row)),
      delete: (k: string) =>
        failDelete
          ? Promise.reject(new Error("IndexedDB delete failed"))
          : holdDelete
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
    failDelete = false;
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
    // Primero existe una revisión durable propia que la transacción borrará.
    for (const cb of idle) cb();
    await Promise.resolve();
    idle.length = 0;
    store.setState({ cart: [{ ...line, qty: 2 }] });
    vi.advanceTimersByTime(700);
    expect(idle).toHaveLength(1);
    expect(rows.size).toBe(1);
    // Se cobra: el borrado queda esperando y, en ese intervalo, corre el
    // callback que ya estaba en cola (el carrito sigue con artículos).
    holdDelete = true;
    const discarding = mod.discardCartDraft();
    for (const cb of idle) cb();
    await vi.advanceTimersByTimeAsync(0);
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
  it("PWA espera el borrado durable del último artículo y no restaura lo quitado", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ cart: [line] });
    vi.advanceTimersByTime(700);
    for (const cb of idle) cb();
    await Promise.resolve();
    expect(rows.has("cart-draft:u1")).toBe(true);
    holdDelete = true;
    // El actualizador consulta antes que el listener del borrador, como main.
    const ready = mod.flushEmptyDraftBeforeReload();
    store.setState({ cart: [] });
    let finished = false;
    void ready.then(() => {
      finished = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(false);
    expect(rows.has("cart-draft:u1")).toBe(true);
    releaseDelete!();
    expect(await ready).toBe(true);
    expect(rows.has("cart-draft:u1")).toBe(false);
    stop();
  });

  it("Inicio vacío no borra un borrador de otra pestaña", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    rows.set("cart-draft:u1", {
      key: "cart-draft:u1",
      data: { items: [line] },
    });
    expect(await mod.flushEmptyDraftBeforeReload()).toBe(true);
    expect(rows.has("cart-draft:u1")).toBe(true);
  });
  it("no borra la revisión más reciente de otra pestaña del mismo usuario", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ cart: [line] });
    vi.advanceTimersByTime(700);
    for (const cb of idle) cb();
    await Promise.resolve();
    rows.set("cart-draft:u1", {
      key: "cart-draft:u1",
      data: { items: [line, line], revision: "other-tab", savedAt: Date.now() },
    });
    store.setState({ cart: [] });
    expect(await mod.flushEmptyDraftBeforeReload()).toBe(false);
    await vi.advanceTimersByTimeAsync(700);
    for (const cb of idle) cb();
    await Promise.resolve();
    expect(rows.get("cart-draft:u1").data.items).toHaveLength(2);
    stop();
  });
  it("un cobro sin resolución mantiene bloqueada la recarga aunque se vacíe", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ cart: [line] });
    await mod.rememberAttempt({
      key: "sale",
      uuid: "uncertain-sale",
      capturedAt: new Date().toISOString(),
    });
    store.setState({ cart: [] });
    expect(await mod.flushEmptyDraftBeforeReload()).toBe(false);
    stop();
  });
  it("fallo IndexedDB al borrar bloquea sin fingir confirmación", async () => {
    const mod = await import("../apps/web/src/cartDraft");
    const stop = mod.keepCartDraft();
    const store = (await import("../apps/web/src/api")).useStore as any;
    store.setState({});
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ cart: [line] });
    vi.advanceTimersByTime(700);
    for (const cb of idle) cb();
    await Promise.resolve();
    failDelete = true;
    store.setState({ cart: [] });
    expect(await mod.flushEmptyDraftBeforeReload()).toBe(false);
    expect(rows.has("cart-draft:u1")).toBe(true);
    stop();
  });
});

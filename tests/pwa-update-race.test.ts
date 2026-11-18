import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({
  state: { cart: [] as unknown[] },
  options: null as any,
  update: vi.fn(),
  controlling: null as null | ((event: any) => void),
}));
// Ejecuta el register.js INSTALADO, no una imitación de su contrato.
// Solo adapta los dos enlaces ESM (import/export) al sandbox de Node;
// el cuerpo del plugin, incluido controlling y el argumento obsoleto, es real.
vi.mock("virtual:pwa-register", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const source = readFileSync(
    "apps/web/node_modules/vite-plugin-pwa/dist/client/build/register.js",
    "utf8",
  );
  const linked = source
    .replace('import("workbox-window")', "Promise.resolve({ Workbox })")
    .replace(
      /export\s*\{\s*registerSW\s*\};?/,
      "result.registerSW = registerSW;",
    );
  return {
    registerSW: (options: any) => {
      env.options = options;
      const result: any = {};
      class Workbox {
        addEventListener(name: string, handler: any) {
          if (name === "controlling") env.controlling = handler;
          if (name === "waiting") Promise.resolve().then(handler);
        }
        register() {
          return Promise.resolve({ update: vi.fn() });
        }
        messageSkipWaiting() {}
      }
      runInNewContext(linked, { result, Workbox, navigator, window });
      const update = result.registerSW(options);
      env.update.mockImplementation(update);
      return env.update;
    },
  };
});
vi.mock("../apps/web/src/api", () => ({
  useStore: { getState: () => env.state, subscribe: vi.fn() },
}));
let sw: EventTarget;
let win: EventTarget;
let doc: EventTarget;
let modal = false;
let buttons: any[] = [];
const reload = vi.fn();
function element() {
  const e: any = new EventTarget();
  e.style = {};
  e.setAttribute = vi.fn();
  e.remove = vi.fn();
  e.replaceChildren = (...children: any[]) => {
    buttons = children.filter((c) => c.type === "button");
  };
  return e;
}
async function start(beforeReload?: () => Promise<boolean>) {
  const { startPwaUpdates } = await import("../apps/web/src/pwaUpdate");
  startPwaUpdates(beforeReload);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(env.controlling).toBeTypeOf("function");
}
function clickUpdate() {
  buttons
    .find((b) => b.textContent === "Actualizar ahora")
    ?.dispatchEvent(new Event("click"));
}
describe("PWA real · carreras de activación sin perder trabajo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    env.state = { cart: [] };
    env.update.mockReset();
    env.controlling = null;
    reload.mockReset();
    modal = false;
    buttons = [];
    sw = Object.assign(new EventTarget(), { controller: {} });
    win = Object.assign(new EventTarget(), {
      location: { reload },
      matchMedia: () => ({ matches: false }),
    });
    doc = Object.assign(new EventTarget(), {
      querySelector: () => (modal ? {} : null),
      createElement: element,
      body: { appendChild: vi.fn() },
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", { serviceWorker: sw, onLine: true });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("escaneo entre aplicar y controllerchange bloquea recarga; Workbox no la fuerza", async () => {
    await start();
    clickUpdate();
    expect(env.update).toHaveBeenCalledWith(false);
    env.state.cart = [{}];
    env.controlling!({ isUpdate: true });
    sw.dispatchEvent(new Event("controllerchange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).not.toHaveBeenCalled();
    env.state.cart = [];
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("otra pestaña activa SW: esta pestaña conserva carrito incluso sin persistencia", async () => {
    await start();
    env.state.cart = [{}];
    env.controlling!({ isUpdate: true });
    sw.dispatchEvent(new Event("controllerchange"));
    vi.advanceTimersByTime(3_600_000);
    expect(reload).not.toHaveBeenCalled();
    expect(env.update).not.toHaveBeenCalled();
  });
  it("pago o conteo abierto bloquea botón, eager y controllerchange aunque carrito esté vacío", async () => {
    await start();
    modal = true;
    clickUpdate();
    win.dispatchEvent(new Event("nexora:check-update"));
    env.controlling!({ isUpdate: true });
    sw.dispatchEvent(new Event("controllerchange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.update).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("un formulario editado bloquea eager y botón hasta la pausa segura", async () => {
    await start();
    win.dispatchEvent(new Event("input"));
    clickUpdate();
    win.dispatchEvent(new Event("nexora:check-update"));
    expect(env.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30 * 60_000);
    expect(env.update).toHaveBeenCalledWith(false);
  });
  it("controllerchange repetido solo recarga una vez cuando está libre", async () => {
    await start();
    sw.dispatchEvent(new Event("controllerchange"));
    sw.dispatchEvent(new Event("controllerchange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("fallo durable bloquea recarga y una nueva venta durante await también", async () => {
    let release: (ready: boolean) => void = () => {};
    await start(
      () =>
        new Promise<boolean>((done) => {
          release = done;
        }),
    );
    sw.dispatchEvent(new Event("controllerchange"));
    release(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    env.state.cart = [{}];
    release(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it("un cambio de usuario durante persistencia bloquea recarga", async () => {
    let release: (ready: boolean) => void = () => {};
    (env.state as any).user = { id: "a" };
    await start(
      () =>
        new Promise<boolean>((done) => {
          release = done;
        }),
    );
    sw.dispatchEvent(new Event("controllerchange"));
    (env.state as any).user = { id: "b" };
    release(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
  });
});

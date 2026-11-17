import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({
  state: { cart: [] as unknown[] },
  options: null as any,
  update: vi.fn(),
}));
vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: any) => {
    env.options = options;
    return env.update;
  },
}));
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
async function start() {
  const { startPwaUpdates } = await import("../apps/web/src/pwaUpdate");
  startPwaUpdates();
  env.options.onNeedRefresh();
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
    sw.dispatchEvent(new Event("controllerchange"));
    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();
    env.state.cart = [];
    vi.advanceTimersByTime(15_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("otra pestaña activa SW: esta pestaña conserva carrito incluso sin persistencia", async () => {
    await start();
    env.state.cart = [{}];
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
    sw.dispatchEvent(new Event("controllerchange"));
    vi.advanceTimersByTime(60_000);
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
    vi.advanceTimersByTime(60_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

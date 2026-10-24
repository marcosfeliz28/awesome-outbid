import { afterEach, describe, expect, it, vi } from "vitest";
import { printSoon } from "../apps/web/src/Prints";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("N-16 · impresión de ticket", () => {
  it("espera al montaje real y al logo antes de abrir la impresión", async () => {
    const print = vi.fn();
    const alert = vi.fn();
    const load: Array<() => void> = [];
    const logo = {
      complete: false,
      addEventListener: (event: string, callback: () => void) => {
        if (event === "load") load.push(callback);
      },
    };
    const sheet = { querySelectorAll: () => [logo] };
    let frames = 0;
    vi.stubGlobal("window", {
      print,
      alert,
      requestAnimationFrame: (callback: () => void) => { frames++; queueMicrotask(callback); },
    });
    vi.stubGlobal("document", {
      querySelector: () => frames >= 3 ? sheet : null,
      fonts: { ready: Promise.resolve() },
    });
    const pending = printSoon();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(frames).toBeGreaterThanOrEqual(3);
    expect(print).not.toHaveBeenCalled();
    expect(load).toHaveLength(1);
    logo.complete = true;
    load[0]();
    expect(await pending).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it("no imprime un ticket incompleto y avisa que se puede reintentar", async () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const alert = vi.fn();
    vi.stubGlobal("window", {
      print,
      alert,
      requestAnimationFrame: (callback: () => void) => { queueMicrotask(callback); },
    });
    vi.stubGlobal("document", {
      querySelector: () => ({ querySelectorAll: () => [{ complete: false, addEventListener: vi.fn() }] }),
      fonts: { ready: Promise.resolve() },
    });
    const pending = printSoon();
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toBe(false);
    expect(print).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("vuelve a pulsar Imprimir"));
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { limitarFrecuencia } from "../packages/ui/src/nx-limitar-frecuencia";

describe("nx-limitar-frecuencia", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("llama una vez tras el plazo, con los últimos argumentos", () => {
    const fn = vi.fn();
    const limitada = limitarFrecuencia(fn, 300);
    limitada("a");
    limitada("b");
    limitada("c");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("cada llamada nueva reinicia el plazo", () => {
    const fn = vi.fn();
    const limitada = limitarFrecuencia(fn, 300);
    limitada(1);
    vi.advanceTimersByTime(200);
    limitada(2);
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(2);
  });

  it("cancelar() evita la llamada pendiente", () => {
    const fn = vi.fn();
    const limitada = limitarFrecuencia(fn, 300);
    limitada(1);
    limitada.cancelar();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancelar() sin llamada pendiente no falla y no altera llamadas futuras", () => {
    const fn = vi.fn();
    const limitada = limitarFrecuencia(fn, 300);
    expect(() => limitada.cancelar()).not.toThrow();
    limitada(7);
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith(7);
  });

  it("con 0 ms no llama de forma síncrona, sino al avanzar el reloj", () => {
    const fn = vi.fn();
    const limitada = limitarFrecuencia(fn, 0);
    limitada(1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

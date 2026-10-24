import { afterEach, describe, expect, it, vi } from "vitest";
import { observeLocalQueue } from "../apps/web/src/localQueueObserver";

afterEach(() => vi.useRealTimers());

describe("N-25 · pendientes reactivos sin consultar cada cuatro segundos", () => {
  it("actualiza por mutación, al enfocar y sólo usa respaldo cada minuto", async () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    let emit!: (value: number) => void;
    const unsubscribe = vi.fn();
    const query = vi.fn().mockResolvedValue(4);
    const values: number[] = [];
    const stop = observeLocalQueue(query, (value) => values.push(value), {
      target: target as any,
      observe: () => ({ subscribe: ({ next }) => { emit = next; return { unsubscribe }; } }),
    });
    emit(1);
    emit(2);
    expect(values).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(4000);
    expect(query).not.toHaveBeenCalled();
    target.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(values.at(-1)).toBe(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(query).toHaveBeenCalled();
    stop();
    emit(9);
    expect(values).not.toContain(9);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

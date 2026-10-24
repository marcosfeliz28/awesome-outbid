import { afterEach, describe, expect, it, vi } from "vitest";
import { observeLocalQueue } from "../apps/web/src/localQueueObserver";

afterEach(() => vi.useRealTimers());

describe("N-26 · cola de mercancía sin sondeo cada dos segundos", () => {
  it("recibe altas y retiros confirmados; al volver a la pestaña relee conflictos", async () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    let emit!: (rows: { id: string; status: string }[]) => void;
    const values: string[][] = [];
    const query = vi.fn().mockResolvedValue([{ id: "A", status: "conflict" }]);
    const stop = observeLocalQueue(query, (rows) => values.push(rows.map((row) => row.status)), {
      target: target as any,
      observe: () => ({ subscribe: ({ next }) => { emit = next; return { unsubscribe: vi.fn() }; } }),
    });
    emit([{ id: "A", status: "pending" }]);
    emit([]);
    expect(values).toEqual([["pending"], []]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(query).not.toHaveBeenCalled();
    target.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(values.at(-1)).toEqual(["conflict"]);
    stop();
  });
});

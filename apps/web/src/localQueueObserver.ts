import { liveQuery } from "dexie";

/** Dexie notifica cambios confirmados, incluso entre pestañas. El sondeo de
 * respaldo sólo cubre escritores externos que no usen Dexie. */
export function observeLocalQueue<T>(
  query: () => Promise<T>,
  onValue: (value: T) => void,
  options: {
    target?: Pick<Window, "addEventListener" | "removeEventListener">;
    observe?: (query: () => Promise<T>) => { subscribe: (handlers: { next: (value: T) => void; error: () => void }) => { unsubscribe: () => void } };
    fallbackMs?: number;
  } = {},
) {
  const target = options.target ?? window;
  let active = true;
  const refresh = async () => {
    try {
      const value = await query();
      if (active) onValue(value);
    } catch { /* Sin IndexedDB disponible: no ocultar la última cuenta válida. */ }
  };
  const subscription = (options.observe ?? liveQuery)(query).subscribe({
    next: (value) => { if (active) onValue(value); },
    error: () => { void refresh(); },
  });
  const onFocus = () => { void refresh(); };
  target.addEventListener("focus", onFocus);
  const timer = setInterval(() => { void refresh(); }, options.fallbackMs ?? 60_000);
  return () => {
    active = false;
    clearInterval(timer);
    target.removeEventListener("focus", onFocus);
    subscription.unsubscribe();
  };
}

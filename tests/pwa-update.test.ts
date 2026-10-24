// M7 (auditoría de infraestructura): la PWA no se recarga sola con una venta
// en curso. La versión nueva queda en espera y se aplica con el carrito vacío.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canApplyPwaUpdate,
  PWA_UPDATE_CHECK_MS,
  PWA_UPDATE_FORM_MS,
  PWA_UPDATE_HIDDEN_IDLE_MS,
  PWA_UPDATE_IDLE_MS,
  pwaUpdateMessage,
  canApplyScheduledPwaUpdate,
  canSchedulePwaUpdate,
  readPwaUpdateSchedule,
  savePwaUpdateSchedule,
} from "../apps/web/src/pwaUpdatePolicy";
import { loadPwaReleaseNotes } from "../apps/web/src/pwaReleaseNotes";

const read = (path: string) => readFileSync(path, "utf8");

describe("PWA · actualización sin cortar ventas", () => {
  it("nunca se aplica con artículos en el carrito", () => {
    for (const hidden of [false, true])
      for (const idleMs of [0, PWA_UPDATE_IDLE_MS * 100])
        expect(canApplyPwaUpdate({ cartItems: 1, idleMs, hidden })).toBe(false);
  });

  it("con el carrito vacío espera a que la caja quede sin usar", () => {
    const visible = (idleMs: number) =>
      canApplyPwaUpdate({ cartItems: 0, idleMs, hidden: false });
    expect(visible(0)).toBe(false);
    expect(visible(PWA_UPDATE_IDLE_MS - 1)).toBe(false);
    expect(visible(PWA_UPDATE_IDLE_MS)).toBe(true);
    const hidden = (idleMs: number) =>
      canApplyPwaUpdate({ cartItems: 0, idleMs, hidden: true });
    expect(hidden(PWA_UPDATE_HIDDEN_IDLE_MS - 1)).toBe(false);
    expect(hidden(PWA_UPDATE_HIDDEN_IDLE_MS)).toBe(true);
    expect(PWA_UPDATE_IDLE_MS).toBeGreaterThanOrEqual(2 * 60_000);
    expect(PWA_UPDATE_CHECK_MS).toBeLessThanOrEqual(60 * 60_000);
  });

  it("05-N9: tampoco con una ventana abierta ni con un formulario a medias", () => {
    const base = {
      cartItems: 0,
      idleMs: PWA_UPDATE_IDLE_MS * 10,
      hidden: true,
    };
    expect(canApplyPwaUpdate(base)).toBe(true);
    expect(canApplyPwaUpdate({ ...base, dialogOpen: true })).toBe(false);
    expect(canApplyPwaUpdate({ ...base, sinceInputMs: 60_000 })).toBe(false);
    expect(
      canApplyPwaUpdate({ ...base, sinceInputMs: PWA_UPDATE_FORM_MS }),
    ).toBe(true);
    expect(
      canApplyPwaUpdate({ ...base, hidden: false, dialogOpen: true }),
    ).toBe(false);
  });

  it("05-N7/N6: todas las pestañas se recargan al cambiar de service worker y el aviso va abajo", () => {
    const module = read("apps/web/src/pwaUpdate.ts");
    // Un oyente permanente (sólo si ya había service worker) y no sólo el de
    // la pestaña que pulsó «Actualizar ahora».
    expect(module).toContain("const hadController");
    expect(module).toContain("if (hadController)");
    expect(module).toContain("reloadIfFree");
    expect(module).toContain("bottom:");
    expect(module).not.toContain('top: "12px"');
  });

  it("el aviso dice si hay que terminar la venta primero", () => {
    expect(pwaUpdateMessage(2)).toContain("al terminar esta venta");
    expect(pwaUpdateMessage(0)).toContain("versión nueva");
  });

  it("vite y main.tsx usan el modo con aviso, no la recarga automática", () => {
    const vite = read("apps/web/vite.config.ts");
    expect(vite).toContain('registerType: "prompt"');
    expect(vite).not.toContain('registerType: "autoUpdate"');
    expect(vite).toContain("clientsClaim: true");
    expect(vite).not.toMatch(/skipWaiting:\s*true/);
    const main = read("apps/web/src/main.tsx");
    expect(main).toContain("startPwaUpdates();");
    expect(main).not.toContain("registerSW(");
    const module = read("apps/web/src/pwaUpdate.ts");
    // La única forma de aplicar (updateSW) comprueba antes el carrito.
    const apply = module.slice(
      module.indexOf("const apply = () => {"),
      module.indexOf("const render = () => {"),
    );
    expect(apply).toContain("cartItems() > 0) return;");
    // Recarga también si la versión la encontró la revisión de cada hora.
    expect(apply).toContain('addEventListener("controllerchange"');
    expect(module.match(/updateSW\(true\)/g)).toHaveLength(1);
    expect(module).toContain('role", "status"');
    expect(module).toContain('aria-live", "polite"');
    expect(module).toContain("canApplyPwaUpdate(");
    expect(module).toContain("registration.update()");
  });

  it("N-29: sólo la dueña puede programar y la fecha persiste por empresa", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const now = Date.parse("2026-10-24T12:00:00Z");
    const scheduled = now + 2 * 60 * 60_000;
    expect(canSchedulePwaUpdate(["*"])).toBe(true);
    expect(canSchedulePwaUpdate(["sale:write"])).toBe(false);
    expect(savePwaUpdateSchedule(storage, "empresa-a", scheduled, now)).toBe(
      true,
    );
    expect(readPwaUpdateSchedule(storage, "empresa-a")).toBe(scheduled);
    expect(readPwaUpdateSchedule(storage, "empresa-b")).toBeNull();
    expect(savePwaUpdateSchedule(storage, "empresa-a", now - 1, now)).toBe(
      false,
    );
  });

  it("N-29: la hora programada jamás interrumpe una venta, modal o formulario", () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    const safe = {
      cartItems: 0,
      idleMs: PWA_UPDATE_IDLE_MS,
      hidden: false,
      sinceInputMs: PWA_UPDATE_FORM_MS,
    };
    expect(canApplyScheduledPwaUpdate(safe, now + 1, now)).toBe(false);
    expect(canApplyScheduledPwaUpdate(safe, now, now)).toBe(true);
    expect(
      canApplyScheduledPwaUpdate({ ...safe, cartItems: 1 }, now, now),
    ).toBe(false);
    expect(
      canApplyScheduledPwaUpdate({ ...safe, dialogOpen: true }, now, now),
    ).toBe(false);
    expect(
      canApplyScheduledPwaUpdate({ ...safe, sinceInputMs: 1 }, now, now),
    ).toBe(false);
  });

  it("N-29: las notas de la versión nueva llegan por red y se limitan a texto breve", async () => {
    const fetcher = async (_url: string, options: { cache: string }) => {
      expect(options.cache).toBe("no-store");
      return {
        ok: true,
        json: async () => ({
          version: "0.1.2",
          notes: ["Caja más segura", "Corrección de tickets"],
        }),
      };
    };
    expect(await loadPwaReleaseNotes(fetcher)).toEqual({
      version: "0.1.2",
      notes: ["Caja más segura", "Corrección de tickets"],
    });
    expect(
      await loadPwaReleaseNotes(async () => ({
        ok: true,
        json: async () => ({ version: "?", notes: ["x".repeat(500)] }),
      })),
    ).toBeNull();
  });

  it("N-29: el aviso real usa la programación y lee notas no precacheadas", () => {
    const updater = read("apps/web/src/pwaUpdate.ts");
    const vite = read("apps/web/vite.config.ts");
    const notes = JSON.parse(read("apps/web/public/release-notes.json"));
    expect(updater).toContain("loadPwaReleaseNotes()");
    expect(updater).toContain(
      "canApplyScheduledPwaUpdate(updateState, scheduledAt)",
    );
    expect(updater).toContain(
      "canSchedulePwaUpdate(useStore.getState().user?.permissions ?? [])",
    );
    expect(updater).toContain(
      "savePwaUpdateSchedule(localStorage, scheduleScope(), when)",
    );
    expect(updater).toContain("notes.textContent =");
    expect(vite).toContain('globPatterns: ["**/*.{js,css,html,svg,woff2}"]');
    expect(notes).toMatchObject({ version: "0.1.1-prueba" });
    expect(notes.notes).toHaveLength(2);
  });
});

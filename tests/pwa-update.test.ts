// M7 (auditoría de infraestructura): la PWA no se recarga sola con una venta
// en curso. La versión nueva queda en espera y se aplica con el carrito vacío.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canApplyPwaUpdate,
  PWA_UPDATE_CHECK_MS,
  PWA_UPDATE_HIDDEN_IDLE_MS,
  PWA_UPDATE_IDLE_MS,
  pwaUpdateMessage,
} from "../apps/web/src/pwaUpdatePolicy";

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
});

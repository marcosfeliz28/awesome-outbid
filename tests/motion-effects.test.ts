import { describe, expect, it, vi } from "vitest";
import {
  applyEffects,
  readEffects,
  saveEffects,
} from "../apps/web/src/motionEffects";

describe("preferencia de efectos", () => {
  it("usa Normal por defecto y descarta valores desconocidos", () => {
    expect(readEffects({ getItem: () => null })).toBe("normal");
    expect(readEffects({ getItem: () => "desconocido" })).toBe("normal");
    expect(
      readEffects({
        getItem: () => {
          throw new Error("no disponible");
        },
      }),
    ).toBe("normal");
  });
  it("guarda y aplica cada modo sin romperse si el almacenamiento falla", () => {
    const setItem = vi.fn();
    const target = { dataset: {} as Record<string, string> };
    for (const mode of ["maximo", "normal", "apagado"] as const) {
      saveEffects(mode, { setItem }, target);
      expect(target.dataset.effects).toBe(mode);
      expect(readEffects({ getItem: () => mode })).toBe(mode);
    }
    expect(setItem).toHaveBeenCalledTimes(3);
    expect(() =>
      saveEffects(
        "apagado",
        {
          setItem: () => {
            throw new Error("no disponible");
          },
        },
        target,
      ),
    ).not.toThrow();
    applyEffects("normal", target);
    expect(target.dataset.effects).toBe("normal");
  });
});

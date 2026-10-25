import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADMIN_THEME_KEY,
  adminThemeLabel,
  readAdminTheme,
  saveAdminTheme,
} from "../apps/web/src/admin-dashboard/preferences";

describe("temas del tablero administrativo", () => {
  const contrast = (foreground: string, background: string) => {
    const luminance = (hex: string) => {
      const channels = hex
        .slice(1)
        .match(/.{2}/g)!
        .map((value) => Number.parseInt(value, 16) / 255)
        .map((value) =>
          value <= 0.04045
            ? value / 12.92
            : Math.pow((value + 0.055) / 1.055, 2.4),
        );
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const [high, low] = [luminance(foreground), luminance(background)].sort(
      (a, b) => b - a,
    );
    return (high + 0.05) / (low + 0.05);
  };
  it("recupera los tres temas y usa una opción segura para valores antiguos", () => {
    expect(readAdminTheme({ getItem: () => "mando" })).toBe("mando");
    expect(readAdminTheme({ getItem: () => "desconocido" })).toBe("cristal");
    expect(adminThemeLabel("ejecutivo")).toBe("Ejecutivo claro");
  });

  it("guarda la preferencia solo en el equipo", () => {
    const writes: [string, string][] = [];
    saveAdminTheme("ejecutivo", {
      setItem: (key, value) => writes.push([key, value]),
    });
    expect(writes).toEqual([[ADMIN_THEME_KEY, "ejecutivo"]]);
  });

  it("no rompe el tablero si el almacenamiento del navegador está bloqueado", () => {
    const blocked = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(readAdminTheme(blocked)).toBe("cristal");
    expect(() => saveAdminTheme("mando", blocked)).not.toThrow();
  });

  it("mantiene texto, acento y límites de controles con contraste accesible", () => {
    for (const [foreground, background] of [
      ["#f8fafc", "#202b45"],
      ["#172033", "#f8fafc"],
      ["#f0fdfa", "#103440"],
      ["#ffffff", "#5b21b6"],
    ])
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    for (const [border, background] of [
      ["#94a3b8", "#202b45"],
      ["#64748b", "#ffffff"],
      ["#5eead4", "#103440"],
    ])
      expect(contrast(border, background)).toBeGreaterThanOrEqual(3);

    const css = readFileSync("apps/web/src/admin-dashboard/themes.css", "utf8");
    expect(css).toContain("--admin-text-strong: var(--admin-text)");
    expect(css).toMatch(
      /data-admin-theme="ejecutivo"[\s\S]*--admin-accent-text:\s*#fff/,
    );
  });
});

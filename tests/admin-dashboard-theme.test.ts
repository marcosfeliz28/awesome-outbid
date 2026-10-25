import { describe, expect, it } from "vitest";
import {
  ADMIN_THEME_KEY,
  adminThemeLabel,
  readAdminTheme,
  saveAdminTheme,
} from "../apps/web/src/admin-dashboard/preferences";

describe("temas del tablero administrativo", () => {
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
});

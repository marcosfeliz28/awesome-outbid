import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeUsername } from "../apps/api/src/auth";
import {
  isDifferentPassword,
  isStrongPassword,
  STRONG_PASSWORD_MESSAGE,
} from "../apps/api/src/password-policy";

describe("inicio de sesión con usuario corto", () => {
  it("ignora mayúsculas, espacios repetidos y acentos", () => {
    expect(normalizeUsername("  F   Rodríguez ")).toBe("f rodriguez");
    expect(normalizeUsername("M Félix")).toBe("m felix");
  });
});

describe("Contraseñas temporales de cajero", () => {
  it("rechaza claves numéricas cortas y exige política fuerte", () => {
    expect(isStrongPassword("1234")).toBe(false);
    expect(isStrongPassword("2804")).toBe(false);
    expect(isStrongPassword("solominusculas123!")).toBe(false);
    expect(STRONG_PASSWORD_MESSAGE).toContain("12 caracteres");
  });

  it("acepta una contraseña larga con mayúscula, minúscula, número y símbolo", () => {
    expect(isStrongPassword("Cajera-Nexora-2026!")).toBe(true);
    expect(isStrongPassword("X".repeat(73) + "1a!")).toBe(false);
  });

  it("no permite reutilizar la contraseña temporal como contraseña nueva", () => {
    expect(
      isDifferentPassword("Temporal-Nexora-2026!", "Temporal-Nexora-2026!"),
    ).toBe(false);
    expect(
      isDifferentPassword("Temporal-Nexora-2026!", "Nueva-Nexora-2026!x"),
    ).toBe(true);
    const auth = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../apps/api/src/auth.ts",
      ),
      "utf8",
    );
    expect(auth).toContain(
      "isDifferentPassword(value.currentPassword, value.newPassword)",
    );
  });

  it("obliga al cambio en login, renueva el acceso y protege rutas autenticadas", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const auth = readFileSync(resolve(root, "apps/api/src/auth.ts"), "utf8");
    const guard = readFileSync(resolve(root, "apps/api/src/common.ts"), "utf8");
    const screen = readFileSync(resolve(root, "apps/web/src/App.tsx"), "utf8");
    const migration = readFileSync(
      resolve(
        root,
        "apps/api/prisma/migrations/202610130001_password_change_required/migration.sql",
      ),
      "utf8",
    );
    expect(auth).toContain("if (user.mustChangePassword)");
    expect(auth).toContain('@Post("change-password")');
    expect(auth).toContain("mustChangePassword: false");
    expect(auth).toContain("authVersion: { increment: 1 }");
    expect(guard).toContain("!user?.active || user.mustChangePassword");
    expect(screen).toContain("/auth/change-password");
    expect(screen).toContain("Guardar contraseña y entrar");
    expect(migration).toContain(
      '"mustChangePassword" BOOLEAN NOT NULL DEFAULT false',
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthController, normalizeUsername } from "../apps/api/src/auth";
import { compare } from "../apps/api/node_modules/bcryptjs/index.js";
vi.mock("../apps/api/node_modules/bcryptjs/index.js", () => ({
  compare: vi.fn(async () => false),
  hash: vi.fn(),
}));
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

describe("E1 · credenciales sin enumeración", () => {
  const controllerFor = (user: any) => {
    const db = {
      user: { findFirst: async () => user, findUnique: async () => user },
      $queryRaw: async () => [],
      authAttempt: {
        upsert: async () => ({ failedAttempts: 0, lockedUntil: null }),
        update: async () => ({}),
      },
      $transaction: async (run: (tx: any) => unknown): Promise<unknown> =>
        run(db),
    };
    const controller = new AuthController(
      db as any,
      {} as any,
      { rememberAuthIdentity: () => undefined } as any,
    );
    (controller as any).limitPublicCredentials = () => ({
      normalized: "cuenta",
      ip: "127.0.0.1",
      unknownFlooded: false,
    });
    return controller;
  };
  it.each([null, { id: "inactivo", active: false, passwordHash: "hash-real" }])(
    "login de cuenta ausente/inactiva realiza bcrypt y responde igual",
    async (user) => {
      vi.mocked(compare).mockClear();
      await expect(
        controllerFor(user).login(
          { login: "cuenta", password: "Incorrecta!" },
          {} as any,
          {} as any,
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: "Usuario o contraseña incorrectos.",
      });
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare).toHaveBeenCalledWith(
        "Incorrecta!",
        expect.stringMatching(/^\$2[aby]\$12\$/),
      );
    },
  );
  it.each([
    null,
    {
      id: "activo",
      active: true,
      mustChangePassword: false,
      passwordHash: "hash-real",
    },
  ])(
    "change-password no revela pendiente antes de verificar contraseña",
    async (user) => {
      vi.mocked(compare).mockClear();
      await expect(
        controllerFor(user).changePassword(
          {
            login: "cuenta",
            currentPassword: "Incorrecta!",
            newPassword: "Nueva-Cuenta-2026!",
            confirmPassword: "Nueva-Cuenta-2026!",
          },
          {} as any,
          {} as any,
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: "Usuario o contraseña incorrectos.",
      });
      expect(compare).toHaveBeenCalledTimes(1);
    },
  );
  it("sólo revela que no hay cambio pendiente con la contraseña correcta", async () => {
    vi.mocked(compare).mockResolvedValueOnce(true as never);
    await expect(
      controllerFor({
        id: "activo",
        active: true,
        mustChangePassword: false,
        passwordHash: "hash-real",
      }).changePassword(
        {
          login: "cuenta",
          currentPassword: "Correcta!",
          newPassword: "Nueva-Cuenta-2026!",
          confirmPassword: "Nueva-Cuenta-2026!",
        },
        {} as any,
        {} as any,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: "No hay un cambio de contraseña pendiente para esta cuenta.",
    });
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

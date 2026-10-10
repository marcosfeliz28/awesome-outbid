// Auditoría de seguridad v2 (02-seguridad-v2): pruebas sin base de datos de
// N-05, N-06 y N-08. Las de N-01 a N-03 están en auth-lockout.test.ts, las de
// N-04 en cloud-deploy.test.ts, N-07 en drive-backup-core.test.ts y N-09 en
// drive-backup.test.ts (API real).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateSecret } from "../apps/api/src/security";
import { weakSecretReason } from "../apps/api/src/secret-strength";
import {
  TEMPORARY_PASSWORD_DAYS,
  temporaryPasswordExpired,
  temporaryPasswordExpiry,
} from "../apps/api/src/password-policy";

const read = (path: string) => readFileSync(path, "utf8");

describe("N-05 · el administrador del script y del instalador exige PIN de 6 dígitos", () => {
  it("create-admin.ts sólo acepta seis dígitos", () => {
    const source = read("apps/api/scripts/create-admin.ts");
    expect(source).toContain("pin: z.string().regex(/^\\d{6}$/)");
    expect(source).not.toMatch(/\\d\{4,6\}/);
  });
  it("el instalador no promete PIN de 4 a 6 dígitos", () => {
    for (const file of [
      "instalador/scripts/Install-FitStore.ps1",
      "instalador/scripts/Repair-FitStoreLogin.ps1",
      "instalador/reanudar-instalacion.ps1",
      "instalador/lanzar-instalacion-silenciosa.ps1",
      "instalador/installer/FitStore.nsi",
      "docs/INSTALADOR.md",
    ])
      expect(read(file), file).not.toMatch(/\\d\{4,6\}|4 a 6 d|entre 4 y 6/);
  });
});

describe("N-06 · frases y secretos sin entropía", () => {
  const weak = [
    "a".repeat(40),
    "abcabcabcabcabcabcabcabcabcabcab",
    "abcdefghijklmnopqrstuvwxyz012345",
    "9876543210987654321098765432109876",
    "contraseña-del-respaldo-de-la-tienda",
    "aaaaaaaaaaaabbbbbbbbbbbbcccccccc",
  ];
  it.each(weak)("rechaza %s", (secret) => {
    expect(weakSecretReason(secret)).toBeTruthy();
  });
  it("acepta una frase larga con variedad y un secreto aleatorio", () => {
    expect(weakSecretReason("q7Zk2mX9vB4nR8tY1wC6pL3sD0hGfJ5a")).toBeNull();
    expect(
      weakSecretReason("mango-tambora-azul-puerto-nube-siete-cafe-lluvia"),
    ).toBeNull();
  });
  it("JWT_SECRET conserva su regla de producción", () => {
    expect(() => validateSecret("a".repeat(40), true)).toThrow(/aleatorio/);
    expect(() => validateSecret("corto", false)).toThrow(/32 caracteres/);
    expect(
      validateSecret("q7Zk2mX9vB4nR8tY1wC6pL3sD0hGfJ5a", true),
    ).toBeTruthy();
    // En desarrollo no se exige entropía (solo largo).
    expect(validateSecret("a".repeat(40), false)).toBeTruthy();
  });
});

describe("N-08 · las contraseñas temporales vencen", () => {
  const now = new Date("2031-03-04T12:00:00Z");
  it("el plazo es de 7 días", () => {
    expect(TEMPORARY_PASSWORD_DAYS).toBe(7);
    expect(temporaryPasswordExpiry(now).toISOString()).toBe(
      "2031-03-11T12:00:00.000Z",
    );
  });
  it("sólo vence si hay cambio pendiente y fecha pasada", () => {
    const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);
    expect(
      temporaryPasswordExpired(
        { mustChangePassword: true, passwordExpiresAt: at(-1) },
        now,
      ),
    ).toBe(true);
    expect(
      temporaryPasswordExpired(
        { mustChangePassword: true, passwordExpiresAt: at(1) },
        now,
      ),
    ).toBe(false);
    expect(
      temporaryPasswordExpired(
        { mustChangePassword: true, passwordExpiresAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      temporaryPasswordExpired(
        { mustChangePassword: false, passwordExpiresAt: at(-1) },
        now,
      ),
    ).toBe(false);
  });
});

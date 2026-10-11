import { z } from "zod";
import { randomInt } from "node:crypto";

export const STRONG_PASSWORD_MESSAGE =
  "Usa al menos 12 caracteres e incluye mayúscula, minúscula, número y símbolo.";
export const CASHIER_PASSWORD_MESSAGE =
  "La contraseña del cajero son 6 números.";
export type PasswordPolicy = "cashier-six-digits" | "strong";

/** Role names come from the persisted Role row, never from user input. */
export function passwordPolicyForRole(roleName: string): PasswordPolicy {
  return roleName === "seller" ? "cashier-six-digits" : "strong";
}

const TRIVIAL_CASHIER_PASSWORDS = new Set([
  "000000",
  "123456",
  "234567",
  "345678",
  "456789",
  "654321",
  "765432",
  "876543",
  "987654",
  "112233",
  "121212",
  "123123",
  "010101",
  "101010",
]);

export function isNonTrivialCashierPassword(value: string) {
  if (!/^\d{6}$/.test(value) || TRIVIAL_CASHIER_PASSWORDS.has(value))
    return false;

  // Bloquea seis dígitos iguales y secuencias ascendentes/descendentes,
  // incluidos los patrones circulares como 789012 y 210987.
  const digits = [...value].map(Number);
  if (digits.every((digit) => digit === digits[0])) return false;
  const asc = digits.every((digit, index) =>
    index === 0 ? true : digit === (digits[index - 1] + 1) % 10,
  );
  const desc = digits.every((digit, index) =>
    index === 0 ? true : digit === (digits[index - 1] + 9) % 10,
  );
  if (asc || desc) return false;

  // También rechaza bloques cortos repetidos (p. ej. 121212 o 123123).
  for (const width of [1, 2, 3]) {
    if (value === value.slice(0, width).repeat(6 / width)) return false;
  }
  return true;
}

export const cashierPasswordSchema = z.string().refine(
  isNonTrivialCashierPassword,
  { message: CASHIER_PASSWORD_MESSAGE },
);

export function passwordSchemaForRole(roleName: string) {
  return passwordPolicyForRole(roleName) === "cashier-six-digits"
    ? cashierPasswordSchema
    : strongPasswordSchema;
}

export function isStrongPassword(value: string) {
  return (
    value.length >= 12 &&
    value.length <= 128 &&
    Buffer.byteLength(value, "utf8") <= 72 &&
    /\p{Lu}/u.test(value) &&
    /\p{Ll}/u.test(value) &&
    /\d/u.test(value) &&
    /[\p{P}\p{S}]/u.test(value)
  );
}

// N-08: una contraseña temporal (alta de usuario o «Restablecer contraseña»)
// vence a los 7 días; después hay que restablecerla otra vez. Sin esto una
// clave que alguien anotó o compartió valdría para siempre.
export const TEMPORARY_PASSWORD_DAYS = 7;
export const TEMPORARY_PASSWORD_EXPIRED_MESSAGE =
  "La contraseña temporal venció. Pide a la administración que use «Restablecer contraseña» en Configuración › Usuarios y permisos.";
export const temporaryPasswordExpiry = (now = new Date()) =>
  new Date(now.getTime() + TEMPORARY_PASSWORD_DAYS * 86_400_000);
export const temporaryPasswordExpired = (
  user: { mustChangePassword: boolean; passwordExpiresAt?: Date | null },
  now = new Date(),
) =>
  user.mustChangePassword &&
  !!user.passwordExpiresAt &&
  user.passwordExpiresAt.getTime() <= now.getTime();

export function isDifferentPassword(
  currentPassword: string,
  newPassword: string,
) {
  return currentPassword !== newPassword;
}

export const strongPasswordSchema = z.string().refine(isStrongPassword, {
  message: STRONG_PASSWORD_MESSAGE,
});

// Contraseña temporal que genera el sistema al restablecer una cuenta. Sin
// caracteres que se confunden al dictarla o copiarla (0/O, 1/l/I, comillas,
// espacios); siempre cumple la política y la persona la cambia al entrar.
const TEMPORARY_SETS = [
  "ABCDEFGHJKMNPQRSTUVWXYZ",
  "abcdefghijkmnpqrstuvwxyz",
  "23456789",
  "!#$%*+-=?@",
];
export function generateTemporaryPassword(length = 16) {
  const all = TEMPORARY_SETS.join("");
  const chars = [
    ...TEMPORARY_SETS.map((set) => set[randomInt(set.length)]),
    ...Array.from({ length: length - TEMPORARY_SETS.length }, () =>
      all.charAt(randomInt(all.length)),
    ),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function generateTemporaryPasswordForRole(roleName: string) {
  if (roleName !== "seller") return generateTemporaryPassword();
  let password = "";
  do {
    password = String(randomInt(1_000_000)).padStart(6, "0");
  } while (!isNonTrivialCashierPassword(password));
  return password;
}

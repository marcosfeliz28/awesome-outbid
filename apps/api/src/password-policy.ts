import { z } from "zod";
import { randomInt } from "node:crypto";

export const STRONG_PASSWORD_MESSAGE =
  "Usa al menos 12 caracteres e incluye mayúscula, minúscula, número y símbolo.";

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

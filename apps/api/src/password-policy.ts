import { z } from "zod";

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

// Keep aligned with the API policy; client validation never replaces it.
// The API's canonical role is "seller"; the other names cover translated or
// older payloads. This is UI guidance only: the API must use the DB role.
export type PasswordPolicy = "cashier-six-digits" | "strong";
export type PasswordRoleOrPolicy = string | null | undefined;
export function passwordPolicyForRole(
  role: PasswordRoleOrPolicy,
): PasswordPolicy {
  return ["seller", "cashier", "cajero"].includes(
    (role ?? "").trim().toLowerCase(),
  )
    ? "cashier-six-digits"
    : "strong";
}
export function isCashierPasswordRole(roleOrPolicy: PasswordRoleOrPolicy) {
  const value = (roleOrPolicy ?? "").trim().toLowerCase();
  return (
    value === "cashier-six-digits" ||
    ["seller", "cashier", "cajero"].includes(value)
  );
}

export function passwordRules(
  value: string,
  policy: PasswordPolicy = "strong",
) {
  if (policy === "cashier-six-digits")
    return [{ label: "6 números", met: /^\d{6}$/.test(value) }];
  return [
    { label: "12 o más caracteres", met: value.length >= 12 },
    { label: "Mayúscula (A–Z)", met: /\p{Lu}/u.test(value) },
    { label: "Minúscula (a–z)", met: /\p{Ll}/u.test(value) },
    { label: "Número (0–9)", met: /\d/u.test(value) },
    { label: "Símbolo, como ! o #", met: /[\p{P}\p{S}]/u.test(value) },
  ];
}
export function isTrivialCashierPassword(value: string) {
  if (!/^\d{6}$/.test(value)) return true;
  const digits = [...value].map(Number);
  if (digits.every((digit) => digit === digits[0])) return true;
  const ascending = digits.every(
    (digit, index) => index === 0 || digit === (digits[index - 1] + 1) % 10,
  );
  const descending = digits.every(
    (digit, index) => index === 0 || digit === (digits[index - 1] + 9) % 10,
  );
  if (ascending || descending) return true;
  if (["112233", "010101", "101010"].includes(value)) return true;
  return [1, 2, 3].some(
    (width) => value === value.slice(0, width).repeat(6 / width),
  );
}
// "required": cambio obligatorio al entrar, desde la contraseña temporal.
// "voluntary": «Cambiar mi contraseña» con la sesión abierta.
export type PasswordChangeMode = "required" | "voluntary";
const previousName = (mode: PasswordChangeMode) =>
  mode === "voluntary" ? "la actual" : "la temporal";
export function passwordChangeError(
  value: string,
  confirm: string,
  current: string,
  mode: PasswordChangeMode = "required",
  policy: PasswordPolicy = "strong",
) {
  if (policy === "cashier-six-digits") {
    if (!/^\d{6}$/.test(value))
      return "La contraseña del cajero debe tener exactamente 6 números.";
    if (isTrivialCashierPassword(value))
      return "Elige 6 números distintos de una secuencia o números repetidos.";
  } else if (!passwordRules(value, policy).every((rule) => rule.met)) {
    return "Completa las cinco reglas para crear tu contraseña.";
  }
  if (value.length > 128 || new TextEncoder().encode(value).length > 72)
    return "Tu contraseña es demasiado larga. Usa menos caracteres.";
  if (value === current)
    return `Elige una contraseña diferente de ${previousName(mode)}.`;
  if (value !== confirm)
    return "Las contraseñas no coinciden. Escríbelas iguales en ambos campos.";
  return "";
}
// Do not expose server details or validation objects to the cashier.
export function friendlyPasswordChangeError(
  error: unknown,
  mode: PasswordChangeMode = "required",
  policy: PasswordPolicy = "strong",
) {
  const message = error instanceof Error ? error.message : "";
  // Si se perdió la respuesta, el servidor pudo haber guardado ya el cambio:
  // no afirmamos que la contraseña sigue igual.
  if (/fetch|network|conexi|internet|offline/i.test(message))
    return `No pudimos confirmar el cambio. Revisa tu internet. Si tu contraseña nueva no funciona, usa ${mode === "voluntary" ? "la anterior" : "la temporal"}.`;
  if (/demasiados|intentos|429|bloquead/i.test(message))
    return mode === "voluntary"
      ? "Hubo demasiados intentos. Espera 15 minutos antes de intentar de nuevo. Tu contraseña todavía no cambió."
      : "Hubo demasiados intentos. Espera un momento antes de intentar de nuevo.";
  if (/coinciden/i.test(message))
    return "Las contraseñas no coinciden. Escríbelas iguales en ambos campos.";
  if (/distinta|diferente/i.test(message))
    return `Elige una contraseña diferente de ${previousName(mode)}.`;
  if (mode === "voluntary" && /actual no es correcta/i.test(message))
    return "La contraseña actual no es correcta. Revísala y vuelve a intentar.";
  if (
    policy === "cashier-six-digits" &&
    /6 números|6 digitos|6 dígitos|numérica/i.test(message)
  )
    return "La contraseña del cajero debe tener exactamente 6 números y no ser una secuencia ni números repetidos.";
  return policy === "cashier-six-digits"
    ? "No pudimos guardar tu contraseña. Verifica que tenga 6 números válidos y pide ayuda a gerencia si el problema continúa."
    : `No pudimos guardar tu contraseña. Revisa ${mode === "voluntary" ? "tu contraseña actual" : "la contraseña temporal"} y las cinco reglas. Si sigue ocurriendo, pide ayuda a gerencia.`;
}

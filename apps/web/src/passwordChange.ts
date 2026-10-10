// Keep aligned with the API policy; client validation never replaces it.
export function passwordRules(value: string) {
  return [
    { label: "12 o más caracteres", met: value.length >= 12 },
    { label: "Mayúscula (A–Z)", met: /\p{Lu}/u.test(value) },
    { label: "Minúscula (a–z)", met: /\p{Ll}/u.test(value) },
    { label: "Número (0–9)", met: /\d/u.test(value) },
    { label: "Símbolo, como ! o #", met: /[\p{P}\p{S}]/u.test(value) },
  ];
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
) {
  if (!passwordRules(value).every((rule) => rule.met))
    return "Completa las cinco reglas para crear tu contraseña.";
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
  return `No pudimos guardar tu contraseña. Revisa ${mode === "voluntary" ? "tu contraseña actual" : "la contraseña temporal"} y las cinco reglas. Si sigue ocurriendo, pide ayuda a gerencia.`;
}

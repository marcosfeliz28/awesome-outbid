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
export function passwordChangeError(
  value: string,
  confirm: string,
  current: string,
) {
  if (!passwordRules(value).every((rule) => rule.met))
    return "Completa las cinco reglas para crear tu contraseña.";
  if (value.length > 128 || new TextEncoder().encode(value).length > 72)
    return "Tu contraseña es demasiado larga. Usa menos caracteres.";
  if (value === current)
    return "Elige una contraseña diferente de la temporal.";
  if (value !== confirm)
    return "Las contraseñas no coinciden. Escríbelas iguales en ambos campos.";
  return "";
}
// Do not expose server details or validation objects to the cashier.
export function friendlyPasswordChangeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/fetch|network|conexi|internet|offline/i.test(message))
    return "No pudimos conectar. Revisa tu internet y vuelve a intentar. Tu contraseña todavía no cambió.";
  if (/demasiados|intentos|429|bloquead/i.test(message))
    return "Hubo demasiados intentos. Espera un momento antes de intentar de nuevo.";
  if (/coinciden/i.test(message))
    return "Las contraseñas no coinciden. Escríbelas iguales en ambos campos.";
  if (/distinta|diferente/i.test(message))
    return "Elige una contraseña diferente de la temporal.";
  return "No pudimos guardar tu contraseña. Revisa la contraseña temporal y las cinco reglas. Si sigue ocurriendo, pide ayuda a gerencia.";
}

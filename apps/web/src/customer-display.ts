/** Presentación mínima: la protección de la API se revisa por separado. */
export function customerPrivateDisplay(
  value: unknown,
  manager: boolean,
): string {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  if (manager) return text;
  const digits = text.replace(/\D/g, "");
  // Un dato corto tampoco se revela completo.
  return digits.length > 3 ? "•••" + digits.slice(-3) : "•••";
}

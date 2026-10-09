/** Presentación mínima: la protección de la API se revisa por separado. */
export function customerPrivateDisplay(
  value: unknown,
  manager: boolean,
): string {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  if (manager) return text;
  const digits = text.replace(/\D/g, "");
  // SEC-05: la API ya lo envía enmascarado («•••••••123»); sus tres dígitos
  // visibles se conservan en vez de reducirlo a «•••».
  if (text.includes("•")) return "•••" + digits.slice(-3);
  // Un dato corto tampoco se revela completo.
  return digits.length > 3 ? "•••" + digits.slice(-3) : "•••";
}

/**
 * Mismo criterio que la API (SEC-05, canViewCustomerPii en common.ts):
 * gerencia (sale:manage), quien puede borrar clientes (customers:erase) o la
 * administración (*) ven teléfono, correo y cédula/RNC completos.
 */
export const seesCustomerPii = (permissions: readonly string[]) =>
  ["*", "sale:manage", "customers:erase"].some((p) => permissions.includes(p));

/**
 * Valor inicial del formulario «Editar» para quien no ve los datos
 * completos: nunca el dato completo, aunque llegara sin enmascarar. Lo
 * enmascarado («•••123») lleva «•», así que la API (SEC-05) no lo guarda
 * encima del dato real; un campo vacío sigue vacío para poder completarlo.
 */
export function customerEditValue(value: unknown, full: boolean) {
  if (value === null || value === undefined || value === "") return value;
  if (full || String(value).includes("•")) return value;
  return customerPrivateDisplay(value, false);
}

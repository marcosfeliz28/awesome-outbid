// Utilidades puras de formato para Nexora POS (D21).
// No se enganchan todavía: Nexora 1 decide cuándo cablearlas a pantallas o
// recibos. `formatMoneyRD` produce el mismo texto que `formatMoney` de
// `packages/shared/src/index.ts`; este módulo reúne los formatos en un solo
// lugar para engancharlos después sin duplicar lógica.

/** RD$ con separador de miles y 2 decimales, p. ej. "RD$ 9,825.00". */
export function formatMoneyRD(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "RD$ 0.00";
  return (
    "RD$ " +
    n.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Fecha en dd/mm/aaaa. Acepta Date, cadena ISO o milisegundos. */
export function formatFechaDDMMAAAA(value: Date | string | number): string {
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aaaa = String(d.getFullYear());
  return `${dd}/${mm}/${aaaa}`;
}

/** Normaliza un NCF (B01…, E31…) a mayúsculas y sin espacios. */
export function formatNcf(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Teléfono RD con formato (809) 123-4567. Acepta con o sin guiones, espacios,
 * paréntesis o el prefijo de país +1. Si no es un número dominicano válido
 * (809/829/849 + 7 dígitos), devuelve el texto original recortado.
 */
export function formatTelefonoRD(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = /^1(809|829|849)\d{7}$/.test(digits)
    ? digits.slice(1)
    : /^(809|829|849)\d{7}$/.test(digits)
      ? digits
      : "";
  if (!local) return value.trim();
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/** Cédula RD con formato 001-1234567-8. */
export function formatCedula(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) return value.trim();
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

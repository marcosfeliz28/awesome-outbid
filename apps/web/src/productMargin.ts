import { margin } from "@fitstore/shared";

// COM-03: aviso del margen al escribir precio y costo. Solo informa: no
// bloquea, no cambia el precio ni el costo. Usa la fórmula única del sistema,
// (precio − costo) / precio sin restar ITBIS, y el mínimo configurado (15 % si
// no hay uno).
export const DEFAULT_LOW_MARGIN = 15;

export function marginHint(
  price: unknown,
  cost: unknown,
  threshold: unknown = DEFAULT_LOW_MARGIN,
): string {
  if (price === "" || price == null || cost === "" || cost == null) return "";
  const p = Number(price);
  const c = Number(cost);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c < 0) return "";
  const min = Number.isFinite(Number(threshold))
    ? Number(threshold)
    : DEFAULT_LOW_MARGIN;
  const value = margin(p, c);
  const text = `Margen: ${value} % (precio − costo) ÷ precio, sin restar ITBIS.`;
  return value < min
    ? `${text} Está por debajo del mínimo de ${min} %.`
    : `${text} Cumple el mínimo de ${min} %.`;
}

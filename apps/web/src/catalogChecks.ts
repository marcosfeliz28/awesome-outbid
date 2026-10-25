import { formatMoney } from "@fitstore/shared";

// Regla de la dueña: margen = (precio − costo) / precio, sin restar ITBIS;
// por debajo de 15 % se avisa (no se bloquea) y se pide confirmar.
export const MIN_MARGIN = 0.15;
export function marginWarning(price: unknown, cost: unknown): string | null {
  const p = Number(price) || 0,
    c = Number(cost) || 0;
  if (p <= 0) return "El precio de venta es 0.";
  if (p < c)
    return `El precio (${formatMoney(p)}) está por debajo del costo (${formatMoney(c)}).`;
  const margin = (p - c) / p;
  if (margin < MIN_MARGIN)
    return `El margen es ${(margin * 100).toFixed(1)} %, menor que 15 %.`;
  return null;
}
/** true si no hay aviso o la persona confirma guardar de todos modos. */
export function confirmMargin(
  price: unknown,
  cost: unknown,
  ask: (message: string) => boolean = (m) => window.confirm(m),
) {
  const warning = marginWarning(price, cost);
  return !warning || ask(warning + " ¿Guardar de todos modos?");
}

// El mismo texto que busca la caja (POS.tsx): nombre, SKU, marca y, de cada
// variante, SKU, código de barras y atributos.
export const productSearchText = (p: {
  name: string;
  sku: string;
  brand?: string;
  variants?: {
    sku: string;
    barcode: string;
    attributes?: Record<string, unknown>;
  }[];
}) =>
  [
    p.name,
    p.sku,
    p.brand ?? "",
    ...(p.variants ?? []).flatMap((v) => [
      v.sku,
      v.barcode,
      ...Object.values(v.attributes || {}).map(String),
    ]),
  ].join(" ");

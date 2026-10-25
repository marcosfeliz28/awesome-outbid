export type PurchaseDraft = {
  variantId: string;
  name: string;
  sku: string;
  sold30: number;
  store: number;
  home: number;
  transfer: number;
  buy: number;
  unitCost: number;
};

// «dias-inventario» trae las ventas netas del rango de 30 días y existencias
// separadas. Casa se muestra como traslado posible; jamás se vende desde Casa.
export function purchaseDrafts(
  rows: Record<string, unknown>[],
  variants: { id: string; sku: string; costAvg?: number | string }[],
): PurchaseDraft[] {
  const bySku = new Map(variants.map((v) => [v.sku.toLowerCase(), v]));
  return rows.flatMap((row) => {
    const sku = String(row.SKU ?? "");
    const variant = bySku.get(sku.toLowerCase());
    const sold30 = Number(row["Vendidas en el período"] ?? 0);
    const stocks = Object.entries(row)
      .filter(([key]) => key.startsWith("Existencia en "))
      .map(([, value]) => Number(value));
    const store = Math.max(0, stocks[0] ?? 0);
    const home = Math.max(0, stocks[1] ?? 0);
    if (!variant || !Number.isFinite(sold30) || sold30 <= 0 || !Number.isFinite(store) || !Number.isFinite(home)) return [];
    const need = Math.max(0, Math.ceil(sold30 - store));
    const transfer = Math.min(need, home);
    const buy = Math.max(0, need - transfer);
    if (need <= 0) return [];
    return [{ variantId: variant.id, name: String(row.Producto ?? sku), sku, sold30, store, home, transfer, buy, unitCost: Number(variant.costAvg ?? 0) }];
  });
}

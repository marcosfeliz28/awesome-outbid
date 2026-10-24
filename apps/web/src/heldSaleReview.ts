import { d } from "@fitstore/shared";

export type HeldQuoteItem = {
  variantId: string;
  qty: number | string;
  name?: string;
  savedPrice?: string | number;
  discountPercent?: number | string;
  discountAmount?: number | string;
};

// La referencia de precio viene de la API. Las ventas antiguas no la tienen:
// en ellas no se afirma falsamente que el precio no haya cambiado.
export function heldSaleReview<
  V extends { id: string; price: string },
  P extends { name: string; variants: V[] },
>(quote: { items: HeldQuoteItem[] }, products: P[]) {
  const available: {
    item: HeldQuoteItem;
    product: P;
    variant: V;
    name: string;
    priceKnown: boolean;
    priceChange: { previous: string; current: string } | null;
  }[] = [];
  const missing: string[] = [];
  for (const item of quote.items) {
    const product = products.find((p) =>
      p.variants.some((variant) => variant.id === item.variantId),
    );
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant) {
      missing.push(item.name || "un artículo");
      continue;
    }
    const saved = item.savedPrice;
    const priceKnown =
      (typeof saved === "string" || typeof saved === "number") &&
      /^\d+(?:\.\d{1,2})?$/.test(String(saved));
    available.push({
      item,
      product,
      variant,
      name: item.name || product.name,
      priceKnown,
      priceChange:
        priceKnown && !d(String(saved)).eq(d(variant.price))
          ? { previous: String(saved), current: variant.price }
          : null,
    });
  }
  return { available, missing };
}

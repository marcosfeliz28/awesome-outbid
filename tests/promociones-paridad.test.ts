// Q-03 (auditoría 07 v2): las promociones de los cinco tipos se calculan en tres
// sitios (API, caja y cola offline) y solo `percent` tenía prueba. La API se
// prueba en tests/calidad-dinero-api.test.ts con la misma tabla; aquí las dos
// copias del navegador: la caja (POS.tsx → discountFor) y la cola offline
// (pendingSales.ts → repricePendingSale) deben dar el mismo total.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { lineTotals, money } from "../packages/shared/src/index";
import { repricePendingSale } from "../apps/web/src/pendingSales";
import { PROMOTION_CASES } from "./fixtures/promociones";

// POS.tsx (y el almacén de estado de api.ts) se importan en el navegador: aquí
// sólo hace falta que existan localStorage y window al cargar el módulo.
let discountFor: typeof import("../apps/web/src/POS").discountFor;
beforeAll(async () => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  discountFor = (await import("../apps/web/src/POS")).discountFor;
});

const NOW = Date.now();
const promotion = (
  c: (typeof PROMOTION_CASES)[number],
  scope: object = {},
) => ({
  id: "promo-" + c.id,
  name: "Promoción " + c.id,
  type: c.type,
  value: c.value,
  active: true,
  startsAt: new Date(NOW - 3600_000).toISOString(),
  endsAt: new Date(NOW + 3600_000).toISOString(),
  scope: { productId: "p1", ...(c.scope ?? {}), ...scope },
});
const catalog = (price: number) => {
  const variant: any = { id: "v1", price: String(price), productId: "p1" };
  const product: any = {
    id: "p1",
    name: "Producto de prueba",
    taxRate: "0",
    categoryId: "c1",
    brand: "",
    variants: [variant],
  };
  return { variant, product };
};

describe.each(PROMOTION_CASES)("promoción $type", (c) => {
  it("la caja (POS.tsx) descuenta lo que la API cobra", () => {
    const { variant, product } = catalog(c.price);
    const off = discountFor(promotion(c), variant, product, c.qty);
    const total = lineTotals(c.qty, c.price, off, 0, true).total;
    expect(Number(money(total))).toBe(c.total);
  });

  it("la cola offline (pendingSales.ts) recalcula el mismo total", () => {
    const { product } = catalog(c.price);
    const repriced = repricePendingSale(
      {
        offlineUuid: "11111111-1111-4111-8111-111111111111",
        cashSessionId: "22222222-2222-4222-8222-222222222222",
        customerId: "33333333-3333-4333-8333-333333333333",
        items: [{ variantId: "v1", qty: c.qty, discountPercent: 0 }],
        globalDiscount: 0,
        payments: [{ method: "cash", amount: c.total }],
        expectedTotal: c.total,
      } as any,
      [product],
      [promotion(c)],
    );
    expect(repriced.total).toBe(c.total);
  });

  it("una promoción de otro producto no aplica", () => {
    const { variant, product } = catalog(c.price);
    expect(
      discountFor(promotion(c, { productId: "otro" }), variant, product, c.qty),
    ).toBe(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { heldSaleReview } from "../apps/web/src/heldSaleReview";

const product = (id: string, name: string, price: string) => ({
  id,
  name,
  variants: [{ id: `${id}-variant`, price, attributes: {} }],
});

describe("N-21 · recuperar borrador con revisión explícita", () => {
  it("el endpoint real guarda el precio del servidor, no uno inyectado por el cliente", async () => {
    const create = vi.fn(async ({ data }: any) => data);
    const db = {
      $transaction: async (fn: any) => fn(db),
      variant: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "60000000-0000-4000-8000-000000000001", price: "125.50" },
          ]),
      },
      quote: { create },
    };
    const result = await new AdminController(db as any).quote(
      {
        type: "held",
        items: [
          {
            variantId: "60000000-0000-4000-8000-000000000001",
            qty: 2,
            name: "Faja",
            savedPrice: "0.01",
          },
        ],
      },
      { id: "cajera", branchId: "main" } as any,
    );
    expect((result.items as any[])[0].savedPrice).toBe("125.50");
    expect(create).toHaveBeenCalledOnce();
  });

  it("muestra productos disponibles, faltantes y cambios de precio sin aplicar nada", () => {
    const review = heldSaleReview(
      {
        items: [
          { variantId: "a-variant", qty: 2, name: "A", savedPrice: "100.00" },
          { variantId: "b-variant", qty: 1, name: "B", savedPrice: "20.00" },
          { variantId: "c-variant", qty: 1, name: "C", savedPrice: "9.00" },
        ],
      },
      [product("a", "Faja A", "110.00"), product("b", "Faja B", "20.00")],
    );
    expect(review.available).toHaveLength(2);
    expect(review.missing).toEqual(["C"]);
    expect(review.available[0].priceChange).toEqual({
      previous: "100.00",
      current: "110.00",
    });
    expect(review.available[1].priceChange).toBeNull();
  });

  it("un borrador legado sin precio indica comparación no disponible", () => {
    const review = heldSaleReview(
      { items: [{ variantId: "a-variant", qty: 1, name: "A" }] },
      [product("a", "Faja A", "120.00")],
    );
    expect(review.available[0].priceKnown).toBe(false);
    expect(review.available[0].priceChange).toBeNull();
  });
});

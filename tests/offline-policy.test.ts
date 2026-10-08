import { describe, expect, it } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { offlineSaleAction } from "../apps/web/src/offlinePolicy";
import { normalizeLegacyOfflineDiscount } from "../apps/api/src/sales";
import {
  applyPendingSaleReprice,
  discardPendingSale,
  isPendingPriceConflict,
  repricePendingSale,
} from "../apps/web/src/pendingSales";

describe("política de ventas offline", () => {
  it("bloquea por defecto una venta iniciada sin conexión", () => {
    expect(offlineSaleAction(false, false)).toBe("block");
  });

  it.each([undefined, null, "true", 1, {}, []])(
    "no habilita con un valor legado o manipulado: %j",
    (value) => {
      expect(offlineSaleAction(value, false)).toBe("block");
      expect(offlineSaleAction(value, true)).toBe("retry");
    },
  );

  it("reintenta con el mismo UUID cuando la petición pudo llegar", () => {
    expect(offlineSaleAction(false, true)).toBe("retry");
  });

  it("sólo guarda localmente cuando el propietario lo habilitó", () => {
    expect(offlineSaleAction(true, false)).toBe("save");
    expect(offlineSaleAction(true, true)).toBe("save");
  });
});

describe("compatibilidad de descuentos offline heredados", () => {
  const input = {
    offlineUuid: "11111111-1111-4111-8111-111111111111",
    cashSessionId: "22222222-2222-4222-8222-222222222222",
    capturedAt: "2026-10-08T12:00:00.000Z",
    customerId: "33333333-3333-4333-8333-333333333333",
    items: [
      {
        variantId: "44444444-4444-4444-8444-444444444444",
        qty: 1,
        discountPercent: 10,
      },
    ],
    globalDiscount: 0,
    payments: [{ method: "cash" as const, amount: 90 }],
  };

  it("añade un motivo auditable sólo a una venta offline heredada", () => {
    const normalized = normalizeLegacyOfflineDiscount(input, true, true);
    expect(normalized.discountReason).toMatch(/offline heredada/i);
    expect(input).not.toHaveProperty("discountReason");
  });

  it("no relaja una venta nueva en línea", () => {
    expect(normalizeLegacyOfflineDiscount(input, false, true)).toBe(input);
  });

  it("no inventa motivo para una venta offline posterior al corte legado", () => {
    const current = { ...input, capturedAt: "2026-10-10T12:00:00.000Z" };
    expect(normalizeLegacyOfflineDiscount(current, true, true)).toBe(current);
  });
});

describe("resolución de precios viejos en la cola offline", () => {
  const input: any = {
    offlineUuid: "11111111-1111-4111-8111-111111111111",
    cashSessionId: "22222222-2222-4222-8222-222222222222",
    items: [
      {
        variantId: "44444444-4444-4444-8444-444444444444",
        qty: 2,
        discountPercent: 0,
      },
    ],
    globalDiscount: 0,
    expectedTotal: 200,
    payments: [{ method: "cash", amount: 200 }],
  };
  const products: any[] = [
    {
      id: "p1",
      name: "Producto actualizado",
      categoryId: "c1",
      brand: "Nexora",
      taxRate: "0",
      variants: [
        {
          id: input.items[0].variantId,
          sku: "SKU-1",
          price: "150",
        },
      ],
    },
  ];

  it("no inventa efectivo cuando el precio sube después de entregar la venta", () => {
    expect(() => repricePendingSale(input, products, [], true)).toThrow(
      /falta cobrar la diferencia/i,
    );
  });

  it("cubre un aumento sólo si ya existe una cuenta por cobrar", () => {
    const result = repricePendingSale(
      {
        ...input,
        payments: [{ method: "credit", amount: 200 }],
      } as any,
      products,
      [],
      true,
    );
    expect(result.input.offlineUuid).toBe(input.offlineUuid);
    expect(result.total).toBe(300);
    expect(result.input.payments[0].amount).toBe(300);
    expect(result.prices[0].unitPrice).toBe(150);
  });

  it("no aplica promociones por lote antes de que la API asigne FEFO", () => {
    const result = repricePendingSale(
      { ...input, expectedTotal: 200 },
      products.map((p) => ({
        ...p,
        variants: p.variants.map((v: any) => ({ ...v, price: "100" })),
      })),
      [
        {
          active: true,
          startsAt: "2020-01-01T00:00:00.000Z",
          endsAt: "2040-01-01T00:00:00.000Z",
          type: "percent",
          value: 50,
          scope: { lotId: "55555555-5555-4555-8555-555555555555" },
        },
      ],
      true,
    );
    expect(result.total).toBe(200);
  });

  it("reduce pagos editables sin producir importes negativos", () => {
    const result = repricePendingSale(
      {
        ...input,
        expectedTotal: 300,
        payments: [
          { method: "card", amount: 200, cardLast4: "1234", approvalCode: "A" },
          { method: "cash", amount: 100 },
        ],
      } as any,
      products.map((p) => ({
        ...p,
        variants: p.variants.map((v: any) => ({ ...v, price: "100" })),
      })),
      [],
      true,
    );
    expect(result.total).toBe(200);
    expect(result.input.payments[1].amount).toBe(100);
    expect(result.input.payments.every((p) => p.amount >= 0)).toBe(true);
  });

  it("distribuye una rebaja entre varios pagos editables sin tocar la tarjeta", () => {
    const result = repricePendingSale(
      {
        ...input,
        expectedTotal: 300,
        payments: [
          { method: "card", amount: 200, cardLast4: "1234", approvalCode: "A" },
          { method: "cash", amount: 50 },
          { method: "credit", amount: 50 },
        ],
      } as any,
      products.map((p) => ({
        ...p,
        variants: p.variants.map((v: any) => ({ ...v, price: "110" })),
      })),
      [],
      true,
    );
    expect(result.total).toBe(220);
    expect(result.input.payments).toEqual([
      expect.objectContaining({ method: "card", amount: 200 }),
      expect.objectContaining({ method: "cash", amount: 50 }),
      expect.objectContaining({ method: "credit", amount: 20 }),
    ]);
  });

  it("exige descartar o cobrar otra vez si los pagos editables no cubren la rebaja", () => {
    expect(() =>
      repricePendingSale(
        {
          ...input,
          expectedTotal: 300,
          payments: [
            {
              method: "card",
              amount: 290,
              cardLast4: "1234",
              approvalCode: "A",
            },
            { method: "cash", amount: 10 },
          ],
        } as any,
        products.map((p) => ({
          ...p,
          variants: p.variants.map((v: any) => ({ ...v, price: "100" })),
        })),
        [],
        true,
      ),
    ).toThrow(/descartarla y cobrarla nuevamente/i);
  });

  it("detecta sólo el conflicto que admite reprecificación", () => {
    expect(
      isPendingPriceConflict(
        "Los precios o promociones cambiaron. Revisa el total antes de cobrar.",
      ),
    ).toBe(true);
    expect(isPendingPriceConflict("No hay suficiente stock.")).toBe(false);
  });

  it("audita antes de reemplazar input y recibo, conservando offlineUuid", async () => {
    const order: string[] = [];
    let audit: any;
    let update: any;
    const creditInput = {
      ...input,
      payments: [{ method: "credit", amount: 200 }],
    } as any;
    const sale: any = {
      id: input.offlineUuid,
      input: creditInput,
      receipt: { number: "LOCAL-11111111", total: 200, snapshot: [] },
      status: "conflict",
      message: "Los precios o promociones cambiaron.",
    };
    await applyPendingSaleReprice(sale, products, [], true, {
      recordResolution: async (body) => {
        order.push("audit");
        audit = body;
      },
      updateLocal: async (_id, changes) => {
        order.push("update");
        update = changes;
      },
    });
    expect(order).toEqual(["audit", "update"]);
    expect(audit).toMatchObject({
      offlineUuid: input.offlineUuid,
      action: "reprice",
      previousTotal: 200,
      currentTotal: 300,
    });
    expect(update.input.offlineUuid).toBe(input.offlineUuid);
    expect(update.input.expectedTotal).toBe(300);
    expect(update.receipt).toMatchObject({ total: 300, taxTotal: 0 });
    expect(update.receipt.snapshot[0].unitPrice).toBe(150);
    expect(update.status).toBe("pending");
  });

  it("al descartar registra motivo antes de borrar IndexedDB", async () => {
    const order: string[] = [];
    const sale: any = {
      id: input.offlineUuid,
      input,
      receipt: { total: 200 },
      status: "conflict",
    };
    await discardPendingSale(sale, "Cliente canceló la operación", {
      recordResolution: async (body) => {
        order.push("audit:" + body.action + ":" + body.reason);
      },
      deleteLocal: async () => {
        order.push("delete");
      },
    });
    expect(order).toEqual([
      "audit:discard:Cliente canceló la operación",
      "delete",
    ]);
  });
});

describe("compatibilidad de ajustes offline", () => {
  const base = {
    name: "Nexora POS",
    legalId: "",
    address: "",
    phone: "",
    currency: "DOP" as const,
    taxIncluded: true,
    sellerDiscountLimit: 10,
    cardFeePercent: 2.5,
    returnDays: 30,
    idleDays: 60,
    expiryDays: 60,
    lowMargin: 15,
    cashDifferenceLimit: 100,
    receiptWidth: "80" as const,
    sessionTimeoutMinutes: 30,
  };
  const actor = {
    id: "owner",
    branchId: "main",
    terminalId: "terminal",
    permissions: ["*"],
  } as any;

  function controller(initial: Record<string, unknown>) {
    let stored = initial;
    const tx = {
      settings: {
        findUnique: async () => ({ data: stored }),
        upsert: async ({ update }: any) => {
          stored = update.data;
          return { data: stored };
        },
      },
      auditLog: { create: async () => ({}) },
    };
    const db = {
      settings: {
        findUniqueOrThrow: async () => ({ data: stored }),
      },
      $transaction: async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
    };
    return {
      api: new AdminController(db as any),
      stored: () => stored,
    };
  }

  it("una PWA anterior no cambia la decisión al omitir la clave nueva", async () => {
    const fixture = controller({ ...base, allowOfflineSales: true });
    const { allowOfflineSales: omitted, ...legacyBody } = fixture.stored();
    void omitted;
    await fixture.api.setSettings(legacyBody, actor);
    expect(fixture.stored().allowOfflineSales).toBe(true);

    await fixture.api.setSettings(
      { ...fixture.stored(), allowOfflineSales: false },
      actor,
    );
    expect(fixture.stored().allowOfflineSales).toBe(false);
  });

  it("una instalación anterior recibe false como valor efectivo", async () => {
    const fixture = controller({ ...base });
    expect((await fixture.api.settings(actor)).allowOfflineSales).toBe(false);
  });
});

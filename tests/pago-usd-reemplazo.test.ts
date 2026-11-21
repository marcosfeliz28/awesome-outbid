import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  largeForeignMessage,
  largeForeignPayment,
  saleSchema,
} from "../packages/shared/src/index";
import { AuthGuard } from "../apps/api/src/common";
import {
  largeForeignGuardEnabled,
  normalizeReplacementPayments,
  replacementPayment,
  SalesController,
} from "../apps/api/src/sales";
import {
  isLargeForeignConfirmationError,
  largeForeignRetryInput,
} from "../apps/web/src/largeForeignConfirmation";
import {
  cashSessionComparisons,
  serializePaymentReplacement,
} from "../apps/web/src/salePaymentReplacement";

// Caso FS-0000730 (19-nov, caja de Wendy): se tecleó US$ 2,360 en vez de
// US$ 40 en una venta de RD$ 3,500 y la tarjeta de RD$ 1,140 no quedó.
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("reflect-metadata");
const { Reflector } = requireApi("@nestjs/core");

const RATE = 60.457;
// En POST /sales, `amount` de un pago en US$ es su equivalente en pesos.
const usd = (amountUsd: number) => ({
  method: "cash",
  currency: "USD",
  amountUsd,
  usdRate: RATE,
  amount: Math.round(amountUsd * RATE * 100) / 100,
});
const p = (x: unknown) => replacementPayment.parse(x);

describe("tope preventivo del cobro en dólares", () => {
  it("la caja reconoce solo el 409 específico y conserva el intento al confirmar", () => {
    expect(
      isLargeForeignConfirmationError({
        status: 409,
        message:
          "Revisa el monto en dólares: US$ 2,360.00 a RD$ 60.457 son RD$ 142,678.52.",
      }),
    ).toBe(true);
    expect(
      isLargeForeignConfirmationError({ status: 409, message: "La venta cambió." }),
    ).toBe(false);
    expect(
      isLargeForeignConfirmationError({
        status: 400,
        message: "Revisa el monto en dólares: confirma.",
      }),
    ).toBe(false);

    const original = {
      offlineUuid: "4a3d66ce-8801-4f4d-9de1-138a939d9015",
      payments: [{ method: "cash", amount: 1000, currency: "USD" }],
    };
    expect(largeForeignRetryInput(original, "246813")).toEqual({
      ...original,
      confirmLargeForeign: true,
      managerPin: "246813",
    });
    expect(largeForeignRetryInput(original, "")).toEqual({
      ...original,
      confirmLargeForeign: true,
    });
    expect(original).not.toHaveProperty("confirmLargeForeign");
  });
  it("US$ 2,360 sobre RD$ 3,500 pide confirmación con un mensaje claro", () => {
    const hit = largeForeignPayment(3500, [usd(2360)]);
    expect(hit).toEqual({
      amountUsd: 2360,
      usdRate: RATE,
      amount: 142678.52,
      total: 3500,
      change: 139178.52,
    });
    const text = largeForeignMessage(hit!, true);
    expect(text).toMatch(/^Revisa el monto en dólares: US\$ 2,360\.00/);
    expect(text).toContain("RD$ 142,678.52");
    expect(text).toContain("RD$ 139,178.52");
    expect(text).toContain("PIN de un gerente");
    expect(largeForeignMessage(hit!, false)).not.toContain("PIN");
  });
  it("US$ 40 + tarjeta RD$ 1,140 pasa", () => {
    expect(
      largeForeignPayment(3500, [
        usd(40),
        { method: "card", amount: 1140 } as any,
      ]),
    ).toBeNull();
  });
  it("un billete de US$ 20 por una venta pequeña no se frena (vuelto < RD$ 5,000)", () => {
    expect(largeForeignPayment(300, [usd(20)])).toBeNull();
  });
  it("suma todos los pagos en US$: dos de US$ 150 sobre RD$ 3,500 se frenan", () => {
    const hit = largeForeignPayment(3500, [usd(150), usd(150)]);
    expect(hit).toMatchObject({ amountUsd: 300, amount: 18137.1 });
    expect(largeForeignPayment(3500, [usd(150)])).toBeNull();
  });
  it("el ajuste LARGE_FOREIGN_GUARD está apagado salvo «on»", () => {
    const before = process.env.LARGE_FOREIGN_GUARD;
    delete process.env.LARGE_FOREIGN_GUARD;
    expect(largeForeignGuardEnabled()).toBe(false);
    process.env.LARGE_FOREIGN_GUARD = "1";
    expect(largeForeignGuardEnabled()).toBe(false);
    process.env.LARGE_FOREIGN_GUARD = "on";
    expect(largeForeignGuardEnabled()).toBe(true);
    if (before === undefined) delete process.env.LARGE_FOREIGN_GUARD;
    else process.env.LARGE_FOREIGN_GUARD = before;
  });
  it("mucho efectivo en pesos no es un pago en dólares", () => {
    expect(
      largeForeignPayment(3500, [{ method: "cash", amount: 150000 }]),
    ).toBeNull();
  });
  it("saleSchema conserva confirmLargeForeign (opcional, sin valor por defecto)", () => {
    const base = {
      offlineUuid: "8f2b1c1e-5c1a-4a43-9d37-3a5b0c1d2e3f",
      cashSessionId: "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c",
      items: [{ variantId: "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1d", qty: 1 }],
      payments: [{ method: "cash", amount: 100 }],
    };
    expect(saleSchema.parse(base)).not.toHaveProperty("confirmLargeForeign");
    expect(
      saleSchema.parse({ ...base, confirmLargeForeign: true })
        .confirmLargeForeign,
    ).toBe(true);
  });
});

describe("normalizeReplacementPayments", () => {
  const fs730 = () => [
    p({
      method: "cash",
      currency: "USD",
      amountUsd: 40,
      usdRate: RATE,
      amount: 2360,
    }),
    p({ method: "card", amount: 1140, approvalCode: "406574" }),
  ];
  it("caso FS-0000730: US$ 40 (RD$ 2,418.28, aplica 2,360, vuelto 58.28) + tarjeta 1,140", () => {
    const rows = normalizeReplacementPayments(3500, fs730(), [RATE]);
    expect(rows[0]).toMatchObject({
      tendered: 2418.28,
      amount: 2360,
      change: 58.28,
      usdRate: RATE,
    });
    expect(rows[1]).toMatchObject({ tendered: 1140, change: 0 });
  });
  it("USD sin tasa", () => {
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [p({ method: "cash", currency: "USD", amountUsd: 58, amount: 3500 })],
        [RATE],
      ),
    ).toThrow(/tasa/);
  });
  it("tasa inventada", () => {
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [
          p({
            method: "cash",
            currency: "USD",
            amountUsd: 60,
            usdRate: 70,
            amount: 3500,
          }),
        ],
        [RATE],
      ),
    ).toThrow(/no es la de la venta/);
  });
  it("suma incorrecta", () => {
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [p({ method: "card", amount: 1140, approvalCode: "1" })],
        [],
      ),
    ).toThrow(/deben coincidir/);
  });
  it("tendered o vuelto incoherentes", () => {
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [
          p({
            method: "cash",
            currency: "USD",
            amountUsd: 40,
            usdRate: RATE,
            tendered: 2400,
            amount: 2360,
          }),
          p({ method: "card", amount: 1140, approvalCode: "1" }),
        ],
        [RATE],
      ),
    ).toThrow(/son RD\$ 2,418.28/);
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [p({ method: "card", amount: 3500, change: 10, approvalCode: "1" })],
        [],
      ),
    ).toThrow(/no dan vuelto/);
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [p({ method: "cash", amount: 3500, tendered: 3000 })],
        [],
      ),
    ).toThrow(/menor que lo aplicado/);
  });
  it("tarjeta sin aprobación ni referencia; dólares que no son efectivo", () => {
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [p({ method: "card", amount: 3500 })],
        [],
      ),
    ).toThrow(/aprobación/);
    expect(() =>
      normalizeReplacementPayments(
        3500,
        [
          p({
            method: "card",
            currency: "USD",
            amountUsd: 58,
            usdRate: RATE,
            amount: 3500,
          }),
        ],
        [RATE],
      ),
    ).toThrow(/sólo puede ser en efectivo/);
  });
});

describe("POST /sales/:id/payments/replace · permisos", () => {
  const handler = SalesController.prototype.replacePayments;
  it("declara @Permit('*') y @RequireTerminal", () => {
    expect(Reflect.getMetadata("permission", handler)).toBe("*");
    expect(Reflect.getMetadata("terminal", handler)).toBe(true);
  });
  it("una cajera recibe 403", async () => {
    const user = {
      id: "8f2b1c1e-5c1a-4a43-9d37-3a5b0c1d2e3f",
      active: true,
      mustChangePassword: false,
      authVersion: 1,
      branchId: "main",
      name: "Cajera",
      email: "cajera@example.test",
      role: { name: "seller", permissions: ["sale:write", "cash:write"] },
    };
    const db: any = {
      user: { findUnique: async () => user },
      settings: { findUnique: async () => null },
      authSession: {
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => ({
          id: "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c",
          userId: user.id,
          terminalId: null,
          lastActivityAt: new Date(),
        }),
      },
    };
    const guard = new AuthGuard(
      db,
      {
        verify: () => ({
          sub: user.id,
          type: "access",
          version: 1,
          sid: "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c",
        }),
      } as any,
      new Reflector(),
    );
    const req: any = { headers: { authorization: "Bearer x" } };
    const ctx: any = {
      getHandler: () => handler,
      getClass: () => SalesController,
      switchToHttp: () => ({ getRequest: () => req }),
    };
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("interfaz administrativa para reemplazar pagos", () => {
  const operationId = "8f2b1c1e-5c1a-4a43-9d37-3a5b0c1d2e3f";

  it("serializa los valores capturados sin calcular montos ni cambiar operationId", () => {
    const draft = {
      operationId,
      reason: "  Corregir combinación registrada  ",
      ownerConfirmed: true,
      payments: [
        {
          method: "cash" as const,
          amount: "2360.00",
          currency: "USD" as const,
          amountUsd: "40",
          usdRate: "60.457",
          cashSessionId: "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c",
        },
        {
          method: "card" as const,
          amount: "1140",
          currency: "DOP" as const,
          approvalCode: "  APR-406574  ",
          reference: " REF-1 ",
          cardLast4: "4242",
          cardBrand: "Visa",
          cardType: "credit" as const,
        },
        {
          method: "transfer" as const,
          amount: "500",
          currency: "DOP" as const,
          bank: "  Banco Demo  ",
          reference: " TX-9 ",
        },
      ],
    };

    expect(serializePaymentReplacement(draft)).toEqual({
      operationId,
      reason: "Corregir combinación registrada",
      ownerConfirmed: true,
      allowTransfer: true,
      payments: [
        {
          method: "cash",
          amount: 2360,
          currency: "USD",
          amountUsd: 40,
          usdRate: 60.457,
          cashSessionId: "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c",
        },
        {
          method: "card",
          amount: 1140,
          currency: "DOP",
          approvalCode: "APR-406574",
          reference: "REF-1",
          cardLast4: "4242",
          cardBrand: "Visa",
          cardType: "credit",
        },
        {
          method: "transfer",
          amount: 500,
          currency: "DOP",
          bank: "Banco Demo",
          reference: "TX-9",
        },
      ],
    });
    expect(draft.operationId).toBe(operationId);
    expect(draft.payments[0]).not.toHaveProperty("tendered");
    expect(draft.payments[0]).not.toHaveProperty("change");
  });

  it("presenta cajas cerradas y abiertas como comparación antes/después", () => {
    const comparisons = cashSessionComparisons(
      {
        cashSessions: [
          {
            id: "closed-1",
            before: {
              expectedCash: 1000,
              countedCash: 900,
              differenceCash: -100,
              expectedUsd: 40,
            },
            after: {
              expectedCash: 1200,
              countedCash: 900,
              differenceCash: -300,
              expectedUsd: 20,
            },
          },
        ],
        openCashSessions: [
          {
            id: "open-1",
            expectedCashBefore: 500,
            expectedCash: 700,
          },
        ],
      },
      false,
    );

    expect(comparisons).toHaveLength(2);
    expect(comparisons[0]).toMatchObject({
      id: "closed-1",
      kindLabel: "Caja cerrada",
    });
    expect(comparisons[0].rows).toEqual(
      expect.arrayContaining([
        {
          key: "expectedCash",
          label: "Efectivo esperado",
          before: 1000,
          after: 1200,
          currency: "DOP",
        },
        {
          key: "expectedUsd",
          label: "US$ esperado",
          before: 40,
          after: 20,
          currency: "USD",
        },
      ]),
    );
    expect(comparisons[1]).toEqual({
      id: "open-1",
      kindLabel: "Caja abierta",
      rows: [
        {
          key: "expectedCash",
          label: "Efectivo esperado",
          before: 500,
          after: 700,
          currency: "DOP",
        },
      ],
    });
    expect(cashSessionComparisons({ cashSessions: [] }, true)).toEqual([]);
  });
});

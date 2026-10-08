import { describe, expect, it } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { offlineSaleAction } from "../apps/web/src/offlinePolicy";

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

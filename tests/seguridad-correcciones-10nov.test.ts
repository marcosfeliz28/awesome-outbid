import { describe, expect, it } from "vitest";
import { editableSale, safe, type Actor } from "../apps/api/src/common";

const actor = (over: Partial<Actor> = {}): Actor => ({
  id: "u1",
  name: "Cajera",
  email: "c@x.test",
  role: "cashier",
  permissions: ["sale:create"],
  branchId: "main",
  ...over,
});

describe("safe(): SupplierPayment.amount", () => {
  const pago = { id: "p1", supplierId: "s1", amount: "500.00", method: "cash" };
  it("oculta amount sin profit:read", () => {
    expect(safe(pago, actor())).not.toHaveProperty("amount");
  });
  it("lo muestra con profit:read", () => {
    const a = actor({ permissions: ["profit:read"] });
    expect(safe(pago, a)).toHaveProperty("amount", "500.00");
  });
  it("sigue mostrando el amount de un pago de venta", () => {
    const venta = { id: "x", saleId: "v1", amount: "100.00", method: "cash" };
    expect(safe(venta, actor())).toHaveProperty("amount", "100.00");
  });
});

describe("editableSale(): bloqueo por sucursal", () => {
  it("el FOR UPDATE filtra por branchId del actor", async () => {
    let sql = "";
    let values: unknown[] = [];
    const tx = {
      $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) => {
        sql = s.join("?");
        values = v;
      },
      sale: { findFirst: async () => null },
    };
    await expect(
      editableSale(tx, "id-venta", actor({ branchId: "otra" })),
    ).rejects.toThrow();
    expect(sql).toMatch(/"branchId"\s*=\s*\?/);
    expect(values).toContain("otra");
  });
});

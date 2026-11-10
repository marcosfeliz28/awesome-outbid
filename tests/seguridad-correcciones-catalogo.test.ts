import { describe, expect, it, vi } from "vitest";
import { CatalogController } from "../apps/api/src/catalog";

const actor: any = { id: "u", branchId: "sucursal2", permissions: [] };

describe("categorías y marcas filtran por sucursal del actor", () => {
  it("GET /categories y GET /brands usan where.branchId", async () => {
    const db: any = {
      category: { findMany: vi.fn().mockResolvedValue([]) },
      brand: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const c = new CatalogController(db);
    await c.categories(actor);
    await c.brands(actor);
    expect(db.category.findMany.mock.calls[0][0].where).toEqual({
      branchId: "sucursal2",
    });
    expect(db.brand.findMany.mock.calls[0][0].where).toEqual({
      branchId: "sucursal2",
    });
  });
  it("POST /brands guarda la sucursal del actor", async () => {
    const db: any = { brand: { create: vi.fn().mockResolvedValue({}) } };
    await new CatalogController(db).brand({ name: "Marca X" }, actor);
    expect(db.brand.create.mock.calls[0][0].data).toEqual({
      name: "Marca X",
      branchId: "sucursal2",
    });
  });
});

import { AdminController } from "../apps/api/src/admin";

describe("GET /settings: lista blanca para quien no tiene sale:manage", () => {
  const data = {
    name: "Tienda",
    transferAccounts: ["Banco 123"],
    cardTerminals: ["Verifon 1"],
    sellerDiscountLimit: 10,
    secretoInterno: "no-para-la-caja",
    cashDifferenceLimit: 500,
    cardFeePercent: 3,
  };
  const call = (permissions: string[]) => {
    const db: any = {
      settings: { findUniqueOrThrow: vi.fn().mockResolvedValue({ data }) },
    };
    const ctrl = new (AdminController as any)(db);
    return ctrl.settings({
      ...actor,
      role: "seller",
      permissions,
      branchId: "main",
    });
  };
  it("la cajera conserva lo del POS y pierde el resto", async () => {
    const out = await call(["catalog:read", "sale:write"]);
    expect(out.transferAccounts).toEqual(["Banco 123"]);
    expect(out.cardTerminals).toEqual(["Verifon 1"]);
    expect(out.sellerDiscountLimit).toBe(10);
    expect(out).not.toHaveProperty("secretoInterno");
    expect(out).not.toHaveProperty("cashDifferenceLimit");
    expect(out).not.toHaveProperty("cardFeePercent");
    expect(out).not.toHaveProperty("cashMovementApprovalLimit");
  });
  it("con sale:manage ve todo", async () => {
    const out = await call(["catalog:read", "sale:manage"]);
    expect(out.secretoInterno).toBe("no-para-la-caja");
    expect(out.cashDifferenceLimit).toBe(500);
  });
});

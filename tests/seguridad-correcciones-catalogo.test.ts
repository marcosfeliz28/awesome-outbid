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

import { describe, expect, it, vi } from "vitest";
import ExcelJS from "../apps/api/node_modules/exceljs/excel.js";
import { CatalogController } from "../apps/api/src/catalog";
import { AuthGuard } from "../apps/api/src/common";
import { Reflector } from "../apps/api/node_modules/@nestjs/core/index.js";

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "QA",
  email: "qa@example.invalid",
  branchId: "main",
  role: "manager",
  permissions: ["catalog:write"],
};
const categoryId = "20000000-0000-4000-8000-000000000001";
async function excel() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Productos");
  sheet.addRow(["Nombre", "SKU", "Categoría", "Barras", "Precio", "Costo"]);
  sheet.addRow(["Producto QA", "SKU-QA", categoryId, "BAR-QA", 100, 50]);
  return { buffer: Buffer.from(await book.xlsx.writeBuffer()) };
}
function fixture(allowed: boolean) {
  const tx = {
    category: {
      findMany: vi.fn(async () => (allowed ? [{ id: categoryId }] : [])),
    },
    $queryRaw: vi.fn(async () => []),
    product: { create: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  const controller = new CatalogController({
    $transaction: async (run: any) => run(tx),
  } as any);
  return { controller, tx };
}
describe("Menor-categoria · importación acotada a sucursal", () => {
  it("categoría ajena o inexistente responde400 sin escrituras", async () => {
    const { controller, tx } = fixture(false);
    await expect(controller.import(await excel(), actor)).rejects.toMatchObject(
      { status: 400 },
    );
    expect(tx.product.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("la categoría válida se busca en la sucursal y permite la carga", async () => {
    const { controller, tx } = fixture(true);
    expect(await controller.import(await excel(), actor)).toEqual({
      imported: 1,
    });
    expect(tx.category.findMany).toHaveBeenCalledWith({
      where: { id: { in: [categoryId] }, branchId: actor.branchId },
      select: { id: true },
    });
    expect(tx.product.create).toHaveBeenCalledOnce();
  });
  it.each([true, false])("catalog:write presente=%s", async (permitted) => {
    const user = {
      ...actor,
      active: true,
      mustChangePassword: false,
      authVersion: 1,
      role: { name: "qa", permissions: permitted ? ["catalog:write"] : [] },
    };
    const db = {
      user: { findUnique: async () => user },
      settings: { findUnique: async () => null },
      authSession: {
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => ({}),
      },
    };
    const guard = new AuthGuard(
      db as any,
      {
        verify: () => ({
          sub: actor.id,
          type: "access",
          version: 1,
          sid: "qa-session",
        }),
      } as any,
      new Reflector(),
    );
    const request = { headers: { authorization: "Bearer local-fixture" } };
    const context = {
      getHandler: () => CatalogController.prototype.import,
      getClass: () => CatalogController,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    if (permitted) expect(await guard.canActivate(context as any)).toBe(true);
    else
      await expect(guard.canActivate(context as any)).rejects.toMatchObject({
        status: 403,
      });
  });
});

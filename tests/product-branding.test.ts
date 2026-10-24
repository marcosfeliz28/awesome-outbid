import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  businessSidebarLabels,
  productLoginFaces,
  warehouseLabel,
} from "../apps/web/src/product-branding";
import { WarehousesController } from "../apps/api/src/warehouses";
import { inventario } from "../apps/api/src/reportes/inventario";

describe("PC-10 marca y almacenes por empresa", () => {
  it("no conserva marcas de la tienda en componentes compartidos de pantallas, tickets y reportes", () => {
    for (const path of [
      "apps/web/src/product-branding.ts",
      "apps/web/src/Management.tsx",
      "apps/web/src/Prints.tsx",
      "apps/web/src/WarehousesPanel.tsx",
      "apps/api/src/receipt-pdf.ts",
      "apps/api/src/formal-report.ts",
    ]) {
      const userFacingSource = readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => !line.includes("@fitstore/"))
        .join("\n");
      expect(userFacingSource, path).not.toMatch(/Macgen|GV Makeup|FitStore/i);
    }
  });

  it("la entrada de producto no anuncia categorías ni marcas de la tienda", () => {
    expect(productLoginFaces).toHaveLength(6);
    expect(JSON.stringify(productLoginFaces)).not.toMatch(
      /Macgen|GV Makeup|FitStore|Fajas|Suplementos/i,
    );
  });

  it("usa el nombre persistido de cada almacén y un fallback neutro", () => {
    expect(warehouseLabel({ name: "Depósito Norte", kind: "home" })).toBe(
      "Depósito Norte",
    );
    expect(warehouseLabel({ name: " Mostrador Centro ", kind: "store" })).toBe(
      "Mostrador Centro",
    );
    expect(warehouseLabel({ name: "", kind: "home" })).toBe("Almacén");
  });

  it("los reportes de inventario usan los nombres reales de ambos almacenes", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { kind: "store", name: "Mostrador Centro" },
      { kind: "home", name: "Depósito Norte" },
    ]);
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          sku: "A-1",
          name: "Artículo",
          category: "General",
          store: 2,
          home: 5,
          min: 4,
        },
      ]),
      warehouse: { findMany },
    };
    const rows = await inventario["bajo-minimo"].run(
      db,
      { branchId: "main" } as never,
      { gte: new Date(), lte: new Date() },
      {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]["Existencia en Mostrador Centro"]).toBe(2);
    expect(rows[0]["Existencia en Depósito Norte"]).toBe(5);
    expect(rows[0]).not.toHaveProperty("Tienda");
    expect(rows[0]).not.toHaveProperty("Casa");
    expect(inventario.traspasos.title).toBe("Traspasos entre almacenes");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: "main" }) }),
    );
  });

  it("un almacén llamado SKU no sobrescribe el SKU del reporte", async () => {
    const rows = await inventario["bajo-minimo"].run(
      {
        $queryRaw: async () => [{ sku: "A-1", name: "Artículo", category: "General", store: 2, home: 5, min: 4 }],
        warehouse: { findMany: async () => [{ kind: "store", name: "SKU" }, { kind: "home", name: "Mínimo" }] },
      },
      { branchId: "main" } as never,
      { gte: new Date(), lte: new Date() },
      {},
    );
    expect(rows[0]).toMatchObject({ SKU: "A-1", Mínimo: 4, "Existencia en SKU": 2, "Existencia en Mínimo": 5 });
  });

  it("la barra lateral usa la empresa y sucursal de Ajustes", () => {
    expect(businessSidebarLabels({ name: "Empresa A", branchName: "Centro" })).toEqual({
      branch: "Centro", business: "Empresa A",
    });
    expect(businessSidebarLabels()).toEqual({ branch: "Sucursal", business: "Nexora POS" });
  });

  it("renombra solamente un almacén activo de la sucursal y audita el cambio", async () => {
    expect(
      Reflect.getMetadata(
        "permission",
        WarehousesController.prototype.renameWarehouse,
      ),
    ).toBe("*");
    const before = {
      id: "10000000-0000-4000-8000-000000000101",
      name: "Casa",
      branchId: "main",
    };
    const findFirst = vi.fn().mockResolvedValue(before);
    const update = vi
      .fn()
      .mockResolvedValue({ ...before, name: "Depósito Norte" });
    const create = vi.fn().mockResolvedValue({ id: "audit" });
    const db = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          warehouse: { findFirst, update },
          auditLog: { create },
        }),
    };
    const controller = new WarehousesController(db as never);
    const actor = { id: "admin", branchId: "main" } as never;
    const result = await controller.renameWarehouse(
      before.id,
      { name: " Depósito Norte " },
      actor,
    );
    expect(result.name).toBe("Depósito Norte");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: before.id, branchId: "main", active: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: before.id, branchId: "main", active: true },
      data: { name: "Depósito Norte" },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "warehouse_renamed" }),
      }),
    );
  });

  it("rechaza un almacén que no pertenece a la sucursal", async () => {
    const update = vi.fn();
    const controller = new WarehousesController({
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          warehouse: {
            findFirst: vi.fn().mockResolvedValue(null),
            update,
          },
        }),
    } as never);
    await expect(
      controller.renameWarehouse(
        "10000000-0000-4000-8000-000000000101",
        { name: "Ajeno" },
        { id: "admin", branchId: "main" } as never,
      ),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("el reporte de empresa en modo producto toma el nombre de Ajustes", async () => {
    vi.stubEnv("PRODUCT_TENANCY", "required");
    vi.resetModules();
    try {
      const { margen } = await import("../apps/api/src/reportes/margen");
      let keySql = "";
      const db = {
        $queryRaw: async (
          _strings: TemplateStringsArray,
          key: { strings: string[] },
        ) => {
          keySql = key.strings.join("");
          return [{ k: "Empresa A", units: 1, venta: 100, costo: 50 }];
        },
      };
      const rows = await margen["margen-por-empresa"].run(
        db,
        {
          branchId: "main",
        } as never,
        { gte: new Date(), lte: new Date() },
        {},
      );
      expect(rows[0].Empresa).toBe("Empresa A");
      expect(keySql).toContain("Settings");
      expect(keySql).toContain("st.data->>'name'");
      expect(keySql).not.toMatch(/MacGen|GV Makeup/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

// Auditoría 19-nov-2026, inventario y clientes: pruebas unitarias con base
// falsa (mismo método que auditoria-lote-a).
import { describe, expect, it } from "vitest";

const VARIANT = "11111111-1111-4111-8111-111111111111";
const VARIANT_B = "33333333-3333-4333-8333-333333333333";
const HOME = "44444444-4444-4444-8444-444444444444";
const SUPPLIER = "55555555-5555-4555-8555-555555555555";
const manager = {
  id: "u1",
  name: "Gerente",
  branchId: "main",
  permissions: ["*"],
  terminalId: "t1",
} as any;
const warehouseUser = {
  id: "u2",
  name: "Almacén",
  branchId: "main",
  permissions: ["inventory:write", "catalog:read"],
  terminalId: "t1",
} as any;

// dinero-11: una devolución a proveedor hecha desde Casa (almacén no vendible)
// valida el proveedor y deja la alerta, igual que desde la Tienda.
function fakeHomeDb(supplierExists: boolean) {
  const calls: string[] = [];
  const alerts: any[] = [];
  const tx: any = {
    $queryRaw: async () => [],
    warehouse: {
      findFirst: async () => ({ id: HOME, name: "Casa", sellable: false }),
    },
    variant: {
      findFirstOrThrow: async () => ({
        id: VARIANT,
        stock: 0,
        costAvg: 100,
        product: { category: { requiresLot: false, requiresExpiry: false } },
        lots: [],
      }),
    },
    settings: { findUnique: async () => null },
    variantStock: {
      findMany: async () => [],
      findUnique: async () => ({ qty: 5 }),
      upsert: async () => calls.push("stock"),
    },
    lotStock: { aggregate: async () => ({ _sum: { qty: 0 } }) },
    inventoryMovement: { create: async () => calls.push("movement") },
    auditLog: { create: async () => ({}) },
    supplier: {
      findFirst: async () => ({ name: "Proveedor X" }),
      findFirstOrThrow: async () => {
        calls.push("supplier");
        if (!supplierExists) throw new Error("Proveedor no encontrado");
        return { id: SUPPLIER };
      },
    },
    alert: { upsert: async (args: any) => alerts.push(args) },
  };
  const db: any = { $transaction: async (fn: any) => fn(tx) };
  return { db, calls, alerts };
}
const homeReturn = {
  variantId: VARIANT,
  warehouseId: HOME,
  qty: -2,
  reason: "Devuelto al proveedor",
  type: "supplier_return",
  supplierId: SUPPLIER,
  reference: "NC-1",
};

describe("dinero-11 · devolución a proveedor desde Casa", () => {
  it("deja la alerta de crédito pendiente con el costo", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db, alerts } = fakeHomeDb(true);
    await new InventoryController(db).adjustment(homeReturn, manager);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].create.type).toBe("supplier_return");
    expect(alerts[0].create.message).toContain("RD$ 200");
    expect(alerts[0].create.message).toContain("NC-1");
  });
  it("rechaza un proveedor de otra sucursal sin mover existencias", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db, calls, alerts } = fakeHomeDb(false);
    await expect(
      new InventoryController(db).adjustment(homeReturn, manager),
    ).rejects.toThrow(/Proveedor/);
    expect(calls).toContain("supplier");
    expect(calls).not.toContain("movement");
    expect(calls).not.toContain("stock");
    expect(alerts).toHaveLength(0);
  });
});

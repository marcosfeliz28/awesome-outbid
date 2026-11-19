// Arreglos de la auditoría de seguridad del 19-nov-2026 (M3, M4, B1-B8).
import { describe, expect, it, vi } from "vitest";

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

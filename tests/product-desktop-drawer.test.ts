import { describe, expect, it, vi } from "vitest";
import { permissions } from "../packages/shared/src";
import { CashController } from "../apps/api/src/cash";
import type { Actor } from "../apps/api/src/common";
import { readFileSync } from "node:fs";

const manager: Actor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Supervisión",
  email: "supervision@example.invalid",
  branchId: "22222222-2222-4222-8222-222222222222",
  tenantId: "00000000-0000-0000-0000-000000000001",
  role: "manager",
  permissions: permissions.manager,
  terminalId: "desktop-1",
  ip: "127.0.0.1",
};
const seller: Actor = {
  ...manager,
  id: "55555555-5555-4555-8555-555555555555",
  role: "seller",
  permissions: permissions.seller,
};
const saleId = "44444444-4444-4444-8444-444444444444";
const operationId = "66666666-6666-4666-8666-666666666666";

function drawerDb(options: { exists?: boolean; consumed?: boolean } = {}) {
  const auditLog = {
    findFirst: vi.fn().mockResolvedValue(options.consumed ? { id: "used" } : null),
    create: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }),
  };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    sale: { findFirst: vi.fn().mockResolvedValue(options.exists === false ? null : { id: saleId }) },
    cashMovement: { findFirst: vi.fn().mockResolvedValue(options.exists === false ? null : { id: saleId }) },
    auditLog,
  };
  return {
    db: { $transaction: vi.fn((callback) => callback(tx)) } as any,
    tx,
    auditLog,
  };
}

describe("PC-16 · apertura auditada de gaveta", () => {
  it("la venta autoriza la apertura automática a cajera y la manual queda en cash:drawer", async () => {
    expect(permissions.seller).toContain("sale:write");
    expect(permissions.seller).not.toContain("cash:drawer");
    expect(permissions.manager).toContain("cash:drawer");
    const controls = readFileSync("apps/web/src/DesktopPrinterControls.tsx", "utf8");
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(controls).toContain('can(user?.permissions ?? [], "cash:drawer")');
    expect(pos).toContain('can(user!.permissions, "sale:write")');
    expect(Reflect.getMetadata("permission", CashController.prototype.drawerOpen)).toBe("authenticated");

    const automatic = drawerDb();
    await expect(new CashController(automatic.db).drawerOpen({
      mode: "automatic", operationId, reason: "Cobro en efectivo de la venta", saleId,
    }, seller)).resolves.toEqual({ auditId: "33333333-3333-4333-8333-333333333333" });

    const manual = drawerDb();
    await expect(new CashController(manual.db).drawerOpen({
      mode: "manual", operationId, reason: "Cambio adicional solicitado", saleId,
    }, seller)).rejects.toThrow(/permiso/i);
    expect(manual.db.$transaction).not.toHaveBeenCalled();
  });

  it("deja el permiso, motivo, usuario y referencia en la bitácora", async () => {
    const { db, tx, auditLog } = drawerDb();
    const result = await new CashController(db).drawerOpen({
      mode: "manual", operationId, reason: "Cambio adicional solicitado", saleId,
    }, manager);
    expect(result.auditId).toBe("33333333-3333-4333-8333-333333333333");
    expect(tx.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        cashSession: { branchId: manager.branchId },
        payments: { some: expect.objectContaining({ method: "cash" }) },
      }),
    }));
    expect(auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: manager.id,
      action: "cash_drawer_open",
      entity: "cash_drawer_authorization",
      entityId: `manual:${operationId}`,
      after: expect.objectContaining({
        mode: "manual",
        reason: "Cambio adicional solicitado",
        reference: { entity: "sale", entityId: saleId },
      }),
    }) });
  });

  it("exige motivo y consume una autorización una sola vez", async () => {
    const missingReason = drawerDb();
    await expect(new CashController(missingReason.db).drawerOpen({
      mode: "manual", operationId, reason: " ", saleId,
    }, manager)).rejects.toThrow();
    expect(missingReason.db.$transaction).not.toHaveBeenCalled();

    const consumed = drawerDb({ consumed: true });
    await expect(new CashController(consumed.db).drawerOpen({
      mode: "automatic", operationId, reason: "Cobro en efectivo de la venta", saleId,
    }, seller)).rejects.toThrow(/ya fue usada/i);
    expect(consumed.tx.sale.findFirst).not.toHaveBeenCalled();
    expect(consumed.auditLog.create).not.toHaveBeenCalled();
  });

  it("rechaza una referencia ajena o inexistente sin escribir bitácora", async () => {
    const missing = drawerDb({ exists: false });
    await expect(new CashController(missing.db).drawerOpen({
      mode: "automatic", operationId, reason: "Cobro en efectivo de la venta", saleId,
    }, seller)).rejects.toThrow(/no existe/i);
    expect(missing.auditLog.create).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { permissions } from "../packages/shared/src";
import { CashController } from "../apps/api/src/cash";
import type { Actor } from "../apps/api/src/common";
import { readFileSync } from "node:fs";

const actor: Actor = {
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

describe("PC-16 · apertura auditada de gaveta", () => {
  it("una cajera no recibe el permiso y la pantalla oculta la acción", () => {
    expect(permissions.seller).not.toContain("cash:drawer");
    expect(permissions.manager).toContain("cash:drawer");
    const source = readFileSync("apps/web/src/DesktopPrinterControls.tsx", "utf8");
    expect(source).toContain('can(user?.permissions ?? [], "cash:drawer")');
    expect(Reflect.getMetadata("permission", CashController.prototype.drawerOpen)).toBe("cash:drawer");
  });

  it("solo autoriza una venta en efectivo de la sucursal y deja usuario y referencia en bitácora", async () => {
    const auditLog = { create: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }) };
    const db = {
      sale: { findFirst: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any;
    const result = await new CashController(db).drawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444444" },
      actor,
    );
    expect(result.auditId).toBe("33333333-3333-4333-8333-333333333333");
    expect(db.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        cashSession: { branchId: actor.branchId },
        payments: { some: expect.objectContaining({ method: "cash" }) },
      }),
    }));
    expect(auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: actor.id,
      action: "cash_drawer_open",
      entity: "sale",
      entityId: "44444444-4444-4444-8444-444444444444",
    }) });
  });

  it("rechaza una referencia ajena o inexistente sin escribir bitácora", async () => {
    const auditLog = { create: vi.fn() };
    const controller = new CashController({
      sale: { findFirst: vi.fn().mockResolvedValue(null) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any);
    await expect(controller.drawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444444" },
      actor,
    )).rejects.toThrow(/no existe/i);
    expect(auditLog.create).not.toHaveBeenCalled();
  });
});

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
const seller: Actor = {
  ...actor,
  id: "11111111-1111-4111-8111-111111111112",
  name: "Cajera",
  email: "cajera@example.invalid",
  role: "seller",
  permissions: permissions.seller,
};

describe("PC-16 · apertura auditada de gaveta", () => {
  it("una cajera no recibe el permiso y la pantalla oculta la acción", () => {
    expect(permissions.seller).not.toContain("cash:drawer");
    expect(permissions.manager).toContain("cash:drawer");
    const source = readFileSync("apps/web/src/DesktopPrinterControls.tsx", "utf8");
    expect(source).toContain('can(user?.permissions ?? [], "cash:drawer")');
    expect(Reflect.getMetadata("permission", CashController.prototype.drawerOpen)).toBe("cash:drawer");
    expect(Reflect.getMetadata("permission", CashController.prototype.automaticDrawerOpen)).toBe("sale:write");
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    const automaticBlock = pos.slice(
      pos.indexOf("const drawerAuthorization"),
      pos.indexOf("if (config?.autoPrintReceipt)"),
    );
    expect(automaticBlock).toContain("automatic: true");
    expect(automaticBlock).not.toContain('"cash:drawer"');
  });

  it("la venta en efectivo de la cajera autoriza una sola apertura automática y la deja auditada", async () => {
    let existingAudit: any = null;
    const auditLog = {
      findFirst: vi.fn(async () => existingAudit),
      create: vi.fn(async ({ data }) => {
        existingAudit = { id: "33333333-3333-4333-8333-333333333334", createdAt: new Date(), ...data };
        return existingAudit;
      }),
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ locked: "" }]),
      sale: { findFirst: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444445" }) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any;
    const controller = new CashController({
      $transaction: (work: (client: any) => unknown) => work(tx),
    } as any);

    const first = await controller.automaticDrawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444445" },
      seller,
    );
    const repeated = await controller.automaticDrawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444445" },
      seller,
    );

    expect(first).toEqual({
      auditId: "33333333-3333-4333-8333-333333333334",
      open: true,
    });
    // Reintento dentro de 30 s: sigue autorizado, sin segunda fila de bitácora.
    expect(repeated).toEqual({
      auditId: "33333333-3333-4333-8333-333333333334",
      open: true,
    });
    expect(tx.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        cashSession: { branchId: seller.branchId, userId: seller.id, closedAt: null },
        payments: { some: expect.objectContaining({ method: "cash" }) },
      }),
    }));
    expect(auditLog.create).toHaveBeenCalledTimes(1);
    expect(auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: seller.id,
      action: "cash_drawer_open_auto",
      entity: "sale",
      entityId: "44444444-4444-4444-8444-444444444445",
    }) });
  });

  it("solo autoriza una venta en efectivo de la sucursal y deja usuario y referencia en bitácora", async () => {
    const auditLog = { create: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }) };
    const db = {
      sale: { findFirst: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any;
    const result = await new CashController(db).drawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444444", reason: "Cliente pidió cambio" },
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
      after: { source: "desktop", reason: "Cliente pidió cambio" },
    }) });
  });

  it("apertura manual: sin motivo (o de menos de 5 caracteres) falla la validación (400 en HTTP) y no audita", async () => {
    const auditLog = { create: vi.fn() };
    const db = { sale: { findFirst: vi.fn().mockResolvedValue({ id: "x" }) }, auditLog } as any;
    const saleId = "44444444-4444-4444-8444-444444444444";
    for (const body of [{ saleId }, { saleId, reason: "ab" }, { saleId, reason: "   a  " }])
      await expect(new CashController(db).drawerOpen(body, actor)).rejects.toThrow(/reason/);
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  // Fake de sale.findFirst que sí aplica la ventana de tiempo y la caja abierta.
  const SALE = "44444444-4444-4444-8444-444444444445";
  const autoController = (sale: { createdAt: Date; sessionClosedAt: Date | null }, audits: any[] = []) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ locked: "" }]),
      sale: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.createdAt?.gte && sale.createdAt < where.createdAt.gte) return null;
          if (where.cashSession?.closedAt === null && sale.sessionClosedAt) return null;
          return { id: SALE };
        }),
      },
      auditLog: {
        findFirst: vi.fn(async () => audits[0] ?? null),
        create: vi.fn(async ({ data }: any) => ({ id: "33333333-3333-4333-8333-333333333334", ...data })),
      },
    } as any;
    return { tx, controller: new CashController({ $transaction: (w: any) => w(tx) } as any) };
  };

  it("apertura automática: rechaza una venta de hace más de 2 minutos", async () => {
    const { controller, tx } = autoController({ createdAt: new Date(Date.now() - 3 * 60_000), sessionClosedAt: null });
    await expect(controller.automaticDrawerOpen({ saleId: SALE }, seller)).rejects.toThrow(/no pertenece/i);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("apertura automática: rechaza una venta de una caja cerrada", async () => {
    const { controller } = autoController({ createdAt: new Date(), sessionClosedAt: new Date() });
    await expect(controller.automaticDrawerOpen({ saleId: SALE }, seller)).rejects.toThrow(/no pertenece/i);
  });

  it("apertura automática: una venta en efectivo reciente de caja abierta se acepta", async () => {
    const { controller } = autoController({ createdAt: new Date(Date.now() - 5_000), sessionClosedAt: null });
    expect((await controller.automaticDrawerOpen({ saleId: SALE }, seller)).open).toBe(true);
  });

  it("apertura automática: reintento a los 10 s devuelve open:true; a los 31 s open:false", async () => {
    const prev = (ageMs: number) => [{ id: "33333333-3333-4333-8333-333333333399", createdAt: new Date(Date.now() - ageMs) }];
    const young = autoController({ createdAt: new Date(), sessionClosedAt: null }, prev(10_000));
    expect(await young.controller.automaticDrawerOpen({ saleId: SALE }, seller))
      .toEqual({ auditId: "33333333-3333-4333-8333-333333333399", open: true });
    expect(young.tx.auditLog.create).not.toHaveBeenCalled();
    const old = autoController({ createdAt: new Date(), sessionClosedAt: null }, prev(31_000));
    expect((await old.controller.automaticDrawerOpen({ saleId: SALE }, seller)).open).toBe(false);
  });

  it("rechaza una referencia ajena o inexistente sin escribir bitácora", async () => {
    const auditLog = { create: vi.fn() };
    const controller = new CashController({
      sale: { findFirst: vi.fn().mockResolvedValue(null) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any);
    await expect(controller.drawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444444", reason: "Motivo válido" },
      actor,
    )).rejects.toThrow(/no existe/i);
    expect(auditLog.create).not.toHaveBeenCalled();
  });
});

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

  // Base simulada que aplica los filtros de la ruta a una venta de prueba:
  // si la ruta deja de pedir la ventana de 2 minutos o la caja abierta, la
  // venta vieja o la de caja cerrada pasarían.
  function drawerDb(sale: { createdAt: Date; closedAt: Date | null }) {
    const rows: any[] = [];
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ locked: "" }]),
      sale: {
        findFirst: vi.fn(async ({ where }: any) => {
          const since = where.createdAt?.gte;
          if (!since || sale.createdAt < since) return null;
          if (!("closedAt" in where.cashSession) || (where.cashSession.closedAt === null && sale.closedAt)) return null;
          return { id: where.id };
        }),
      },
      auditLog: {
        findMany: vi.fn(async ({ where }: any) =>
          rows.filter((row) => row.entityId === where.entityId && where.action.in.includes(row.action))),
        findFirst: vi.fn(async ({ where }: any) =>
          rows.find((row) => row.id === where.id && row.action === where.action && row.userId === where.userId) ?? null),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `33333333-3333-4333-8333-33333333333${rows.length}`, ...data };
          rows.push(row);
          return row;
        }),
      },
    } as any;
    const controller = new CashController({
      ...tx,
      $transaction: (work: (client: any) => unknown) => work(tx),
    } as any);
    return { controller, rows, tx };
  }
  const saleId = "44444444-4444-4444-8444-444444444445";

  it("CPC-10: abre con la venta en efectivo recién cobrada y deja la bitácora", async () => {
    const { controller, rows, tx } = drawerDb({ createdAt: new Date(), closedAt: null });
    const first = await controller.automaticDrawerOpen({ saleId }, seller);
    expect(first).toEqual({ auditId: rows[0].id, open: true });
    expect(tx.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        cashSession: { branchId: seller.branchId, userId: seller.id, closedAt: null },
        payments: { some: expect.objectContaining({ method: "cash" }) },
      }),
    }));
    expect(rows[0]).toEqual(expect.objectContaining({
      userId: seller.id, action: "cash_drawer_open_auto", entity: "sale", entityId: saleId,
    }));
  });

  it("CPC-10: rechaza una venta de hace más de 2 minutos", async () => {
    const { controller, rows } = drawerDb({ createdAt: new Date(Date.now() - 3 * 60_000), closedAt: null });
    await expect(controller.automaticDrawerOpen({ saleId }, seller)).rejects.toThrow(/2 minutos/);
    expect(rows).toHaveLength(0);
  });

  it("CPC-10: rechaza una venta de una caja ya cerrada", async () => {
    const { controller, rows } = drawerDb({ createdAt: new Date(), closedAt: new Date() });
    await expect(controller.automaticDrawerOpen({ saleId }, seller)).rejects.toThrow(/caja abierta/);
    expect(rows).toHaveLength(0);
  });

  it("CPC-10: permite un reintento si el pulso no se confirmó y rechaza el segundo", async () => {
    const { controller, rows } = drawerDb({ createdAt: new Date(), closedAt: null });
    expect((await controller.automaticDrawerOpen({ saleId }, seller)).open).toBe(true);
    expect((await controller.automaticDrawerOpen({ saleId }, seller)).open).toBe(true);
    await expect(controller.automaticDrawerOpen({ saleId }, seller)).rejects.toThrow(/dos veces/);
    expect(rows.filter((row) => row.action === "cash_drawer_open_auto")).toHaveLength(2);
  });

  it("CPC-10: con el pulso confirmado por el equipo no hay reintento", async () => {
    const { controller, rows } = drawerDb({ createdAt: new Date(), closedAt: null });
    const first = await controller.automaticDrawerOpen({ saleId }, seller);
    await controller.automaticDrawerSent({ auditId: first.auditId }, seller);
    expect(rows.at(-1)).toEqual(expect.objectContaining({ action: "cash_drawer_open_auto_sent", entityId: saleId }));
    expect(await controller.automaticDrawerOpen({ saleId }, seller)).toEqual(
      expect.objectContaining({ open: false }),
    );
    // Otra cajera no puede marcar como enviado un pulso ajeno.
    await expect(controller.automaticDrawerSent({ auditId: first.auditId }, { ...seller, id: actor.id }))
      .rejects.toThrow(/pendiente/);
    expect(Reflect.getMetadata("permission", CashController.prototype.automaticDrawerSent)).toBe("sale:write");
  });

  it("CPC-10: la apertura manual sin motivo se rechaza sin bitácora", async () => {
    const auditLog = { create: vi.fn() };
    const controller = new CashController({
      sale: { findFirst: vi.fn().mockResolvedValue({ id: saleId }) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any);
    await expect(controller.drawerOpen({ saleId }, actor)).rejects.toThrow();
    await expect(controller.drawerOpen({ saleId, reason: "ok" }, actor)).rejects.toThrow(/motivo/);
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it("solo autoriza una venta en efectivo de la sucursal y deja usuario y referencia en bitácora", async () => {
    const auditLog = { create: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }) };
    const db = {
      sale: { findFirst: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }) },
      cashMovement: { findFirst: vi.fn() },
      auditLog,
    } as any;
    const result = await new CashController(db).drawerOpen(
      { saleId: "44444444-4444-4444-8444-444444444444", reason: "Cambio para la cajera 2" },
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
      after: expect.objectContaining({ reason: "Cambio para la cajera 2" }),
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
      { saleId: "44444444-4444-4444-8444-444444444444", reason: "Cambio para la cajera 2" },
      actor,
    )).rejects.toThrow(/no existe/i);
    expect(auditLog.create).not.toHaveBeenCalled();
  });
});

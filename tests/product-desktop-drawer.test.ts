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

function drawerDb(
  options: { exists?: boolean; attempts?: Array<Record<string, unknown>> } = {},
) {
  const auditLog = {
    findMany: vi.fn().mockResolvedValue(options.attempts ?? []),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi
      .fn()
      .mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }),
    update: vi.fn().mockResolvedValue({}),
  };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi
      .fn()
      .mockResolvedValue(options.exists === false ? [] : [{ id: saleId }]),
    sale: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.exists === false ? null : { id: saleId }),
    },
    cashMovement: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.exists === false ? null : { id: saleId }),
    },
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
    const controls = readFileSync(
      "apps/web/src/DesktopPrinterControls.tsx",
      "utf8",
    );
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(controls).toContain('can(user?.permissions ?? [], "cash:drawer")');
    expect(pos).toContain('can(user!.permissions, "sale:write")');
    expect(
      Reflect.getMetadata("permission", CashController.prototype.drawerOpen),
    ).toBe("authenticated");

    const automatic = drawerDb();
    await expect(
      new CashController(automatic.db).drawerOpen(
        {
          mode: "automatic",
          operationId,
          reason: "Cobro en efectivo de la venta",
          saleId,
        },
        seller,
      ),
    ).resolves.toEqual({
      auditId: "33333333-3333-4333-8333-333333333333",
      pulseStatus: "authorized",
    });

    const manual = drawerDb();
    await expect(
      new CashController(manual.db).drawerOpen(
        {
          mode: "manual",
          operationId,
          reason: "Cambio adicional solicitado",
          saleId,
        },
        seller,
      ),
    ).rejects.toThrow(/permiso/i);
    expect(manual.db.$transaction).not.toHaveBeenCalled();
  });

  it("deja el permiso, motivo, usuario y referencia en la bitácora", async () => {
    const { db, tx, auditLog } = drawerDb();
    const result = await new CashController(db).drawerOpen(
      {
        mode: "manual",
        operationId,
        reason: "Cambio adicional solicitado",
        saleId,
      },
      manager,
    );
    expect(result.auditId).toBe("33333333-3333-4333-8333-333333333333");
    expect(tx.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cashSession: { branchId: manager.branchId },
          payments: { some: expect.objectContaining({ method: "cash" }) },
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: manager.id,
        action: "cash_drawer_open",
        entity: "cash_drawer_authorization",
        entityId: `manual:${operationId}`,
        after: expect.objectContaining({
          mode: "manual",
          reason: "Cambio adicional solicitado",
          attempt: 1,
          pulseStatus: "authorized",
          reference: { entity: "sale", entityId: saleId },
        }),
      }),
    });
  });

  it("exige motivo y consume una autorización una sola vez", async () => {
    const missingReason = drawerDb();
    await expect(
      new CashController(missingReason.db).drawerOpen(
        {
          mode: "manual",
          operationId,
          reason: " ",
          saleId,
        },
        manager,
      ),
    ).rejects.toThrow();
    expect(missingReason.db.$transaction).not.toHaveBeenCalled();

    const tooShort = drawerDb();
    await expect(
      new CashController(tooShort.db).drawerOpen(
        {
          mode: "manual",
          operationId,
          reason: "1234",
          saleId,
        },
        manager,
      ),
    ).rejects.toThrow();
    expect(tooShort.db.$transaction).not.toHaveBeenCalled();

    const consumed = drawerDb({
      attempts: [{ id: "used", after: { pulseStatus: "sent" } }],
    });
    await expect(
      new CashController(consumed.db).drawerOpen(
        {
          mode: "automatic",
          operationId,
          reason: "Cobro en efectivo de la venta",
          saleId,
        },
        seller,
      ),
    ).rejects.toThrow(/ya envió/i);
    expect(consumed.tx.$queryRaw).not.toHaveBeenCalled();
    expect(consumed.auditLog.create).not.toHaveBeenCalled();
  });

  it("permite un solo reintento sin confirmar y marca enviado al confirmar", async () => {
    const pending = {
      id: "22222222-2222-4222-8222-222222222221",
      after: { pulseStatus: "authorized" },
    };
    const retry = drawerDb({ attempts: [pending] });
    await expect(
      new CashController(retry.db).drawerOpen(
        {
          mode: "automatic",
          operationId,
          reason: "Reintento sin pulso recibido",
          saleId,
        },
        seller,
      ),
    ).resolves.toMatchObject({ pulseStatus: "authorized" });

    const exhausted = drawerDb({
      attempts: [
        pending,
        { ...pending, id: "22222222-2222-4222-8222-222222222222" },
      ],
    });
    await expect(
      new CashController(exhausted.db).drawerOpen(
        {
          mode: "automatic",
          operationId,
          reason: "Tercer intento bloqueado",
          saleId,
        },
        seller,
      ),
    ).rejects.toThrow(/agotó/i);

    const confirmation = drawerDb();
    confirmation.auditLog.findFirst.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      after: { pulseStatus: "authorized", reason: "Cobro en efectivo" },
    });
    await expect(
      new CashController(confirmation.db).confirmDrawerPulse(
        "33333333-3333-4333-8333-333333333333",
        seller,
      ),
    ).resolves.toEqual({
      auditId: "33333333-3333-4333-8333-333333333333",
      pulseStatus: "sent",
    });
    expect(confirmation.auditLog.update).toHaveBeenCalledWith({
      where: { id: "33333333-3333-4333-8333-333333333333" },
      data: {
        after: expect.objectContaining({
          pulseStatus: "sent",
          confirmedAt: expect.any(String),
        }),
      },
    });
  });

  it("rechaza una referencia ajena o inexistente sin escribir bitácora", async () => {
    const missing = drawerDb({ exists: false });
    await expect(
      new CashController(missing.db).drawerOpen(
        {
          mode: "automatic",
          operationId,
          reason: "Cobro en efectivo de la venta",
          saleId,
        },
        seller,
      ),
    ).rejects.toThrow(/no existe/i);
    expect(missing.auditLog.create).not.toHaveBeenCalled();
  });
});

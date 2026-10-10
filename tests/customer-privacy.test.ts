import { describe, expect, it, vi } from "vitest";
import { permissions } from "../packages/shared/src/index";
import { AdminController } from "../apps/api/src/admin";
import { SalesController } from "../apps/api/src/sales";

const customerId = "11111111-1111-4111-8111-111111111111";
const actor = {
  id: "owner",
  name: "Dueña",
  email: "owner@example.test",
  role: "manager",
  permissions: permissions.manager,
  branchId: "main",
} as any;

function fixture(
  debt = 0,
  creditNoteBalance = 0,
  customerName = "Persona privada",
) {
  let customer = {
    id: customerId,
    name: customerName,
    phone: "809-555-0101",
    email: "private@example.test",
    legalId: "00100000001",
    notes: "Dato privado",
    active: true,
    anonymizedAt: null as Date | null,
  };
  const sale = {
    id: "22222222-2222-4222-8222-222222222222",
    number: "NX-42",
    total: 875,
    ncf: "B0200000042",
  };
  const saleAudit = {
    id: "33333333-3333-4333-8333-333333333333",
    before: {
      recipientLegalId: "00100000001",
      notes: "Llamar al 809-555-0101",
      voidedReason: "La Persona privada pidió anular",
      reference: "private@example.test",
      financialMemo: "La semana financiera cerró bien",
      total: 875,
      status: "completed",
    },
    after: {
      total: 875,
      nested: { notes: "private@example.test", kept: "contabilidad" },
    },
  };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: customerId }]),
    customer: {
      findFirst: vi.fn(async () =>
        customer.active && !customer.anonymizedAt ? customer : null,
      ),
      findFirstOrThrow: vi.fn(async () => customer),
      update: vi.fn(async ({ data }: any) => {
        customer = { ...customer, ...data };
        return customer;
      }),
    },
    sale: {
      aggregate: vi.fn(async () => ({ _sum: { creditBalance: debt } })),
      findMany: vi.fn(async () => [{ id: sale.id }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    creditNote: {
      aggregate: vi.fn(async () => ({
        _sum: { balance: creditNoteBalance },
      })),
    },
    quote: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: any) => data),
    },
    alert: { updateMany: vi.fn(async () => ({ count: 1 })) },
    // Auditoría 03 (A2): pagos, devoluciones, kardex y avisos de la venta.
    payment: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ data }: any) => data),
    },
    saleReturn: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ data }: any) => data),
    },
    inventoryMovement: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ data }: any) => data),
    },
    notificationOutbox: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ data }: any) => data),
    },
    auditLog: {
      updateMany: vi.fn(async () => ({ count: 2 })),
      findMany: vi.fn(async () => [saleAudit]),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(saleAudit, data);
        return saleAudit;
      }),
      create: vi.fn(async ({ data }: any) => data),
    },
  };
  const db = {
    customer: tx.customer,
    variant: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  return { api: new AdminController(db as any), tx, sale, saleAudit };
}

describe("G6: anonimización de clientes", () => {
  it("reserva el endpoint a customers:erase y no lo concede a vendedores", () => {
    const handler = (AdminController.prototype as any).anonymizeCustomer;
    expect(Reflect.getMetadata("permission", handler)).toBe("customers:erase");
    expect(permissions.manager).toContain("customers:erase");
    expect(permissions.seller).not.toContain("customers:erase");
  });

  it("rechaza la anonimización cuando hay crédito o contraentrega pendiente", async () => {
    const { api, tx } = fixture(25);
    await expect(
      (api as any).anonymizeCustomer(
        customerId,
        { reason: "Solicitud verificada", requestRef: "SOL-2026-001" },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.customer.update).not.toHaveBeenCalled();
  });

  it("borra datos personales y auditoría sin alterar ventas ni montos", async () => {
    const { api, tx, sale, saleAudit } = fixture();
    const originalSale = structuredClone(sale);
    const privateReason = "Solicitud de otra-persona@example.test";
    const privateReference = "CASO-PII-8095559999";
    const result = await (api as any).anonymizeCustomer(
      customerId,
      { reason: privateReason, requestRef: privateReference },
      actor,
    );

    expect(result).toMatchObject({ id: customerId, active: false });
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: null,
          email: null,
          legalId: null,
          notes: "",
          active: false,
        }),
      }),
    );
    expect(tx.auditLog.updateMany).toHaveBeenCalled();
    expect(tx.auditLog.update).toHaveBeenCalledTimes(1);
    expect(saleAudit.before).toEqual({
      recipientLegalId: "[dato anonimizado]",
      notes: "[dato anonimizado]",
      voidedReason: "La [dato anonimizado] pidió anular",
      reference: "[dato anonimizado]",
      financialMemo: "La semana financiera cerró bien",
      total: 875,
      status: "completed",
    });
    expect(saleAudit.after).toEqual({
      total: 875,
      nested: {
        notes: "[dato anonimizado]",
        kept: "contabilidad",
      },
    });
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [sale.id] } },
      data: { recipientLegalId: null, notes: "" },
    });
    expect(tx.alert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "resolved" }),
      }),
    );
    expect(JSON.stringify(tx.auditLog.updateMany.mock.calls)).not.toContain(
      "809-555-0101",
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      "809-555-0101",
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      privateReason,
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      privateReference,
    );
    expect(tx.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          after: {
            reasonRecorded: true,
            requestReferenceRecorded: true,
          },
        }),
      }),
    );
    expect(sale).toEqual(originalSale);
  });

  it("rechaza una segunda anonimización sin sobrescribir la primera auditoría", async () => {
    const { api, tx } = fixture();
    const request = {
      reason: "Solicitud verificada",
      requestRef: "SOL-2026-003",
    };
    await (api as any).anonymizeCustomer(customerId, request, actor);
    const firstAudit = structuredClone(tx.auditLog.create.mock.calls);

    await expect(
      (api as any).anonymizeCustomer(customerId, request, actor),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.auditLog.create.mock.calls).toEqual(firstAudit);
    expect(tx.customer.update).toHaveBeenCalledTimes(1);
  });

  it("impide volver a identificar un cliente ya anonimizado", async () => {
    const { api } = fixture();
    await (api as any).anonymizeCustomer(
      customerId,
      { reason: "Solicitud verificada", requestRef: "SOL-2026-004" },
      actor,
    );

    await expect(
      (api as any).editCustomer(
        customerId,
        { name: "Persona privada otra vez" },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("impide asociar una cotización nueva a un cliente anonimizado", async () => {
    const { api, tx } = fixture();
    await (api as any).anonymizeCustomer(
      customerId,
      { reason: "Solicitud verificada", requestRef: "SOL-2026-005" },
      actor,
    );
    await expect(
      (api as any).quote(
        {
          type: "quote",
          customerId,
          items: [
            {
              variantId: "44444444-4444-4444-8444-444444444444",
              qty: 1,
              discountPercent: 0,
            },
          ],
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.quote.create).not.toHaveBeenCalled();
  });

  it("no confunde un nombre corto con una subcadena financiera inocua", async () => {
    const { api, saleAudit } = fixture(0, 0, "Ana");
    await (api as any).anonymizeCustomer(
      customerId,
      { reason: "Solicitud verificada", requestRef: "SOL-2026-006" },
      actor,
    );
    expect(saleAudit.before.financialMemo).toBe(
      "La semana financiera cerró bien",
    );
  });

  it("relee bajo bloqueo al cliente de toda venta, incluso efectivo o tarjeta", async () => {
    const terminalId = "55555555-5555-4555-8555-555555555555";
    const seller = {
      ...actor,
      id: "66666666-6666-4666-8666-666666666666",
      terminalId,
      permissions: ["sale:write"],
    } as any;
    const tx = {
      $queryRaw: vi.fn(async () => [{ locked: "1" }]),
      sale: { findUnique: vi.fn(async () => null) },
      // N-M1: se consulta si gerencia descartó esta venta offline.
      auditLog: { findFirst: vi.fn(async () => null) },
      settings: { findUnique: vi.fn(async () => ({ data: {} })) },
      cashSession: {
        findFirstOrThrow: vi.fn(async () => ({
          id: "77777777-7777-4777-8777-777777777777",
          userId: seller.id,
          registerId: terminalId,
          openedAt: new Date(),
          closedAt: null,
        })),
      },
      customer: { findFirst: vi.fn(async () => null) },
    };
    const db = {
      sale: tx.sale,
      settings: tx.settings,
      variant: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
    };
    const sales = new SalesController(db as any);
    await expect(
      sales.complete(seller, {
        offlineUuid: "88888888-8888-4888-8888-888888888888",
        cashSessionId: "77777777-7777-4777-8777-777777777777",
        customerId,
        items: [
          {
            variantId: "99999999-9999-4999-8999-999999999999",
            qty: 1,
            discountPercent: 0,
          },
        ],
        payments: [{ method: "card", amount: 100 }],
        globalDiscount: 0,
      } as any),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.customer.findFirst).toHaveBeenCalledWith({
      where: {
        id: customerId,
        branchId: seller.branchId,
        active: true,
        anonymizedAt: null,
      },
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { permissions } from "../packages/shared/src/index";
import { AdminController } from "../apps/api/src/admin";

const customerId = "11111111-1111-4111-8111-111111111111";
const actor = {
  id: "owner",
  name: "Dueña",
  email: "owner@example.test",
  role: "manager",
  permissions: permissions.manager,
  branchId: "main",
} as any;

function fixture(debt = 0, creditNoteBalance = 0) {
  const sale = { number: "NX-42", total: 875, ncf: "B0200000042" };
  const tx = {
    customer: {
      findFirstOrThrow: vi.fn(async () => ({
        id: customerId,
        name: "Persona privada",
        phone: "809-555-0101",
        email: "private@example.test",
        legalId: "00100000001",
        notes: "Dato privado",
      })),
      update: vi.fn(async ({ data }: any) => ({ id: customerId, ...data })),
    },
    sale: {
      aggregate: vi.fn(async () => ({ _sum: { creditBalance: debt } })),
    },
    creditNote: {
      aggregate: vi.fn(async () => ({
        _sum: { balance: creditNoteBalance },
      })),
    },
    quote: { updateMany: vi.fn(async () => ({ count: 1 })) },
    auditLog: {
      updateMany: vi.fn(async () => ({ count: 2 })),
      create: vi.fn(async ({ data }: any) => data),
    },
  };
  const db = {
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  return { api: new AdminController(db as any), tx, sale };
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
    const { api, tx, sale } = fixture();
    const originalSale = structuredClone(sale);
    const result = await (api as any).anonymizeCustomer(
      customerId,
      { reason: "Solicitud verificada", requestRef: "SOL-2026-002" },
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
    expect(JSON.stringify(tx.auditLog.updateMany.mock.calls)).not.toContain(
      "809-555-0101",
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      "809-555-0101",
    );
    expect(sale).toEqual(originalSale);
  });
});

// Auditoría 06, D-M2: anulación, devolución y cierre de caja abren su
// transacción con el mismo plazo que la venta (20 s), no con los 5 s por
// defecto de Prisma. La base se simula: sólo importa el plazo pedido.
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { SalesController } from "../apps/api/src/sales";
import { CashController } from "../apps/api/src/cash";

const actor = {
  id: randomUUID(),
  name: "Administración",
  email: "admin@example.test",
  role: "admin",
  permissions: ["*"],
  branchId: "main",
  terminalId: randomUUID(),
  terminalApproved: true,
} as any;
function fakeDb(result: unknown) {
  const calls: unknown[] = [];
  return {
    calls,
    db: {
      $transaction: async (_run: unknown, options?: unknown) => {
        calls.push(options);
        return result;
      },
    } as any,
  };
}

describe("D-M2 · plazo de las transacciones de dinero", () => {
  it("POST /sales/:id/void usa 20 s", async () => {
    const { calls, db } = fakeDb({ ok: true });
    await new SalesController(db).voidSale(
      randomUUID(),
      { reason: "Prueba de plazo" },
      actor,
    );
    expect(calls).toEqual([{ timeout: 20000 }]);
  });
  it("POST /returns usa 20 s", async () => {
    const { calls, db } = fakeDb(null);
    await new SalesController(db).returnSale(
      {
        operationId: randomUUID(),
        saleId: randomUUID(),
        cashSessionId: randomUUID(),
        reason: "Talla equivocada",
        refundMethod: "cash",
        items: [{ saleItemId: randomUUID(), qty: 1, restock: true }],
      },
      actor,
    );
    expect(calls).toEqual([{ timeout: 20000 }]);
  });
  it("POST /cash-sessions/:id/close usa 20 s", async () => {
    const { calls, db } = fakeDb({ id: randomUUID() });
    await new CashController(db).close(
      randomUUID(),
      { countedCash: 0, countedCard: 0, countedTransfer: 0 },
      actor,
    );
    expect(calls).toEqual([{ timeout: 20000 }]);
  });
});

import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { MONEY_TRANSACTION, SalesController } from "../apps/api/src/sales";

const source = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

describe("PERF-5 · la devolución tiene el mismo plazo de transacción que la venta", () => {
  it("POST /returns abre la transacción con 20 s, no con los 5 s por defecto de Prisma", async () => {
    const calls: unknown[] = [];
    const controller = new SalesController({
      $transaction: async (_run: unknown, options?: unknown) => {
        calls.push(options);
        return null;
      },
    } as any);
    await controller.returnSale(
      {
        operationId: randomUUID(),
        saleId: randomUUID(),
        cashSessionId: randomUUID(),
        reason: "Talla equivocada",
        refundMethod: "cash",
        items: [{ saleItemId: randomUUID(), qty: 1, restock: true }],
      },
      {
        id: randomUUID(),
        name: "Gerente",
        email: "gerente@example.test",
        role: "manager",
        permissions: ["sale:manage"],
        branchId: "main",
      } as any,
    );
    expect(calls).toEqual([{ timeout: 20000 }]);
    expect(MONEY_TRANSACTION).toEqual({ timeout: 20000 });
    // La venta usa el mismo plazo.
    expect(source("apps/api/src/sales.ts")).toContain(
      "{ timeout: MONEY_TRANSACTION.timeout },",
    );
  });
});

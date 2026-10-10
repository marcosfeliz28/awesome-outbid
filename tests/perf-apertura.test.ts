import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { MONEY_TRANSACTION, SalesController } from "../apps/api/src/sales";
import { CashController } from "../apps/api/src/cash";

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

describe("PERF-4 · GET /cash-sessions con consultas agrupadas", () => {
  // Antes: Promise.all de 100 cajas × (pagos + movimientos + devoluciones +
  // equipo) = 400 consultas a la vez contra un pool de 9 → P2024.
  function fakeDb(count: number) {
    const calls: Record<string, number> = {};
    const hit =
      (name: string, value: (args: any) => unknown = () => []) =>
      async (args: any) => {
        calls[name] = (calls[name] ?? 0) + 1;
        return value(args);
      };
    const sessions = Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      registerId: randomUUID(),
      userId: "cajera-1",
      openingAmount: 100,
      openedAt: new Date(Date.UTC(2026, 0, 1) + i * 3600000),
      closedAt: i === count - 1 ? null : new Date(),
      branchId: "main",
    }));
    const db = {
      cashSession: {
        findMany: hit("cashSession.findMany", ({ where }: any) =>
          sessions.filter((s) =>
            where.closedAt === null ? !s.closedAt : !!s.closedAt,
          ),
        ),
      },
      payment: {
        findMany: hit("payment.findMany"),
        groupBy: hit("payment.groupBy", ({ where }: any) =>
          where.cashSessionId.in.map((id: string) => ({
            cashSessionId: id,
            method: "cash",
            _sum: { amount: 25 },
          })),
        ),
      },
      cashMovement: { findMany: hit("cashMovement.findMany") },
      saleReturn: {
        findMany: hit("saleReturn.findMany"),
        groupBy: hit("saleReturn.groupBy"),
      },
      terminal: {
        findUnique: hit("terminal.findUnique", () => null),
        findMany: hit("terminal.findMany"),
      },
    };
    return { db, calls };
  }
  const actor = (permissions: string[]) =>
    ({
      id: "cajera-1",
      name: "Caja",
      email: "caja@example.test",
      role: "custom",
      permissions,
      branchId: "main",
    }) as any;

  it("gerencia: un número fijo de consultas para 60 cajas y el esperado de cada una", async () => {
    const { db, calls } = fakeDb(60);
    const list: any[] = await new CashController(db as any).sessions(
      actor(["cash:write", "sale:manage"]),
    );
    expect(list).toHaveLength(60);
    expect(list.every((s) => s.expected?.cash === 125)).toBe(true);
    expect(calls).toEqual({
      "cashSession.findMany": 2,
      "payment.groupBy": 1,
      "cashMovement.findMany": 1,
      "saleReturn.groupBy": 1,
      "terminal.findMany": 1,
    });
  });

  it("cajera: ni siquiera se calcula el esperado (cierre ciego)", async () => {
    const { db, calls } = fakeDb(60);
    const list: any[] = await new CashController(db as any).sessions(
      actor(["cash:write"]),
    );
    expect(list).toHaveLength(60);
    expect(list.some((s) => "expected" in s || "expectedCash" in s)).toBe(
      false,
    );
    expect(calls).toEqual({
      "cashSession.findMany": 2,
      "terminal.findMany": 1,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  AI_INVOICE_ACTION,
  AI_INVOICE_DAILY_LIMIT,
  reserveAiInvoiceRead,
} from "../apps/api/src/ai-daily-limit";

// Cliente falso: cuenta las lecturas guardadas y registra las nuevas.
function fakeDb(initial: { userId: string; createdAt: Date; action: string }[]) {
  const rows = [...initial];
  const tx = {
    $queryRaw: async () => [{ locked: "t" }],
    auditLog: {
      count: async ({ where }: any) =>
        rows.filter(
          (r) =>
            r.userId === where.userId &&
            r.action === where.action &&
            r.createdAt >= where.createdAt.gte,
        ).length,
      create: async ({ data }: any) => {
        rows.push({ userId: data.userId, action: data.action, createdAt: new Date() });
        return data;
      },
    },
  };
  return { rows, $transaction: async (fn: any) => fn(tx) };
}

const actor = { id: "u1", branchId: "main", ip: "127.0.0.1" } as any;
const hoy = new Date("2026-10-30T15:00:00Z");

describe("tope diario de lecturas con IA por usuario", () => {
  it("el tope es 30 por día", () => {
    expect(AI_INVOICE_DAILY_LIMIT).toBe(30);
  });

  it("permite la lectura 30 y registra la lectura antes de llamar al modelo", async () => {
    const db = fakeDb(
      Array.from({ length: 29 }, () => ({
        userId: "u1",
        action: AI_INVOICE_ACTION,
        createdAt: new Date("2026-10-30T13:00:00Z"),
      })),
    );
    expect(await reserveAiInvoiceRead(db, actor, hoy)).toBe(30);
    expect(db.rows.filter((r) => r.action === AI_INVOICE_ACTION)).toHaveLength(30);
  });

  it("rechaza la lectura 31 con un mensaje claro y no registra nada", async () => {
    const db = fakeDb(
      Array.from({ length: 30 }, () => ({
        userId: "u1",
        action: AI_INVOICE_ACTION,
        createdAt: new Date("2026-10-30T13:00:00Z"),
      })),
    );
    await expect(reserveAiInvoiceRead(db, actor, hoy)).rejects.toThrow(
      "Ya usaste las 30 lecturas con IA de hoy.",
    );
    expect(db.rows).toHaveLength(30);
  });

  it("cuenta por usuario: otra persona no consume el tope", async () => {
    const db = fakeDb(
      Array.from({ length: 30 }, () => ({
        userId: "otra",
        action: AI_INVOICE_ACTION,
        createdAt: new Date("2026-10-30T13:00:00Z"),
      })),
    );
    expect(await reserveAiInvoiceRead(db, actor, hoy)).toBe(1);
  });

  it("el día empieza a las 00:00 de Santo Domingo: lecturas de ayer no cuentan", async () => {
    const db = fakeDb(
      Array.from({ length: 30 }, () => ({
        userId: "u1",
        action: AI_INVOICE_ACTION,
        // 29-oct 23:30 en Santo Domingo = 30-oct 03:30 UTC: ya es el día anterior.
        createdAt: new Date("2026-10-30T03:30:00Z"),
      })),
    );
    // A las 15:00 UTC (11:00 en Santo Domingo) el día es el 30-oct, que empieza 04:00 UTC.
    expect(await reserveAiInvoiceRead(db, actor, hoy)).toBe(1);
  });
});

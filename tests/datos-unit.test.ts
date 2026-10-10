import { describe, expect, it } from "vitest";
import { cashExpected } from "../apps/api/src/cash";
import { audit } from "../apps/api/src/common";
import {
  DEFAULT_POOL,
  databaseUrlWithPool,
} from "../apps/api/src/database-pool";

// Auditoría 06 (D-M2, D-M6) y 03 (A2): comprobaciones sin base de datos.

const actor = {
  id: "owner-1",
  name: "Dueña",
  email: "owner@example.test",
  role: "owner",
  permissions: ["*"],
  branchId: "main",
} as any;

// Foto de evidencia como la guarda POST /payments/:id/proof (data URL).
const photo = "data:image/jpeg;base64," + "A".repeat(4000);

describe("D-M6 · el esperado de caja no carga las fotos de evidencia", () => {
  it("pide sólo método e importe de los pagos y de las devoluciones", async () => {
    const calls: Record<string, any> = {};
    const db = {
      payment: {
        findMany: async (args: any) => {
          calls.payment = args;
          return [
            { method: "cash", amount: 100 },
            { method: "transfer", amount: 50 },
          ];
        },
      },
      cashMovement: {
        findMany: async (args: any) => {
          calls.movement = args;
          return [{ type: "out", amount: 20 }];
        },
      },
      saleReturn: {
        findMany: async (args: any) => {
          calls.saleReturn = args;
          return [{ refundMethod: "cash", refundAmount: 10 }];
        },
      },
    };
    const expected = await cashExpected(db, {
      id: "c0a80101-0000-4000-8000-000000000001",
      openingAmount: 1000,
    });
    // La suma no cambia.
    expect(expected).toMatchObject({ cash: 1070, card: 0, transfer: 50 });
    // Sin select, Prisma trae todas las columnas: también proofUrl, una foto
    // base64 de hasta 2,7 MB por abono (26 MB para 20 abonos en una caja).
    expect(calls.payment.select).toEqual({ method: true, amount: true });
    expect(calls.saleReturn.select).toEqual({
      refundMethod: true,
      refundAmount: true,
    });
  });
});

describe("A2 · la bitácora no guarda copias de las fotos de evidencia", () => {
  it("reemplaza cualquier data URL de imagen, también anidada, por un marcador", async () => {
    let stored: any;
    const db = {
      auditLog: {
        create: async (args: any) => {
          stored = args.data;
          return args.data;
        },
      },
    };
    await audit(
      db,
      actor,
      "verify",
      "payment",
      "c0a80101-0000-4000-8000-000000000002",
      { id: "p1", amount: 500, proofUrl: photo, reference: "REF-1" },
      { status: "ok", nested: [{ proofUrl: photo }], logo: null },
    );
    expect(JSON.stringify(stored)).not.toContain("base64");
    expect(stored.before).toEqual({
      id: "p1",
      amount: 500,
      proofUrl: "(imagen)",
      reference: "REF-1",
    });
    expect(stored.after).toEqual({
      status: "ok",
      nested: [{ proofUrl: "(imagen)" }],
      logo: null,
    });
  });
  it("conserva textos normales y omite before/after cuando no se envían", async () => {
    let stored: any;
    const db = {
      auditLog: {
        create: async (args: any) => {
          stored = args.data;
          return args.data;
        },
      },
    };
    await audit(db, actor, "note", "sale", "s1", undefined, {
      notes: "data: sin imagen",
    });
    expect(stored.before).toBeUndefined();
    expect(stored.after).toEqual({ notes: "data: sin imagen" });
  });
});

describe("D-M2 · tamaño del pool de Prisma explícito", () => {
  const base = "postgresql://u:p@db.example:5432/nexora";
  it("agrega connection_limit y pool_timeout cuando la URL no los trae", () => {
    const url = new URL(databaseUrlWithPool(base, {})!);
    expect(url.searchParams.get("connection_limit")).toBe(
      String(DEFAULT_POOL.connectionLimit),
    );
    expect(url.searchParams.get("pool_timeout")).toBe(
      String(DEFAULT_POOL.poolTimeout),
    );
    expect(url.username).toBe("u");
    expect(url.pathname).toBe("/nexora");
  });
  it("respeta lo que ya trae la URL y conserva options (TimeZone=UTC)", () => {
    const original =
      base + "?connection_limit=4&sslmode=require&options=-c%20TimeZone%3DUTC";
    const url = new URL(databaseUrlWithPool(original, {})!);
    expect(url.searchParams.get("connection_limit")).toBe("4");
    expect(url.searchParams.get("pool_timeout")).toBe(
      String(DEFAULT_POOL.poolTimeout),
    );
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("options")).toBe("-c TimeZone=UTC");
  });
  it("las variables NEXORA_DB_CONNECTION_LIMIT y NEXORA_DB_POOL_TIMEOUT cambian los valores", () => {
    const url = new URL(
      databaseUrlWithPool(base, {
        NEXORA_DB_CONNECTION_LIMIT: "6",
        NEXORA_DB_POOL_TIMEOUT: "30",
      })!,
    );
    expect(url.searchParams.get("connection_limit")).toBe("6");
    expect(url.searchParams.get("pool_timeout")).toBe("30");
  });
  it("ignora valores inválidos y no toca una URL vacía o ilegible", () => {
    const url = new URL(
      databaseUrlWithPool(base, {
        NEXORA_DB_CONNECTION_LIMIT: "0",
        NEXORA_DB_POOL_TIMEOUT: "abc",
      })!,
    );
    expect(url.searchParams.get("connection_limit")).toBe(
      String(DEFAULT_POOL.connectionLimit),
    );
    expect(url.searchParams.get("pool_timeout")).toBe(
      String(DEFAULT_POOL.poolTimeout),
    );
    expect(databaseUrlWithPool(undefined, {})).toBeUndefined();
    expect(databaseUrlWithPool("no es una url", {})).toBe("no es una url");
  });
});

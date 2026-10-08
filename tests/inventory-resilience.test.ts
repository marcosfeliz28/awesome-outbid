import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isSerializationConflict,
  lotIdentity,
  reconcileLotExpiry,
  retrySerializable,
} from "../apps/api/src/inventory-resilience";

describe("I1 · identidad canónica de lote", () => {
  it("unifica el código sin distinguir mayúsculas, espacios ni vencimiento", () => {
    expect(lotIdentity("  lote   abc  ", null)).toEqual(
      lotIdentity("LOTE ABC", undefined),
    );
    expect(lotIdentity(" lote abc ", null).lotNumberNormalized).toBe(
      "LOTE ABC",
    );
  });

  it("completa un vencimiento nulo y rechaza otro día para el mismo código", () => {
    const received = new Date("2030-01-01T04:00:00.000Z");
    expect(reconcileLotExpiry(null, received)).toEqual({
      conflict: false,
      expiryDate: received,
    });
    expect(
      reconcileLotExpiry(received, "2030-01-01T12:00:00.000Z").conflict,
    ).toBe(false);
    expect(
      reconcileLotExpiry(received, "2030-01-02T04:00:00.000Z").conflict,
    ).toBe(true);
  });

  it("trata como el mismo vencimiento las horas distintas del mismo día dominicano", () => {
    expect(
      reconcileLotExpiry("2030-01-01T12:00:00.000Z", "2030-01-02T03:59:59.000Z")
        .conflict,
    ).toBe(false);
  });

  it("la migración aborta fechas ambiguas y reescribe lotes usados por devoluciones", () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL(
          "../apps/api/prisma/migrations/202610140001_lot_identity/migration.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    expect(sql).toContain("count(DISTINCT");
    expect(sql).toContain("RAISE EXCEPTION");
    expect(sql).toContain('normalize("lotNumber", NFKC)');
    expect(sql).toContain('UPDATE "InventoryMovement"');
    expect(sql).toContain('UPDATE "SaleItem"');
    expect(sql).toContain("jsonb_set");
    expect(sql.indexOf('UPDATE "SaleItem"')).toBeLessThan(
      sql.indexOf('DELETE FROM "Lot"'),
    );
  });
});

describe("K1 · reintentos serializables acotados", () => {
  it("dos solicitudes recuperan un 40001/P2010 transitorio sin duplicar", async () => {
    let committed: { id: string } | undefined;
    let conflicts = 0;
    const request = async () =>
      retrySerializable(async () => {
        if (!committed) {
          if (!conflicts++) throw { code: "P2010", meta: { code: "40001" } };
          committed = { id: "recepcion-1" };
        }
        return committed;
      });
    const results = await Promise.all([request(), request()]);
    expect(results).toEqual([{ id: "recepcion-1" }, { id: "recepcion-1" }]);
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
  });

  it("se detiene al quinto conflicto y no reintenta errores de negocio", async () => {
    let attempts = 0;
    await expect(
      retrySerializable(async () => {
        attempts++;
        throw { code: "P2010", meta: { message: "SQLSTATE 40001" } };
      }),
    ).rejects.toMatchObject({ code: "P2010" });
    expect(attempts).toBe(5);
    expect(isSerializationConflict({ code: "P2034" })).toBe(true);

    attempts = 0;
    await expect(
      retrySerializable(async () => {
        attempts++;
        throw new Error("stock insuficiente");
      }),
    ).rejects.toThrow("stock insuficiente");
    expect(attempts).toBe(1);
  });
});

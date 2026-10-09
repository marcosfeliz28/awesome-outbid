import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clearLogoutCache,
  hasLogoutPending,
} from "../apps/web/src/logoutPrivacy";

function fixture(sales = 0, merchandise = 0) {
  const cache = new Map<string, any>([
    ["session", { user: { name: "Persona local" }, expiresAt: 999999 }],
    ["customers", [{ phone: "local-fixture" }]],
    ["catalog:main", [{ price: 100 }]],
    ["payments", [{ reference: "local-fixture" }]],
  ]);
  const db: any = {
    sales: { count: async () => sales },
    merchandise: { count: async () => merchandise },
    cache: {
      clear: async () => cache.clear(),
      put: async (row: any) => cache.set(row.key, row.data),
      update: async (key: string) => {
        if (cache.has(key)) cache.get(key).expiresAt = 0;
      },
    },
    transaction: async (
      _mode: string,
      _tables: any[],
      run: () => Promise<void>,
    ) => run(),
  };
  return { db, cache };
}

describe("G9 · limpieza al cerrar sesión", () => {
  it("elimina clientes, catálogo, pagos y sesión sin pendientes", async () => {
    const { db, cache } = fixture();
    await clearLogoutCache(db, true);
    expect(cache.size).toBe(0);
  });
  it("sin red conserva sólo un marcador vencido sin datos personales", async () => {
    const { db, cache } = fixture();
    await clearLogoutCache(db, false);
    expect([...cache]).toEqual([["session", { expiresAt: 0 }]]);
  });
  it.each([
    [1, 0],
    [0, 1],
  ])(
    "con pendientes preserva la cola y los datos de recuperación %i/%i",
    async (sales, merchandise) => {
      const { db, cache } = fixture(sales, merchandise);
      expect(await hasLogoutPending(db)).toBe(true);
      await clearLogoutCache(db, false);
      expect(cache.has("customers")).toBe(true);
      expect(cache.get("session").expiresAt).toBe(0);
      expect(await db.sales.count()).toBe(sales);
      expect(await db.merchandise.count()).toBe(merchandise);
    },
  );
  it("limpia el cache completo con protección de operaciones pendientes", () => {
    const source = readFileSync("apps/web/src/api.ts", "utf8");
    expect(
      source.includes("clearLogoutCache(localDB"),
      "endSession debe usar limpieza transaccional",
    ).toBe(true);
  });
});

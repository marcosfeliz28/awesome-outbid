// Blindaje del producto multiempresa (19-nov-2026): M3 candados por empresa y
// M5 sin tarifas de incentivo de la tienda. Sin base de datos.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultIncentiveRate, rateFor } from "../apps/api/src/incentives";
import { tenantLock, tenantScope } from "../apps/api/src/tenant-context";

const root = resolve(import.meta.dirname, "..");
const saved = process.env.PRODUCT_TENANCY;
afterEach(() => {
  if (saved === undefined) delete process.env.PRODUCT_TENANCY;
  else process.env.PRODUCT_TENANCY = saved;
});

describe("M3: candados de aviso por empresa", () => {
  it("en modo producto la clave lleva la empresa; la tienda conserva la suya", () => {
    delete process.env.PRODUCT_TENANCY;
    expect(tenantLock("nexora-inventory-import")).toBe(
      "nexora-inventory-import",
    );
    process.env.PRODUCT_TENANCY = "required";
    const a = tenantScope.run({ tenantId: "a" }, () =>
      tenantLock("main:cash-open"),
    );
    const b = tenantScope.run({ tenantId: "b" }, () =>
      tenantLock("main:cash-open"),
    );
    expect(a).toBe("a:main:cash-open");
    expect(b).toBe("b:main:cash-open");
    expect(() => tenantLock("x")).toThrow(/contexto de empresa/);
  });

  it("ningún candado global queda sin empresa en importación, alertas, caja e incentivos", () => {
    const src = (file: string) =>
      readFileSync(join(root, "apps/api/src", file), "utf8");
    for (const [file, pattern] of [
      [
        "inventory-import-core.ts",
        /pg_try_advisory_xact_lock\(hashtext\(\$\{tenantLock\("nexora-inventory-import"\)\}\)\)/,
      ],
      [
        "inventory-import.ts",
        /pg_advisory_xact_lock\(hashtext\(\$\{tenantLock\("nexora-inventory-import"\)\}\)\)/,
      ],
      [
        "alerts.ts",
        /pg_advisory_xact_lock\(hashtext\(\$\{tenantLock\("fitstore:alert-engine"\)\}\)\)/,
      ],
      [
        "cash.ts",
        /hashtext\(\$\{tenantLock\(actor\.branchId \+ ":cash-open"\)\}\)/,
      ],
      [
        "incentives.ts",
        /pg_advisory_xact_lock\(7301, hashtext\(\$\{tenantLock\(branchId\)\}\)\)/,
      ],
      [
        "incentives.ts",
        /pg_advisory_xact_lock_shared\(7301, hashtext\(\$\{tenantLock\(branchId\)\}\)\)/,
      ],
    ] as const)
      expect(src(file), file).toMatch(pattern);
    expect(src("inventory-import-core.ts")).not.toContain(
      "hashtext('nexora-inventory-import')",
    );
    expect(src("alerts.ts")).not.toContain("hashtext('fitstore:alert-engine')");
  });
});

describe("M5: incentivos sin tarifas de la tienda en modo producto", () => {
  it("defaultIncentiveRate devuelve 0 por nombre de categoría; la configurada sigue mandando", () => {
    expect(defaultIncentiveRate("Maquillaje")).toBe(25); // tienda
    process.env.PRODUCT_TENANCY = "required";
    for (const name of ["Suplementos", "Fajas", "Maquillaje", "faja"])
      expect(defaultIncentiveRate(name), name).toBe(0);
    expect(rateFor({ id: "m", name: "Maquillaje" }, [])).toBe(0);
    expect(
      rateFor({ id: "m", name: "Maquillaje" }, [
        { categoryId: "m", amount: "12" },
      ]),
    ).toBe(12);
  });
});

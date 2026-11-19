import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { branchDocumentNumber, nextBranchId } from "../apps/api/src/branches";

const sql = readFileSync(
  "apps/api/prisma/migrations/202611190001_branches/migration.sql",
  "utf8",
);
const sales = readFileSync("apps/api/src/sales.ts", "utf8");

describe("sucursales: numeración y códigos", () => {
  it("la principal conserva FS-0000001 y las demás llevan su código", () => {
    expect(branchDocumentNumber("FS", "main", 1, 7)).toBe("FS-0000001");
    expect(branchDocumentNumber("NC", "main", 42, 6)).toBe("NC-000042");
    expect(branchDocumentNumber("FS", "s2", 1, 7)).toBe("FS-S2-0000001");
    expect(branchDocumentNumber("FS", "s2", 1, 7)).not.toBe(
      branchDocumentNumber("FS", "main", 1, 7),
    );
  });
  it("la caja usa la numeración por sucursal en facturas y devoluciones", () => {
    expect(sales).toContain(
      'branchDocumentNumber("FS", actor.branchId, counter.value, 7)',
    );
    expect(sales).toContain(
      'branchDocumentNumber("NC", actor.branchId, counter.value, 6)',
    );
    expect(sales).not.toMatch(/"FS-" \+ String/);
  });
  it("da el primer código libre sin reutilizar uno existente", () => {
    expect(nextBranchId(["main"])).toBe("s2");
    expect(nextBranchId(["main", "s2"])).toBe("s3");
    expect(nextBranchId(["main", "s3"])).toBe("s2");
  });
});

describe("sucursales: migración", () => {
  it("crea Branch con RLS por empresa, clave única por empresa y relleno idempotente", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "Branch"/);
    expect(sql).toMatch(/PRIMARY KEY \("tenantId", "id"\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(
      /CREATE POLICY tenant_isolation ON "Branch" TO nexora_tenant_runtime/,
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON "Branch" TO nexora_tenant_runtime/,
    );
    expect(sql).toMatch(/ON CONFLICT \("tenantId", "id"\) DO NOTHING/);
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE FROM|TRUNCATE|DROP TABLE)\s/m);
  });
});

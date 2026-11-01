import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pieza 25 (orden 105): índices para consultas de reportes. Cada índice debe
// estar en schema.prisma (dentro de su modelo) y en la migración aditiva.
const root = join(__dirname, "..");
const schema = readFileSync(join(root, "apps/api/prisma/schema.prisma"), "utf8");
const migrationsDir = join(root, "apps/api/prisma/migrations");
const migrationFolder = readdirSync(migrationsDir).find((d) => d.endsWith("_pq25_indices"));
const migrationSql = migrationFolder
  ? readFileSync(join(migrationsDir, migrationFolder, "migration.sql"), "utf8")
  : "";

function modelBlock(model: string): string {
  const start = schema.indexOf(`model ${model} {`);
  if (start < 0) return "";
  const end = schema.indexOf("\n}", start);
  return schema.slice(start, end);
}

const indices = [
  { model: "Sale", table: "Sale", cols: ["branchId", "status", "createdAt"] },
  { model: "SaleReturn", table: "SaleReturn", cols: ["branchId", "createdAt"] },
  { model: "Payment", table: "Payment", cols: ["entryType", "createdAt"] },
  { model: "CashSession", table: "CashSession", cols: ["branchId", "openedAt"] },
].map((i) => ({
  ...i,
  name: `${i.table}_${i.cols.join("_")}_idx`,
  attr: `@@index([${i.cols.join(", ")}])`,
  sql: `CREATE INDEX IF NOT EXISTS "${i.table}_${i.cols.join("_")}_idx" ON "${i.table}"(${i.cols.map((c) => `"${c}"`).join(", ")});`,
}));

describe("PQ-25 índices de reportes", () => {
  it("existe la carpeta de migración *_pq25_indices", () => {
    expect(migrationFolder).toBeDefined();
  });

  for (const idx of indices) {
    it(`${idx.model}: @@index en schema.prisma (${idx.name})`, () => {
      expect(modelBlock(idx.model)).toContain(idx.attr);
    });

    it(`${idx.model}: CREATE INDEX IF NOT EXISTS en la migración`, () => {
      expect(migrationSql).toContain(idx.sql);
    });
  }

  it("la migración no usa CONCURRENTLY (Prisma la ejecuta en transacción)", () => {
    expect(migrationSql.toUpperCase()).not.toContain("CONCURRENTLY");
  });
});

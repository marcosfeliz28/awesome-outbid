import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

const carpeta = readdirSync("apps/api/prisma/migrations").find((n) =>
  n.endsWith("_change_requests"),
);
const sql = carpeta
  ? readFileSync(`apps/api/prisma/migrations/${carpeta}/migration.sql`, "utf8")
  : "";

it("la migración de ChangeRequest existe y copia el aislamiento por empresa", () => {
  expect(carpeta).toBeTruthy();
  expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "ChangeRequest"/);
  expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
  expect(sql).toMatch(/CREATE POLICY tenant_isolation ON "ChangeRequest"/);
  expect(sql).toMatch(/nexora_check_tenant_fk\('User', 'id', 'userId'\)/);
  expect(sql).toMatch(/nexora_assign_tenant/);
  expect(sql).toMatch(
    /GRANT SELECT, INSERT, UPDATE, DELETE ON "ChangeRequest" TO nexora_tenant_runtime/,
  );
});

it("la base también limita título, descripción y estado", () => {
  expect(sql).toMatch(/CHECK \(char_length\("title"\) BETWEEN 3 AND 120\)/);
  expect(sql).toMatch(
    /CHECK \(char_length\("description"\) BETWEEN 10 AND 2000\)/,
  );
  expect(sql).toMatch(/'abierto', 'en_proceso', 'resuelto'/);
});

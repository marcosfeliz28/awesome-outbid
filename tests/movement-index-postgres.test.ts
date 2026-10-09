import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";

it("Menor-indices: índices por sucursal y fecha se aplican dos veces sobre datos existentes", async () => {
  const sql = await readFile(
    "apps/api/prisma/migrations/202610160005_inventory_branch_date_indexes/migration.sql",
    "utf8",
  ).catch((error) => {
    if (error.code === "ENOENT") return "SELECT 1";
    throw error;
  });
  const directory = await mkdtemp(join(tmpdir(), "nexora-movement-index-"));
  const database = new EmbeddedPostgres({
    databaseDir: directory,
    user: "qa_index",
    password: "local_disposable_only",
    port: 55603,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  let client: any;
  try {
    await database.initialise();
    await database.start();
    await database.createDatabase("nexora_index");
    client = database.getPgClient("nexora_index", "127.0.0.1");
    await client.connect();
    for (const table of ["InventoryMovement", "GoodsReceipt"]) {
      await client.query(
        `CREATE TABLE "${table}" (id text PRIMARY KEY, "branchId" text NOT NULL, "createdAt" timestamp NOT NULL)`,
      );
      await client.query(
        `INSERT INTO "${table}" VALUES ('a','main','2026-01-01'),('b','main','2026-01-01'),('c','secondary','2026-01-01')`,
      );
    }
    await client.query(sql);
    await client.query(sql);
    const indexes = await client.query(
      `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('InventoryMovement_branchId_createdAt_idx','GoodsReceipt_branchId_createdAt_idx') ORDER BY indexname`,
    );
    expect(indexes.rows).toHaveLength(2);
    for (const row of indexes.rows) {
      expect(row.indexdef).toContain('("branchId", "createdAt")');
      expect(row.indexdef).not.toContain("UNIQUE");
    }
    for (const table of ["InventoryMovement", "GoodsReceipt"]) {
      expect(
        (await client.query(`SELECT count(*)::int AS count FROM "${table}"`))
          .rows[0].count,
      ).toBe(3);
      await client.query("SET enable_seqscan=off");
      const plan = await client.query(
        `EXPLAIN SELECT * FROM "${table}" WHERE "branchId"='main' AND "createdAt">='2026-01-01' ORDER BY "createdAt"`,
      );
      expect(JSON.stringify(plan.rows)).toContain(
        table + "_branchId_createdAt_idx",
      );
    }
  } finally {
    await client?.end();
    await database.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}, 120000);

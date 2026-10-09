import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migrationPath =
  "apps/api/prisma/migrations/202610160004_variant_codes_case_insensitive/migration.sql";
let database: EmbeddedPostgres;
let directory: string;
let client: any;
let migration = "";
describe("K2 · índices de códigos en PostgreSQL real", () => {
  beforeAll(async () => {
    // Para capturar la regresión antes de implementar: sin migración, el estado
    // previo acepta códigos que sólo cambian de mayúsculas.
    migration = await readFile(migrationPath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "SELECT 1";
      throw error;
    });
    directory = await mkdtemp(join(tmpdir(), "nexora-k2-"));
    database = new EmbeddedPostgres({
      databaseDir: directory,
      user: "qa_k2",
      password: "local_disposable_only",
      port: 55601,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase("nexora_k2");
    client = database.getPgClient("nexora_k2", "127.0.0.1");
    await client.connect();
  }, 120000);
  beforeEach(async () => {
    await client.query('DROP TABLE IF EXISTS "Variant"');
    // Las restricciones y el alcance global son los del schema.prisma real.
    await client.query(
      'CREATE TABLE "Variant" (id text PRIMARY KEY, sku text UNIQUE NOT NULL, barcode text UNIQUE NOT NULL, "branchId" text NOT NULL DEFAULT \'main\')',
    );
  });
  afterAll(async () => {
    await client?.end();
    await database?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it("códigos limpios quedan protegidos incluso entre sucursales; reaplicar es inocuo", async () => {
    await client.query(
      `INSERT INTO "Variant" (id,sku,barcode) VALUES ('a','ABC','BAR')`,
    );
    await client.query(migration);
    await client.query(migration);
    await expect(
      client.query(
        `INSERT INTO "Variant" (id,sku,barcode,"branchId") VALUES ('b','abc','other','secondary')`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      client.query(
        `INSERT INTO "Variant" (id,sku,barcode) VALUES ('c','other','bar')`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect(
      (await client.query('SELECT count(*)::int AS count FROM "Variant"'))
        .rows[0].count,
    ).toBe(1);
  });
  it("SKU hostiles se conservan y no impiden crear el índice de barras", async () => {
    await client.query(
      `INSERT INTO "Variant" (id,sku,barcode) VALUES ('a','ABC','BAR1'),('b','abc','BAR2')`,
    );
    const notices: string[] = [];
    const handler = (notice: any) => notices.push(notice.message);
    client.on("notice", handler);
    try {
      await client.query(migration);
      await client.query(migration);
    } finally {
      client.removeListener("notice", handler);
    }
    expect(notices.join("\n")).toContain("SKU duplicados");
    expect(
      (await client.query('SELECT count(*)::int AS count FROM "Variant"'))
        .rows[0].count,
    ).toBe(2);
    await expect(
      client.query(
        `INSERT INTO "Variant" (id,sku,barcode) VALUES ('c','NEW','bar1')`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
  it("barras hostiles se conservan y no impiden crear el índice SKU", async () => {
    await client.query(
      `INSERT INTO "Variant" (id,sku,barcode) VALUES ('a','SKU1','BAR'),('b','SKU2','bar')`,
    );
    const notices: string[] = [];
    const handler = (notice: any) => notices.push(notice.message);
    client.on("notice", handler);
    try {
      await client.query(migration);
      await client.query(migration);
    } finally {
      client.removeListener("notice", handler);
    }
    expect(notices.join("\n")).toContain("códigos de barras duplicados");
    expect(
      (await client.query('SELECT count(*)::int AS count FROM "Variant"'))
        .rows[0].count,
    ).toBe(2);
    await expect(
      client.query(
        `INSERT INTO "Variant" (id,sku,barcode) VALUES ('c','sku1','NEW')`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});

import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";

const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Sin puerto para PostgreSQL de pruebas."));
      } else server.close(() => resolve(address.port));
    });
  });

describe("objetos del producto · migraciones verificables en CI", () => {
  it("valida las restricciones NOT VALID posteriores a la migración general", () => {
    const root = "apps/api/prisma/migrations";
    const sql = readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && entry.name > "202610280007_product_objects",
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) =>
        readFileSync(`${root}/${entry.name}/migration.sql`, "utf8"),
      )
      .join("\n");
    expect(sql).toMatch(
      /VALIDATE CONSTRAINT "InvoiceAttachment_object_location"/,
    );
    expect(sql).toMatch(/VALIDATE CONSTRAINT "BillingRequest_proof_location"/);
  });

  it("valida una base limpia y no aborta sobre filas históricas incompatibles", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-object-check-"));
    const port = await freePort();
    const server = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    let started = false;
    try {
      await server.initialise();
      await server.start();
      started = true;
      const db = new Client({
        connectionString: `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/postgres`,
      });
      await db.connect();
      try {
        const migration = await readFile(
          "apps/api/prisma/migrations/202610280016_validate_product_objects/migration.sql",
          "utf8",
        );
        for (const [schema, hostile] of [
          ["clean_case", false],
          ["legacy_case", true],
        ] as const) {
          await db.query(`CREATE SCHEMA ${schema}`);
          await db.query(`SET search_path TO ${schema}`);
          await db.query(
            'CREATE TABLE "InvoiceAttachment" (data bytea, "objectKey" text)',
          );
          await db.query(
            'CREATE TABLE "BillingRequest" (proof text, "proofObjectKey" text)',
          );
          if (hostile) {
            await db.query('INSERT INTO "InvoiceAttachment" DEFAULT VALUES');
          }
          await db.query(`ALTER TABLE "InvoiceAttachment"
            ADD CONSTRAINT "InvoiceAttachment_object_location"
            CHECK ((data IS NOT NULL AND "objectKey" IS NULL)
              OR (data IS NULL AND "objectKey" IS NOT NULL)) NOT VALID`);
          await db.query(`ALTER TABLE "BillingRequest"
            ADD CONSTRAINT "BillingRequest_proof_location"
            CHECK (proof IS NULL OR "proofObjectKey" IS NULL) NOT VALID`);
          await expect(db.query(migration)).resolves.toBeDefined();
          await expect(db.query(migration)).resolves.toBeDefined();
          const state = await db.query(
            `SELECT conname, convalidated
            FROM pg_constraint WHERE connamespace = $1::regnamespace
              AND conname IN ('InvoiceAttachment_object_location',
                'BillingRequest_proof_location')`,
            [schema],
          );
          expect(
            Object.fromEntries(
              state.rows.map((row: any) => [row.conname, row.convalidated]),
            ),
          ).toEqual({
            InvoiceAttachment_object_location: !hostile,
            BillingRequest_proof_location: true,
          });
        }
      } finally {
        await db.end();
      }
    } finally {
      if (started) await server.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 45_000);
});

import { readFile, mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removeTemporaryDirectory } from "./temp-cleanup";

const migrationPath = resolve(
  "apps/api/prisma/migrations/202610260001_repair_auth_attempt_retention/migration.sql",
);
const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar el puerto de PostgreSQL."));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });

describe("D-01 · migración de reparación de AuthAttempt", () => {
  let dir = "";
  let database: InstanceType<typeof EmbeddedPostgres>;
  let client: any;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "nexora-auth-attempt-migration-"));
    database = new EmbeddedPostgres({
      databaseDir: dir,
      user: "nexora_test",
      password: "nexora_test_only",
      port: await freePort(),
      // Keep cleanup under the retry helper; embedded-postgres itself calls
      // fs.rm without retries when persistent is false.
      persistent: true,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase("nexora_auth_migration");
    client = database.getPgClient("nexora_auth_migration", "127.0.0.1");
    await client.connect();
  }, 120_000);

  afterAll(async () => {
    try {
      if (client) await client.end();
    } finally {
      try {
        if (database) await database.stop();
      } finally {
        if (dir) await removeTemporaryDirectory(dir);
      }
    }
  }, 120_000);

  it("repara una columna ausente y es idempotente; el trigger mantiene la fecha", async () => {
    const migration = await readFile(migrationPath, "utf8");
    await client.query(
      'CREATE TABLE "AuthAttempt" (key text PRIMARY KEY, "failedAttempts" integer NOT NULL DEFAULT 0, "lockedUntil" timestamp(3), "windowStartedAt" timestamp(3))',
    );
    await client.query(
      'INSERT INTO "AuthAttempt" (key) VALUES (\'login:missing:fixture\')',
    );

    await client.query(migration);
    await client.query(migration);

    const column = await client.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'AuthAttempt'
          AND column_name = 'updatedAt'`,
    );
    expect(column.rows[0].is_nullable).toBe("NO");
    expect(column.rows[0].column_default).toContain("CURRENT_TIMESTAMP");

    const original = await client.query(
      'SELECT "updatedAt" FROM "AuthAttempt" WHERE key = \'login:missing:fixture\'',
    );
    await client.query("SELECT pg_sleep(0.01)");
    await client.query(
      'UPDATE "AuthAttempt" SET "failedAttempts" = 1 WHERE key = \'login:missing:fixture\'',
    );
    const touched = await client.query(
      'SELECT "updatedAt" FROM "AuthAttempt" WHERE key = \'login:missing:fixture\'',
    );
    expect(touched.rows[0].updatedAt.getTime()).toBeGreaterThan(
      original.rows[0].updatedAt.getTime(),
    );
    const trigger = await client.query(
      `SELECT t.tgtype, p.proname AS function_name FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
       WHERE c.relname = 'AuthAttempt' AND t.tgname = 'auth_attempt_touch'
         AND n.nspname = current_schema() AND pn.nspname = current_schema()
         AND NOT t.tgisinternal`,
    );
    expect(trigger.rows).toEqual([
      { tgtype: 23, function_name: "nexora_touch_auth_attempt" },
    ]);
    await client.query('DROP TRIGGER auth_attempt_touch ON "AuthAttempt"');
    await client.query(`CREATE FUNCTION wrong_auth_attempt_trigger() RETURNS trigger
      LANGUAGE plpgsql AS $body$ BEGIN RETURN NEW; END $body$`);
    await client.query(`CREATE TRIGGER auth_attempt_touch AFTER UPDATE ON "AuthAttempt"
      FOR EACH ROW EXECUTE FUNCTION wrong_auth_attempt_trigger()`);
    await client.query('ALTER TABLE "AuthAttempt" ALTER COLUMN "updatedAt" DROP NOT NULL');
    await client.query('UPDATE "AuthAttempt" SET "updatedAt" = NULL');
    await client.query(migration);
    const repairedColumn = await client.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'AuthAttempt'
          AND column_name = 'updatedAt'`,
    );
    expect(repairedColumn.rows[0].is_nullable).toBe("NO");
    const repairedTrigger = await client.query(
      `SELECT t.tgtype, p.proname AS function_name
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_proc p ON p.oid = t.tgfoid
         JOIN pg_namespace pn ON pn.oid = p.pronamespace
        WHERE n.nspname = current_schema() AND pn.nspname = current_schema()
          AND c.relname = 'AuthAttempt' AND t.tgname = 'auth_attempt_touch'
          AND NOT t.tgisinternal`,
    );
    expect(repairedTrigger.rows).toEqual([
      { tgtype: 23, function_name: "nexora_touch_auth_attempt" },
    ]);
  });
});

import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { expect, it } from "vitest";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto de prueba");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("N-22: migración PostgreSQL conserva el formato de ventas ya emitidas y permite instantáneas nuevas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "n22-locale-"));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "n22_test",
    password: "local_test_only",
    port: await freePort(),
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  let client: ReturnType<typeof pg.getPgClient> | undefined;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("n22_qa");
    client = pg.getPgClient("n22_qa", "127.0.0.1");
    await client.connect();
    await client.query('CREATE TABLE "Sale" (id integer PRIMARY KEY)');
    await client.query('INSERT INTO "Sale" (id) VALUES (1)');
    const sql = await readFile(resolve("apps/api/prisma/migrations/202610280017_sale_locale_snapshot/migration.sql"), "utf8");
    await client.query(sql);
    await client.query(sql); // desplegar dos veces no reescribe las ventas.
    await client.query('INSERT INTO "Sale" (id, "receiptCurrency", "receiptTimeZone") VALUES (2, $1, $2)',
      ["USD", "America/Los_Angeles"]);
    const rows = await client.query('SELECT id, "receiptCurrency", "receiptTimeZone" FROM "Sale" ORDER BY id');
    expect(rows.rows).toEqual([
      { id: 1, receiptCurrency: "DOP", receiptTimeZone: "America/Santo_Domingo" },
      { id: 2, receiptCurrency: "USD", receiptTimeZone: "America/Los_Angeles" },
    ]);
  } finally {
    await client?.end().catch(() => undefined);
    await pg.stop().catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  }
}, 120_000);

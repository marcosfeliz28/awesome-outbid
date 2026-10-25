// Pago en dólares (25-oct): la migración se aplica sobre una base con pagos
// existentes sin tocar sus importes; quedan como «DOP» y sin dólares.
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { expect, it } from "vitest";

const MIGRATION = "202610250301_pago_dolares";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaDir = join(root, "apps/api/prisma");
const requireApi = createRequire(join(root, "apps/api/package.json"));
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("Sin puerto"));
      server.close(() => resolvePort(address.port));
    });
  });

it("migra una base con pagos sin cambiar sus importes y deja los pagos como DOP", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-usd-db-"));
  const projectDir = await mkdtemp(join(tmpdir(), "nexora-usd-schema-"));
  const port = await freePort();
  const database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "usd_test",
    password: "usd_test_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  let client: any;
  try {
    await database.initialise();
    await database.start();
    await database.createDatabase("usd_qa");
    const url = `postgresql://usd_test:usd_test_only@127.0.0.1:${port}/usd_qa`;
    const oldDir = join(projectDir, "old");
    const migrations = join(oldDir, "migrations");
    await mkdir(migrations, { recursive: true });
    await cp(join(prismaDir, "schema.prisma"), join(oldDir, "schema.prisma"));
    await cp(
      join(prismaDir, "migrations/migration_lock.toml"),
      join(migrations, "migration_lock.toml"),
    );
    for (const name of await readdir(join(prismaDir, "migrations")))
      if (name < MIGRATION && name !== "migration_lock.toml")
        await cp(join(prismaDir, "migrations", name), join(migrations, name), {
          recursive: true,
        });
    const migrate = (schema: string) =>
      run(
        process.execPath,
        [prismaCli, "migrate", "deploy", "--schema", schema],
        {
          cwd: root,
          env: { ...process.env, DATABASE_URL: url },
          timeout: 120000,
        },
      );
    await migrate(join(oldDir, "schema.prisma"));
    client = database.getPgClient("usd_qa", "127.0.0.1");
    await client.connect();
    const sale = "20000000-0000-4000-8000-000000000001";
    await client.query(
      `INSERT INTO "Sale" (id, number, "offlineUuid", "sellerId", subtotal, "discountTotal", "taxTotal", total, "costTotal", "updatedAt") VALUES ($1, 'FS-USD-QA', $1, $1, 2500, 0, 0, 2500, 1000, NOW())`,
      [sale],
    );
    await client.query(
      `INSERT INTO "Payment" (id, "saleId", method, amount, tendered, change) VALUES
        ('20000000-0000-4000-8000-000000000002', $1, 'cash', 2456.63, 2456.63, 0),
        ('20000000-0000-4000-8000-000000000003', $1, 'cash', 43.37, 100, 56.63)`,
      [sale],
    );
    const read = async () =>
      (
        await client.query(
          `SELECT * FROM "Payment" WHERE "saleId"=$1 ORDER BY id`,
          [sale],
        )
      ).rows;
    const before = await read();
    const migration = await migrate(join(prismaDir, "schema.prisma"));
    expect(migration.stdout).toContain(MIGRATION);
    const after = await read();
    expect(
      after.map((p: any) => [p.id, p.amount, p.tendered, p.change]),
    ).toEqual(before.map((p: any) => [p.id, p.amount, p.tendered, p.change]));
    expect(after.map((p: any) => [p.currency, p.amountUsd, p.usdRate])).toEqual(
      [
        ["DOP", null, null],
        ["DOP", null, null],
      ],
    );
    // Un pago en dólares exige efectivo, US$ y tasa.
    await expect(
      client.query(
        `UPDATE "Payment" SET currency='USD' WHERE id='20000000-0000-4000-8000-000000000002'`,
      ),
    ).rejects.toThrow();
    await client.query(
      `UPDATE "Payment" SET currency='USD', "amountUsd"=40, "usdRate"=61.4158 WHERE id='20000000-0000-4000-8000-000000000002'`,
    );
    // Volver a aplicar no hace nada.
    await migrate(join(prismaDir, "schema.prisma"));
  } finally {
    await client?.end().catch(() => undefined);
    await database.stop().catch(() => undefined);
    const retry = {
      recursive: true,
      force: true,
      maxRetries: 12,
      retryDelay: 250,
    };
    await rm(dataDir, retry);
    await rm(projectDir, retry);
  }
}, 120000);

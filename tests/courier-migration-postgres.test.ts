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

it("migra una base con ventas sin alterar total, costo, impuestos ni importe de caja", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-courier-db-"));
  const projectDir = await mkdtemp(join(tmpdir(), "nexora-courier-schema-"));
  const port = await freePort();
  const database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "courier_test",
    password: "courier_test_only",
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
    await database.createDatabase("courier_qa");
    const url = `postgresql://courier_test:courier_test_only@127.0.0.1:${port}/courier_qa`;
    const oldDir = join(projectDir, "old");
    const migrations = join(oldDir, "migrations");
    await mkdir(migrations, { recursive: true });
    await cp(join(prismaDir, "schema.prisma"), join(oldDir, "schema.prisma"));
    await cp(
      join(prismaDir, "migrations/migration_lock.toml"),
      join(migrations, "migration_lock.toml"),
    );
    for (const name of await readdir(join(prismaDir, "migrations")))
      if (name < "202610250001_courier_fee" && name !== "migration_lock.toml")
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
    client = database.getPgClient("courier_qa", "127.0.0.1");
    await client.connect();
    const id = "10000000-0000-4000-8000-000000000001";
    await client.query(
      `INSERT INTO "Sale" (id, number, "offlineUuid", "sellerId", subtotal, "discountTotal", "taxTotal", total, "costTotal", "updatedAt") VALUES ($1, 'FS-COURIER-QA', $1, $1, 15550, 0, 0, 15550, 5000, NOW())`,
      [id],
    );
    const before = (
      await client.query(
        `SELECT total, "costTotal", "taxTotal" FROM "Sale" WHERE id=$1`,
        [id],
      )
    ).rows[0];
    const migration = await migrate(join(prismaDir, "schema.prisma"));
    expect(migration.stdout).toContain("202610250001_courier_fee");
    const after = (
      await client.query(
        `SELECT total, "costTotal", "taxTotal", "courierFee", "courierPaidAt" FROM "Sale" WHERE id=$1`,
        [id],
      )
    ).rows[0];
    expect([after.total, after.costTotal, after.taxTotal]).toEqual([
      before.total,
      before.costTotal,
      before.taxTotal,
    ]);
    expect(after.courierFee).toBe("0.00");
    expect(after.courierPaidAt).toBeNull();
    await expect(
      client.query(`UPDATE "Sale" SET "courierFee"=-1 WHERE id=$1`, [id]),
    ).rejects.toThrow();
    await migrate(join(prismaDir, "schema.prisma"));
  } finally {
    await client?.end().catch(() => undefined);
    // stop() espera a que salga postgres; en Windows los archivos pueden
    // seguir bloqueados un momento (EBUSY, Q-04): rm reintenta.
    await database.stop().catch(() => undefined);
    const retry = {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    };
    await rm(dataDir, retry);
    await rm(projectDir, retry);
  }
}, 120000);

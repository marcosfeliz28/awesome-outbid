// Migración 202611060001_gv_gerente_rol: crea el rol gerente_gv con permisos
// exactos, es idempotente y no pisa una edición posterior de la dueña.
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
import { permissions } from "../packages/shared/src/index";

const MIGRATION = "202611060001_gv_gerente_rol";
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

it("la migración crea gerente_gv exacto, idempotente y sin pisar ediciones", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-gv-db-"));
  const projectDir = await mkdtemp(join(tmpdir(), "nexora-gv-schema-"));
  const port = await freePort();
  const database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "gv_test",
    password: "gv_test_only",
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
    await database.createDatabase("gv_qa");
    const url = `postgresql://gv_test:gv_test_only@127.0.0.1:${port}/gv_qa`;
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
    client = database.getPgClient("gv_qa", "127.0.0.1");
    await client.connect();
    // Una gerente_gv con datos propios no se toca: DO NOTHING.
    const before = (await client.query(`SELECT count(*)::int AS n FROM "Role"`))
      .rows[0].n;
    const migration = await migrate(join(prismaDir, "schema.prisma"));
    expect(migration.stdout).toContain(MIGRATION);
    const roles = (
      await client.query(
        `SELECT name, permissions FROM "Role" WHERE name = 'gerente_gv'`,
      )
    ).rows;
    expect(roles).toEqual([
      {
        name: "gerente_gv",
        permissions: ["gv:read", "gv:reports", "gv:verify"],
      },
    ]);
    expect(
      (await client.query(`SELECT count(*)::int AS n FROM "Role"`)).rows[0].n,
    ).toBe(before + 1);
    expect(permissions.gerente_gv).toEqual(roles[0].permissions);
    await client.query(
      `UPDATE "Role" SET permissions = ARRAY['gv:read'] WHERE name = 'gerente_gv'`,
    );
    // Volver a aplicar no hace nada ni pisa la edición.
    await migrate(join(prismaDir, "schema.prisma"));
    expect(
      (
        await client.query(
          `SELECT permissions FROM "Role" WHERE name = 'gerente_gv'`,
        )
      ).rows[0].permissions,
    ).toEqual(["gv:read"]);
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

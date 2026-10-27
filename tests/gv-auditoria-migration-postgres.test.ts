// Migración de la auditoría GV (202610260903_gv_auditoria): sobre una base
// con datos que la versión anterior de GV permitía, no aborta, deja las
// restricciones NOT VALID donde hay filas viejas y fija el rol gv.
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

const MIGRATION = "202610260903_gv_auditoria";
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

it("aplica la migración de la auditoría GV sobre datos de la versión anterior sin abortar", async () => {
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
    // Datos que la versión anterior permitía: transferencia sin referencia
    // y un rol «gv» con permisos de más.
    await client.query(
      `INSERT INTO "Role" (id, name, permissions, "updatedAt") VALUES (gen_random_uuid(), 'manager', ARRAY['catalog:read'], NOW()) ON CONFLICT (name) DO NOTHING`,
    );
    await client.query(
      `UPDATE "Role" SET permissions = ARRAY['gv:read','gv:write','gv:reports','*'] WHERE name = 'gv'`,
    );
    const course = "30000000-0000-4000-8000-000000000001";
    const enrollment = "30000000-0000-4000-8000-000000000002";
    await client.query(
      `INSERT INTO "GvCourse" (id, name, type, date, price, capacity, "createdBy", "updatedAt") VALUES ($1, 'QA', 'otro', '2026-10-01', 1000, 5, 'qa', NOW())`,
      [course],
    );
    await client.query(
      `INSERT INTO "GvEnrollment" (id, "courseId", "clientName", "agreedPrice", "createdBy", "updatedAt") VALUES ($1, $2, 'QA', 1000, 'qa', NOW())`,
      [enrollment, course],
    );
    await client.query(
      `INSERT INTO "GvPayment" (id, "enrollmentId", date, amount, concept, method, verified, "createdBy") VALUES ('30000000-0000-4000-8000-000000000003', $1, '2026-10-01', 500, 'separo', 'transferencia', false, 'qa')`,
      [enrollment],
    );
    const migration = await migrate(join(prismaDir, "schema.prisma"));
    expect(migration.stdout).toContain(MIGRATION);
    // La fila antigua sigue; la restricción queda NOT VALID y rige para nuevas.
    const checks = (
      await client.query(
        `SELECT conname, convalidated FROM pg_constraint WHERE conname LIKE 'gv_payment_%' ORDER BY conname`,
      )
    ).rows;
    expect(checks).toContainEqual({
      conname: "gv_payment_transfer_details",
      convalidated: false,
    });
    expect(checks).toContainEqual({
      conname: "gv_payment_review_exclusive",
      convalidated: true,
    });
    await expect(
      client.query(
        `INSERT INTO "GvPayment" (id, "enrollmentId", date, amount, concept, method, verified, "createdBy") VALUES ('30000000-0000-4000-8000-000000000004', $1, '2026-10-02', 100, 'restante', 'transferencia', false, 'qa')`,
        [enrollment],
      ),
    ).rejects.toThrow();
    const roles = (
      await client.query(
        `SELECT name, permissions FROM "Role" WHERE name IN ('gv','manager') ORDER BY name`,
      )
    ).rows;
    expect(roles).toEqual([
      { name: "gv", permissions: ["gv:read", "gv:write", "gv:reports"] },
      { name: "manager", permissions: ["catalog:read", "gv:verify"] },
    ]);
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

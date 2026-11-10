// Migraciones aditivas de la auditoría de intrusión (10-nov): marcas por
// sucursal y numeración de facturas/devoluciones única por sucursal.
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

const MARCAS = "202611100001_marca_por_sucursal";
const NUMERACION = "202611100002_numeracion_por_sucursal";
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

it("Brand: antes global, después única por (sucursal, nombre) sin tocar filas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-s10-db-"));
  const projectDir = await mkdtemp(join(tmpdir(), "nexora-s10-schema-"));
  const port = await freePort();
  const database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "s10_test",
    password: "s10_test_only",
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
    await database.createDatabase("s10_qa");
    const url = `postgresql://s10_test:s10_test_only@127.0.0.1:${port}/s10_qa`;
    const oldDir = join(projectDir, "old");
    const migrations = join(oldDir, "migrations");
    await mkdir(migrations, { recursive: true });
    await cp(join(prismaDir, "schema.prisma"), join(oldDir, "schema.prisma"));
    await cp(
      join(prismaDir, "migrations/migration_lock.toml"),
      join(migrations, "migration_lock.toml"),
    );
    for (const name of await readdir(join(prismaDir, "migrations")))
      if (name < MARCAS && name !== "migration_lock.toml")
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
    client = database.getPgClient("s10_qa", "127.0.0.1");
    await client.connect();

    // Hallazgo: con el esquema anterior la misma marca en dos sucursales choca.
    await client.query(
      `INSERT INTO "Brand"(id, name) VALUES (gen_random_uuid(), 'Nutri')`,
    );
    await expect(
      client.query(
        `INSERT INTO "Brand"(id, name) VALUES (gen_random_uuid(), 'Nutri')`,
      ),
    ).rejects.toThrow(/Brand_name_key/);

    const migration = await migrate(join(prismaDir, "schema.prisma"));
    expect(migration.stdout).toContain(MARCAS);
    const before = (
      await client.query(`SELECT "branchId" FROM "Brand" WHERE name = 'Nutri'`)
    ).rows;
    expect(before).toEqual([{ branchId: "main" }]);
    await client.query(
      `INSERT INTO "Brand"(id, name, "branchId") VALUES (gen_random_uuid(), 'Nutri', 'sucursal2')`,
    );
    await expect(
      client.query(
        `INSERT INTO "Brand"(id, name, "branchId") VALUES (gen_random_uuid(), 'Nutri', 'sucursal2')`,
      ),
    ).rejects.toThrow(/Brand_branchId_name_key/);
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
}, 240000);

// Inserta una fila rellenando las columnas NOT NULL sin valor por defecto.
async function insertar(
  client: any,
  table: string,
  values: Record<string, unknown>,
) {
  const cols = (
    await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = $1 AND is_nullable = 'NO' AND column_default IS NULL`,
      [table],
    )
  ).rows;
  const row: Record<string, unknown> = { ...values };
  for (const c of cols) {
    if (c.column_name in row) continue;
    row[c.column_name] =
      c.data_type === "uuid"
        ? "00000000-0000-4000-8000-" +
          String(Math.random()).slice(2, 14).padEnd(12, "0")
        : c.data_type === "numeric" || c.data_type === "integer"
          ? 0
          : c.data_type === "boolean"
            ? false
            : c.data_type === "jsonb"
              ? "[]"
              : c.data_type.startsWith("timestamp")
                ? new Date()
                : "x";
  }
  const names = Object.keys(row);
  await client.query(
    `INSERT INTO "${table}"(${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map((_, i) => "$" + (i + 1)).join(",")})`,
    names.map((n) => row[n]),
  );
}

it("Sale y SaleReturn: número único por sucursal, sin tocar ventas guardadas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-s10n-db-"));
  const projectDir = await mkdtemp(join(tmpdir(), "nexora-s10n-schema-"));
  const port = await freePort();
  const database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "s10_test",
    password: "s10_test_only",
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
    await database.createDatabase("s10_qa");
    const url = `postgresql://s10_test:s10_test_only@127.0.0.1:${port}/s10_qa`;
    const oldDir = join(projectDir, "old");
    const migrations = join(oldDir, "migrations");
    await mkdir(migrations, { recursive: true });
    await cp(join(prismaDir, "schema.prisma"), join(oldDir, "schema.prisma"));
    await cp(
      join(prismaDir, "migrations/migration_lock.toml"),
      join(migrations, "migration_lock.toml"),
    );
    for (const name of await readdir(join(prismaDir, "migrations")))
      if (name < NUMERACION && name !== "migration_lock.toml")
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
    client = database.getPgClient("s10_qa", "127.0.0.1");
    await client.connect();
    const uuid = () => crypto.randomUUID();

    await insertar(client, "Sale", {
      id: uuid(),
      offlineUuid: uuid(),
      number: "FS-0000001",
      branchId: "main",
    });
    // Hallazgo: con el esquema anterior otra sucursal con el mismo número choca.
    await expect(
      insertar(client, "Sale", {
        id: uuid(),
        offlineUuid: uuid(),
        number: "FS-0000001",
        branchId: "sucursal2",
      }),
    ).rejects.toThrow(/Sale_number_key/);

    const migration = await migrate(join(prismaDir, "schema.prisma"));
    expect(migration.stdout).toContain(NUMERACION);

    // La venta guardada sigue igual.
    expect(
      (await client.query(`SELECT number, "branchId" FROM "Sale"`)).rows,
    ).toEqual([{ number: "FS-0000001", branchId: "main" }]);
    // Misma numeración en otra sucursal: ahora coexiste; dentro de una sucursal sigue prohibido.
    await insertar(client, "Sale", {
      id: uuid(),
      offlineUuid: uuid(),
      number: "FS-0000001",
      branchId: "sucursal2",
    });
    await expect(
      insertar(client, "Sale", {
        id: uuid(),
        offlineUuid: uuid(),
        number: "FS-0000001",
        branchId: "sucursal2",
      }),
    ).rejects.toThrow(/Sale_branchId_number_key/);

    const saleId = (await client.query(`SELECT id FROM "Sale" LIMIT 1`)).rows[0]
      .id;
    await insertar(client, "SaleReturn", {
      id: uuid(),
      saleId,
      number: "NC-000001",
      refundMethod: "cash",
      branchId: "main",
    });
    await insertar(client, "SaleReturn", {
      id: uuid(),
      saleId,
      number: "NC-000001",
      refundMethod: "cash",
      branchId: "sucursal2",
    });
    await expect(
      insertar(client, "SaleReturn", {
        id: uuid(),
        saleId,
        number: "NC-000001",
        refundMethod: "cash",
        branchId: "sucursal2",
      }),
    ).rejects.toThrow(/SaleReturn_branchId_number_key/);
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
}, 240000);

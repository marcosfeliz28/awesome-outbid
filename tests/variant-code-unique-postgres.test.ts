import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";

// K2 · índices únicos de códigos sin distinguir mayúsculas ni espacios, contra
// PostgreSQL real. Con NEXORA_TEST_PG_URL (URL de administración de un
// PostgreSQL ya en marcha, p. ej. postgresql://postgres@127.0.0.1:5432/postgres)
// usa ese servidor y crea/borra sus propias bases; si no, arranca uno embebido.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaDir = join(root, "apps", "api", "prisma");
const migrationsDir = join(prismaDir, "migrations");
const k2Migration = "202610170001_variant_code_unique";
const apiRequire = createRequire(join(root, "apps", "api", "package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const run = promisify(execFile);

const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto para PostgreSQL."));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });

async function startServer() {
  const external = process.env.NEXORA_TEST_PG_URL;
  const created: string[] = [];
  let adminUrl: string;
  let stop: () => Promise<void>;
  if (external) {
    adminUrl = external;
    stop = async () => undefined;
  } else {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-k2-db-"));
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    adminUrl = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/postgres`;
    stop = async () => {
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    };
  }
  const url = (db: string) => {
    const u = new URL(adminUrl);
    u.pathname = "/" + db;
    return u.toString();
  };
  const admin = async (sql: string) => {
    const c = new Client({ connectionString: adminUrl });
    await c.connect();
    try {
      await c.query(sql);
    } finally {
      await c.end();
    }
  };
  return {
    url,
    client: (db: string) => new Client({ connectionString: url(db) }),
    create: async (db: string) => {
      await admin(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
      await admin(`CREATE DATABASE "${db}"`);
      created.push(db);
    },
    stop: async () => {
      for (const db of created)
        await admin(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`).catch(
          () => undefined,
        );
      await stop();
    },
  };
}

// cwd en la raíz: sin prisma.config.ts, `--schema` decide qué migraciones usa.
const migrate = (schema: string, databaseUrl: string) =>
  run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    timeout: 120_000,
  });

// Copia del esquema con las migraciones anteriores a K2: una base «vieja».
async function preK2Schema(parent: string) {
  const target = join(parent, "prisma-pre-k2");
  await mkdir(join(target, "migrations"), { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(target, "schema.prisma"));
  await cp(
    join(migrationsDir, "migration_lock.toml"),
    join(target, "migrations", "migration_lock.toml"),
  );
  for (const name of await readdir(migrationsDir))
    if (/^\d/.test(name) && name < k2Migration)
      await cp(join(migrationsDir, name), join(target, "migrations", name), {
        recursive: true,
      });
  return join(target, "schema.prisma");
}

const ciIndexes = async (client: any) =>
  (
    await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'Variant' AND indexname LIKE 'Variant_%_ci_key'
        ORDER BY 1`,
    )
  ).rows.map((r: any) => r.indexname);

const categoryId = "10000000-0000-4000-8000-000000000002";
const productId = "20000000-0000-4000-8000-000000000002";
async function seedProduct(client: any) {
  await client.query(
    `INSERT INTO "Category" (id,name,"updatedAt") VALUES ($1,'K2',now())`,
    [categoryId],
  );
  await client.query(
    `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt")
       VALUES ($1,'K2 producto','K2-P',$2,now())`,
    [productId, categoryId],
  );
}
const insertVariant = (
  client: any,
  sku: string,
  barcode: string,
  branchId = "main",
) =>
  client.query(
    `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,"branchId","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,1,2,$4,now())`,
    [productId, sku, barcode, branchId],
  );

// Aplica el archivo de la migración tal cual (como `psql -f`) y junta los NOTICE.
async function applyFile(client: any) {
  const sql = await readFile(
    join(migrationsDir, k2Migration, "migration.sql"),
    "utf8",
  );
  const notices: string[] = [];
  const onNotice = (n: any) => notices.push(String(n.message));
  client.on("notice", onNotice);
  try {
    await client.query(sql);
  } finally {
    client.off("notice", onNotice);
  }
  return notices;
}

describe("K2 · códigos únicos sin mayúsculas ni espacios en PostgreSQL real", () => {
  it("crea los índices en base limpia, los omite con duplicados sin fallar y la base rechaza ABC/abc concurrentes", async () => {
    const server = await startServer();
    const projectDir = await mkdtemp(join(tmpdir(), "nexora-k2-project-"));
    const clients: any[] = [];
    const open = async (db: string) => {
      const c = server.client(db);
      await c.connect();
      clients.push(c);
      return c;
    };
    try {
      // (a) Base limpia: todas las migraciones crean los dos índices.
      await server.create("nexora_k2_clean");
      const clean = await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_k2_clean"),
      );
      expect(clean.stdout).toContain(k2Migration);
      const a = await open("nexora_k2_clean");
      expect(await ciIndexes(a)).toEqual([
        "Variant_barcode_ci_key",
        "Variant_sku_ci_key",
      ]);
      // Idempotente: aplicarla dos veces más no falla ni cambia nada.
      for (let i = 0; i < 2; i++)
        expect(await applyFile(a)).toEqual([
          "K2: el índice Variant_sku_ci_key ya existe; no se cambia.",
          "K2: el índice Variant_barcode_ci_key ya existe; no se cambia.",
        ]);
      await seedProduct(a);
      await insertVariant(a, "K2-BASE", "K2-BASE-B");
      // Vacíos no reservan nada: '' y ' ' en las barras de dos variantes.
      await insertVariant(a, "K2-E1", "");
      await insertVariant(a, "K2-E2", " ");
      // Mayúsculas y espacios laterales cuentan como el mismo código.
      for (const [sku, barcode, index] of [
        [" k2-base ", "K2-OTRA-B", "Variant_sku_ci_key"],
        ["K2-OTRA", "k2-base-b", "Variant_barcode_ci_key"],
      ])
        await expect(insertVariant(a, sku, barcode)).rejects.toMatchObject({
          code: "23505",
          constraint: index,
        });

      // (c) Dos altas a la vez, «ABC» y «abc»: la segunda espera a la primera
      // y falla con 23505 cuando ésta confirma.
      const c1 = await open("nexora_k2_clean");
      const c2 = await open("nexora_k2_clean");
      for (const [first, second, field] of [
        ["K2-RACE-ABC", "k2-race-abc", "sku"],
        ["K2-RACE-BAR", " k2-race-bar", "barcode"],
      ]) {
        await c1.query("BEGIN");
        await c2.query("BEGIN");
        const other = "K2-X-" + field + "-";
        await (field === "sku"
          ? insertVariant(c1, first, other + "1")
          : insertVariant(c1, other + "1", first));
        const pending = (
          field === "sku"
            ? insertVariant(c2, second, other + "2")
            : insertVariant(c2, other + "2", second)
        ).then(
          () => ({ ok: true }),
          (error: any) => ({ ok: false, error }),
        );
        // Espera a que la segunda quede bloqueada por la primera.
        for (let i = 0; i < 100; i++) {
          const { rows } = await a.query(
            `SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'`,
          );
          if (rows[0].n > 0) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        await c1.query("COMMIT");
        const result: any = await pending;
        await c2.query("ROLLBACK");
        expect(result.ok, field).toBe(false);
        expect(result.error).toMatchObject({
          code: "23505",
          constraint: "Variant_" + field + "_ci_key",
        });
      }
      const { rows: race } = await a.query(
        `SELECT count(*)::int AS n FROM "Variant" WHERE lower(btrim(sku)) = 'k2-race-abc'
            OR lower(btrim(barcode)) = 'k2-race-bar'`,
      );
      expect(race[0].n).toBe(2);

      // (b) Base anterior a K2 con códigos que sólo cambian en mayúsculas o
      // espacios: la migración termina bien y NO crea esos índices.
      await server.create("nexora_k2_dups");
      await migrate(
        await preK2Schema(projectDir),
        server.url("nexora_k2_dups"),
      );
      const b = await open("nexora_k2_dups");
      expect(await ciIndexes(b)).toEqual([]);
      await seedProduct(b);
      await insertVariant(b, "ABC-1", "D-1");
      await insertVariant(b, "abc-1", "D-2");
      await insertVariant(b, " Abc-1 ", "D-3");
      await insertVariant(b, "D-4", "XYZ-9");
      await insertVariant(b, "D-5", "xyz-9", "sucursal-2");
      await insertVariant(b, "D-6", "");
      await insertVariant(b, "D-7", " ");
      const upgraded = await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_k2_dups"),
      );
      expect(upgraded.stdout).toContain(k2Migration);
      expect(await ciIndexes(b)).toEqual([]);
      // Registro duradero en la auditoría de cada sucursal afectada.
      const { rows: logged } = await b.query(
        `SELECT "entityId", "branchId", after FROM "AuditLog"
          WHERE action = 'k2_code_index_skipped' ORDER BY 1, 2`,
      );
      expect(logged).toMatchObject([
        {
          entityId: "Variant_barcode_ci_key",
          branchId: "main",
          after: { duplicateKeys: 1, duplicateRows: 2 },
        },
        { entityId: "Variant_barcode_ci_key", branchId: "sucursal-2" },
        {
          entityId: "Variant_sku_ci_key",
          branchId: "main",
          after: { duplicateKeys: 1, duplicateRows: 3, field: "sku" },
        },
      ]);
      // Con psql, dos veces: sigue sin fallar y avisa qué falta corregir.
      for (let i = 0; i < 2; i++) {
        const notices = await applyFile(b);
        expect(notices).toHaveLength(2);
        expect(notices[0]).toMatch(
          /NO se creó el índice Variant_sku_ci_key: hay 1 SKU repetido\(s\).*'abc-1' \(3 variantes\)/,
        );
        expect(notices[1]).toMatch(
          /NO se creó el índice Variant_barcode_ci_key.*'xyz-9' \(2 variantes\)/,
        );
      }
      expect(await ciIndexes(b)).toEqual([]);
      // Corregidos los SKU, volver a ejecutarla crea sólo ese índice.
      await b.query(
        `UPDATE "Variant" SET sku = sku || '-' || barcode WHERE lower(btrim(sku)) = 'abc-1'`,
      );
      const fixed = await applyFile(b);
      expect(fixed[0]).toBe("K2: índice Variant_sku_ci_key creado.");
      expect(await ciIndexes(b)).toEqual(["Variant_sku_ci_key"]);
    } finally {
      for (const c of clients) await c.end().catch(() => undefined);
      await server.stop();
      await rm(projectDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 240_000);
});

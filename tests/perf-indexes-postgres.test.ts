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

// PERF-1 · índices de enlace y plan_cache_mode (migración
// 202610200001_perf_indexes_links) contra PostgreSQL real: base vacía, base
// con datos, dos ejecuciones seguidas, índice inválido y un rol sin permisos
// (nunca aborta). Con NEXORA_TEST_PG_URL usa ese servidor; si no, uno embebido.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaDir = join(root, "apps", "api", "prisma");
const migrationsDir = join(prismaDir, "migrations");
const perfMigration = "202610200001_perf_indexes_links";
const apiRequire = createRequire(join(root, "apps", "api", "package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const run = promisify(execFile);

const INDEXES = [
  "CashMovement_sessionId_idx",
  "Payment_cashSessionId_idx",
  "Payment_saleId_idx",
  "SaleItem_saleId_idx",
  "SaleReturn_cashSessionId_idx",
  "SaleReturn_saleId_idx",
  "Sale_cashSessionId_idx",
  "Variant_productId_idx",
];

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
  const roles: string[] = [];
  let adminUrl: string;
  let stop: () => Promise<void>;
  if (external) {
    adminUrl = external;
    stop = async () => undefined;
  } else {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-perf-db-"));
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
  const url = (db: string, user?: string, password?: string) => {
    const u = new URL(adminUrl);
    u.pathname = "/" + db;
    if (user) {
      u.username = user;
      u.password = password ?? "";
    }
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
    admin,
    client: (db: string, user?: string, password?: string) =>
      new Client({ connectionString: url(db, user, password) }),
    create: async (db: string) => {
      await admin(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
      await admin(`CREATE DATABASE "${db}"`);
      created.push(db);
    },
    role: async (name: string, password: string) => {
      await admin(`DROP ROLE IF EXISTS "${name}"`);
      await admin(`CREATE ROLE "${name}" LOGIN PASSWORD '${password}'`);
      roles.push(name);
    },
    stop: async () => {
      for (const db of created)
        await admin(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`).catch(
          () => undefined,
        );
      for (const name of roles)
        await admin(`DROP ROLE IF EXISTS "${name}"`).catch(() => undefined);
      await stop();
    },
  };
}

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

// Copia del esquema con las migraciones anteriores a ésta: una base «vieja».
async function previousSchema(parent: string) {
  const target = join(parent, "prisma-pre-perf");
  await mkdir(join(target, "migrations"), { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(target, "schema.prisma"));
  await cp(
    join(migrationsDir, "migration_lock.toml"),
    join(target, "migrations", "migration_lock.toml"),
  );
  for (const name of await readdir(migrationsDir))
    if (/^\d/.test(name) && name < perfMigration)
      await cp(join(migrationsDir, name), join(target, "migrations", name), {
        recursive: true,
      });
  return join(target, "schema.prisma");
}

const perfIndexes = async (client: any) =>
  (
    await client.query(
      `SELECT c.relname FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = ANY($1) AND i.indisvalid ORDER BY 1`,
      [INDEXES],
    )
  ).rows.map((r: any) => r.relname);

const planSettings = async (client: any) =>
  (
    await client.query(
      `SELECT (r.rolname IS NOT NULL) AS for_role, (d.datname IS NOT NULL) AS for_db, s.setconfig
         FROM pg_db_role_setting s
         LEFT JOIN pg_roles r ON r.oid = s.setrole
         LEFT JOIN pg_database d ON d.oid = s.setdatabase
        WHERE 'plan_cache_mode=force_custom_plan' = ANY(s.setconfig)
          AND (r.rolname = current_user OR d.datname = current_database())
        ORDER BY 1, 2`,
    )
  ).rows.map((r: any) => (r.for_role ? "rol" : "base"));

async function applyFile(client: any) {
  const sql = await readFile(
    join(migrationsDir, perfMigration, "migration.sql"),
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

// Un año de historial reducido: 300 cajas × 60 ventas con su pago.
async function seedHistory(client: any) {
  await client.query(`
    INSERT INTO "CashSession"(id, "registerId", "userId", "openingAmount", "openedAt", "closedAt")
    SELECT gen_random_uuid(), 'hist', 'u-' || (g % 4), 0, now() - g * interval '1 day', now() - g * interval '1 day' + interval '8 hours'
      FROM generate_series(1, 300) g;
    CREATE TEMP TABLE hs AS
    SELECT gen_random_uuid() id, cs.id csid, row_number() over () n
      FROM "CashSession" cs CROSS JOIN generate_series(1, 60);
    INSERT INTO "Sale"(id, number, "offlineUuid", "sellerId", "cashSessionId", subtotal, "discountTotal", "taxTotal", total, "costTotal", "updatedAt")
    SELECT id, 'PH-' || n, gen_random_uuid(), gen_random_uuid(), csid, 100, 0, 15, 100, 50, now() FROM hs;
    INSERT INTO "Payment"(id, "saleId", "cashSessionId", method, amount, tendered)
    SELECT gen_random_uuid(), id, csid, CASE WHEN n % 2 = 0 THEN 'cash' ELSE 'card' END, 100, 100 FROM hs;
    ANALYZE;
  `);
}

const explain = async (client: any, sql: string, params: unknown[]) =>
  JSON.stringify(
    (await client.query("EXPLAIN (FORMAT JSON) " + sql, params)).rows[0],
  );

describe("PERF-1 · índices de enlace y plan_cache_mode en PostgreSQL real", () => {
  it("base vacía y base con datos: crea todo, se repite sin errores, rehace un índice inválido y no aborta sin permisos", async () => {
    const server = await startServer();
    const projectDir = await mkdtemp(join(tmpdir(), "nexora-perf-project-"));
    const clients: any[] = [];
    const open = async (db: string, user?: string, password?: string) => {
      const c = server.client(db, user, password);
      await c.connect();
      clients.push(c);
      return c;
    };
    try {
      // (a) Base vacía con todas las migraciones.
      await server.create("nexora_perf_clean");
      const clean = await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_perf_clean"),
      );
      expect(clean.stdout).toContain(perfMigration);
      const a = await open("nexora_perf_clean");
      expect(await perfIndexes(a)).toEqual(INDEXES);
      expect(await planSettings(a)).toEqual(["base", "rol"]);
      // Dos veces más (como psql): sólo avisos de «ya existe», nada falla.
      for (let i = 0; i < 2; i++) {
        const notices = await applyFile(a);
        expect(notices.filter((n) => n.startsWith("PERF:"))).toEqual([]);
        expect(await perfIndexes(a)).toEqual(INDEXES);
      }
      // Migrar otra vez no tiene nada pendiente.
      await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_perf_clean"),
      );

      // (b) Base anterior con historial: la migración crea los índices sobre
      // los datos existentes y luego se repite sin errores.
      await server.create("nexora_perf_data");
      await migrate(
        await previousSchema(projectDir),
        server.url("nexora_perf_data"),
      );
      const b = await open("nexora_perf_data");
      expect(await perfIndexes(b)).toEqual([]);
      await seedHistory(b);
      const upgraded = await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_perf_data"),
      );
      expect(upgraded.stdout).toContain(perfMigration);
      expect(await perfIndexes(b)).toEqual(INDEXES);
      for (let i = 0; i < 2; i++) await applyFile(b);
      expect(await perfIndexes(b)).toEqual(INDEXES);

      // El esperado de una caja (consulta de Prisma de cashExpected) y la
      // suma agrupada de GET /cash-sessions usan el índice por caja.
      const { rows: sessions } = await b.query(
        `SELECT id FROM "CashSession" ORDER BY "openedAt" DESC LIMIT 100`,
      );
      const one = await explain(
        b,
        `SELECT p.* FROM "Payment" p LEFT JOIN "Sale" j0 ON j0.id = p."saleId"
          WHERE p."cashSessionId" = $1 AND j0.status = $2 AND j0.id IS NOT NULL
            AND (p."entryType" <> $3 OR p.status = $4)`,
        [sessions[0].id, "completed", "installment", "ok"],
      );
      expect(one).toContain("Payment_cashSessionId_idx");
      const grouped = await explain(
        b,
        `SELECT sum(p.amount), p."cashSessionId", p.method FROM "Payment" p
           LEFT JOIN "Sale" j0 ON j0.id = p."saleId"
          WHERE p."cashSessionId" = ANY($1::uuid[]) AND j0.status = $2 AND j0.id IS NOT NULL
            AND (p."entryType" <> $3 OR p.status = $4)
          GROUP BY p."cashSessionId", p.method`,
        [sessions.map((s: any) => s.id), "completed", "installment", "ok"],
      );
      expect(grouped).toContain("Payment_cashSessionId_idx");

      // (c) Un índice inválido (CREATE INDEX CONCURRENTLY interrumpido) se
      // rehace al volver a ejecutar la migración.
      await b.query(
        `UPDATE pg_index SET indisvalid = false
          WHERE indexrelid = '"Payment_saleId_idx"'::regclass`,
      );
      expect(await perfIndexes(b)).not.toContain("Payment_saleId_idx");
      await applyFile(b);
      expect(await perfIndexes(b)).toEqual(INDEXES);

      // (d) Un rol sin permisos sobre las tablas ni la base: cada paso avisa
      // con NOTICE y la migración termina igual (nunca aborta un despliegue).
      await b.query(`DROP INDEX "Variant_productId_idx"`);
      await server.role("nexora_perf_limited", "perf_limited_only");
      await server.admin(
        `GRANT CONNECT ON DATABASE "nexora_perf_data" TO nexora_perf_limited`,
      );
      await b.query(`GRANT USAGE ON SCHEMA public TO nexora_perf_limited`);
      const limited = await open(
        "nexora_perf_data",
        "nexora_perf_limited",
        "perf_limited_only",
      );
      const notices = await applyFile(limited);
      expect(notices).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^PERF: no se creó el índice Variant_productId_idx \(.*owner.*\); el despliegue sigue/,
          ),
          expect.stringMatching(
            /^PERF: no se pudo fijar plan_cache_mode para la base nexora_perf_data/,
          ),
        ]),
      );
      expect(await perfIndexes(b)).not.toContain("Variant_productId_idx");
      // El rol sí puede fijar su propio plan_cache_mode.
      expect(await planSettings(limited)).toContain("rol");
      // Con el dueño, volver a ejecutarla crea lo que quedó pendiente.
      await applyFile(b);
      expect(await perfIndexes(b)).toEqual(INDEXES);
    } finally {
      for (const c of clients) await c.end().catch(() => undefined);
      await server.stop();
      await rm(projectDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 240_000);
});

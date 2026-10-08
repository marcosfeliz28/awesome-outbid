import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const r7Root = "/workspace/auditoria-ronda7/fitstore-pos/";
const currentRequire = createRequire(root + "apps/api/package.json");
const r7Require = createRequire(r7Root + "apps/api/package.json");
const pgModule = await import(
  root + "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js"
);
const { Client } = pgModule.default;
const dbName = "fitstore_audit_r9_upgrade7";
const adminUrl =
  "postgresql://fitstore:fitstore_local@127.0.0.1:55439/postgres?options=-c%20TimeZone%3DUTC";
const dbUrl =
  `postgresql://fitstore:fitstore_local@127.0.0.1:55439/${dbName}` +
  "?options=-c%20TimeZone%3DUTC";
const output =
  root + "docs/validacion/auditoria-ronda9-actualizacion-r7-r9.json";
const logFile =
  root + "docs/validacion/auditoria-ronda9-evidencias/actualizacion-r7-r9.txt";
const logs = [];

function run(label, command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    timeout: 120000,
  });
  const record = {
    label,
    status: result.status,
    signal: result.signal,
    output: (result.stdout + result.stderr).trim(),
  };
  logs.push(record);
  assert.equal(result.signal, null, `${label}: señal ${result.signal}`);
  assert.equal(result.status, 0, `${label}: ${record.output}`);
  return record;
}

async function snapshot(client) {
  const migrations = await client.query(
    'SELECT migration_name, finished_at IS NOT NULL AS finished FROM "_prisma_migrations" ORDER BY migration_name',
  );
  const counts = {};
  for (const table of ["User", "Category", "Product", "Variant", "Sale"])
    counts[table] = Number(
      (await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0]
        .n,
    );
  return { migrations: migrations.rows, counts };
}

const admin = new Client({ connectionString: adminUrl });
let api;
try {
  await admin.connect();
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [dbName],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.query(`CREATE DATABASE "${dbName}"`);

  run(
    "R7 migrate deploy",
    process.execPath,
    [r7Require.resolve("prisma/build/index.js"), "migrate", "deploy"],
    r7Root + "apps/api",
    { DATABASE_URL: dbUrl },
  );
  run(
    "R7 seed",
    process.execPath,
    [r7Require.resolve("tsx/cli"), "prisma/seed.ts"],
    r7Root + "apps/api",
    {
      DATABASE_URL: dbUrl,
      NODE_ENV: "test",
      SEED_DEMO_PASSWORD: "FitStore-Demo-2026!",
    },
  );

  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  const legacyQuoteId = randomUUID();
  await db.query(
    "INSERT INTO \"Quote\" (id,type,\"userId\",items,notes,status,\"branchId\",\"createdAt\",\"updatedAt\") VALUES ($1,'held','legacy-r7','[]'::jsonb,'R7','open','main',now(),now())",
    [legacyQuoteId],
  );
  const before = await snapshot(db);
  assert.equal(before.migrations.length, 12);

  run(
    "R9 migrate deploy sobre R7",
    process.execPath,
    [currentRequire.resolve("prisma/build/index.js"), "migrate", "deploy"],
    root + "apps/api",
    { DATABASE_URL: dbUrl },
  );
  const after = await snapshot(db);
  const quote = (
    await db.query(
      'SELECT "globalDiscount"::text AS value FROM "Quote" WHERE id=$1',
      [legacyQuoteId],
    )
  ).rows[0];
  const columns = (
    await db.query(
      `SELECT table_name,column_name,is_nullable,column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND
          (table_name,column_name) IN (
            ('Quote','globalDiscount'),
            ('Terminal','registerNumber'),('Terminal','registerName'),
            ('User','cashierNumber'),('CashSession','closeDetails'),
            ('PurchaseItem','damagedQty'),('GoodsReceipt','damagedCost'),
            ('GoodsReceipt','supplierNcf'),('PurchaseOrder','supplierNcf')
          )
        ORDER BY table_name,column_name`,
    )
  ).rows;
  const indexes = (
    await db.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public'
       AND indexname IN ('Terminal_branch_registerNumber_active_key','User_branch_cashierNumber_active_key')
       ORDER BY indexname`,
    )
  ).rows.map((row) => row.indexname);
  await db.end();

  assert.equal(after.migrations.length, 15);
  assert.deepEqual(after.counts, before.counts);
  assert.equal(Number(quote.value), 0);
  assert.equal(columns.length, 9);
  assert.equal(indexes.length, 2);
  assert.ok(after.migrations.every((migration) => migration.finished));

  // La API compilada actual debe arrancar y leer los datos migrados.
  const apiLogs = [];
  api = spawn(process.execPath, ["dist/main.js"], {
    cwd: root + "apps/api",
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      PORT: "3110",
      NODE_ENV: "test",
      JWT_SECRET: "auditoria-r9-upgrade-secret-2026-0001",
      WEB_ORIGIN: "http://127.0.0.1:4190",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stdout.setEncoding("utf8").on("data", (data) => apiLogs.push(data));
  api.stderr.setEncoding("utf8").on("data", (data) => apiLogs.push(data));
  let healthy = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:3110/api/health");
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {
      healthy = false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, apiLogs.join(""));
  const login = await fetch("http://127.0.0.1:3110/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@fitstore.demo",
      password: "FitStore-Demo-2026!",
    }),
  });
  const loginBody = await login.json();
  assert.equal(login.status, 201, JSON.stringify(loginBody));
  const catalog = await fetch("http://127.0.0.1:3110/api/products?limit=1", {
    headers: { Authorization: "Bearer " + loginBody.accessToken },
  });
  const catalogBody = await catalog.json();
  assert.equal(catalog.status, 200, JSON.stringify(catalogBody));

  const evidence = {
    generatedAt: new Date().toISOString(),
    source:
      "Base nueva R7 sembrada, luego migrada in situ con las migraciones R9.",
    before,
    after,
    legacyQuote: {
      id: legacyQuoteId,
      globalDiscountAfterUpgrade: Number(quote.value),
    },
    newColumns: columns,
    newIndexes: indexes,
    currentCompiledApi: {
      health: healthy,
      loginStatus: login.status,
      catalogStatus: catalog.status,
      catalogItems: Array.isArray(catalogBody.items)
        ? catalogBody.items.length
        : null,
    },
    passed: true,
  };
  writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
  writeFileSync(
    logFile,
    logs
      .map((entry) =>
        [`## ${entry.label}`, `status=${entry.status}`, entry.output].join(
          "\n",
        ),
      )
      .join("\n\n") + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (api && api.exitCode === null) {
    api.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => api.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    if (api.exitCode === null) api.kill("SIGKILL");
  }
  await admin.end().catch(() => {});
}

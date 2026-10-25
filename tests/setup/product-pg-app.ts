// Arranque común de las pruebas de producto con PostgreSQL real: base
// desechable (NEXORA_TEST_PG_URL si se corre como root, si no embedded-postgres),
// migraciones, una empresa con administradora, equipo aprobado y la app Nest.
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { createAppModule } from "../../apps/api/src/app";
import { ApiExceptionFilter } from "../../apps/api/src/common";

const root = resolve(import.meta.dirname, "../..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
export const TENANT = "00000000-0000-0000-0000-000000000001";
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function freePort() {
  const listener = createServer();
  await new Promise<void>((done) => listener.listen(0, "127.0.0.1", done));
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => listener.close(() => done()));
  return address.port;
}

async function database(name: string) {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) {
    const admin = new PrismaClient({ datasources: { db: { url: external } } });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/" + name;
    return {
      url: url.toString(),
      stop: async () => {
        const again = new PrismaClient({ datasources: { db: { url: external } } });
        await again.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => undefined);
        await again.$disconnect();
      },
    };
  }
  const dir = await mkdtemp(join(tmpdir(), "nexora-" + name + "-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir, user: "app_test", password: "app_test_only", port, persistent: false,
    authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  await pg.initialise(); await pg.start(); await pg.createDatabase(name);
  return {
    url: `postgresql://app_test:app_test_only@127.0.0.1:${port}/${name}`,
    stop: async () => {
      await pg.stop().catch(() => undefined);
      await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
    },
  };
}

const KEYS = ["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_OBJECT_STORE_DIR", "NODE_ENV",
  "PRODUCT_OBJECT_BUCKET", "PRODUCT_OBJECT_REGION", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"];

export async function startProductApp(name: string) {
  const previous = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const pg = await database(name);
  const objects = await mkdtemp(join(tmpdir(), "nexora-objects-"));
  let app: any, db: any;
  try {
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: pg.url }, timeout: 120_000 });
    db = new PrismaClient({ datasources: { db: { url: pg.url } } });
    const q = (sql: string, ...params: unknown[]) => db.$queryRawUnsafe(sql, ...params) as Promise<any[]>;
    await q(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Administración',ARRAY['*'],now())`, id(1), TENANT);
    await q(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
      VALUES ($1::uuid,$2::uuid,'QA','qa-arreglos@example.invalid','test-only','test-only',$3::uuid,'main',now())`, id(2), TENANT, id(1));
    await q(`INSERT INTO "Terminal" (id,"tenantId",name,"branchId","approvedAt","secretHash")
      VALUES ($1::uuid,$2::uuid,'Equipo QA','main',now(),'test-only')`, id(4), TENANT);
    await q(`INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
      id(3), TENANT, id(2), id(4));
    process.env.DATABASE_URL = pg.url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_OBJECT_STORE_DIR = objects;
    const secret = "clave-exclusiva-de-prueba-" + name.padEnd(32, "x");
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const token = "Bearer " + new JwtService({ secret }).sign({ sub: id(2), sid: id(3), type: "access", version: 0, tenantId: TENANT });
    const http = supertest(app.getHttpServer());
    const as = (method: "get" | "post" | "patch" | "delete", path: string) =>
      (http as any)[method]("/api" + path).set("Authorization", token);
    return {
      http, token, q, db, as,
      get: (path: string) => as("get", path),
      post: (path: string, body?: unknown) => as("post", path).send(body ?? {}),
      patch: (path: string, body?: unknown) => as("patch", path).send(body ?? {}),
      del: (path: string) => as("delete", path),
      async stop() {
        await app?.close().catch(() => undefined);
        await db?.$disconnect().catch(() => undefined);
        await pg.stop();
        await rm(objects, { recursive: true, force: true });
        for (const [k, v] of Object.entries(previous)) v === undefined ? delete process.env[k] : (process.env[k] = v);
      },
    };
  } catch (error) {
    await app?.close().catch(() => undefined);
    await db?.$disconnect().catch(() => undefined);
    await pg.stop();
    throw error;
  }
}

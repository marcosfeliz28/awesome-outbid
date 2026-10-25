import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { tenantDatabaseProxy } from "../apps/api/src/tenant-database";
import { tenantScope } from "../apps/api/src/tenant-context";

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const platformToken = "operador-soporte-solo-prueba-".padEnd(72, "0123456789abcdef");
const keys = ["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION",
  "PLATFORM_ADMIN_TOKEN_SHA256", "APP_PUBLIC_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

async function port() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

// Igual que product-platform-ai-packs: NEXORA_TEST_PG_URL usa un PostgreSQL local.
async function database() {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) {
    const admin = new PrismaClient({ datasources: { db: { url: external } } });
    await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS "nexora_support_platform_test" WITH (FORCE)');
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_support_platform_test"');
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_support_platform_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const directory = await mkdtemp(join(tmpdir(), "nexora-support-platform-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory, user: "support_test", password: "only_local_test", port: pgPort,
    persistent: false, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  await db.initialise();
  await db.start();
  await db.createDatabase("support_qa");
  return {
    url: `postgresql://support_test:only_local_test@127.0.0.1:${pgPort}/support_qa`,
    stop: async () => {
      await db.stop().catch(() => undefined);
      await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
    },
  };
}

it("N-05: el operador abre solo el acceso de soporte que la empresa activó; solo lectura, bitácora y vencimiento", async () => {
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const pg = await database();
  let app: any;
  let client: any;
  let runtime: any;
  try {
    process.env.DATABASE_URL = pg.url;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")],
      { cwd: root, env: process.env, timeout: 120000 });
    process.env.PRODUCT_TENANCY = "required";
    process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
    delete process.env.PRODUCT_PUBLIC_REGISTRATION;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256").update(platformToken).digest("hex");
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-secret-for-product-support-at-least-32ch"), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    client = new PrismaClient({ datasources: { db: { url: pg.url } } });

    const password = "ClaveSegura-2026!";
    const tenant = async (code: string) => {
      const created = await http.post("/api/platform/tenants").set("Authorization", auth).send({
        businessName: `Piloto ${code}`, companyCode: code, businessType: "retail", plan: "pro",
        adminName: "Dueña", adminEmail: `${code}@example.invalid`,
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const token = created.body.invitationUrl.split("#token=")[1];
      expect((await http.post("/api/auth/accept-invitation").send({ token, password, managerPin: "869253" })).status).toBe(201);
      const login = await http.post("/api/auth/login").set("x-tenant-id", code).send({ login: `${code}@example.invalid`, password });
      expect(login.status, JSON.stringify(login.body)).toBe(201);
      return { id: created.body.id as string, bearer: `Bearer ${login.body.accessToken}` };
    };
    const a = await tenant("soporte-a");
    const b = await tenant("soporte-b");

    // Sin permiso de la empresa no hay nada que abrir.
    expect((await http.get("/api/platform/support-grants").set("Authorization", auth)).body).toEqual([]);
    expect((await http.post("/api/platform/tenants/soporte-a/support-session").set("Authorization", auth)).status).toBe(403);
    // El token de una empresa no sirve como token de operador.
    expect((await http.get("/api/platform/support-grants").set("Authorization", a.bearer)).status).toBe(401);
    expect((await http.post("/api/platform/tenants/soporte-a/support-session").set("Authorization", a.bearer)).status).toBe(401);

    // La administradora de A concede 24 h.
    const enabled = await http.post("/api/support-access/enable").set("Authorization", a.bearer).send({ duration: "24h" });
    expect(enabled.status, JSON.stringify(enabled.body)).toBe(201);
    const grants = (await http.get("/api/platform/support-grants").set("Authorization", auth)).body;
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ slug: "soporte-a" });
    expect(new Date(grants[0].expiresAt).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    // B no concedió nada.
    expect((await http.post("/api/platform/tenants/soporte-b/support-session").set("Authorization", auth)).status).toBe(403);

    const opened = await http.post("/api/platform/tenants/soporte-a/support-session").set("Authorization", auth);
    expect(opened.status, JSON.stringify(opened.body)).toBe(201);
    expect(opened.headers["cache-control"]).toBe("no-store");
    expect(opened.body).toMatchObject({ tokenType: "Bearer", expiresIn: 900, readOnly: true });
    const support = `Bearer ${opened.body.accessToken}`;

    // Lee A, nunca B; no escribe; cada paso queda en la bitácora de A.
    expect((await http.get("/api/products").set("Authorization", support)).status).toBe(200);
    expect((await http.post("/api/expense-categories").set("Authorization", support).send({ name: "Soporte" })).status).toBe(403);
    const audit = await client.$queryRawUnsafe(
      `SELECT "tenantId"::text AS t, action FROM "AuditLog" WHERE action LIKE 'support.%' ORDER BY "createdAt"`) as any[];
    expect(audit.map((row) => row.t).every((t: string) => t === a.id)).toBe(true);
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining(
      ["support.enable", "support.platform_session", "support.read", "support.write_denied"]));
    expect(audit.some((row) => row.t === b.id)).toBe(false);

    // Postgres rechaza escrituras cuando el contexto de soporte es READ ONLY.
    runtime = tenantDatabaseProxy(new PrismaClient({ datasources: { db: { url: pg.url } } }));
    await expect(tenantScope.run({ tenantId: a.id, readOnly: true }, () =>
      runtime.expenseCategory.create({ data: { name: "Escritura de soporte" } }))).rejects.toThrow(/read-only|solo lectura|READ ONLY/i);

    // Al vencer (o al retirarlo la empresa) la sesión abierta deja de valer.
    await client.$executeRawUnsafe(
      `UPDATE "User" SET "supportExpiresAt" = now() - interval '1 minute' WHERE email = 'soporte-nexora@nexora.local' AND "tenantId" = $1::uuid`, a.id);
    expect((await http.get("/api/products").set("Authorization", support)).status).toBe(401);
    expect((await http.post("/api/platform/tenants/soporte-a/support-session").set("Authorization", auth)).status).toBe(403);
    expect((await http.get("/api/platform/support-grants").set("Authorization", auth)).body).toEqual([]);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.$disconnect().catch(() => undefined);
    await runtime?.$disconnect().catch(() => undefined);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.stop();
  }
}, 180000);

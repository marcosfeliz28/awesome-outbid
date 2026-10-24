import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it, vi } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);

async function port() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>(done => server.close(() => done()));
  return address.port;
}

it("registra empresa aislada y exige confirmar el correo una sola vez antes de entrar", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-registration-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory, user: "registration_test", password: "only_local_test",
    port: pgPort, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const previous = Object.fromEntries(["DATABASE_URL", "PRODUCT_TENANCY", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL", "RESEND_API_BASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].map(k => [k, process.env[k]]));
  let app: any;
  let client: any;
  let html = "";
  let failNextMail = false;
  try {
    await db.initialise(); await db.start(); await db.createDatabase("registration_qa");
    process.env.DATABASE_URL = `postgresql://registration_test:only_local_test@127.0.0.1:${pgPort}/registration_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")], {
      cwd: root, env: process.env, timeout: 120000,
    });
    process.env.PRODUCT_TENANCY = "required";
    process.env.RESEND_API_KEY = "local-test-only";
    process.env.NOTIFY_EMAIL_FROM = "Nexora <test@example.invalid>";
    process.env.APP_PUBLIC_URL = "https://example.invalid";
    process.env.RESEND_API_BASE = "https://mail.example.invalid";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
      html = JSON.parse(String(options.body)).html;
      if (failNextMail) { failNextMail = false; return { ok: false }; }
      return { ok: true };
    }));
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-secret-for-product-registration-at-least-32"), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const input = { businessName: "Tienda de prueba", ownerName: "Dueña de prueba", email: "owner@example.invalid", password: "ClaveSegura-2026!", managerPin: "869253", businessType: "retail", companyCode: "tienda-de-prueba" };
    const created = await http.post("/api/auth/register").send(input);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(html).toContain("/confirmar-correo#token=");
    const token = html.match(/#token=([a-f0-9]{64})/)?.[1];
    expect(token).toHaveLength(64);
    client = db.getPgClient("registration_qa", "127.0.0.1");
    await client.connect();
    const tenants = await client.query(`SELECT id, status, "trialEndsAt" FROM "Tenant" WHERE slug='tienda-de-prueba'`);
    expect(tenants.rows).toHaveLength(1);
    expect(tenants.rows[0].status).toBe("trial");
    expect(new Date(tenants.rows[0].trialEndsAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000);
    expect((await client.query(`SELECT count(*)::int AS n FROM "Role" WHERE "tenantId"=$1`, [tenants.rows[0].id])).rows[0].n).toBe(1);
    expect((await client.query(`SELECT count(*)::int AS n FROM "Settings" WHERE "tenantId"=$1`, [tenants.rows[0].id])).rows[0].n).toBe(1);
    const owner = await client.query(`SELECT "pinHash" FROM "User" WHERE "tenantId"=$1`, [tenants.rows[0].id]);
    expect(await apiRequire("bcryptjs").compare(input.managerPin, owner.rows[0].pinHash)).toBe(true);
    expect(owner.rows[0].pinHash).not.toContain(input.managerPin);
    const before = await http.post("/api/auth/login").set("x-tenant-id", input.companyCode).send({ login: input.email, password: input.password });
    expect(before.status).toBe(403);
    expect((await http.post("/api/auth/verify-email").send({ token })).status).toBe(201);
    expect((await http.post("/api/auth/verify-email").send({ token })).status).toBe(400);
    const after = await http.post("/api/auth/login").set("x-tenant-id", input.companyCode).send({ login: input.email, password: input.password });
    expect(after.status, JSON.stringify(after.body)).toBe(201);
    expect(after.body.user.tenantId).toBe(tenants.rows[0].id);
    expect((await http.post("/api/auth/register").send(input)).status).toBe(409);
    failNextMail = true;
    const second = await http.post("/api/auth/register").send({ ...input, companyCode: "otra-tienda" });
    expect(second.status).toBe(201);
    expect(second.body.deliveryPending).toBe(true);
    const undeliveredToken = html.match(/#token=([a-f0-9]{64})/)?.[1];
    const another = await client.query(`SELECT id FROM "Tenant" WHERE slug='otra-tienda'`);
    expect(another.rows[0].id).not.toBe(tenants.rows[0].id);
    // El mismo correo puede ser dueño en dos empresas; una verificación no
    // autoriza la otra. El reenvío sólo envía a la cuenta solicitante.
    expect((await http.post("/api/auth/login").set("x-tenant-id", "otra-tienda")
      .send({ login: input.email, password: input.password })).status).toBe(403);
    const resent = await http.post("/api/auth/resend-verification").send({ companyCode: "otra-tienda", email: input.email });
    expect(resent.status).toBe(201);
    expect((await http.post("/api/auth/verify-email").send({ token: undeliveredToken })).status).toBe(400);
    const recoveredToken = html.match(/#token=([a-f0-9]{64})/)?.[1];
    expect((await http.post("/api/auth/verify-email").send({ token: recoveredToken })).status).toBe(201);
    expect((await http.post("/api/auth/login").set("x-tenant-id", "otra-tienda")
      .send({ login: input.email, password: input.password })).status).toBe(201);
    expect((await http.post("/api/auth/resend-verification").send({ companyCode: "otra-tienda", email: "absent@example.invalid" })).body.message).toBe(resent.body.message);
    expect((await http.post("/api/auth/register").send({})).status).toBe(400);
    expect((await http.post("/api/auth/register").send({})).status).toBe(400);
    expect((await http.post("/api/auth/register").send({})).status).toBe(429);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.end().catch(() => undefined);
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await db.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter, Database } from "../apps/api/src/common";
import { TenantLifecycleService, effectiveTenantStatus } from "../apps/api/src/tenant-lifecycle";
import { tenantScope } from "../apps/api/src/tenant-context";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const DAY = 86_400_000;
const idA = "d0000000-0000-4000-8000-000000000001";
const idB = "d0000000-0000-4000-8000-000000000002";
const at = (now: Date, days: number) => new Date(now.getTime() + days * DAY);

async function freePort() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>(done => server.close(() => done()));
  return address.port;
}

it("expira prueba y cobro, da siete días de gracia, suspende escrituras y conserva exportación/lectura", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-lifecycle-"));
  const pgPort = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir, user: "lifecycle_test", password: "only_local_test", port: pgPort,
    persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const prior = Object.fromEntries(["DATABASE_URL", "PRODUCT_TENANCY", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL"].map(k => [k, process.env[k]]));
  let app: any;
  let client: any;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("lifecycle_qa");
    const url = `postgresql://lifecycle_test:only_local_test@127.0.0.1:${pgPort}/lifecycle_qa`;
    process.env.DATABASE_URL = url;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: process.env, timeout: 120000,
    });
    process.env.PRODUCT_TENANCY = "required";
    process.env.RESEND_API_KEY = "local-test-only";
    process.env.NOTIFY_EMAIL_FROM = "Nexora <test@example.invalid>";
    process.env.APP_PUBLIC_URL = "https://example.invalid";
    client = pg.getPgClient("lifecycle_qa", "127.0.0.1");
    await client.connect();
    const now = new Date();
    for (const [tenantId, slug] of [[idA, "empresa-a"], [idB, "empresa-b"]]) {
      await client.query(`INSERT INTO "Tenant" (id, slug, name, status, "trialEndsAt", "updatedAt") VALUES ($1,$2,$2,'trial',$3,now())`, [tenantId, slug, at(now, 7)]);
    }
    const roleId = "d0000000-0000-4000-8000-000000000003";
    const userId = "d0000000-0000-4000-8000-000000000004";
    const sessionId = "d0000000-0000-4000-8000-000000000005";
    await client.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1,$2,'admin',ARRAY['*'],now())`, [roleId, idA]);
    await client.query(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1,$2,'Owner','owner@example.invalid','test-only','test-only',$3,'main',now())`, [userId, idA, roleId]);
    await client.query(`INSERT INTO "AuthSession" (id,"tenantId","userId") VALUES ($1,$2,$3)`, [sessionId, idA, userId]);
    await client.query(`INSERT INTO "Category" (id,"tenantId",name,"updatedAt") VALUES (gen_random_uuid(),$1,'Conservada',now())`, [idA]);
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "test-lifecycle-secret-at-least-32-chars";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const service = app.get(TenantLifecycleService) as TenantLifecycleService;
    const http = supertest(app.getHttpServer());
    const bearer = "Bearer " + new JwtService({ secret }).sign({ sub: userId, sid: sessionId, type: "access", version: 0, tenantId: idA });
    expect((await http.get("/api/tenant/status").set("Authorization", bearer)).body.status).toBe("trial");
    expect((await http.post("/api/categories").set("Authorization", bearer).send({ name: "Antes" })).status).toBe(201);

    await service.queueNotices(now);
    await service.queueNotices(now);
    expect((await client.query(`SELECT kind FROM "TenantLifecycleNotice" WHERE "tenantId"=$1`, [idA])).rows).toEqual([{ kind: "trial_7" }]);
    const sent: Array<{ to: string; key: string }> = [];
    await service.sendPendingNotices(now, async (settings, _subject, _text, key) => {
      sent.push({ to: settings.to, key }); return { ok: true };
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("owner@example.invalid");
    await service.sendPendingNotices(now, async () => { throw new Error("Duplicado"); });
    await service.queueNotices(at(now, 4));
    expect((await client.query(`SELECT kind FROM "TenantLifecycleNotice" WHERE "tenantId"=$1 ORDER BY kind`, [idA])).rows).toEqual([{ kind: "trial_3" }, { kind: "trial_7" }]);

    // El trabajador persiste la transición, pero la guardia la calcula también
    // sin depender de que el trabajador llegue a tiempo.
    await client.query(`UPDATE "Tenant" SET "trialEndsAt"=$2 WHERE id=$1`, [idA, at(now, -1)]);
    expect(effectiveTenantStatus({ status: "trial", trialEndsAt: at(now, -1), paidThroughAt: null, pastDueAt: null }, now)).toBe("past_due");
    expect((await http.get("/api/tenant/status").set("Authorization", bearer)).body.status).toBe("past_due");
    await service.advance(now);
    expect((await client.query(`SELECT status,"pastDueAt" FROM "Tenant" WHERE id=$1`, [idA])).rows[0].status).toBe("past_due");
    expect((await http.post("/api/categories").set("Authorization", bearer).send({ name: "En gracia" })).status).toBe(201);
    await client.query(`UPDATE "Tenant" SET "pastDueAt"=$2 WHERE id=$1`, [idA, at(now, -8)]);
    const suspended = await http.get("/api/tenant/status").set("Authorization", bearer);
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe("suspended");
    expect((await http.post("/api/categories").set("Authorization", bearer).send({ name: "Prohibida" })).status).toBe(403);
    const categoryRead = await http.get("/api/categories").set("Authorization", bearer);
    expect(categoryRead.status, JSON.stringify(categoryRead.body)).toBe(200);
    expect(categoryRead.body.map((row: any) => row.name)).toContain("Conservada");
    await expect(tenantScope.run({ tenantId: idA, readOnly: true }, () => app.get(Database).category.create({ data: { name: "GET-mutador" } }))).rejects.toThrow();
    expect((await client.query(`SELECT count(*)::int AS n FROM "Category" WHERE "tenantId"=$1 AND name='GET-mutador'`, [idA])).rows[0].n).toBe(0);
    await service.advance(now);
    expect((await client.query(`SELECT status,"suspendedAt" FROM "Tenant" WHERE id=$1`, [idA])).rows[0].status).toBe("suspended");
    const { hashSync } = apiRequire("bcryptjs");
    await client.query(`UPDATE "User" SET "passwordHash"=$1 WHERE id=$2`, [hashSync("Clave-de-prueba-2026!", 4), userId]);
    const suspendedLogin = await http.post("/api/auth/login").set("x-tenant-id", "empresa-a")
      .send({ login: "owner@example.invalid", password: "Clave-de-prueba-2026!" });
    expect(suspendedLogin.status, JSON.stringify(suspendedLogin.body)).toBe(201);
    expect((await client.query(`SELECT status FROM "Tenant" WHERE id=$1`, [idB])).rows[0].status).toBe("trial");
    const listed = await http.get("/api/categories").set("Authorization", bearer);
    expect(listed.status).toBe(200);
    await service.activateTenant(idA, at(now, 30), now);
    expect((await http.get("/api/tenant/status").set("Authorization", bearer)).body.status).toBe("active");
    expect((await http.post("/api/categories").set("Authorization", bearer).send({ name: "Renovada" })).status).toBe(201);
    await service.queueNotices(at(now, 23));
    const afterRenewal: string[] = [];
    await service.sendPendingNotices(at(now, 23), async (_settings, _subject, _text, key) => {
      afterRenewal.push(key); return { ok: true };
    });
    expect(afterRenewal).toHaveLength(1); // billing_7; trial_3 antigua se descarta.
    const stale = await client.query(`SELECT status FROM "TenantLifecycleNotice" WHERE "tenantId"=$1 AND kind='trial_3'`, [idA]);
    expect(stale.rows[0].status).toBe("superseded");
    await client.query(`UPDATE "Tenant" SET "paidThroughAt"=$2 WHERE id=$1`, [idA, at(now, -8)]);
    await service.advance(now);
    expect((await client.query(`SELECT status FROM "Tenant" WHERE id=$1`, [idA])).rows[0].status).toBe("suspended");
    expect((await client.query(`SELECT count(*)::int AS n FROM "Category" WHERE "tenantId"=$1`, [idA])).rows[0].n).toBeGreaterThan(0);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.end().catch(() => undefined);
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await pg.stop().catch(() => undefined);
    await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

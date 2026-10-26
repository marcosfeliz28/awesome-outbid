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

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const platformToken = "operador-plataforma-solo-prueba-".padEnd(72, "0123456789abcdef");
const keys = ["PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION", "DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PLATFORM_ADMIN_TOKEN_SHA256", "APP_PUBLIC_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

async function port() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>(done => server.close(() => done()));
  return address.port;
}

// Como root, embedded-postgres no puede leer su mkdtemp: NEXORA_TEST_PG_URL
// (superusuario de un PostgreSQL local) usa una base desechable en su lugar.
async function database() {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) {
    const admin = new PrismaClient({ datasources: { db: { url: external } } });
    await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS "nexora_platform_test" WITH (FORCE)');
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_platform_test"');
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_platform_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const directory = await mkdtemp(join(tmpdir(), "nexora-platform-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory, user: "platform_test", password: "only_local_test",
    port: pgPort, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  await db.initialise(); await db.start(); await db.createDatabase("platform_qa");
  return {
    url: `postgresql://platform_test:only_local_test@127.0.0.1:${pgPort}/platform_qa`,
    stop: async () => {
      await db.stop().catch(() => undefined);
      await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
    },
  };
}

it("el operador crea empresas piloto por invitación sin abrir el registro público", async () => {
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const pg = await database();
  let app: any;
  let client: any;
  try {
    process.env.DATABASE_URL = pg.url;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")], {
      cwd: root, env: process.env, timeout: 120000,
    });
    process.env.PRODUCT_TENANCY = "required";
    process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
    delete process.env.PRODUCT_PUBLIC_REGISTRATION;
    delete process.env.PLATFORM_ADMIN_TOKEN_SHA256;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-secret-for-product-platform-at-least-32ch"), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    const pilot = (companyCode: string, adminEmail: string) => ({
      businessName: `Piloto ${companyCode}`, companyCode, businessType: "retail",
      plan: "basico", adminName: "Dueña piloto", adminEmail, operadora: "Ana Operadora", acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" },
    });

    // Sin credencial configurada las rutas no existen, ni con token.
    expect((await http.get("/api/platform/tenants").set("Authorization", auth)).status).toBe(404);
    expect((await http.post("/api/platform/tenants").set("Authorization", auth).send(pilot("piloto-a", "a@example.invalid"))).status).toBe(404);
    process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256").update(platformToken).digest("hex");
    expect((await http.get("/api/platform/tenants")).status).toBe(401);
    expect((await http.get("/api/platform/tenants").set("Authorization", "Platform otro-token-equivocado-0123456789abcdef")).status).toBe(401);
    expect((await http.get("/api/platform/tenants").set("Authorization", `Bearer ${platformToken}`)).status).toBe(401);

    const created = await http.post("/api/platform/tenants").set("Authorization", auth).send(pilot("piloto-a", "A@example.invalid"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ slug: "piloto-a", plan: "basico", status: "trial" });
    expect(new Date(created.body.trialEndsAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
    expect(created.body.invitationUrl).toMatch(/^https:\/\/pos\.example\.invalid\/aceptar-invitacion#token=[a-f0-9]{64}$/);
    const tokenA = created.body.invitationUrl.split("#token=")[1];
    const createdB = await http.post("/api/platform/tenants").set("Authorization", auth).send({ ...pilot("piloto-b", "b@example.invalid"), trialDays: 10, plan: "pro" });
    expect(createdB.status).toBe(201);
    const tokenB = createdB.body.invitationUrl.split("#token=")[1];
    expect((await http.post("/api/platform/tenants").set("Authorization", auth).send(pilot("piloto-a", "x@example.invalid"))).status).toBe(409);
    expect((await http.post("/api/platform/tenants").set("Authorization", auth).send({ ...pilot("piloto-c", "c@example.invalid"), plan: "gratis" })).status).toBe(400);

    const listed = await http.get("/api/platform/tenants").set("Authorization", auth);
    expect(listed.status).toBe(200);
    expect(listed.body.map((t: any) => t.slug)).toEqual(expect.arrayContaining(["piloto-a", "piloto-b"]));
    expect(Object.keys(listed.body[0]).sort()).toEqual(["createdAt", "id", "name", "paidUntil", "plan", "slug", "status", "trialEndsAt"]);

    client = new PrismaClient({ datasources: { db: { url: pg.url } } });
    const q = (sql: string, ...params: unknown[]) => client.$queryRawUnsafe(sql, ...params) as Promise<any[]>;
    const tenantA = created.body.id;
    const stored = await q(`SELECT "emailVerifiedAt", "emailVerificationHash", "emailVerificationExpiresAt" FROM "User" WHERE "tenantId"=$1::uuid`, tenantA);
    expect(stored).toHaveLength(1);
    expect(stored[0].emailVerifiedAt).toBeNull();
    expect(stored[0].emailVerificationHash).not.toContain(tokenA);
    expect(new Date(stored[0].emailVerificationExpiresAt).getTime()).toBeGreaterThan(Date.now() + 6.9 * 86400000);
    expect((await q(`SELECT "termsAcceptedAt" FROM "Tenant" WHERE id=$1::uuid`, tenantA))[0].termsAcceptedAt).toBeNull();

    // RLS: con el rol de la aplicación, la empresa A solo ve su propia fila.
    const visible = await client.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
      await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenantA);
      return tx.$queryRawUnsafe(`SELECT (SELECT array_agg(slug) FROM "Tenant") AS tenants,
        (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Settings") AS settings`);
    });
    expect(visible[0]).toEqual({ tenants: ["piloto-a"], users: 1, settings: 1 });

    const password = "ClaveSegura-2026!";
    const login = (slug: string, email: string) => http.post("/api/auth/login").set("x-tenant-id", slug).send({ login: email, password });
    const early = await login("piloto-a", "a@example.invalid");
    expect(early.status, JSON.stringify(early.body)).toBe(400);
    // El enlace de invitación no sirve como confirmación de correo (no fija clave).
    expect((await http.post("/api/auth/verify-email").send({ token: tokenA })).status).toBe(400);
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenA, password: "corta", managerPin: "869253", consentAccepted: true })).status).toBe(400);
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenA, password, managerPin: "123456" })).status).toBe(400);
    // INV-01: sin aceptación explícita no se activa.
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenA, password, managerPin: "869253" })).status).toBe(400);
    const accepted = await http.post("/api/auth/accept-invitation").send({ token: tokenA, password, managerPin: "869253", consentAccepted: true });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
    // INV-01: queda la versión del acuerdo en papel y la fecha de aceptación; INV-02: ciclo durable, sin el token.
    const terms = (await q(`SELECT "termsVersion", "termsAcceptedAt", "privacyAcceptedAt" FROM "Tenant" WHERE id=$1::uuid`, tenantA))[0];
    expect(terms.termsVersion).toBe("papel:piloto-1");
    expect(terms.termsAcceptedAt).not.toBeNull();
    expect(terms.privacyAcceptedAt).not.toBeNull();
    const lifecycleA = await q(`SELECT action, after, ip FROM "AuditLog" WHERE "tenantId"=$1::uuid AND entity='invitation' ORDER BY "createdAt"`, tenantA);
    expect(lifecycleA.map((row) => row.action)).toEqual(["invitation.created", "invitation.accepted"]);
    expect(lifecycleA[0].after).toMatchObject({ operadora: "Ana Operadora", acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" } });
    expect(lifecycleA[1].after).toMatchObject({ metodo: "papel", termsVersion: "papel:piloto-1" });
    expect(JSON.stringify(lifecycleA)).not.toContain(tokenA);
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenA, password: "OtraClave-2026!!", managerPin: "869253", consentAccepted: true })).status).toBe(400);
    const session = await login("piloto-a", "a@example.invalid");
    expect(session.status, JSON.stringify(session.body)).toBe(201);
    expect(session.body.user.tenantId).toBe(tenantA);
    const guide = await http.get("/api/onboarding").set("Authorization", `Bearer ${session.body.accessToken}`);
    expect(guide.body).toMatchObject({ businessName: "Piloto piloto-a", businessType: "retail", categories: 0 });
    // La empresa A no entra en B, ni con su clave.
    expect((await login("piloto-b", "a@example.invalid")).status).not.toBe(201);

    // Invitación vencida: no se acepta y B sigue sin poder entrar.
    await client.$executeRawUnsafe(`UPDATE "User" SET "emailVerificationExpiresAt"=now() - interval '1 minute' WHERE "tenantId"=$1::uuid`, createdB.body.id);
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenB, password, managerPin: "869253", consentAccepted: true })).status).toBe(400);
    expect((await login("piloto-b", "b@example.invalid")).status).not.toBe(201);

    // INV-01: sin acuerdo registrado no se crea la invitación.
    const { acuerdo: _acuerdo, ...withoutAgreement } = pilot("piloto-e", "e@example.invalid");
    expect((await http.post("/api/platform/tenants").set("Authorization", auth).send(withoutAgreement)).status).toBe(400);

    // INV-02: cancelación explícita, con operadora y en la bitácora.
    const platformPost = (path: string, body: object) => http.post(path).set("Authorization", auth).send(body);
    const createdD = await platformPost("/api/platform/tenants", pilot("piloto-d", "d@example.invalid"));
    expect(createdD.status).toBe(201);
    const tenantD = createdD.body.id;
    const tokenD = createdD.body.invitationUrl.split("#token=")[1];
    expect((await platformPost("/api/platform/tenants/piloto-d/revoke-invitation", {})).status).toBe(400);
    expect((await platformPost("/api/platform/tenants/piloto-d/revoke-invitation", { operadora: "Ana Operadora" })).status).toBe(201);
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenD, password, managerPin: "869253", consentAccepted: true })).status).toBe(400);
    // INI-09: otra fila pendiente (dato anómalo) no se toca ni impide reenviar a la dueña.
    const [ownerD] = await q(`SELECT "roleId" FROM "User" WHERE "tenantId"=$1::uuid`, tenantD);
    await client.user.create({ data: {
      tenantId: tenantD, name: "Anómala", username: "anomala", usernameKey: "anomala", email: "anomala@example.invalid",
      passwordHash: "x", pinHash: "x", roleId: ownerD.roleId, branchId: "main",
      emailVerificationHash: "invite:anomala", emailVerificationExpiresAt: new Date(Date.now() + 86400000),
    } });
    const reissued = await platformPost("/api/platform/tenants/piloto-d/reinvite", { operadora: "Ana Operadora" });
    expect(reissued.status, JSON.stringify(reissued.body)).toBe(201);
    expect((await q(`SELECT "emailVerificationHash" FROM "User" WHERE email='anomala@example.invalid'`))[0].emailVerificationHash).toBe("invite:anomala");
    const tokenD2 = reissued.body.invitationUrl.split("#token=")[1];
    expect((await http.post("/api/auth/accept-invitation").send({ token: tokenD2, password, managerPin: "869253", consentAccepted: true })).status).toBe(201);
    const lifecycleD = await q(`SELECT action, after FROM "AuditLog" WHERE "tenantId"=$1::uuid AND entity='invitation' ORDER BY "createdAt"`, tenantD);
    expect(lifecycleD.map((row) => row.action)).toEqual(["invitation.created", "invitation.revoked", "invitation.reissued", "invitation.accepted"]);
    expect(lifecycleD[1].after).toMatchObject({ operadora: "Ana Operadora" });

    // INV-01 con textos web aprobados: exige y guarda la versión vigente.
    process.env.PRODUCT_LEGAL_APPROVED = "confirmed";
    process.env.PRODUCT_TERMS_VERSION = "terms-test-1";
    process.env.PRODUCT_PRIVACY_VERSION = "privacy-test-1";
    const createdF = await platformPost("/api/platform/tenants", pilot("piloto-f", "f@example.invalid"));
    const tokenF = createdF.body.invitationUrl.split("#token=")[1];
    const acceptF = (extra: object) => http.post("/api/auth/accept-invitation").send({ token: tokenF, password, managerPin: "869253", consentAccepted: true, ...extra });
    expect((await acceptF({ termsVersion: "vieja", privacyVersion: "privacy-test-1" })).status).toBe(409);
    expect((await acceptF({ termsVersion: "terms-test-1", privacyVersion: "privacy-test-1" })).status).toBe(201);
    expect((await q(`SELECT "termsVersion", "privacyVersion" FROM "Tenant" WHERE id=$1::uuid`, createdF.body.id))[0])
      .toEqual({ termsVersion: "terms-test-1", privacyVersion: "privacy-test-1" });
    delete process.env.PRODUCT_LEGAL_APPROVED;

    // El registro público sigue cerrado.
    const register = await http.post("/api/auth/register").send({
      businessName: "Abierta", ownerName: "Nadie", email: "open@example.invalid", password, managerPin: "869253",
      businessType: "retail", companyCode: "abierta", termsAccepted: true, privacyAccepted: true,
      termsVersion: "t1", privacyVersion: "p1",
    });
    expect(register.status).toBe(404);
    expect(await q(`SELECT 1 FROM "Tenant" WHERE slug='abierta'`)).toHaveLength(0);

    // Fallos del token de plataforma: tras 5 por minuto, ni el token bueno pasa.
    for (let i = 0; i < 2; i++)
      expect((await http.get("/api/platform/tenants").set("Authorization", `Platform ${"x".repeat(40)}`)).status).toBe(401);
    expect((await http.get("/api/platform/tenants").set("Authorization", auth)).status).toBe(429);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.$disconnect().catch(() => undefined);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await pg.stop();
  }
}, 180000);

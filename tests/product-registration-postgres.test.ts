import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it, vi } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { RegistrationService } from "../apps/api/src/registration";

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

it("no acepta borradores sin aprobación ni versiones legales caducadas", async () => {
  const keys = ["PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION"];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const service = new RegistrationService();
  const input = {
    businessName: "Negocio ficticio", ownerName: "Dueña ficticia", email: "legal@example.invalid",
    password: "ClaveSegura-2026!", managerPin: "869253", businessType: "retail",
    companyCode: "legal-test", termsAccepted: true, privacyAccepted: true,
    termsVersion: "terms-test-1", privacyVersion: "privacy-test-1",
  } as const;
  try {
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_PUBLIC_REGISTRATION = "enabled";
    process.env.PRODUCT_TERMS_VERSION = input.termsVersion;
    process.env.PRODUCT_PRIVACY_VERSION = input.privacyVersion;
    delete process.env.PRODUCT_LEGAL_APPROVED;
    await expect(service.register(input)).rejects.toMatchObject({ status: 503 });
    process.env.PRODUCT_LEGAL_APPROVED = "confirmed";
    await expect(service.register({ ...input, termsVersion: "anterior" })).rejects.toMatchObject({ status: 409 });
  } finally {
    await service.onModuleDestroy();
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key];
    }
  }
});

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
  const previous = Object.fromEntries(["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL", "RESEND_API_BASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].map(k => [k, process.env[k]]));
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
    process.env.PRODUCT_LEGAL_APPROVED = "confirmed";
    process.env.PRODUCT_TERMS_VERSION = "terms-test-1";
    process.env.PRODUCT_PRIVACY_VERSION = "privacy-test-1";
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
    // Modo producto, correo configurado, pero todavía sin aprobación legal:
    // el alta pública permanece cerrada por defecto y no deja Tenant.
    delete process.env.PRODUCT_PUBLIC_REGISTRATION;
    const accepted = { ...input, termsAccepted: true, privacyAccepted: true, termsVersion: "terms-test-1", privacyVersion: "privacy-test-1" };
    const closed = await http.post("/api/auth/register").send({ ...accepted, companyCode: "closed-store" });
    expect(closed.status).toBe(404);
    client = db.getPgClient("registration_qa", "127.0.0.1");
    await client.connect();
    expect((await client.query(`SELECT count(*)::int AS n FROM "Tenant" WHERE slug='closed-store'`)).rows[0].n).toBe(0);
    process.env.PRODUCT_PUBLIC_REGISTRATION = "enabled";
    const withoutConsent = await http.post("/api/auth/register").send(input);
    expect(withoutConsent.status).toBe(400);
    const created = await http.post("/api/auth/register").send(accepted);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(html).toContain("/confirmar-correo#token=");
    const token = html.match(/#token=([a-f0-9]{64})/)?.[1];
    expect(token).toHaveLength(64);
    const tenants = await client.query(`SELECT id, status, "trialEndsAt", "termsAcceptedAt", "termsVersion", "privacyAcceptedAt", "privacyVersion" FROM "Tenant" WHERE slug='tienda-de-prueba'`);
    expect(tenants.rows).toHaveLength(1);
    expect(tenants.rows[0].status).toBe("trial");
    expect(new Date(tenants.rows[0].trialEndsAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000);
    expect(tenants.rows[0].termsVersion).toBe("terms-test-1");
    expect(tenants.rows[0].privacyVersion).toBe("privacy-test-1");
    expect(new Date(tenants.rows[0].termsAcceptedAt).getTime()).toBeGreaterThan(Date.now() - 60000);
    expect(new Date(tenants.rows[0].privacyAcceptedAt).getTime()).toBeGreaterThan(Date.now() - 60000);
    expect((await client.query(`SELECT count(*)::int AS n FROM "Role" WHERE "tenantId"=$1`, [tenants.rows[0].id])).rows[0].n).toBe(1);
    expect((await client.query(`SELECT count(*)::int AS n FROM "Settings" WHERE "tenantId"=$1`, [tenants.rows[0].id])).rows[0].n).toBe(1);
    const owner = await client.query(`SELECT "pinHash" FROM "User" WHERE "tenantId"=$1`, [tenants.rows[0].id]);
    expect(await apiRequire("bcryptjs").compare(input.managerPin, owner.rows[0].pinHash)).toBe(true);
    expect(owner.rows[0].pinHash).not.toContain(input.managerPin);
    const before = await http.post("/api/auth/login").set("x-tenant-id", input.companyCode).send({ login: input.email, password: input.password });
    expect(before.status).toBe(403);
    failNextMail = true;
    expect((await http.post("/api/auth/resend-verification").send({ companyCode: input.companyCode, email: input.email })).status).toBe(503);
    // Un reenvío fallido no inutiliza el enlace inicial.
    expect((await http.post("/api/auth/verify-email").send({ token })).status).toBe(201);
    expect((await http.post("/api/auth/verify-email").send({ token })).status).toBe(400);
    const after = await http.post("/api/auth/login").set("x-tenant-id", input.companyCode).send({ login: input.email, password: input.password });
    expect(after.status, JSON.stringify(after.body)).toBe(201);
    expect(after.body.user.tenantId).toBe(tenants.rows[0].id);
    const aToken = `Bearer ${after.body.accessToken}`;
    const initialGuide = await http.get("/api/onboarding").set("Authorization", aToken);
    expect(initialGuide.status).toBe(200);
    expect(initialGuide.body).toMatchObject({ available: true, dismissed: false, businessType: "retail", categories: 0, products: 0 });
    expect(initialGuide.body).toMatchObject({ businessName: "Tienda de prueba", legalId: "", hasLogo: false, selectedModules: [] });
    const profile = { name: "Tienda QA", legalId: "123456789", modules: ["sales", "inventory", "sales"] };
    const savedProfile = await http.post("/api/onboarding/profile").set("Authorization", aToken).send(profile);
    expect(savedProfile.status).toBe(201);
    expect(savedProfile.body).toMatchObject({ businessName: "Tienda QA", legalId: "123456789", selectedModules: ["sales", "inventory"] });
    expect((await http.get("/api/onboarding").set("Authorization", aToken)).body)
      .toMatchObject({ businessName: "Tienda QA", legalId: "123456789", selectedModules: ["sales", "inventory"] });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lNcAAAAASUVORK5CYII=", "base64");
    expect((await http.post("/api/settings/logo").set("Authorization", aToken).attach("file", png, "marca.png")).status).toBe(201);
    expect((await http.get("/api/onboarding").set("Authorization", aToken)).body.hasLogo).toBe(true);
    expect((await http.post("/api/onboarding/profile").set("Authorization", aToken).send({ ...profile, modules: ["unknown"] })).status).toBe(400);
    expect((await http.post("/api/onboarding").set("Authorization", aToken).send({ dismissed: true })).body.dismissed).toBe(true);
    expect((await http.get("/api/onboarding").set("Authorization", aToken)).body.dismissed).toBe(true);
    expect((await http.get("/api/onboarding").set("Authorization", aToken)).body.selectedModules).toEqual(["sales", "inventory"]);
    expect((await http.post("/api/onboarding").set("Authorization", aToken).send({ dismissed: false })).body.dismissed).toBe(false);
    expect((await http.post("/api/categories").set("Authorization", aToken).send({ name: "Abarrotes" })).status).toBe(201);
    expect((await http.get("/api/onboarding").set("Authorization", aToken)).body.categories).toBe(1);
    const roleId = randomUUID();
    await client.query(`INSERT INTO "Role" (id, "tenantId", name, permissions, "updatedAt") VALUES ($1, $2, 'seller', $3, now())`,
      [roleId, tenants.rows[0].id, ["catalog:read", "sale:write", "cash:write", "customers:write"]]);
    const cashier = (name: string) => ({ name, username: name, password: "729486", pin: "869254", roleId });
    const firstCashier = await http.post("/api/users").set("Authorization", aToken).send(cashier("Cajera A"));
    expect(firstCashier.status, JSON.stringify(firstCashier.body)).toBe(201);
    const cashierLogin = await http.post("/api/auth/login").set("x-tenant-id", input.companyCode)
      .send({ login: "Cajera A", password: "729486" });
    expect(cashierLogin.status, JSON.stringify(cashierLogin.body)).toBe(201);
    expect(cashierLogin.body.requiresPasswordChange).toBe(true);
    const cashierChanged = await http.post("/api/auth/change-password").set("x-tenant-id", input.companyCode)
      .send({ login: "Cajera A", currentPassword: "729486", newPassword: "825419", confirmPassword: "825419" });
    expect(cashierChanged.status, JSON.stringify(cashierChanged.body)).toBe(201);
    const sellerToken = `Bearer ${cashierChanged.body.accessToken}`;
    const deniedProfile = await http.post("/api/onboarding/profile").set("Authorization", sellerToken).send(profile);
    expect(deniedProfile.status, JSON.stringify(deniedProfile.body)).toBe(403);
    const deniedLogo = await http.post("/api/settings/logo").set("Authorization", sellerToken).attach("file", png, "marca.png");
    expect(deniedLogo.status, JSON.stringify(deniedLogo.body)).toBe(403);
    const overUsers = await http.post("/api/users").set("Authorization", aToken).send(cashier("Cajera B"));
    expect(overUsers.status, JSON.stringify(overUsers.body)).toBe(409);
    expect((await http.patch(`/api/users/${firstCashier.body.id}`).set("Authorization", aToken).send({ active: false })).status).toBe(200);
    expect((await http.post("/api/users").set("Authorization", aToken).send(cashier("Cajera B"))).status).toBe(201);
    expect((await http.patch(`/api/users/${firstCashier.body.id}`).set("Authorization", aToken).send({ active: true })).status).toBe(409);
    const device = (id: string) => ({ id, name: "Caja de prueba", secret: "only-local-test-secret-123" });
    expect((await http.post("/api/terminals/register").set("Authorization", aToken)
      .send(device("00000000-0000-4000-8000-000000000101"))).status).toBe(201);
    const overBoxes = await http.post("/api/terminals/register").set("Authorization", aToken)
      .send(device("00000000-0000-4000-8000-000000000102"));
    expect(overBoxes.status, JSON.stringify(overBoxes.body)).toBe(409);
    expect((await http.post("/api/auth/register").send(accepted)).status).toBe(409);
    failNextMail = true;
    const second = await http.post("/api/auth/register").send({ ...accepted, companyCode: "otra-tienda" });
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
    const secondLogin = await http.post("/api/auth/login").set("x-tenant-id", "otra-tienda")
      .send({ login: input.email, password: input.password });
    expect(secondLogin.status).toBe(201);
    expect((await http.get("/api/onboarding").set("Authorization", `Bearer ${secondLogin.body.accessToken}`)).body.categories).toBe(0);
    expect((await http.post("/api/auth/resend-verification").send({ companyCode: "otra-tienda", email: "absent@example.invalid" })).body.message).toBe(resent.body.message);
    // Cerrado + sin consentimiento + dos altas + duplicado ya agotaron los cinco intentos.
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

import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it, vi } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { reviewProductBilling } from "../apps/api/scripts/review-product-billing";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
async function port() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("transferencia: dueño envía prueba, sólo operador separado aprueba, una vez y sin invadir otra empresa", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-billing-"));
  const pgPort = await port();
  const pg = new EmbeddedPostgres({
    databaseDir: directory, user: "billing_test", password: "local_test_only",
    port: pgPort, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const keys = ["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL", "RESEND_API_BASE", "NEXORA_BILLING_BANK_NAME", "NEXORA_BILLING_BANK_ACCOUNT", "NEXORA_BILLING_BANK_HOLDER", "BILLING_TEST_MODE"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let app: any;
  let operatorDb: InstanceType<typeof PrismaClient> | undefined;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("billing_qa");
    process.env.DATABASE_URL = `postgresql://billing_test:local_test_only@127.0.0.1:${pgPort}/billing_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], { cwd: root, env: process.env, timeout: 120000 });
    operatorDb = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    // En la integración final esta columna procede de la migración del punto 3.
    await operatorDb.$executeRawUnsafe('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paidThroughAt" timestamp(3)');
    await operatorDb.$executeRawUnsafe('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pastDueAt" timestamp(3)');
    await operatorDb.$executeRawUnsafe('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp(3)');
    await operatorDb.$executeRawUnsafe('GRANT UPDATE ("paidThroughAt") ON "Tenant" TO nexora_platform_billing');
    await operatorDb.$executeRawUnsafe('GRANT UPDATE ("pastDueAt", "suspendedAt") ON "Tenant" TO nexora_platform_billing');
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_PUBLIC_REGISTRATION = "enabled";
    process.env.PRODUCT_LEGAL_APPROVED = "confirmed";
    process.env.PRODUCT_TERMS_VERSION = "terms-test-1";
    process.env.PRODUCT_PRIVACY_VERSION = "privacy-test-1";
    process.env.RESEND_API_KEY = "local-test-only";
    process.env.NOTIFY_EMAIL_FROM = "Nexora <test@example.invalid>";
    process.env.APP_PUBLIC_URL = "https://example.invalid";
    process.env.RESEND_API_BASE = "https://mail.example.invalid";
    process.env.NEXORA_BILLING_BANK_NAME = "Banco ficticio";
    process.env.NEXORA_BILLING_BANK_ACCOUNT = "000TEST000";
    process.env.NEXORA_BILLING_BANK_HOLDER = "Nexora prueba";
    process.env.BILLING_TEST_MODE = "enabled";
    let html = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
      html = JSON.parse(String(options.body)).html;
      return { ok: true };
    }));
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-secret-for-billing-product-more-than-32"), { logger: false });
    app.setGlobalPrefix("api"); app.useGlobalFilters(new ApiExceptionFilter()); await app.init();
    const http = supertest(app.getHttpServer());
    const register = async (companyCode: string) => {
      const body = { businessName: companyCode, ownerName: "Dueña ficticia", email: `${companyCode}@example.invalid`, password: "ClaveSegura-2026!", managerPin: "869253", businessType: "retail", companyCode, termsAccepted: true, privacyAccepted: true, termsVersion: "terms-test-1", privacyVersion: "privacy-test-1" };
      expect((await http.post("/api/auth/register").send(body)).status).toBe(201);
      const token = html.match(/#token=([a-f0-9]{64})/)?.[1];
      expect((await http.post("/api/auth/verify-email").send({ token })).status).toBe(201);
      const login = await http.post("/api/auth/login").set("x-tenant-id", companyCode).send({ login: body.email, password: body.password });
      expect(login.status, JSON.stringify(login.body)).toBe(201);
      return `Bearer ${login.body.accessToken}`;
    };
    const ownerA = await register("negocio-uno");
    const ownerB = await register("negocio-dos");
    const banks = await http.get("/api/billing/providers").set("Authorization", ownerA);
    expect(banks.body).toContainEqual({ kind: "bank_transfer", instructions: { bank: "Banco ficticio", account: "000TEST000", holder: "Nexora prueba" } });
    expect((await http.post("/api/billing/requests").send({ plan: "pro", provider: "bank_transfer" })).status).toBe(400);
    const requested = await http.post("/api/billing/requests").set("Authorization", ownerA).send({ plan: "pro", provider: "bank_transfer", amount: 1 });
    expect(requested.status).toBe(400); // No aceptar un monto controlado por el cliente.
    const request = await http.post("/api/billing/requests").set("Authorization", ownerA).send({ plan: "pro", provider: "bank_transfer" });
    expect(request.status, JSON.stringify(request.body)).toBe(201);
    expect(Number(request.body.amount)).toBe(3990);
    const id = request.body.id;
    expect(id, JSON.stringify(request.body)).toMatch(/^[0-9a-f-]{36}$/i);
    expect((await http.get("/api/billing/requests").set("Authorization", ownerB)).body).toEqual([]);
    const pendingThrough = new Date(Date.now() + 30 * 86400000);
    await expect(reviewProductBilling(operatorDb!, { requestId: id, decision: "approved", paidThroughAt: pendingThrough, reviewer: "Operadora ficticia", reason: "Banco confirmado" })).rejects.toThrow("pendiente");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
    const proof = await http.post(`/api/billing/requests/${id}/proof`).set("Authorization", ownerA).attach("file", png, "comprobante.png");
    expect(proof.status, JSON.stringify(proof.body)).toBe(201);
    const listed = await http.get("/api/billing/requests").set("Authorization", ownerA);
    expect(listed.body[0].hasProof).toBe(true);
    expect(JSON.stringify(listed.body)).not.toContain("base64");
    expect((await http.get(`/api/billing/requests/${id}/proof`).set("Authorization", ownerB)).status).toBe(400);
    const digest = createHash("sha256").update(png).digest("hex");
    const review = { requestId: id, decision: "approved" as const, paidThroughAt: pendingThrough, expectedProofSha256: digest, reviewer: "Operadora ficticia", reason: "Banco confirmado" };
    await expect(reviewProductBilling(operatorDb!, { ...review, expectedProofSha256: "0".repeat(64) })).rejects.toThrow("SHA-256");
    expect(await reviewProductBilling(operatorDb!, review)).toMatchObject({ status: "approved", alreadyReviewed: false });
    expect(await reviewProductBilling(operatorDb!, review)).toMatchObject({ alreadyReviewed: true });
    const rows = await operatorDb.$queryRawUnsafe<Array<{ n: bigint }>>('SELECT count(*) AS n FROM "BillingDecision" WHERE "requestId"=$1::uuid', id);
    expect(Number(rows[0].n)).toBe(1);
    const other = await operatorDb.tenant.findUnique({ where: { slug: "negocio-dos" } });
    const activated = await operatorDb.tenant.findUnique({ where: { slug: "negocio-uno" } });
    expect(activated?.status).toBe("active");
    expect(activated?.plan).toBe("pro");
    expect(other?.status).toBe("trial");
    const pendingTerminalId = randomUUID();
    await operatorDb!.terminal.create({ data: {
      id: pendingTerminalId, tenantId: activated!.id, name: "Caja pendiente",
      branchId: "segunda", secretHash: "solo-fixture",
    } });
    const branchDowngrade = await http.post("/api/billing/requests").set("Authorization", ownerA).send({ plan: "autoservicio", provider: "bank_transfer" });
    expect(branchDowngrade.status).toBe(201);
    expect((await http.post(`/api/billing/requests/${branchDowngrade.body.id}/proof`).set("Authorization", ownerA).attach("file", png, "comprobante.png")).status).toBe(201);
    await expect(reviewProductBilling(operatorDb!, { ...review, requestId: branchDowngrade.body.id })).rejects.toThrow("Libera cupos");
    await operatorDb!.terminal.delete({ where: { id: pendingTerminalId } });
    await expect(operatorDb!.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_platform_billing");
      await tx.$queryRawUnsafe('SELECT "passwordHash" FROM "User" LIMIT 1');
    })).rejects.toThrow();
    await operatorDb!.$executeRawUnsafe(`INSERT INTO "User" (id,"tenantId",name,username,"usernameKey",email,"passwordHash","pinHash","roleId","branchId","updatedAt")
      SELECT gen_random_uuid(),"tenantId",name,'cajera2','cajera2','cajera2@example.invalid',"passwordHash","pinHash","roleId","branchId",now()
      FROM "User" WHERE "tenantId"=$1::uuid LIMIT 1`, activated!.id);
    await operatorDb!.$executeRawUnsafe(`INSERT INTO "User" (id,"tenantId",name,username,"usernameKey",email,"passwordHash","pinHash","roleId","branchId","updatedAt")
      SELECT gen_random_uuid(),"tenantId",name,'cajera3','cajera3','cajera3@example.invalid',"passwordHash","pinHash","roleId","branchId",now()
      FROM "User" WHERE "tenantId"=$1::uuid LIMIT 1`, activated!.id);
    await operatorDb!.$executeRawUnsafe(`UPDATE "User" SET active=false WHERE "tenantId"=$1::uuid AND "usernameKey"='cajera3'`, activated!.id);
    const downgrade = await http.post("/api/billing/requests").set("Authorization", ownerA).send({ plan: "autoservicio", provider: "bank_transfer" });
    expect(downgrade.status).toBe(201);
    expect((await http.post(`/api/billing/requests/${downgrade.body.id}/proof`).set("Authorization", ownerA).attach("file", png, "comprobante.png")).status).toBe(201);
    let signalLocked!: () => void;
    let releaseLock!: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const gate = new Promise<void>((resolve) => { releaseLock = resolve; });
    const holder = operatorDb!.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${activated!.id}`}))::text`;
      signalLocked();
      await gate;
      await tx.$executeRawUnsafe(`UPDATE "User" SET active=true WHERE "tenantId"=$1::uuid AND "usernameKey"='cajera3'`, activated!.id);
    }, { timeout: 10000 });
    await locked;
    let reviewSettled = false;
    const pendingReview = reviewProductBilling(operatorDb!, { ...review, requestId: downgrade.body.id }).then(
      (value) => { reviewSettled = true; return { value, error: null }; },
      (error: unknown) => { reviewSettled = true; return { value: null, error }; },
    );
    try {
      let waitingForQuotaLock = false;
      for (let attempt = 0; attempt < 80 && !reviewSettled; attempt++) {
        const locks = await operatorDb!.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted`;
        waitingForQuotaLock = Number(locks[0].n) > 0;
        if (waitingForQuotaLock) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(waitingForQuotaLock).toBe(true);
      expect(reviewSettled).toBe(false);
    } finally {
      releaseLock();
      await holder;
    }
    expect((await pendingReview).error).toMatchObject({ message: expect.stringContaining("Libera cupos") });
    expect((await operatorDb!.tenant.findUnique({ where: { slug: "negocio-uno" } }))?.plan).toBe("pro");
  } finally {
    await app?.close().catch(() => undefined);
    await operatorDb?.$disconnect().catch(() => undefined);
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await pg.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

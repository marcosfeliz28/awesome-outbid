import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { TenantLifecycleService } from "../apps/api/src/tenant-lifecycle";

// Decisiones de la dueña (19-nov): avisos de pago 2 días antes y 2 después,
// suspendido puede pedir el pago, prueba de 7 días con prórroga/plan del
// operador (H5) y cobro a una empresa en «trial» eligiendo el plan (H1).
const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const DAY = 86_400_000;
const platformToken = "operador-plataforma-cuentas-prueba-".padEnd(
  72,
  "0123456789abcdef",
);
const keys = [
  "DATABASE_URL",
  "PRODUCT_TENANCY",
  "PRODUCT_PUBLIC_REGISTRATION",
  "PLATFORM_ADMIN_TOKEN_SHA256",
  "PLATFORM_OPERATOR_LABEL",
  "APP_PUBLIC_URL",
  "RESEND_API_KEY",
  "NOTIFY_EMAIL_FROM",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "BILLING_TEST_MODE",
  "NEXORA_BILLING_BANK_NAME",
  "NEXORA_BILLING_BANK_ACCOUNT",
  "NEXORA_BILLING_BANK_HOLDER",
  "PRODUCT_OBJECT_STORE_DIR",
  "NEXORA_SUPPORT_CONTACT",
];

async function port() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

async function database(directory: string) {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) {
    const admin = new PrismaClient({ datasources: { db: { url: external } } });
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_cuentas_test" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_cuentas_test"');
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_cuentas_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: join(directory, "pg"),
    user: "cuentas_test",
    password: "only_local_test",
    port: pgPort,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  await db.initialise();
  await db.start();
  await db.createDatabase("cuentas_qa");
  return {
    url: `postgresql://cuentas_test:only_local_test@127.0.0.1:${pgPort}/cuentas_qa`,
    stop: async () => {
      await db.stop().catch(() => undefined);
    },
  };
}

it("avisos 2 días antes/después, pago estando suspendido, prueba de 7 días, prórroga/plan del operador y cobro a «trial»", async () => {
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const directory = await mkdtemp(join(tmpdir(), "nexora-cuentas-"));
  const pg = await database(directory);
  let app: any;
  let client: any;
  try {
    process.env.DATABASE_URL = pg.url;
    await run(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "deploy",
        "--schema",
        join(root, "apps/api/prisma/schema.prisma"),
      ],
      {
        cwd: root,
        env: process.env,
        timeout: 120000,
      },
    );
    process.env.PRODUCT_TENANCY = "required";
    process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
    process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256")
      .update(platformToken)
      .digest("hex");
    process.env.PLATFORM_OPERATOR_LABEL = "dueña-nexora";
    process.env.BILLING_TEST_MODE = "enabled";
    process.env.NEXORA_BILLING_BANK_NAME = "Banco ficticio";
    process.env.NEXORA_BILLING_BANK_ACCOUNT = "000TEST000";
    process.env.NEXORA_BILLING_BANK_HOLDER = "Nexora prueba";
    process.env.PRODUCT_OBJECT_STORE_DIR = join(directory, "objects");
    process.env.NEXORA_SUPPORT_CONTACT = "WhatsApp de prueba 000-000-0000";
    for (const k of [
      "PRODUCT_PUBLIC_REGISTRATION",
      "RESEND_API_KEY",
      "NOTIFY_EMAIL_FROM",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
    ])
      delete process.env[k];
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(
      createAppModule("test-secret-for-product-cuentas-at-least-32ch"),
      { logger: false },
    );
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    client = new PrismaClient({ datasources: { db: { url: pg.url } } });
    const q = (sql: string, ...params: unknown[]) =>
      client.$queryRawUnsafe(sql, ...params) as Promise<any[]>;

    // 3: invitación sin trialDays = 7 días de prueba.
    const password = "ClaveSegura-2026!";
    const tenants: Record<string, { id: string; bearer: string }> = {};
    for (const code of ["cuenta-a", "cuenta-b"]) {
      const before = Date.now();
      const created = await http
        .post("/api/platform/tenants")
        .set("Authorization", auth)
        .send({
          businessName: `Piloto ${code}`,
          companyCode: code,
          businessType: "retail",
          plan: "basico",
          adminName: "Dueña piloto",
          adminEmail: `${code}@example.invalid`,
          operadora: "Ana Operadora",
          acuerdo: {
            version: "piloto-1",
            fecha: "2026-11-19",
            referencia: "Carpeta 19",
          },
        });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const trial = new Date(created.body.trialEndsAt).getTime();
      expect(trial).toBeGreaterThanOrEqual(before + 7 * DAY);
      expect(trial).toBeLessThan(before + 7 * DAY + 60_000);
      const token = created.body.invitationUrl.split("#token=")[1];
      expect(
        (
          await http.post("/api/auth/accept-invitation").send({
            token,
            password,
            managerPin: "869253",
            consentAccepted: true,
          })
        ).status,
      ).toBe(201);
      const login = await http
        .post("/api/auth/login")
        .set("x-tenant-id", code)
        .send({ login: `${code}@example.invalid`, password });
      expect(login.status, JSON.stringify(login.body)).toBe(201);
      tenants[code] = {
        id: created.body.id,
        bearer: `Bearer ${login.body.accessToken}`,
      };
    }
    const A = tenants["cuenta-a"],
      B = tenants["cuenta-b"];
    const tenantRow = async (id: string) =>
      (
        await q(
          `SELECT plan, status, "trialEndsAt", "paidThroughAt" FROM "Tenant" WHERE id=$1::uuid`,
          id,
        )
      )[0];

    // 1: avisos. 2 días antes: uno (idempotente) para A, nada para B.
    const lifecycle = app.get(TenantLifecycleService) as TenantLifecycleService;
    await q(
      `UPDATE "Tenant" SET "trialEndsAt"=$2, "timeZone"='America/Santo_Domingo' WHERE id=$1::uuid`,
      A.id,
      new Date("2030-03-10T02:00:00Z"),
    );
    await q(
      `UPDATE "Tenant" SET "trialEndsAt"=$2 WHERE id=$1::uuid`,
      B.id,
      new Date("2030-04-10T02:00:00Z"),
    );
    await lifecycle.queueNotices(new Date("2030-03-07T01:00:00Z")); // 3 días antes: todavía no.
    expect(await q(`SELECT 1 FROM "Alert" WHERE type='plan_due'`)).toHaveLength(
      0,
    );
    const before2 = new Date("2030-03-08T03:00:00Z");
    await lifecycle.queueNotices(before2);
    await lifecycle.queueNotices(before2);
    const notices = await q(
      `SELECT "tenantId", kind FROM "TenantLifecycleNotice" WHERE status <> 'operator'`,
    );
    expect(notices).toEqual([{ tenantId: A.id, kind: "trial_due_2" }]);
    const alerts = await q(
      `SELECT "tenantId", message, severity FROM "Alert" WHERE type='plan_due'`,
    );
    expect(alerts.map((a) => a.tenantId)).toEqual([A.id]);
    // H10: vence 02:00 UTC del 10 = 9 de marzo en Santo Domingo.
    expect(alerts[0].message).toMatch(
      /prueba gratis de Norexos vence el 9 de marzo de 2030\. Paga para seguir/,
    );
    expect(
      (
        await http
          .get("/api/alerts?type=plan_due")
          .set("Authorization", B.bearer)
      ).body,
    ).toHaveLength(0);
    // Sin RESEND solo app: el correo no sale ni se marca.
    const mails: Array<{ to: string; subject: string }> = [];
    const mailer = async (settings: { to: string }, subject: string) => {
      mails.push({ to: settings.to, subject });
      return { ok: true };
    };
    await lifecycle.sendPendingNotices(before2, mailer);
    expect(mails).toHaveLength(0);
    // Con RESEND: un correo a la dueña de A, una sola vez.
    process.env.RESEND_API_KEY = "local-test-only";
    process.env.NOTIFY_EMAIL_FROM = "Nexora <test@example.invalid>";
    await lifecycle.sendPendingNotices(before2, mailer);
    await lifecycle.sendPendingNotices(before2, mailer);
    expect(mails).toEqual([
      {
        to: "cuenta-a@example.invalid",
        subject: "Tu prueba gratis de Norexos vence el 9 de marzo de 2030",
      },
    ]);
    // 2 días después (en mora): aviso de suspensión, una vez; antes de los 2 días, nada.
    await lifecycle.queueNotices(new Date("2030-03-11T02:00:00Z"));
    await lifecycle.advance(new Date("2030-03-11T02:00:00Z"));
    expect((await tenantRow(A.id)).status).toBe("past_due");
    expect(
      await q(`SELECT 1 FROM "TenantLifecycleNotice" WHERE kind='overdue_2'`),
    ).toHaveLength(0);
    const after2 = new Date("2030-03-12T03:00:00Z");
    await lifecycle.queueNotices(after2);
    await lifecycle.queueNotices(after2);
    await lifecycle.sendPendingNotices(after2, mailer);
    expect(
      (
        await q(
          `SELECT "tenantId" FROM "TenantLifecycleNotice" WHERE kind='overdue_2'`,
        )
      ).map((r) => r.tenantId),
    ).toEqual([A.id]);
    expect(mails).toHaveLength(2);
    expect(mails[1].subject).toMatch(/se va a suspender/);
    const overdue = await q(
      `SELECT message, severity FROM "Alert" WHERE type='plan_due' AND message LIKE '%mora%'`,
    );
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ severity: "high" });
    expect(overdue[0].message).toMatch(
      /venció el 9 de marzo de 2030.*antes del 16 de marzo de 2030/,
    );
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFY_EMAIL_FROM;

    // GET /tenant/status lleva el aviso del momento (banner) y, suspendido, el contacto.
    await q(
      `UPDATE "Tenant" SET status='past_due', "pastDueAt"=now() - interval '3 days' WHERE id=$1::uuid`,
      A.id,
    );
    const status = await http
      .get("/api/tenant/status")
      .set("Authorization", A.bearer);
    expect(status.body).toMatchObject({
      status: "past_due",
      notice: { kind: "overdue_2" },
      supportContact: "WhatsApp de prueba 000-000-0000",
    });
    expect(
      (await http.get("/api/tenant/status").set("Authorization", B.bearer)).body
        .notice,
    ).toBeNull();

    // 2: suspendido. Solo pide el pago y sube el comprobante; lo demás sigue bloqueado.
    await q(
      `UPDATE "Tenant" SET status='suspended', "trialEndsAt"=now() - interval '10 days', "pastDueAt"=now() - interval '8 days', "suspendedAt"=now() WHERE id=$1::uuid`,
      A.id,
    );
    expect(
      (await http.get("/api/tenant/status").set("Authorization", A.bearer))
        .body,
    ).toMatchObject({ status: "suspended", notice: null });
    expect(
      (
        await http
          .post("/api/categories")
          .set("Authorization", A.bearer)
          .send({ name: "Prohibida" })
      ).status,
    ).toBe(403);
    const request = await http
      .post("/api/billing/requests")
      .set("Authorization", A.bearer)
      .send({ plan: "basico", provider: "bank_transfer" });
    expect(request.status, JSON.stringify(request.body)).toBe(201);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
      "base64",
    );
    const proof = await http
      .post(`/api/billing/requests/${request.body.id}/proof`)
      .set("Authorization", A.bearer)
      .attach("file", png, "comprobante.png");
    expect(proof.status, JSON.stringify(proof.body)).toBe(201);
    expect(await q(`SELECT "tenantId", status FROM "BillingRequest"`)).toEqual([
      { tenantId: A.id, status: "pending_review" },
    ]);
    // B no ve la solicitud de A ni puede subirle comprobante.
    expect(
      (await http.get("/api/billing/requests").set("Authorization", B.bearer))
        .body,
    ).toHaveLength(0);
    expect(
      (
        await http
          .post(`/api/billing/requests/${request.body.id}/proof`)
          .set("Authorization", B.bearer)
          .attach("file", png, "x.png")
      ).status,
    ).toBe(400);

    // 3/H5: prórroga y plan, solo el operador, con bitácora; B no cambia.
    const planRoute = (slug: string, body: object, authorization = auth) =>
      http
        .post(`/api/platform/tenants/${slug}/plan`)
        .set("Authorization", authorization)
        .send(body);
    expect(
      (
        await planRoute(
          "cuenta-a",
          { operadora: "Ana", motivo: "Piloto", prorrogarDias: 7 },
          A.bearer,
        )
      ).status,
    ).toBe(401);
    for (const body of [
      { operadora: "Ana", motivo: "Piloto" },
      { operadora: "Ana", motivo: "x", prorrogarDias: 7 },
      { operadora: "Ana", motivo: "Piloto", prorrogarDias: 0 },
      { operadora: "Ana", motivo: "Piloto", plan: "gratis" },
    ])
      expect(
        (await planRoute("cuenta-a", body)).status,
        JSON.stringify(body),
      ).toBe(400);
    expect(
      (
        await planRoute("no-existe", {
          operadora: "Ana",
          motivo: "Piloto",
          prorrogarDias: 7,
        })
      ).status,
    ).toBe(404);
    const startExtend = Date.now();
    const extended = await planRoute("cuenta-a", {
      operadora: "Ana Operadora",
      motivo: "Piloto de 60 días",
      prorrogarDias: 30,
    });
    expect(extended.status, JSON.stringify(extended.body)).toBe(201);
    expect(extended.body).toMatchObject({
      slug: "cuenta-a",
      status: "trial",
      plan: "basico",
    });
    // Ya vencida: cuenta desde hoy, no desde la fecha vieja.
    expect(
      new Date(extended.body.trialEndsAt).getTime(),
    ).toBeGreaterThanOrEqual(startExtend + 30 * DAY);
    expect(new Date(extended.body.trialEndsAt).getTime()).toBeLessThan(
      startExtend + 30 * DAY + 60_000,
    );
    expect(
      (
        await http
          .post("/api/categories")
          .set("Authorization", A.bearer)
          .send({ name: "Reactivada" })
      ).status,
    ).toBe(201);
    const planned = await planRoute("cuenta-a", {
      operadora: "Ana Operadora",
      motivo: "Pasa a Pro",
      plan: "pro",
    });
    expect(planned.status, JSON.stringify(planned.body)).toBe(201);
    expect((await tenantRow(A.id)).plan).toBe("pro");
    const audit = await q(
      `SELECT "tenantId", after FROM "AuditLog" WHERE action='platform_plan_update' ORDER BY "createdAt"`,
    );
    expect(audit.map((r) => r.tenantId)).toEqual([A.id, A.id]);
    expect(audit[0].after).toMatchObject({
      operadora: "Ana Operadora",
      motivo: "Piloto de 60 días",
      prorrogarDias: 30,
    });
    expect(await tenantRow(B.id)).toMatchObject({
      plan: "basico",
      status: "trial",
    });
    expect((await tenantRow(B.id)).trialEndsAt.getTime()).toBe(
      new Date("2030-04-10T02:00:00Z").getTime(),
    );
    // A administra su bitácora; B no ve la de A.
    const auditB = await http
      .get("/api/audit-log")
      .set("Authorization", B.bearer);
    expect(JSON.stringify(auditB.body)).not.toContain("platform_plan_update");
    // Bajar de plan por debajo de lo que usa: 3 usuarios activos y Autoservicio permite 2.
    await q(
      `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
      SELECT gen_random_uuid(), "tenantId", 'Cajera ' || n, 'cajera' || n || '@example.invalid', 'x', 'x', "roleId", 'main', now()
      FROM "User", generate_series(1, 2) n WHERE "tenantId"=$1::uuid LIMIT 2`,
      A.id,
    );
    const downgrade = await planRoute("cuenta-a", {
      operadora: "Ana",
      motivo: "Baja",
      plan: "autoservicio",
    });
    expect(downgrade.status).toBe(409);
    expect((await tenantRow(A.id)).plan).toBe("pro");

    // H1: empresa autoregistrada en «trial» (sin precio): sin plan, 409; con plan, cobra y lo fija.
    await q(`UPDATE "Tenant" SET plan='trial' WHERE id=$1::uuid`, A.id);
    const pay = (body: object) =>
      http
        .post("/api/platform/tenants/cuenta-a/payments")
        .set("Authorization", auth)
        .send({
          operationId: randomUUID(),
          method: "transfer",
          months: 1,
          ...body,
        });
    const noPlan = await pay({ amount: 2000, reference: "BHD-H1-0" });
    expect(noPlan.status).toBe(409);
    expect(noPlan.body.message).toMatch(/elige el plan/);
    expect(
      (await pay({ amount: 1250, reference: "BHD-H1-1", plan: "basico" }))
        .status,
    ).toBe(400);
    const paid = await pay({
      amount: 2000,
      reference: "BHD-H1-2",
      plan: "basico",
    });
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect(paid.body.payment).toMatchObject({ plan: "basico" });
    expect(await tenantRow(A.id)).toMatchObject({
      plan: "basico",
      status: "active",
    });
    // Ya con plan, otro plan distinto en el cobro no se acepta.
    expect(
      (await pay({ amount: 4000, reference: "BHD-H1-3", plan: "pro" })).status,
    ).toBe(409);
    // Anular devuelve el plan anterior («trial») y el estado.
    const voided = await http
      .post(
        `/api/platform/tenants/cuenta-a/payments/${paid.body.payment.id}/void`,
      )
      .set("Authorization", auth)
      .send({ reason: "Anotado por error" });
    expect(voided.status, JSON.stringify(voided.body)).toBe(201);
    expect(await tenantRow(A.id)).toMatchObject({
      plan: "trial",
      status: "trial",
    });
    // Una empresa que ya pagó no vuelve a prueba.
    const repaid = await pay({
      amount: 2000,
      reference: "BHD-H1-4",
      plan: "basico",
    });
    expect(repaid.status).toBe(201);
    expect(
      (
        await planRoute("cuenta-a", {
          operadora: "Ana",
          motivo: "Más prueba",
          prorrogarDias: 5,
        })
      ).status,
    ).toBe(409);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.$disconnect().catch(() => undefined);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.stop();
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 12,
      retryDelay: 250,
    });
  }
}, 240000);

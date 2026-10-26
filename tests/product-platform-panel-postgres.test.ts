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
const platformToken = "operador-plataforma-solo-prueba-".padEnd(
  72,
  "0123456789abcdef",
);
const keys = [
  "DATABASE_URL",
  "PRODUCT_TENANCY",
  "PRODUCT_PUBLIC_REGISTRATION",
  "PLATFORM_ADMIN_TOKEN_SHA256",
  "APP_PUBLIC_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
];

async function port() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

// Como root, embedded-postgres no puede leer su mkdtemp: NEXORA_TEST_PG_URL
// (superusuario de un PostgreSQL local) usa una base desechable en su lugar.
async function database() {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) {
    const admin = new PrismaClient({ datasources: { db: { url: external } } });
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_platform_panel_test" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe(
      'CREATE DATABASE "nexora_platform_panel_test"',
    );
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_platform_panel_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const directory = await mkdtemp(join(tmpdir(), "nexora-platform-panel-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory,
    user: "platform_test",
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
  await db.createDatabase("platform_qa");
  return {
    url: `postgresql://platform_test:only_local_test@127.0.0.1:${pgPort}/platform_qa`,
    stop: async () => {
      await db.stop().catch(() => undefined);
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 12,
        retryDelay: 250,
      });
    },
  };
}

it("panel del operador: resumen, detalle con contacto y reenvío de invitación", async () => {
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const pg = await database();
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
        join(prismaDir, "schema.prisma"),
      ],
      {
        cwd: root,
        env: process.env,
        timeout: 120000,
      },
    );
    process.env.PRODUCT_TENANCY = "required";
    process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
    delete process.env.PRODUCT_PUBLIC_REGISTRATION;
    delete process.env.PLATFORM_ADMIN_TOKEN_SHA256;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(
      createAppModule("test-secret-for-product-platform-at-least-32ch"),
      { logger: false },
    );
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    const get = (path: string) => http.get(path).set("Authorization", auth);
    const post = (path: string, body: object = { operadora: "Ana Operadora" }) =>
      http.post(path).set("Authorization", auth).send(body);

    // Sin credencial configurada, las rutas nuevas tampoco existen.
    expect((await get("/api/platform/summary")).status).toBe(404);
    expect((await post("/api/platform/tenants/x1/reinvite")).status).toBe(404);
    process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256")
      .update(platformToken)
      .digest("hex");
    expect((await http.get("/api/platform/summary")).status).toBe(401);
    expect((await http.post("/api/platform/tenants/x1/reinvite")).status).toBe(
      401,
    );
    expect((await http.get("/api/platform/tenants/x1")).status).toBe(401);

    // La migración deja la empresa original: el resumen se compara contra esa base.
    const base = (await get("/api/platform/summary")).body;
    expect(base.monthIncome).toBe(0);
    const pilot = async (companyCode: string, trialDays = 30) => {
      const res = await post("/api/platform/tenants", {
        businessName: `Piloto ${companyCode}`,
        companyCode,
        businessType: "retail",
        plan: "basico",
        adminName: `Dueña ${companyCode}`,
        adminEmail: `${companyCode}@example.invalid`, operadora: "Ana Operadora", acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" },
        trialDays,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      return res.body;
    };
    const a = await pilot("panel-a"); // prueba con tiempo
    await pilot("panel-b", 3); // prueba por vencer
    const c = await pilot("panel-c"); // pagada (al día)
    const d = await pilot("panel-d"); // atrasada
    const e = await pilot("panel-e"); // suspendida
    client = new PrismaClient({ datasources: { db: { url: pg.url } } });
    const exec = (sql: string, ...params: unknown[]) =>
      client.$executeRawUnsafe(sql, ...params);
    expect(
      (
        await post("/api/platform/tenants/panel-c/payments", {
          amount: 990,
          method: "transfer",
          reference: "T-1",
          months: 1,
        })
      ).status,
    ).toBe(201);
    await exec(
      `UPDATE "Tenant" SET status='active', "paidThroughAt"=now() + interval '60 days' WHERE id=$1::uuid`,
      c.id,
    );
    await exec(
      `UPDATE "Tenant" SET "trialEndsAt"=now() - interval '2 days' WHERE id=$1::uuid`,
      d.id,
    );
    await exec(
      `UPDATE "Tenant" SET status='suspended' WHERE id=$1::uuid`,
      e.id,
    );
    // Pago de hace 40 días: no cuenta en el ingreso del mes.
    await exec(
      `INSERT INTO "PlatformPayment" (id,"tenantId",amount,method,reference,months,operator,"paidFrom","paidUntil","createdAt")
      VALUES (gen_random_uuid(),$1::uuid,500,'cash','VIEJO',1,'x',now() - interval '40 days',now(),now() - interval '40 days')`,
      c.id,
    );

    const summary = await get("/api/platform/summary");
    expect(summary.status, JSON.stringify(summary.body)).toBe(200);
    expect(summary.body).toEqual({
      total: base.total + 5,
      alDia: base.alDia + 1,
      // «En prueba» cuenta igual que su filtro (también la que vence en 3
      // días); «Por vencer» se superpone.
      enPrueba: base.enPrueba + 2,
      porVencer: base.porVencer + 1,
      atrasados: base.atrasados + 1,
      suspendidos: base.suspendidos + 1,
      month: expect.stringMatching(/^\d{4}-\d{2}$/),
      monthIncome: 990,
      monthPayments: 990,
      monthAiPacks: 0,
    });

    const detail = await get("/api/platform/tenants/panel-a");
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    expect(detail.body).toMatchObject({
      slug: "panel-a",
      name: "Piloto panel-a",
      plan: "basico",
      status: "trial",
      paidUntil: null,
      admin: {
        name: "Dueña panel-a",
        email: "panel-a@example.invalid",
        invitationPending: true,
      },
    });
    expect(
      new Date(detail.body.admin.invitationExpiresAt).getTime(),
    ).toBeGreaterThan(Date.now() + 6.9 * 86400000);
    expect(JSON.stringify(detail.body)).not.toMatch(
      /invite:|passwordHash|pinHash/,
    );
    expect((await get("/api/platform/tenants/no-existe")).status).toBe(404);
    expect(
      (await post("/api/platform/tenants/no-existe/reinvite")).status,
    ).toBe(404);

    // Reenviar: enlace nuevo; el viejo deja de servir.
    const oldToken = a.invitationUrl.split("#token=")[1];
    const again = await post("/api/platform/tenants/panel-a/reinvite");
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    expect(again.body.invitationUrl).toMatch(
      /^https:\/\/pos\.example\.invalid\/aceptar-invitacion#token=[a-f0-9]{64}$/,
    );
    const newToken = again.body.invitationUrl.split("#token=")[1];
    expect(newToken).not.toBe(oldToken);
    const accept = (token: string) =>
      http
        .post("/api/auth/accept-invitation")
        .send({ token, password: "ClaveSegura-2026!", managerPin: "869253", consentAccepted: true });
    expect((await accept(oldToken)).status).toBe(400);
    expect((await accept(newToken)).status).toBe(201);
    // Aceptada: ya no se reenvía y el detalle lo dice.
    expect((await post("/api/platform/tenants/panel-a/reinvite")).status).toBe(
      409,
    );
    expect(
      (await get("/api/platform/tenants/panel-a")).body.admin,
    ).toMatchObject({ invitationPending: false, invitationExpiresAt: null });
    // Otra empresa no se toca al reenviar la de panel-a.
    const b = await get("/api/platform/tenants/panel-b");
    expect(b.body.admin.invitationPending).toBe(true);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.$disconnect().catch(() => undefined);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.stop();
  }
}, 180000);

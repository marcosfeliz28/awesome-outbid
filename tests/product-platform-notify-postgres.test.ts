import { execFile } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
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
import { reserveAiQuestion } from "../apps/api/src/platform-ai-packs";
import { notifyOperator } from "../apps/api/src/platform-notify";
import { TenantLifecycleService } from "../apps/api/src/tenant-lifecycle";
import { tenantDatabaseProxy } from "../apps/api/src/tenant-database";
import { tenantScope } from "../apps/api/src/tenant-context";

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const DAY = 86_400_000;
const platformToken = "operador-plataforma-solo-prueba-".padEnd(
  72,
  "0123456789abcdef",
);
const resendKey = "re_prueba_secreta_no_debe_salir";
const botToken = "123456:bot-secreto-no-debe-salir-abcdefghij";
const keys = [
  "DATABASE_URL",
  "PRODUCT_TENANCY",
  "PRODUCT_PUBLIC_REGISTRATION",
  "PLATFORM_ADMIN_TOKEN_SHA256",
  "APP_PUBLIC_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_API_BASE",
  "RESEND_API_KEY",
  "RESEND_API_BASE",
  "NOTIFY_EMAIL_FROM",
  "NOTIFY_EMAIL_TO",
  "PLATFORM_OWNER_EMAIL",
  "PLATFORM_TELEGRAM_CHAT_ID",
  "SUPPORT_WHATSAPP",
  "SUPPORT_EMAIL",
  "SUPPORT_HOURS",
];

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
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_platform_notify_test" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe(
      'CREATE DATABASE "nexora_platform_notify_test"',
    );
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_platform_notify_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const directory = await mkdtemp(join(tmpdir(), "nexora-platform-notify-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory,
    user: "notify_test",
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
  await db.createDatabase("notify_qa");
  return {
    url: `postgresql://notify_test:only_local_test@127.0.0.1:${pgPort}/notify_qa`,
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

it("soporte y avisos al operador: una vez por evento, sin datos del negocio y sin romper la acción", async () => {
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const pg = await database();
  // Resend y Telegram falsos: guardan lo que les llega.
  const outbox: Array<{ channel: "email" | "telegram"; body: any }> = [];
  const fake = createHttpServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      outbox.push({
        channel: req.url === "/emails" ? "email" : "telegram",
        body: JSON.parse(raw || "{}"),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, id: "x" }));
    });
  });
  await new Promise<void>((done) => fake.listen(0, "127.0.0.1", done));
  const fakeBase = `http://127.0.0.1:${(fake.address() as any).port}`;
  let app: any;
  let client: any;
  let runtime: any;
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
    Object.assign(process.env, {
      PRODUCT_TENANCY: "required",
      APP_PUBLIC_URL: "https://pos.example.invalid",
      PLATFORM_ADMIN_TOKEN_SHA256: createHash("sha256")
        .update(platformToken)
        .digest("hex"),
      RESEND_API_KEY: resendKey,
      RESEND_API_BASE: fakeBase,
      NOTIFY_EMAIL_FROM: "Nexora <avisos@example.invalid>",
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_API_BASE: fakeBase,
      PLATFORM_OWNER_EMAIL: "duena@example.invalid",
      PLATFORM_TELEGRAM_CHAT_ID: "-100777",
      SUPPORT_WHATSAPP: "+1 (809) 555-1234",
      SUPPORT_EMAIL: "soporte@nexorapos.net",
      SUPPORT_HOURS: "Lunes a sábado, 9:00 a 6:00",
    });
    delete process.env.PRODUCT_PUBLIC_REGISTRATION;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.NOTIFY_EMAIL_TO;
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(
      createAppModule("test-secret-for-product-platform-notify-32ch"),
      { logger: false },
    );
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    const pilot = (companyCode: string) =>
      http
        .post("/api/platform/tenants")
        .set("Authorization", auth)
        .send({
          businessName: `Piloto ${companyCode}`,
          companyCode,
          businessType: "retail",
          plan: "autoservicio",
          adminName: "Dueña piloto",
          adminEmail: `${companyCode}@example.invalid`,
        });
    const createdA = await pilot("aviso-a");
    const createdB = await pilot("aviso-b");
    expect(createdA.status, JSON.stringify(createdA.body)).toBe(201);
    expect(createdB.status).toBe(201);
    const tenantA = createdA.body.id as string;
    const tenantB = createdB.body.id as string;
    const take = () => outbox.splice(0);
    const texts = (rows: typeof outbox) =>
      rows.map(
        (r) => (r.channel === "email" ? r.body.html : r.body.text) as string,
      );

    // (a) Invitación aceptada: un correo y un Telegram, una sola vez.
    const token = createdA.body.invitationUrl.split("#token=")[1];
    const password = "ClaveSegura-2026!";
    const accept = () =>
      http
        .post("/api/auth/accept-invitation")
        .send({ token, password, managerPin: "869253" });
    expect((await accept()).status).toBe(201);
    expect((await accept()).status).toBe(400);
    let sent = take();
    expect(sent.map((s) => s.channel).sort()).toEqual(["email", "telegram"]);
    expect(sent.find((s) => s.channel === "email")!.body.to).toEqual([
      "duena@example.invalid",
    ]);
    expect(sent.find((s) => s.channel === "telegram")!.body.chat_id).toBe(
      "-100777",
    );
    for (const text of texts(sent))
      expect(text).toMatch(
        /Nueva empresa activa[\s\S]*Piloto aviso-a \(aviso-a\)/,
      );

    // Soporte: valores del entorno y la empresa propia; ningún secreto.
    const session = await http
      .post("/api/auth/login")
      .set("x-tenant-id", "aviso-a")
      .send({ login: "aviso-a@example.invalid", password });
    expect(session.status, JSON.stringify(session.body)).toBe(201);
    const bearer = `Bearer ${session.body.accessToken}`;
    expect([400, 401]).toContain(
      (await http.get("/api/support-info").set("x-tenant-id", "aviso-a"))
        .status,
    );
    const support = await http
      .get("/api/support-info")
      .set("Authorization", bearer);
    expect(support.status).toBe(200);
    expect(support.body).toEqual({
      whatsapp: "18095551234",
      email: "soporte@nexorapos.net",
      hours: "Lunes a sábado, 9:00 a 6:00",
      company: { name: "Piloto aviso-a", slug: "aviso-a" },
    });
    const raw = JSON.stringify(support.body);
    for (const secret of [
      resendKey,
      botToken,
      platformToken,
      "-100777",
      "duena@example.invalid",
      "test-secret-for",
    ])
      expect(raw).not.toContain(secret);

    // (d) Pago registrado: monto y plan, sin la referencia; un aviso por pago.
    const pay = (reference: string) =>
      http
        .post("/api/platform/tenants/aviso-a/payments")
        .set("Authorization", auth)
        .send({ amount: 990, method: "transfer", reference, months: 1 });
    const paid = await pay("REF-PRIVADA-1");
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect(paid.body).not.toHaveProperty("tenantId");
    sent = take();
    expect(sent).toHaveLength(2);
    for (const text of texts(sent)) {
      expect(text).toContain("Pago de plataforma registrado");
      expect(text).toContain("990");
      expect(text).not.toContain("REF-PRIVADA-1");
    }

    // (c) Límite de IA: 429 siempre, pero un solo aviso al mes y solo de la empresa A.
    client = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await client.$executeRawUnsafe(
      `INSERT INTO "AuditLog" (id,"tenantId","userId",action,entity,"entityId")
      SELECT gen_random_uuid(), $1::uuid, 'usuario-a', 'assistant.ask', 'assistant', gen_random_uuid()::text FROM generate_series(1,100)`,
      tenantA,
    );
    runtime = tenantDatabaseProxy(
      new PrismaClient({ datasources: { db: { url: pg.url } } }),
    );
    const actor = {
      id: "usuario-a",
      name: "A",
      role: "admin",
      permissions: ["*"],
      branchId: "main",
    } as any;
    const asA = <T>(fn: () => Promise<T>) =>
      tenantScope.run({ tenantId: tenantA }, fn);
    for (let i = 0; i < 3; i++)
      await expect(
        asA(() => reserveAiQuestion(runtime, actor)),
      ).rejects.toMatchObject({ status: 429 });
    sent = take();
    expect(sent).toHaveLength(2);
    for (const text of texts(sent))
      expect(text).toMatch(/límite de IA[\s\S]*aviso-a/);
    // Desde la empresa A no se puede avisar por la B (RLS): nada se guarda ni se envía.
    expect(
      await asA(() =>
        notifyOperator(runtime, {
          tenantId: tenantB,
          event: "op_payment",
          key: new Date(),
          amount: 1,
        }),
      ),
    ).toBe(false);
    expect(take()).toEqual([]);
    expect(
      (await client.$queryRawUnsafe(
        `SELECT kind FROM "TenantLifecycleNotice" WHERE "tenantId"=$1::uuid`,
        tenantB,
      )) as unknown[],
    ).toEqual([]);

    // (b) Vencimientos de B: ≤7 días, vencida y suspendida; cada uno una vez.
    const lifecycle = app.get(TenantLifecycleService);
    const now = new Date();
    const due = new Date(now.getTime() + 5 * DAY);
    await client.$executeRawUnsafe(
      `UPDATE "Tenant" SET "trialEndsAt"=$2 WHERE id=$1::uuid`,
      tenantB,
      due,
    );
    await lifecycle.queueNotices(now);
    await lifecycle.queueNotices(now);
    sent = take();
    expect(sent).toHaveLength(2);
    for (const text of texts(sent))
      expect(text).toMatch(/Empresa por vencer[\s\S]*aviso-b/);
    const later = new Date(due.getTime() + DAY);
    await lifecycle.advance(later);
    await lifecycle.advance(later);
    sent = take();
    expect(sent).toHaveLength(2);
    for (const text of texts(sent))
      expect(text).toMatch(/Empresa vencida[\s\S]*past_due/);
    const muchLater = new Date(due.getTime() + 8 * DAY);
    await lifecycle.advance(muchLater);
    await lifecycle.advance(muchLater);
    sent = take();
    expect(sent).toHaveLength(2);
    for (const text of texts(sent))
      expect(text).toMatch(/Empresa suspendida[\s\S]*suspended/);
    // Los avisos al operador nunca salen como avisos a la empresa.
    await lifecycle.sendPendingNotices(muchLater, async () => {
      throw new Error("no debe enviarse");
    });

    // Sin canales configurados la acción principal sigue igual y no sale nada.
    delete process.env.PLATFORM_OWNER_EMAIL;
    delete process.env.PLATFORM_TELEGRAM_CHAT_ID;
    expect((await pay("REF-2")).status).toBe(201);
    expect(take()).toEqual([]);
    // Canal caído: tampoco rompe la acción.
    process.env.PLATFORM_OWNER_EMAIL = "duena@example.invalid";
    process.env.RESEND_API_BASE = "http://127.0.0.1:1";
    expect((await pay("REF-3")).status).toBe(201);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.$disconnect().catch(() => undefined);
    await runtime?.$disconnect().catch(() => undefined);
    await new Promise((done) => fake.close(done));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.stop();
  }
}, 180000);

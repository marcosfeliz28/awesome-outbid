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
import {
  AI_LIMIT_MESSAGE,
  aiUsage,
  reserveAiQuestion,
} from "../apps/api/src/platform-ai-packs";
import { tenantDatabaseProxy } from "../apps/api/src/tenant-database";
import { tenantScope } from "../apps/api/src/tenant-context";

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
  "ANTHROPIC_API_KEY",
];

async function port() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

// Igual que product-platform-invitation: NEXORA_TEST_PG_URL usa un PostgreSQL local.
async function database() {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) {
    const admin = new PrismaClient({ datasources: { db: { url: external } } });
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_ai_packs_test" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_ai_packs_test"');
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_ai_packs_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const directory = await mkdtemp(join(tmpdir(), "nexora-ai-packs-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory,
    user: "ai_packs_test",
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
  await db.createDatabase("ai_packs_qa");
  return {
    url: `postgresql://ai_packs_test:only_local_test@127.0.0.1:${pgPort}/ai_packs_qa`,
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

it("PC-24: paquetes de IA del operador, por mes y por empresa, sin pasar del límite", async () => {
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const pg = await database();
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
    process.env.PRODUCT_TENANCY = "required";
    // Clave ficticia: el 429 sale antes de llamar al modelo.
    process.env.ANTHROPIC_API_KEY = "solo-prueba-sin-red";
    process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
    delete process.env.PRODUCT_PUBLIC_REGISTRATION;
    delete process.env.PLATFORM_ADMIN_TOKEN_SHA256;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(
      createAppModule("test-secret-for-product-ai-packs-at-least-32ch"),
      { logger: false },
    );
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    const credit = (slug: string, body: unknown, authorization = auth) =>
      http
        .post(`/api/platform/tenants/${slug}/ai-packs`)
        .set("Authorization", authorization)
        .send(body as object);

    // Sin credencial de plataforma configurada, las rutas no existen.
    expect((await credit("ia-a", { size: 100, reference: "T-0" })).status).toBe(
      404,
    );
    expect(
      (
        await http
          .get("/api/platform/tenants/ia-a/ai-usage")
          .set("Authorization", auth)
      ).status,
    ).toBe(404);
    process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256")
      .update(platformToken)
      .digest("hex");

    const pilot = (companyCode: string, plan: string) =>
      http
        .post("/api/platform/tenants")
        .set("Authorization", auth)
        .send({
          businessName: `Piloto ${companyCode}`,
          companyCode,
          businessType: "retail",
          plan,
          adminName: "Dueña piloto",
          adminEmail: `${companyCode}@example.invalid`, operadora: "Ana Operadora", acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" },
        });
    const createdA = await pilot("ia-a", "autoservicio");
    const createdB = await pilot("ia-b", "pro");
    expect(createdA.status, JSON.stringify(createdA.body)).toBe(201);
    expect(createdB.status).toBe(201);
    const tenantA = createdA.body.id as string;
    const tenantB = createdB.body.id as string;

    // La administradora de la empresa no puede acreditarse paquetes.
    const password = "ClaveSegura-2026!";
    const tokenA = createdA.body.invitationUrl.split("#token=")[1];
    expect(
      (
        await http
          .post("/api/auth/accept-invitation")
          .send({ token: tokenA, password, managerPin: "869253", consentAccepted: true })
      ).status,
    ).toBe(201);
    const session = await http
      .post("/api/auth/login")
      .set("x-tenant-id", "ia-a")
      .send({ login: "ia-a@example.invalid", password });
    expect(session.status, JSON.stringify(session.body)).toBe(201);
    const bearer = `Bearer ${session.body.accessToken}`;
    expect(
      (await credit("ia-a", { size: 300, reference: "propia" }, bearer)).status,
    ).toBe(401);
    expect(
      (
        await http
          .get("/api/platform/tenants/ia-a/ai-usage")
          .set("Authorization", bearer)
      ).status,
    ).toBe(401);
    expect(
      (
        await credit(
          "ia-a",
          { size: 300, reference: "propia" },
          "Platform " + "f".repeat(64),
        )
      ).status,
    ).toBe(401);

    // El operador acredita: valida tamaño, empresa y referencia única.
    expect((await credit("ia-a", { size: 200, reference: "T-1" })).status).toBe(
      400,
    );
    expect((await credit("ia-a", { size: 100, reference: "" })).status).toBe(
      400,
    );
    expect(
      (await credit("no-existe", { size: 100, reference: "T-1" })).status,
    ).toBe(404);
    const packA = await credit("ia-a", {
      size: 100,
      reference: "Transferencia 1",
    });
    expect(packA.status, JSON.stringify(packA.body)).toBe(201);
    const month = new Date()
      .toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" })
      .slice(0, 7);
    expect(packA.body).toMatchObject({
      month,
      questions: 100,
      priceDop: 399,
      reference: "Transferencia 1",
    });
    expect(packA.body.usage).toMatchObject({
      month,
      used: 0,
      planQuota: 100,
      packs: 100,
      limit: 200,
    });
    expect(
      (await credit("ia-a", { size: 100, reference: "Transferencia 1" }))
        .status,
    ).toBe(409);
    const packB = await credit("ia-b", {
      size: 300,
      reference: "Transferencia 1",
    });
    expect(packB.status).toBe(201);
    expect(packB.body).toMatchObject({ questions: 300, priceDop: 999 });
    const usageB = await http
      .get("/api/platform/tenants/ia-b/ai-usage")
      .set("Authorization", auth);
    expect(usageB.body).toMatchObject({
      used: 0,
      planQuota: 600,
      packs: 300,
      limit: 900,
    });

    client = new PrismaClient({ datasources: { db: { url: pg.url } } });
    // Inmutables y fuera del alcance de la empresa (solo lectura de lo suyo).
    await expect(
      client.$executeRawUnsafe(`UPDATE "AiPackCredit" SET questions=300`),
    ).rejects.toThrow(/no se modifican/);
    await expect(
      client.$executeRawUnsafe(`DELETE FROM "AiPackCredit"`),
    ).rejects.toThrow(/no se modifican/);
    await expect(
      client.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
        await tx.$queryRawUnsafe(
          "SELECT set_config('app.tenant_id', $1, true)",
          tenantA,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "AiPackCredit" (id,"tenantId",month,questions,"priceDop",reference) VALUES (gen_random_uuid(), $1::uuid, $2, 300, 999, 'gratis')`,
          tenantA,
          month,
        );
      }),
    ).rejects.toThrow(/permission denied/);

    runtime = tenantDatabaseProxy(
      new PrismaClient({ datasources: { db: { url: pg.url } } }),
    );
    const actor = {
      id: "usuario-a",
      name: "A",
      email: "a@example.invalid",
      role: "Administración",
      permissions: ["*"],
      branchId: "main",
    } as any;
    const asA = <T>(fn: () => Promise<T>) =>
      tenantScope.run({ tenantId: tenantA }, fn);

    // La empresa A ve solo su paquete; el de B no existe para ella.
    expect(
      await asA(() =>
        runtime.$queryRawUnsafe(
          `SELECT reference, questions FROM "AiPackCredit"`,
        ),
      ),
    ).toEqual([{ reference: "Transferencia 1", questions: 100 }]);
    await expect(asA(() => aiUsage(runtime, tenantB))).rejects.toMatchObject({
      status: 403,
    });

    // 195 preguntas usadas; 10 simultáneas en el borde: pasan exactamente 5.
    await client.$executeRawUnsafe(
      `INSERT INTO "AuditLog" (id,"tenantId","userId",action,entity,"entityId")
      SELECT gen_random_uuid(), $1::uuid, 'usuario-a', 'assistant.ask', 'assistant', gen_random_uuid()::text FROM generate_series(1,195)`,
      tenantA,
    );
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        asA(() => reserveAiQuestion(runtime, actor)),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(rejected).toHaveLength(5);
    for (const r of rejected)
      expect(r.reason).toMatchObject({
        status: 429,
        message: AI_LIMIT_MESSAGE,
      });
    expect(AI_LIMIT_MESSAGE).toMatch(/^Llegaste a tu límite de este mes\./);
    expect(AI_LIMIT_MESSAGE).toContain("RD$399");
    const usageA = await http
      .get("/api/platform/tenants/ia-a/ai-usage")
      .set("Authorization", auth);
    expect(usageA.body).toMatchObject({
      used: 200,
      limit: 200,
      remaining: 0,
      packs: 100,
    });
    // A está en su tope aunque B tenga 300 preguntas de paquete sin usar.
    expect(
      (
        await http
          .get("/api/platform/tenants/ia-b/ai-usage")
          .set("Authorization", auth)
      ).body,
    ).toMatchObject({ used: 0, packs: 300 });
    // El asistente usa la misma cuota (plan + paquetes) y el mismo aviso.
    expect(
      (await http.get("/api/assistant/usage").set("Authorization", bearer)).body,
    ).toMatchObject({ usadas: 200, limite: 200, packs: 100 });
    const ask = await http
      .post("/api/assistant/ask")
      .set("Authorization", bearer)
      .send({ messages: [{ role: "user", content: "¿Cuánto vendí hoy?" }] });
    expect(ask.status).toBe(429);
    expect(ask.body.message).toBe(AI_LIMIT_MESSAGE);
    // Solo se pausa la IA: el resto del sistema sigue igual.
    expect(
      (await http.get("/api/onboarding").set("Authorization", bearer)).status,
    ).toBe(200);

    // Mes siguiente (zona de la empresa): vuelve la cuota del plan, sin el paquete.
    const [year, index] = month.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, index, 1, 4, 30)); // 00:30 en Santo Domingo
    const lastMinute = new Date(Date.UTC(year, index, 1, 3, 59));
    await expect(
      asA(() => reserveAiQuestion(runtime, actor, lastMinute)),
    ).rejects.toMatchObject({ status: 429 });
    const next = await asA(() => reserveAiQuestion(runtime, actor, nextMonth));
    expect(next).toMatchObject({
      used: 1,
      planQuota: 100,
      packs: 0,
      limit: 100,
      remaining: 99,
    });
    expect(next.month).not.toBe(month);
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

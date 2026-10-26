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

// PC-23: cobro manual sólo desde el operador de la plataforma.
const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const DAY = 86_400_000;
const platformToken = "operador-plataforma-cobros-prueba-".padEnd(72, "0123456789abcdef");
const keys = ["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PLATFORM_ADMIN_TOKEN_SHA256", "PLATFORM_OPERATOR_LABEL", "APP_PUBLIC_URL", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

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
    await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS "nexora_platform_billing_test" WITH (FORCE)');
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_platform_billing_test"');
    await admin.$disconnect();
    const url = new URL(external);
    url.pathname = "/nexora_platform_billing_test";
    return { url: url.toString(), stop: async () => undefined };
  }
  const directory = await mkdtemp(join(tmpdir(), "nexora-platform-billing-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory, user: "billing_test", password: "only_local_test",
    port: pgPort, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  await db.initialise(); await db.start(); await db.createDatabase("billing_qa");
  return {
    url: `postgresql://billing_test:only_local_test@127.0.0.1:${pgPort}/billing_qa`,
    stop: async () => {
      await db.stop().catch(() => undefined);
      await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
    },
  };
}

it("sólo el operador registra pagos; la bitácora es inmutable y el vencimiento pasa a gracia y solo lectura", async () => {
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
    process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256").update(platformToken).digest("hex");
    process.env.PLATFORM_OPERATOR_LABEL = "dueña-nexora";
    for (const k of ["PRODUCT_PUBLIC_REGISTRATION", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) delete process.env[k];
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-secret-for-product-platform-billing-32ch"), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const auth = `Platform ${platformToken}`;
    client = new PrismaClient({ datasources: { db: { url: pg.url } } });
    const q = (sql: string, ...params: unknown[]) => client.$queryRawUnsafe(sql, ...params) as Promise<any[]>;

    // Dos empresas piloto con su administradora ya activa.
    const password = "ClaveSegura-2026!";
    const tenants: Record<string, { id: string; bearer: string }> = {};
    for (const code of ["cobro-a", "cobro-b"]) {
      const created = await http.post("/api/platform/tenants").set("Authorization", auth).send({
        businessName: `Piloto ${code}`, companyCode: code, businessType: "retail", plan: "basico",
        adminName: "Dueña piloto", adminEmail: `${code}@example.invalid`,
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const token = created.body.invitationUrl.split("#token=")[1];
      expect((await http.post("/api/auth/accept-invitation").send({ token, password, managerPin: "869253" })).status).toBe(201);
      const login = await http.post("/api/auth/login").set("x-tenant-id", code).send({ login: `${code}@example.invalid`, password });
      expect(login.status, JSON.stringify(login.body)).toBe(201);
      tenants[code] = { id: created.body.id, bearer: `Bearer ${login.body.accessToken}` };
    }
    const A = tenants["cobro-a"], B = tenants["cobro-b"];
    const pay = (slug: string, body: object, authorization = auth) =>
      http.post(`/api/platform/tenants/${slug}/payments`).set("Authorization", authorization).send({ operationId: randomUUID(), ...body });
    const valid = { amount: 2000, method: "transfer", reference: "BHD-0001", months: 1 };

    // Nadie fuera del operador: ni sin credencial, ni la administradora de la empresa.
    const anon = await http.post("/api/platform/tenants/cobro-a/payments").send(valid);
    expect(anon.status, JSON.stringify(anon.body)).toBe(401);
    expect((await pay("cobro-a", valid, A.bearer)).status).toBe(401);
    expect((await http.get("/api/platform/tenants/cobro-a/payments").set("Authorization", A.bearer)).status).toBe(401);
    expect(await q(`SELECT 1 FROM "PlatformPayment"`)).toHaveLength(0);

    // Validación: meses 1-12 o año, métodos manuales, sin campos de tarjeta.
    for (const body of [
      { ...valid, months: 13 }, { ...valid, months: 0 }, { ...valid, year: true },
      { amount: 2000, method: "transfer", reference: "x" }, { ...valid, amount: 0 },
      { ...valid, method: "stripe" }, { ...valid, reference: "  " }, { ...valid, cardNumber: "4111111111111111" },
      { ...valid, operationId: undefined }, { ...valid, operationId: "no-uuid" },
      // PLA-03: el monto lo fija el plan (básico RD$2,000/mes; año = 10 meses).
      { ...valid, amount: 0.01 }, { ...valid, amount: 0.01, year: true, months: undefined },
      { ...valid, amount: 2000, months: 12 }, { ...valid, amount: 24000, months: undefined, year: true },
    ]) expect((await pay("cobro-a", body)).status, JSON.stringify(body)).toBe(400);
    const wrong = await pay("cobro-a", { ...valid, amount: 1999.99 });
    expect(wrong.body.message).toContain("RD$2000.00");
    expect((await pay("no-existe", valid)).status).toBe(404);
    expect(await q(`SELECT 1 FROM "PlatformPayment"`)).toHaveLength(0);

    // Extensión: desde lo pagado si aún no vence (31-ene + 1 mes = 28-feb), y el año = 12 meses.
    await q(`UPDATE "Tenant" SET status='active', "paidThroughAt"='2030-01-31T12:00:00Z' WHERE id=$1::uuid`, A.id);
    const first = await pay("cobro-a", valid);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.tenant).toMatchObject({ slug: "cobro-a", status: "active", paidUntil: "2030-02-28T12:00:00.000Z" });
    expect(first.body.payment).toMatchObject({ amount: "2000", method: "transfer", reference: "BHD-0001", months: 1, operator: "dueña-nexora", paidFrom: "2030-01-31T12:00:00.000Z" });
    expect(first.body.payment.plan).toBe("basico");
    // PLA-02: reenviar la misma operación devuelve el pago original y no extiende otra vez.
    const op = randomUUID();
    const annualBody = { operationId: op, amount: 20000, method: "cash", reference: "Recibo 17", year: true };
    const replays = await Promise.all([pay("cobro-a", annualBody), pay("cobro-a", annualBody)]);
    const annual = replays[0];
    expect(replays.map(r => r.status)).toEqual([201, 201]);
    expect(replays[1].body).toEqual(replays[0].body);
    expect((await pay("cobro-a", { ...annualBody, reference: " recibo17 " })).body).toEqual(annual.body);
    expect((await pay("cobro-a", { ...annualBody, method: "transfer" })).status).toBe(409);
    expect((await pay("cobro-b", annualBody)).status).toBe(409);
    expect(await q(`SELECT 1 FROM "PlatformPayment" WHERE "operationId"=$1::uuid`, op)).toHaveLength(1);
    // La misma transferencia con otra clave (otro equipo, otra pestaña) tampoco se suma.
    expect((await pay("cobro-a", { ...valid, reference: " bhd-0001" })).status).toBe(409);
    expect(annual.body.tenant.paidUntil).toBe("2031-02-28T12:00:00.000Z");
    expect(annual.body.payment.months).toBe(12);
    // Vencido: desde hoy, no desde la fecha vieja; limpia la gracia y la suspensión.
    await q(`UPDATE "Tenant" SET status='suspended', "paidThroughAt"=now() - interval '40 days', "pastDueAt"=now() - interval '40 days', "suspendedAt"=now() WHERE id=$1::uuid`, B.id);
    const before = Date.now();
    const lapsed = await pay("cobro-b", { amount: 6000, method: "courier", reference: "Mensajero 3", months: 3 });
    expect(lapsed.status).toBe(201);
    const fromB = new Date(lapsed.body.payment.paidFrom).getTime();
    expect(fromB).toBeGreaterThanOrEqual(before - 1000);
    expect(fromB).toBeLessThanOrEqual(Date.now() + 1000);
    const expectedB = new Date(fromB); expectedB.setUTCMonth(expectedB.getUTCMonth() + 3);
    expect(Math.abs(new Date(lapsed.body.tenant.paidUntil).getTime() - expectedB.getTime())).toBeLessThan(4 * DAY);
    expect((await q(`SELECT status, "pastDueAt", "suspendedAt" FROM "Tenant" WHERE id=$1::uuid`, B.id))[0]).toEqual({ status: "active", pastDueAt: null, suspendedAt: null });

    // Listados del operador, cada empresa sólo con sus pagos.
    const listA = await http.get("/api/platform/tenants/cobro-a/payments").set("Authorization", auth);
    expect(listA.status).toBe(200);
    expect(listA.body.map((p: any) => p.reference)).toEqual(["Recibo 17", "BHD-0001"]);
    const listB = await http.get("/api/platform/tenants/cobro-b/payments").set("Authorization", auth);
    expect(listB.body.map((p: any) => p.reference)).toEqual(["Mensajero 3"]);
    const listed = await http.get("/api/platform/tenants").set("Authorization", auth);
    expect(listed.body.find((t: any) => t.slug === "cobro-a")).toMatchObject({ status: "active", paidUntil: "2031-02-28T12:00:00.000Z", plan: "basico" });
    // Ninguna ruta de la plataforma modifica o borra pagos.
    const paymentId = listA.body[0].id;
    for (const method of ["put", "patch", "delete"] as const) {
      expect([400, 404]).toContain((await (http as any)[method](`/api/platform/tenants/cobro-a/payments/${paymentId}`).set("Authorization", auth).send({ amount: 1 })).status);
      expect((await (http as any)[method]("/api/platform/tenants/cobro-a/payments").set("Authorization", auth).send({ amount: 1 })).status).toBe(404);
    }
    expect((await q(`SELECT amount::text FROM "PlatformPayment" WHERE id=$1::uuid`, paymentId))[0].amount).toBe("20000.00");

    // Inmutable en la base, incluso para el dueño de las tablas.
    await expect(q(`UPDATE "PlatformPayment" SET amount=1 WHERE id=$1::uuid`, paymentId)).rejects.toThrow(/inmutable/);
    await expect(q(`DELETE FROM "PlatformPayment" WHERE id=$1::uuid`, paymentId)).rejects.toThrow(/inmutable/);
    await expect(q(`TRUNCATE "PlatformPayment"`)).rejects.toThrow(/inmutable/);
    expect(await q(`SELECT 1 FROM "PlatformPayment"`)).toHaveLength(3);
    // El rol de la aplicación de empresas: sólo lee lo suyo y no puede escribir.
    const asTenant = (tenantId: string, sql: string) => client.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
      await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenantId);
      return tx.$queryRawUnsafe(sql);
    });
    expect(await asTenant(B.id, `SELECT reference FROM "PlatformPayment"`)).toEqual([{ reference: "Mensajero 3" }]);
    await expect(asTenant(B.id, `INSERT INTO "PlatformPayment" (id,"tenantId",amount,method,reference,months,operator,"paidFrom","paidUntil") VALUES (gen_random_uuid(), '${B.id}', 1, 'cash', 'propia', 1, 'yo', now(), now() + interval '1 year')`)).rejects.toThrow();

    // Avisos 7 y 3 días antes, dentro del sistema aunque no haya correo configurado.
    const lifecycle = app.get(TenantLifecycleService);
    const due = new Date(Date.now() + 7 * DAY - 60_000);
    await q(`UPDATE "Tenant" SET "paidThroughAt"=$2 WHERE id=$1::uuid`, A.id, due);
    await lifecycle.queueNotices(new Date());
    await lifecycle.queueNotices(new Date());
    await lifecycle.sendPendingNotices(new Date());
    await lifecycle.queueNotices(new Date(due.getTime() - 3 * DAY + 60_000));
    const notices = await q(`SELECT "tenantId", type, message FROM "Alert" WHERE type='plan_due' ORDER BY message DESC`);
    expect(notices.map(n => n.tenantId)).toEqual([A.id, A.id]);
    expect(notices[0].message).toMatch(/vence en 7 días.*solo lectura/);
    expect(notices[1].message).toMatch(/vence en 3 días/);
    expect((await q(`SELECT "tenantId" FROM "RealtimeEvent" WHERE data->>'type'='plan_due'`)).map(r => r.tenantId)).toEqual([A.id, A.id]);
    const inApp = await http.get("/api/alerts?type=plan_due").set("Authorization", A.bearer);
    expect(inApp.status).toBe(200);
    expect(inApp.body).toHaveLength(2);
    expect((await http.get("/api/alerts?type=plan_due").set("Authorization", B.bearer)).body).toHaveLength(0);

    // Vencido: 7 días de gracia (escribe), luego solo lectura (lee y exporta).
    await q(`UPDATE "Tenant" SET "paidThroughAt"=now() - interval '1 day' WHERE id=$1::uuid`, A.id);
    await lifecycle.advance(new Date());
    expect((await q(`SELECT status FROM "Tenant" WHERE id=$1::uuid`, A.id))[0].status).toBe("past_due");
    expect((await http.post("/api/categories").set("Authorization", A.bearer).send({ name: "En gracia" })).status).toBe(201);
    await q(`UPDATE "Tenant" SET "pastDueAt"=now() - interval '8 days' WHERE id=$1::uuid`, A.id);
    await lifecycle.advance(new Date());
    expect((await q(`SELECT status FROM "Tenant" WHERE id=$1::uuid`, A.id))[0].status).toBe("suspended");
    const blocked = await http.post("/api/categories").set("Authorization", A.bearer).send({ name: "Prohibida" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/solo|consultar y exportar/i);
    const read = await http.get("/api/categories").set("Authorization", A.bearer);
    expect(read.status).toBe(200);
    expect(read.body.map((c: any) => c.name)).toContain("En gracia");
    const exported = await http.get("/api/tenant/export?format=json").set("Authorization", A.bearer).buffer(true).parse((res: any, cb: any) => { let s = ""; res.on("data", (c: any) => { s += c; }); res.on("end", () => cb(null, s)); });
    expect(exported.status).toBe(200);
    expect(exported.body).toContain("BHD-0001");
    expect(exported.body).not.toContain("Mensajero 3");
    // Nada se borró, y la otra empresa sigue escribiendo.
    expect(await q(`SELECT 1 FROM "PlatformPayment" WHERE "tenantId"=$1::uuid`, A.id)).toHaveLength(2);
    expect((await http.post("/api/categories").set("Authorization", B.bearer).send({ name: "Sigue B" })).status).toBe(201);
    expect((await http.get("/api/platform/tenants").set("Authorization", auth)).body.find((t: any) => t.slug === "cobro-a").status).toBe("suspended");

    // Un pago del operador reactiva la escritura.
    expect((await pay("cobro-a", { amount: 2000, method: "card_in_store", reference: "POS local 9", months: 1 })).status).toBe(201);
    expect((await http.post("/api/categories").set("Authorization", A.bearer).send({ name: "Renovada" })).status).toBe(201);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.$disconnect().catch(() => undefined);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await pg.stop();
  }
}, 180000);

it("no existe pasarela de pago ni campo de tarjeta en el esquema, las migraciones o las rutas", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const card = /stripe|paypal|cardnet|braintree|mercadopago|card_?number|card_?holder|\bcvv\b|\bcvc\b|\bpan\b|card_?expir|card_?token/i;
  const files = [
    join(prismaDir, "schema.prisma"),
    ...readdirSync(join(prismaDir, "migrations"), { recursive: true, encoding: "utf8" })
      .filter(f => f.endsWith(".sql")).map(f => join(prismaDir, "migrations", f)),
    ...readdirSync(join(root, "apps/api/src"), { recursive: true, encoding: "utf8" })
      .filter(f => f.endsWith(".ts")).map(f => join(root, "apps/api/src", f)),
  ];
  for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(card);
  for (const manifest of ["package.json", "apps/api/package.json", "apps/web/package.json"])
    expect(readFileSync(join(root, manifest), "utf8"), manifest).not.toMatch(/stripe|paypal|braintree|mercadopago|azul-|cardnet/i);
  // «card_in_store» sólo nombra el método: la tarjeta se pasa en el datáfono del local, fuera del sistema.
  const payment = readFileSync(join(prismaDir, "schema.prisma"), "utf8").match(/model PlatformPayment \{[^}]+\}/)![0];
  expect(payment.match(/^\s+(\w+)\s/gm)!.map(s => s.trim()).sort())
    .toEqual(["amount", "createdAt", "id", "method", "months", "operationId", "operator", "paidFrom", "paidUntil", "plan", "reference", "tenant", "tenantId"]);
});

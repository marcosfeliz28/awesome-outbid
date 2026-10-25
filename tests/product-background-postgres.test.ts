import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { expect, it } from "vitest";
import { Database } from "../apps/api/src/common";
import { CreditReminderService } from "../apps/api/src/credit-reminder";
import { enqueue, NotificationWorker } from "../apps/api/src/notifications";
import { RetentionWorker } from "../apps/api/src/retention";
import { tenantScope } from "../apps/api/src/tenant-context";
import { UsdRateWorker } from "../apps/api/src/usd-rate";
import { DailySummaryWorker, collectFacts } from "../apps/api/src/daily-summary";
import { businessDate } from "../packages/shared/src/index";

const root = resolve(import.meta.dirname, "..");
const prismaCli = createRequire(join(root, "apps/api/package.json")).resolve(
  "prisma/build/index.js",
);
const run = promisify(execFile);
const demo = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("los trabajos de fondo recorren cada empresa sin mezclar avisos, créditos ni retención", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-background-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "background_test",
    password: "background_test_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const oldUrl = process.env.DATABASE_URL;
  const oldMode = process.env.PRODUCT_TENANCY;
  const oldResend = process.env.RESEND_API_KEY;
  const oldAnthropic = process.env.ANTHROPIC_API_KEY;
  let sql: any;
  let db: Database | undefined;
  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("background_qa");
    const url = `postgresql://background_test:background_test_only@127.0.0.1:${port}/background_qa`;
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 },
    );
    sql = postgres.getPgClient("background_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(
      `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'segunda','Segunda empresa',now())`,
      [other],
    );
    for (const [index, tenantId] of [demo, other].entries()) {
      const roleId = `10000000-0000-4000-8000-00000000001${index}`;
      const userId = `10000000-0000-4000-8000-00000000002${index}`;
      const customerId = `10000000-0000-4000-8000-00000000003${index}`;
      const saleId = `10000000-0000-4000-8000-00000000004${index}`;
      await sql.query(
        `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
        [roleId, tenantId],
      );
      await sql.query(
        `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,'Cajera QA',$2,'test','test',$3,now(),$4)`,
        [userId, `cajera-${index}@example.invalid`, roleId, tenantId],
      );
      await sql.query(
        `INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`,
        [customerId, `Cliente ${index}`, tenantId],
      );
      await sql.query(
        `INSERT INTO "Sale" (id,number,"offlineUuid","sellerId","customerId",subtotal,"discountTotal","taxTotal",total,"costTotal","creditBalance","updatedAt","tenantId") VALUES ($1,$2,$3,$4,$5,100,0,0,100,0,100,now(),$6)`,
        [saleId, `FS-QA-${index}`, `20000000-0000-4000-8000-00000000000${index}`, userId, customerId, tenantId],
      );
      await sql.query(
        `INSERT INTO "Payment" (id,"saleId",method,amount,tendered,"tenantId") VALUES ($1,$2,'credit',100,100,$3)`,
        [`30000000-0000-4000-8000-00000000000${index}`, saleId, tenantId],
      );
      await sql.query(
        `INSERT INTO "RealtimeEvent" ("branchId",type,data,"createdAt","tenantId") VALUES ('main','stock','{}'::jsonb,now() - interval '3 days',$1)`,
        [tenantId],
      );
      await sql.query(
        `INSERT INTO "NotificationOutbox" (id,"eventType","refId",payload,status,"sentAt","createdAt","tenantId") VALUES ($1,'old','old','{}'::jsonb,'sent',now() - interval '31 days',now() - interval '31 days',$2)`,
        [`40000000-0000-4000-8000-00000000000${index}`, tenantId],
      );
      await sql.query(
        `INSERT INTO "Settings" (id,data,"updatedAt","tenantId") VALUES ('main',$1::jsonb,now(),$2)`,
        [JSON.stringify({ usdRate: index === 0 ? 63 : 65 }), tenantId],
      );
    }

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    db = new Database();
    await db.$connect();
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ rates: { DOP: 67 } }),
    })) as typeof fetch;
    try {
      await new UsdRateWorker(db).run();
    } finally {
      globalThis.fetch = previousFetch;
    }
    const rates = await sql.query(
      `SELECT "tenantId", data->>'usdRate' AS rate FROM "Settings" ORDER BY "tenantId"`,
    );
    expect(rates.rows).toEqual([
      { tenantId: demo, rate: "67" },
      { tenantId: other, rate: "67" },
    ]);
    const rateAlerts = await sql.query(
      `SELECT "tenantId",type,status FROM "Alert" WHERE type='usd_rate_change' ORDER BY "tenantId"`,
    );
    // 63 -> 67 supera 5 %; 65 -> 67 no. La tasa se aplica en las dos
    // empresas y el aviso queda exclusivamente en la que tuvo el salto.
    expect(rateAlerts.rows).toEqual([
      { tenantId: demo, type: "usd_rate_change", status: "new" },
    ]);
    for (const [index, tenantId] of [demo, other].entries()) {
      const facts = await tenantScope.run({ tenantId }, () => collectFacts(db!, {
        id: `10000000-0000-4000-8000-00000000002${index}`,
        name: "Administración QA", email: `cajera-${index}@example.invalid`, role: "admin",
        permissions: ["*"], branchId: "main", tenantId,
      }, businessDate()));
      expect(facts.revenue).toBe(100);
      expect(facts.invoices).toBe(1);
    }
    await expect(enqueue(db, "test", "sin-empresa", "main", "No enviar"))
      .rejects.toThrow(/contexto de empresa/);
    // La clave idempotente se puede repetir entre negocios y el INSERT bruto
    // debe escribir bajo la empresa activa, sin recaer en el tenant demo.
    for (const tenantId of [demo, other]) {
      await tenantScope.run({ tenantId }, () =>
        enqueue(db!, "test", "misma-clave", "main", "Aviso QA"),
      );
      await tenantScope.run({ tenantId }, () =>
        enqueue(db!, "test", "misma-clave", "main", "Reintento QA"),
      );
      expect(await tenantScope.run({ tenantId }, () =>
        db!.notificationOutbox.count({ where: { refId: "misma-clave" } }),
      )).toBe(1);
    }
    expect(
      (await sql.query(`SELECT "tenantId" FROM "NotificationOutbox" WHERE "refId"='misma-clave' ORDER BY "tenantId"`)).rows.map((r: any) => r.tenantId),
    ).toEqual([demo, other]);
    await sql.query(`UPDATE "NotificationOutbox" SET "nextAttemptAt"=now() + interval '1 day' WHERE "refId"='misma-clave'`);

    const reminder = new CreditReminderService(db);
    const monday = new Date("2026-10-19T13:00:00.000Z");
    const created = await reminder.run(monday, { telegram: true });
    expect(created.created).toHaveLength(2);
    const alerts = await sql.query(`SELECT "tenantId",key FROM "Alert" WHERE type='credit_reminder' ORDER BY "tenantId"`);
    expect(alerts.rows.map((r: any) => r.tenantId)).toEqual([demo, other]);
    expect((await reminder.run(monday, { telegram: true })).created).toEqual([]);

    const notifications = new NotificationWorker(db);
    await notifications.tick();
    expect((await sql.query(`SELECT "tenantId" FROM "NotificationOutbox" WHERE "eventType"='old'`)).rows).toEqual([]);
    const retention = new RetentionWorker(db);
    await retention.run();
    expect((await sql.query(`SELECT "tenantId" FROM "RealtimeEvent" WHERE type='stock'`)).rows).toEqual([]);

    // N-07: correo diario por empresa con PostgreSQL real; ni Anthropic ni
    // Resend se llaman. La cola de Telegram no toma este tipo de mensaje.
    await sql.query(`UPDATE "Role" SET name='admin' WHERE name='Administración'`);
    process.env.RESEND_API_KEY = "resend-falsa";
    process.env.ANTHROPIC_API_KEY = "anthropic-falsa";
    const emails: string[] = [];
    const daily = new DailySummaryWorker(db);
    const day = new Date("2026-10-25T01:00:00Z");
    const deps: any = {
      facts: async (_db: any, actor: any, businessDay: string) => ({ day: businessDay,
        revenue: actor.tenantId === demo ? 111 : 222, invoices: 1,
        cashDifference: 0, pendingCod: 0, newAlerts: 0 }),
      model: async () => "Revisa la jornada.",
      send: async (settings: any, _subject: string, body: string) => {
        emails.push(`${settings.to}: ${body}`);
        return { ok: true };
      },
    };
    await daily.run(day, deps);
    await daily.run(day, deps);
    expect(emails).toHaveLength(2);
    expect(emails.some((email) => email.includes("cajera-0@example.invalid") && email.includes("RD$ 111.00") && !email.includes("RD$ 222.00"))).toBe(true);
    expect(emails.some((email) => email.includes("cajera-1@example.invalid") && email.includes("RD$ 222.00") && !email.includes("RD$ 111.00"))).toBe(true);
    const dailyRows = await sql.query(`SELECT "tenantId",status FROM "NotificationOutbox" WHERE "eventType"='ai_daily_email' ORDER BY "tenantId"`);
    expect(dailyRows.rows).toEqual([{ tenantId: demo, status: "sent" }, { tenantId: other, status: "sent" }]);
  } finally {
    await db?.$disconnect().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = oldMode;
    if (oldResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldResend;
    if (oldAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = oldAnthropic;
    await postgres.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}, 180_000);

import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Auditoría 03 v2, V2-06 (y N-09): lo que la purga de retención borra y, sobre
// todo, lo que NO borra, contra PostgreSQL real. Con NEXORA_TEST_PG_URL usa
// ese servidor; si no, uno embebido.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiRequire = createRequire(join(root, "apps", "api", "package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const run = promisify(execFile);

const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto para PostgreSQL."));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });

const DATABASE = "nexora_retencion_seg";
let adminUrl = "";
let stopServer: () => Promise<void> = async () => undefined;
let prisma: any;
let sql: any;

const urlFor = (db: string) => {
  const u = new URL(adminUrl);
  u.pathname = "/" + db;
  return u.toString();
};

beforeAll(async () => {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) adminUrl = external;
  else {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-retencion-db-"));
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    adminUrl = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/postgres`;
    stopServer = async () => {
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    };
  }
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${DATABASE}"`);
  await admin.end();
  await run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps", "api", "prisma", "schema.prisma"),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: urlFor(DATABASE),
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
      },
      timeout: 120_000,
    },
  );
  prisma = new PrismaClient({
    datasources: { db: { url: urlFor(DATABASE) } },
  });
  sql = new Client({ connectionString: urlFor(DATABASE) });
  await sql.connect();
}, 240_000);

afterAll(async () => {
  await sql?.end().catch(() => undefined);
  await prisma?.$disconnect().catch(() => undefined);
  if (adminUrl) {
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect().catch(() => undefined);
    await admin
      .query(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`)
      .catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
  await stopServer();
}, 60_000);

const ago = (interval: string) =>
  `timezone('UTC', now()) - interval '${interval}'`;

describe("V2-06 · retención de AuditLog, InvoiceAttachment y avisos pendientes", () => {
  it("borra el ruido de sesiones de hace más de 400 días y nunca la bitácora de dinero", async () => {
    const { purgeExpiredData, SECURITY_AUDIT_ACTIONS } =
      await import("../apps/api/src/retention");
    const insert = (action: string, age: string, entity = "user") =>
      sql.query(
        `INSERT INTO "AuditLog"(id, "userId", action, entity, "entityId", "createdAt")
         VALUES (gen_random_uuid(), 'u1', $1, $2, gen_random_uuid()::text, ${ago(age)})`,
        [action, entity],
      );
    for (const action of SECURITY_AUDIT_ACTIONS) {
      await insert(action, "401 days");
      await insert(action, "399 days");
    }
    // Dinero y administración, aunque sean muy viejos: se conservan.
    for (const [action, entity] of [
      ["void", "sale"],
      ["payment_verified", "payment"],
      ["cash_close", "cash_session"],
      ["return", "sale"],
      ["password_reset_by_admin", "user"],
      ["customer_anonymized", "customer"],
    ])
      await insert(action, "3000 days", entity);
    const before = Number(
      (await sql.query(`SELECT count(*)::int AS n FROM "AuditLog"`)).rows[0].n,
    );
    const purged = await purgeExpiredData(prisma);
    expect(purged.errors).toEqual([]);
    expect(purged.auditLogs).toBe(SECURITY_AUDIT_ACTIONS.length);
    const left = await sql.query(
      `SELECT action, ("createdAt" < ${ago("400 days")}) AS old FROM "AuditLog"`,
    );
    expect(left.rows.length).toBe(before - SECURITY_AUDIT_ACTIONS.length);
    // Ninguna acción de seguridad de más de 400 días sobrevive...
    expect(
      left.rows.filter(
        (r: any) =>
          r.old &&
          (SECURITY_AUDIT_ACTIONS as readonly string[]).includes(r.action),
      ),
    ).toEqual([]);
    // ...y todas las de dinero, sí.
    for (const action of [
      "void",
      "payment_verified",
      "cash_close",
      "return",
      "password_reset_by_admin",
      "customer_anonymized",
    ])
      expect(
        left.rows.some((r: any) => r.action === action),
        action,
      ).toBe(true);
    // Idempotente.
    expect((await purgeExpiredData(prisma)).auditLogs).toBe(0);
  }, 60_000);

  it("borra archivos de factura huérfanos y conserva los de una recepción o un borrador", async () => {
    const { purgeExpiredData } = await import("../apps/api/src/retention");
    const attach = async (name: string, age: string) => {
      const { rows } = await sql.query(
        `INSERT INTO "InvoiceAttachment"(id, "branchId", "userId", mime, data, "createdAt")
         VALUES (gen_random_uuid(), 'main', $1, 'application/pdf', '\\x00', ${ago(age)}) RETURNING id`,
        [name],
      );
      return rows[0].id as string;
    };
    const orphanOld = await attach("huerfano-viejo", "20 days");
    const orphanNew = await attach("huerfano-nuevo", "3 days");
    const withDraft = await attach("con-borrador", "20 days");
    const withReceipt = await attach("con-recepcion", "400 days");
    await sql.query(
      `INSERT INTO "InvoiceDraft"(id, "branchId", "userId", lines, "attachmentId")
       VALUES (gen_random_uuid(), 'main', 'u1', '[]', $1)`,
      [withDraft],
    );
    await sql.query(
      `INSERT INTO "GoodsReceipt"(id, "attachmentId", freight, "otherCosts", items, "userId")
       VALUES (gen_random_uuid(), $1, 0, 0, '[]', 'u1')`,
      [withReceipt],
    );
    const purged = await purgeExpiredData(prisma);
    expect(purged.errors).toEqual([]);
    expect(purged.invoiceAttachments).toBe(1);
    const ids = (
      await sql.query(`SELECT id FROM "InvoiceAttachment"`)
    ).rows.map((r: any) => r.id);
    expect(ids).not.toContain(orphanOld);
    expect(ids).toEqual(
      expect.arrayContaining([orphanNew, withDraft, withReceipt]),
    );
  }, 60_000);

  it("los avisos pendientes de más de 30 días se descartan; los recientes siguen en cola", async () => {
    const { purgeExpiredData } = await import("../apps/api/src/retention");
    await sql.query(
      `INSERT INTO "NotificationOutbox"(id, "eventType", "refId", payload, status, "createdAt", "nextAttemptAt") VALUES
        (gen_random_uuid(), 'sale', 'pendiente-viejo', '{"text":"Cliente: Ana Herrera"}', 'pending', ${ago("31 days")}, now()),
        (gen_random_uuid(), 'sale', 'pendiente-hace-29', '{"text":"x"}', 'pending', ${ago("29 days")}, now()),
        (gen_random_uuid(), 'sale', 'pendiente-reciente', '{"text":"x"}', 'pending', ${ago("1 hour")}, now())`,
    );
    const purged = await purgeExpiredData(prisma);
    expect(purged.notifications).toBe(1);
    expect(
      (await sql.query(`SELECT "refId" FROM "NotificationOutbox" ORDER BY 1`))
        .rows,
    ).toEqual([
      { refId: "pendiente-hace-29" },
      { refId: "pendiente-reciente" },
    ]);
  }, 60_000);
});

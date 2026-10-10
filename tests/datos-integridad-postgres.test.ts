import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { permissions } from "../packages/shared/src/index";

// Auditorías 06 (datos y concurrencia) y 03 (privacidad) contra PostgreSQL
// real: migraciones nuevas (base vacía, base con datos antiguos que violan
// las reglas, dos ejecuciones seguidas, sin deriva con schema.prisma),
// restricciones, carrera de la limpieza de borradores, retención y
// anonimización completa. Con NEXORA_TEST_PG_URL usa ese servidor; si no,
// uno embebido.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaDir = join(root, "apps", "api", "prisma");
const migrationsDir = join(prismaDir, "migrations");
const OWN = [
  "202610210001_datos_indices",
  "202610210002_datos_restricciones",
  "202610210003_datos_privacidad",
];
const apiRequire = createRequire(join(root, "apps", "api", "package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const run = promisify(execFile);

const INDEXES = [
  "AuditLog_entityId_entity_idx",
  "PurchaseItem_orderId_idx",
  "Sale_customerId_idx",
];
const CONSTRAINTS = [
  "CashMovement_sessionId_fkey",
  "CreditNote_customerId_fkey",
  "CreditNote_returnId_fkey",
  "GoodsReceipt_attachmentId_fkey",
  "KitComponent_componentVariantId_fkey",
  "KitComponent_kitVariantId_fkey",
  "Payment_cashSessionId_fkey",
  "Payment_creditNoteId_fkey",
  "PurchaseItem_variantId_fkey",
  "SaleReturn_cashSessionId_fkey",
  "Sale_cashSessionId_fkey",
  "Sale_customerId_fkey",
  "cash_movement_amount_nonnegative",
  "cash_movement_type_valid",
  "cash_session_closed_after_opened",
  "cash_session_opening_nonnegative",
  "credit_note_amount_nonnegative",
  "expense_amount_nonnegative",
  "incentive_entry_period_valid",
  "incentive_period_close_period_valid",
  "incentive_settlement_period_valid",
  "kit_component_qty_positive",
  "payment_amounts_nonnegative",
  "purchase_item_quantities_valid",
  "sale_amounts_nonnegative",
  "sale_return_amounts_nonnegative",
  "sale_return_refund_method_valid",
  "sale_status_valid",
  "supplier_payment_amount_nonnegative",
];

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

async function startServer() {
  const external = process.env.NEXORA_TEST_PG_URL;
  const created: string[] = [];
  let adminUrl: string;
  let stop: () => Promise<void>;
  if (external) {
    adminUrl = external;
    stop = async () => undefined;
  } else {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-datos-db-"));
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
    stop = async () => {
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    };
  }
  const url = (db: string) => {
    const u = new URL(adminUrl);
    u.pathname = "/" + db;
    return u.toString();
  };
  const admin = async (sql: string) => {
    const c = new Client({ connectionString: adminUrl });
    await c.connect();
    try {
      await c.query(sql);
    } finally {
      await c.end();
    }
  };
  return {
    url,
    client: (db: string) => new Client({ connectionString: url(db) }),
    create: async (db: string) => {
      await admin(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
      await admin(`CREATE DATABASE "${db}"`);
      created.push(db);
    },
    stop: async () => {
      for (const db of created)
        await admin(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`).catch(
          () => undefined,
        );
      await stop();
    },
  };
}

const prismaEnv = (databaseUrl: string) => ({
  ...process.env,
  DATABASE_URL: databaseUrl,
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
});
const migrate = (schema: string, databaseUrl: string) =>
  run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
    cwd: root,
    env: prismaEnv(databaseUrl),
    timeout: 120_000,
  });

// Esquema con las migraciones anteriores a las de esta rama: una base «vieja».
async function previousSchema(parent: string) {
  const target = join(parent, "prisma-pre-datos");
  await mkdir(join(target, "migrations"), { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(target, "schema.prisma"));
  await cp(
    join(migrationsDir, "migration_lock.toml"),
    join(target, "migrations", "migration_lock.toml"),
  );
  for (const name of await readdir(migrationsDir))
    if (/^\d/.test(name) && name < OWN[0])
      await cp(join(migrationsDir, name), join(target, "migrations", name), {
        recursive: true,
      });
  return join(target, "schema.prisma");
}

async function applyOwn(client: any) {
  const notices: string[] = [];
  const onNotice = (n: any) => notices.push(String(n.message));
  client.on("notice", onNotice);
  try {
    for (const name of OWN)
      await client.query(
        await readFile(join(migrationsDir, name, "migration.sql"), "utf8"),
      );
  } finally {
    client.off("notice", onNotice);
  }
  return notices.filter((n) => n.startsWith("DATOS:"));
}

const indexes = async (client: any) =>
  (
    await client.query(
      `SELECT c.relname FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = ANY($1) AND i.indisvalid ORDER BY 1`,
      [INDEXES],
    )
  ).rows.map((r: any) => r.relname);

const constraintState = async (client: any) =>
  Object.fromEntries(
    (
      await client.query(
        `SELECT conname, convalidated FROM pg_constraint
          WHERE connamespace = current_schema()::regnamespace AND conname = ANY($1)`,
        [CONSTRAINTS],
      )
    ).rows.map((r: any) => [r.conname, r.convalidated]),
  );

// Lo que la base aceptaba sin protestar (06-anexos/sql/restricciones.sql).
async function expectRejected(client: any, sql: string, code: string) {
  await client.query("BEGIN");
  try {
    await expect(client.query(sql)).rejects.toMatchObject({ code });
  } finally {
    await client.query("ROLLBACK");
  }
}

async function baseRows(client: any) {
  const ids = {
    customer: randomUUID(),
    cash: randomUUID(),
    sale: randomUUID(),
    payment: randomUUID(),
    product: randomUUID(),
    variant: randomUUID(),
    order: randomUUID(),
    item: randomUUID(),
    supplier: randomUUID(),
    category: randomUUID(),
  };
  const q = (sql: string, params: unknown[]) => client.query(sql, params);
  await q(
    `INSERT INTO "Customer"(id, name, "updatedAt") VALUES ($1, 'Cliente Base', now())`,
    [ids.customer],
  );
  await q(
    `INSERT INTO "CashSession"(id, "userId", "openingAmount", "openedAt") VALUES ($1, 'u1', 100, now() - interval '1 hour')`,
    [ids.cash],
  );
  await q(
    `INSERT INTO "Sale"(id, number, "offlineUuid", "customerId", "sellerId", "cashSessionId", subtotal, "discountTotal", "taxTotal", total, "costTotal", "updatedAt")
     VALUES ($1, $4, gen_random_uuid(), $2, gen_random_uuid(), $3, 100, 0, 15, 100, 50, now())`,
    [ids.sale, ids.customer, ids.cash, "DT-" + ids.sale],
  );
  await q(
    `INSERT INTO "Payment"(id, "saleId", "cashSessionId", method, amount, tendered) VALUES ($1, $2, $3, 'cash', 100, 100)`,
    [ids.payment, ids.sale, ids.cash],
  );
  await q(
    `INSERT INTO "Category"(id, name, "updatedAt") VALUES ($1::uuid, 'Cat ' || $1::uuid::text, now())`,
    [ids.category],
  );
  await q(
    `INSERT INTO "Product"(id, name, sku, "categoryId", "updatedAt") VALUES ($1::uuid, 'Prod', 'P-' || $1::uuid::text, $2, now())`,
    [ids.product, ids.category],
  );
  await q(
    `INSERT INTO "Variant"(id, "productId", sku, barcode, "costAvg", price, "updatedAt") VALUES ($1::uuid, $2, 'SKU-' || $1::uuid::text, 'BC-' || $1::uuid::text, 10, 20, now())`,
    [ids.variant, ids.product],
  );
  await q(
    `INSERT INTO "PurchaseOrder"(id, number, "supplierId", total, "updatedAt") VALUES ($1::uuid, 'OC-' || $1::uuid::text, $2, 100, now())`,
    [ids.order, ids.supplier],
  );
  await q(
    `INSERT INTO "PurchaseItem"(id, "orderId", "variantId", qty, "receivedQty", "unitCost") VALUES ($1, $2, $3, 10, 4, 10)`,
    [ids.item, ids.order, ids.variant],
  );
  return ids;
}

describe("Auditoría 06 · migraciones de datos en PostgreSQL real", () => {
  it("base vacía y base con datos antiguos: crea índices y restricciones, nunca aborta, se repite y no deriva de schema.prisma", async () => {
    const server = await startServer();
    const projectDir = await mkdtemp(join(tmpdir(), "nexora-datos-project-"));
    const clients: any[] = [];
    const open = async (db: string) => {
      const c = server.client(db);
      await c.connect();
      clients.push(c);
      return c;
    };
    try {
      // (a) Base vacía con todas las migraciones (prisma migrate deploy).
      await server.create("nexora_datos_clean");
      const clean = await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_datos_clean"),
      );
      for (const name of OWN) expect(clean.stdout).toContain(name);
      const a = await open("nexora_datos_clean");
      expect(await indexes(a)).toEqual(INDEXES);
      const state = await constraintState(a);
      expect(Object.keys(state).sort()).toEqual([...CONSTRAINTS].sort());
      expect(Object.values(state).every(Boolean)).toBe(true);
      // Dos veces más con psql: sin avisos ni errores, nada cambia.
      for (let i = 0; i < 2; i++) {
        expect(await applyOwn(a)).toEqual([]);
        expect(await constraintState(a)).toEqual(state);
      }
      await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_datos_clean"),
      );

      // Sin deriva: schema.prisma y las migraciones describen la misma base
      // (D-B1: GoodsReceipt_orderId_fkey; las FK nuevas como relaciones).
      await server.create("nexora_datos_shadow");
      const diff = await run(
        process.execPath,
        [
          prismaCli,
          "migrate",
          "diff",
          "--from-migrations",
          migrationsDir,
          "--to-schema-datamodel",
          join(prismaDir, "schema.prisma"),
          "--shadow-database-url",
          server.url("nexora_datos_shadow"),
          "--script",
        ],
        {
          cwd: root,
          env: prismaEnv(server.url("nexora_datos_shadow")),
          timeout: 120_000,
        },
      );
      expect(diff.stdout).toContain("This is an empty migration.");

      // La base rechaza lo que antes aceptaba.
      const ids = await baseRows(a);
      const bad: [string, string][] = [
        [
          `UPDATE "PurchaseItem" SET "receivedQty" = qty + 5 WHERE id = '${ids.item}'`,
          "23514",
        ],
        [
          `INSERT INTO "Payment"(id, "saleId", method, amount, tendered) VALUES (gen_random_uuid(), '${ids.sale}', 'cash', -500, -500)`,
          "23514",
        ],
        [
          `INSERT INTO "Payment"(id, "saleId", "cashSessionId", method, amount, tendered) VALUES (gen_random_uuid(), '${ids.sale}', gen_random_uuid(), 'cash', 5, 5)`,
          "23503",
        ],
        [
          `INSERT INTO "CashMovement"(id, "sessionId", type, amount, reason, "userId") VALUES (gen_random_uuid(), '${ids.cash}', 'robo', 1, 'x', 'u')`,
          "23514",
        ],
        [
          `INSERT INTO "CashMovement"(id, "sessionId", type, amount, reason, "userId") VALUES (gen_random_uuid(), '${ids.cash}', 'out', -1, 'x', 'u')`,
          "23514",
        ],
        [
          `INSERT INTO "CashMovement"(id, "sessionId", type, amount, reason, "userId") VALUES (gen_random_uuid(), gen_random_uuid(), 'out', 1, 'x', 'u')`,
          "23503",
        ],
        [
          `INSERT INTO "CreditNote"(id, "redemptionCode", "returnId", amount, balance) VALUES (gen_random_uuid(), 'X' || gen_random_uuid(), gen_random_uuid(), 100, 100)`,
          "23503",
        ],
        [`UPDATE "Sale" SET total = -1 WHERE id = '${ids.sale}'`, "23514"],
        [
          `UPDATE "Sale" SET status = 'lo-que-sea' WHERE id = '${ids.sale}'`,
          "23514",
        ],
        [
          `UPDATE "Sale" SET "customerId" = gen_random_uuid() WHERE id = '${ids.sale}'`,
          "23503",
        ],
        [
          `UPDATE "Sale" SET "cashSessionId" = gen_random_uuid() WHERE id = '${ids.sale}'`,
          "23503",
        ],
        [
          `UPDATE "CashSession" SET "closedAt" = "openedAt" - interval '1 day' WHERE id = '${ids.cash}'`,
          "23514",
        ],
        [
          `INSERT INTO "KitComponent"(id, "kitVariantId", "componentVariantId", qty) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1)`,
          "23503",
        ],
        [
          `INSERT INTO "KitComponent"(id, "kitVariantId", "componentVariantId", qty) VALUES (gen_random_uuid(), '${ids.variant}', '${ids.variant}', -3)`,
          "23514",
        ],
        [
          `INSERT INTO "IncentiveEntry"(id, kind, "refId", "saleId", "saleItemId", "userId", "categoryName", qty, "rateAtSale", amount, period, "originPeriod") VALUES (gen_random_uuid(), 'sale', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'c', 1, 1, 1, '2026-13', '2026-10')`,
          "23514",
        ],
        [
          `INSERT INTO "SaleReturn"(id, "saleId", number, reason, total, "taxTotal", "costTotal", "refundMethod", "userId", items) VALUES (gen_random_uuid(), '${ids.sale}', 'NC-X' || gen_random_uuid(), 'motivo', -10, 0, 0, 'cash', 'u', '[]')`,
          "23514",
        ],
        [
          `INSERT INTO "PurchaseItem"(id, "orderId", "variantId", qty, "unitCost") VALUES (gen_random_uuid(), '${ids.order}', gen_random_uuid(), 1, 1)`,
          "23503",
        ],
        [
          `INSERT INTO "Expense"(id, "categoryId", amount, method, description, "updatedAt") SELECT gen_random_uuid(), id, -5, 'cash', 'x', now() FROM "ExpenseCategory" LIMIT 1`,
          "23514",
        ],
        [
          `INSERT INTO "SupplierPayment"(id, "supplierId", amount, method) VALUES (gen_random_uuid(), gen_random_uuid(), -5, 'cash')`,
          "23514",
        ],
      ];
      // La migración inicial no crea categorías de gasto: una para la prueba.
      await a.query(
        `INSERT INTO "ExpenseCategory"(id, name) VALUES (gen_random_uuid(), 'Prueba datos') ON CONFLICT DO NOTHING`,
      );
      for (const [sql, code] of bad) await expectRejected(a, sql, code);
      // Las filas válidas siguen entrando.
      await a.query(
        `INSERT INTO "CashMovement"(id, "sessionId", type, amount, reason, "userId") VALUES (gen_random_uuid(), $1, 'out', 1, 'Retiro', 'u')`,
        [ids.cash],
      );
      await a.query(
        `UPDATE "PurchaseItem" SET "receivedQty" = 6, "damagedQty" = 4 WHERE id = $1`,
        [ids.item],
      );

      // (b) Base anterior con datos que violan las reglas: el despliegue
      // termina, las restricciones violadas quedan NOT VALID (protegen lo
      // nuevo) con un aviso, el resto queda validado; al corregir los datos y
      // volver a ejecutar la migración, quedan validadas.
      await server.create("nexora_datos_old");
      await migrate(
        await previousSchema(projectDir),
        server.url("nexora_datos_old"),
      );
      const b = await open("nexora_datos_old");
      expect(await indexes(b)).toEqual([]);
      const old = await baseRows(b);
      const orphanNote = randomUUID();
      await b.query(
        `INSERT INTO "CreditNote"(id, "redemptionCode", "returnId", amount, balance) VALUES ($1, 'HUERFANA', gen_random_uuid(), 100, 100)`,
        [orphanNote],
      );
      await b.query(
        `UPDATE "PurchaseItem" SET "receivedQty" = qty + 5 WHERE id = $1`,
        [old.item],
      );
      await b.query(
        `INSERT INTO "AuditLog"(id, "userId", action, entity, "entityId", before, after)
         VALUES (gen_random_uuid(), 'u', 'verify', 'payment', $1, $2, '{"status":"ok"}')`,
        [
          old.payment,
          JSON.stringify({
            id: old.payment,
            proofUrl: "data:image/jpeg;base64," + "B".repeat(3000),
          }),
        ],
      );
      await b.query(
        `INSERT INTO "AuthAttempt"(key, "failedAttempts") VALUES ('login:missing:abc:127.0.0.1', 1)`,
      );
      const upgraded = await migrate(
        join(prismaDir, "schema.prisma"),
        server.url("nexora_datos_old"),
      );
      for (const name of OWN) expect(upgraded.stdout).toContain(name);
      expect(await indexes(b)).toEqual(INDEXES);
      const partial = await constraintState(b);
      expect(Object.keys(partial).sort()).toEqual([...CONSTRAINTS].sort());
      expect(
        Object.entries(partial)
          .filter(([, valid]) => !valid)
          .map(([name]) => name)
          .sort(),
      ).toEqual(["CreditNote_returnId_fkey", "purchase_item_quantities_valid"]);
      // NOT VALID también protege: lo nuevo que viole la regla se rechaza.
      await expectRejected(
        b,
        `INSERT INTO "CreditNote"(id, "redemptionCode", "returnId", amount, balance) VALUES (gen_random_uuid(), 'X2', gen_random_uuid(), 1, 1)`,
        "23503",
      );
      // La foto que guardaba la bitácora desapareció; AuthAttempt tiene fecha.
      const { rows: audits } = await b.query(
        `SELECT before FROM "AuditLog" WHERE "entityId" = $1`,
        [old.payment],
      );
      expect(audits[0].before.proofUrl).toBe("(imagen)");
      expect(JSON.stringify(audits)).not.toContain("base64");
      const { rows: attempts } = await b.query(
        `SELECT "updatedAt" FROM "AuthAttempt"`,
      );
      expect(attempts[0].updatedAt).toBeInstanceOf(Date);
      // Dos ejecuciones más con psql: avisan de lo pendiente y no fallan.
      for (let i = 0; i < 2; i++) {
        const notices = await applyOwn(b);
        expect(notices).toEqual([
          expect.stringMatching(
            /^DATOS: 1 fila\(s\) antiguas de "CreditNote" violan CreditNote_returnId_fkey/,
          ),
          expect.stringMatching(
            /^DATOS: 1 fila\(s\) antiguas de "PurchaseItem" violan purchase_item_quantities_valid/,
          ),
        ]);
      }
      // Corregidos los datos, la siguiente ejecución valida todo.
      await b.query(`DELETE FROM "CreditNote" WHERE id = $1`, [orphanNote]);
      await b.query(
        `UPDATE "PurchaseItem" SET "receivedQty" = qty WHERE id = $1`,
        [old.item],
      );
      expect(await applyOwn(b)).toEqual([]);
      expect(Object.values(await constraintState(b)).every(Boolean)).toBe(true);
    } finally {
      for (const c of clients) await c.end().catch(() => undefined);
      await server.stop();
      await rm(projectDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 300_000);
});

describe("Auditorías 06 y 03 · comportamiento en PostgreSQL real", () => {
  // Cada prueba importa su módulo al ejecutarse: así, sin la corrección, cada
  // una falla por sí sola en vez de impedir que se cargue el archivo.
  let server: Awaited<ReturnType<typeof startServer>>;
  let sql: any;
  let prisma: any;
  const clients: any[] = [];
  beforeAll(async () => {
    server = await startServer();
    await server.create("nexora_datos_app");
    await migrate(
      join(prismaDir, "schema.prisma"),
      server.url("nexora_datos_app"),
    );
    sql = server.client("nexora_datos_app");
    await sql.connect();
    clients.push(sql);
    prisma = new PrismaClient({
      datasources: { db: { url: server.url("nexora_datos_app") } },
    });
    await prisma.$connect();
  }, 240_000);
  afterAll(async () => {
    if (prisma) await prisma.$disconnect().catch(() => undefined);
    for (const c of clients) await c.end().catch(() => undefined);
    if (server) await server.stop();
  });

  it("D-M5: la limpieza de borradores no borra la factura de una recepción confirmada a la vez", async () => {
    const { purgeStaleInvoiceDrafts } =
      await import("../apps/api/src/merchandise");
    // D-M5 · la limpieza de borradores no borra la factura de una
    // recepción que se confirma al mismo tiempo.
    const attachmentId = randomUUID();
    const draftId = randomUUID();
    const staleAttachment = randomUUID();
    const staleDraft = randomUUID();
    await sql.query(
      `INSERT INTO "InvoiceAttachment"(id, "branchId", "userId", mime, data, "createdAt")
       VALUES ($1, 'main', 'u', 'application/pdf', '\\x255044462d', now() - interval '9 days'),
              ($2, 'main', 'u', 'application/pdf', '\\x255044462d', now() - interval '9 days')`,
      [attachmentId, staleAttachment],
    );
    await sql.query(
      `INSERT INTO "InvoiceDraft"(id, "branchId", "userId", lines, "attachmentId", "createdAt")
       VALUES ($1, 'main', 'u', '[]', $2, now() - interval '8 days'),
              ($3, 'main', 'u', '[]', $4, now() - interval '8 days')`,
      [draftId, attachmentId, staleDraft, staleAttachment],
    );
    // Sesión A: lo mismo que la confirmación (merchandise.ts), sin
    // confirmar todavía.
    const confirm = server.client("nexora_datos_app");
    await confirm.connect();
    clients.push(confirm);
    const receiptId = randomUUID();
    await confirm.query("BEGIN");
    await confirm.query(
      `SELECT id FROM "InvoiceDraft" WHERE id = $1 FOR UPDATE`,
      [draftId],
    );
    await confirm.query(
      `INSERT INTO "GoodsReceipt"(id, "attachmentId", freight, "otherCosts", items, "userId")
       VALUES ($1, $2, 0, 0, '[]', 'u')`,
      [receiptId, attachmentId],
    );
    await confirm.query(
      `UPDATE "InvoiceDraft" SET "confirmedOperationId" = gen_random_uuid() WHERE id = $1`,
      [draftId],
    );
    // Sesión B: la limpieza que corre al subir otra factura.
    const purge = prisma.$transaction((tx: any) =>
      purgeStaleInvoiceDrafts(tx, "main"),
    );
    const settled = purge.then(
      () => ({ ok: true as const }),
      (error: any) => ({ ok: false as const, error }),
    );
    const deadline = Date.now() + 10_000;
    for (;;) {
      const { rows } = await sql.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'`,
      );
      if (rows[0].n > 0 || Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    await confirm.query("COMMIT");
    const outcome = await settled;
    expect(outcome).toEqual({ ok: true });
    const { rows: kept } = await sql.query(
      `SELECT r."attachmentId", (SELECT count(*)::int FROM "InvoiceAttachment" a WHERE a.id = r."attachmentId") AS exists
         FROM "GoodsReceipt" r WHERE r.id = $1`,
      [receiptId],
    );
    expect(kept).toEqual([{ attachmentId, exists: 1 }]);
    expect(
      (
        await sql.query(
          `SELECT count(*)::int AS n FROM "InvoiceDraft" WHERE id = $1`,
          [draftId],
        )
      ).rows[0].n,
    ).toBe(1);
    // El borrador vencido que nadie confirmó sí se borra con su archivo.
    expect(
      (
        await sql.query(
          `SELECT (SELECT count(*) FROM "InvoiceDraft" WHERE id = $1)::int + (SELECT count(*) FROM "InvoiceAttachment" WHERE id = $2)::int AS n`,
          [staleDraft, staleAttachment],
        )
      ).rows[0].n,
    ).toBe(0);
    // Y la base impide borrar la factura de una recepción.
    await expectRejected(
      sql,
      `DELETE FROM "InvoiceAttachment" WHERE id = '${attachmentId}'`,
      "23503",
    );
  }, 60_000);

  it("retención: RealtimeEvent, avisos enviados o fallidos viejos, AuthAttempt login:missing y sesiones vencidas", async () => {
    const { purgeExpiredData } = await import("../apps/api/src/retention");
    await sql.query(
      `INSERT INTO "RealtimeEvent"("branchId", type, data, "createdAt") VALUES
         ('main', 'stock.changed', '{}', timezone('UTC', now()) - interval '3 days'),
         ('main', 'stock.changed', '{}', timezone('UTC', now()) - interval '1 hour')`,
    );
    await sql.query(
      `INSERT INTO "NotificationOutbox"(id, "eventType", "refId", payload, status, "createdAt", "nextAttemptAt", "sentAt") VALUES
         (gen_random_uuid(), 'sale', 'viejo-fallido', '{"text":"Cliente: Ana"}', 'failed', timezone('UTC', now()) - interval '40 days', now(), NULL),
         (gen_random_uuid(), 'sale', 'viejo-pendiente', '{"text":"x"}', 'pending', timezone('UTC', now()) - interval '40 days', now(), NULL),
         (gen_random_uuid(), 'sale', 'viejo-enviado', '{"text":"x"}', 'sent', timezone('UTC', now()) - interval '40 days', now(), timezone('UTC', now()) - interval '31 days'),
           (gen_random_uuid(), 'sale', 'enviado-hace-29', '{"text":"x"}', 'sent', timezone('UTC', now()) - interval '40 days', now(), timezone('UTC', now()) - interval '29 days'),
         (gen_random_uuid(), 'sale', 'reciente-fallido', '{"text":"x"}', 'failed', timezone('UTC', now()) - interval '2 days', now(), NULL)`,
    );
    await sql.query(
      `INSERT INTO "AuthAttempt"(key, "failedAttempts", "lockedUntil") VALUES
         ('login:missing:viejo:10.0.0.1', 2, NULL),
         ('login:missing:reciente:10.0.0.2', 1, NULL),
         ('login:missing:bloqueado:10.0.0.3', 9, timezone('UTC', now()) + interval '1 hour'),
         ('login:user-1:0:10.0.0.4', 3, NULL),
         ('login:user-2:0:10.0.0.5', 1, NULL)`,
    );
    // El disparador fija la fecha en cada escritura: se envejecen a mano.
    await sql.query(
      `ALTER TABLE "AuthAttempt" DISABLE TRIGGER auth_attempt_touch;
       UPDATE "AuthAttempt" SET "updatedAt" = timezone('UTC', now()) - interval '3 days'
        WHERE key IN ('login:missing:viejo:10.0.0.1', 'login:missing:bloqueado:10.0.0.3', 'login:user-1:0:10.0.0.4');
       UPDATE "AuthAttempt" SET "updatedAt" = timezone('UTC', now()) - interval '40 days'
        WHERE key = 'login:user-2:0:10.0.0.5';
       ALTER TABLE "AuthAttempt" ENABLE TRIGGER auth_attempt_touch;`,
    );
    // Una escritura normal renueva la fecha (security.ts usa UPDATE crudo).
    await sql.query(
      `UPDATE "AuthAttempt" SET "failedAttempts" = "failedAttempts" + 1 WHERE key = 'login:user-1:0:10.0.0.4'`,
    );
    await sql.query(
      `INSERT INTO "RefreshToken"(id, "userId", hash, "expiresAt") VALUES
         (gen_random_uuid(), gen_random_uuid(), 'vencido-' || gen_random_uuid(), timezone('UTC', now()) - interval '3 days'),
         (gen_random_uuid(), gen_random_uuid(), 'vigente-' || gen_random_uuid(), timezone('UTC', now()) + interval '3 days')`,
    );
    const purged = await purgeExpiredData(prisma);
    expect(purged).toMatchObject({
      realtimeEvents: 1,
      notifications: 2,
      authAttempts: 2,
      refreshTokens: 1,
    });
    expect(
      (await sql.query(`SELECT "refId" FROM "NotificationOutbox" ORDER BY 1`))
        .rows,
    ).toEqual([
      { refId: "enviado-hace-29" },
      { refId: "reciente-fallido" },
      { refId: "viejo-pendiente" },
    ]);
    expect(
      (await sql.query(`SELECT key FROM "AuthAttempt" ORDER BY 1`)).rows.map(
        (r: any) => r.key,
      ),
    ).toEqual([
      "login:missing:bloqueado:10.0.0.3",
      "login:missing:reciente:10.0.0.2",
      "login:user-1:0:10.0.0.4",
    ]);
    expect(
      (await sql.query(`SELECT count(*)::int AS n FROM "RealtimeEvent"`))
        .rows[0].n,
    ).toBe(1);
    // Idempotente: una segunda pasada no borra nada más.
    expect(await purgeExpiredData(prisma)).toMatchObject({
      realtimeEvents: 0,
      notifications: 0,
      authAttempts: 0,
      refreshTokens: 0,
    });
  }, 60_000);

  it("03-A2: la anonimización borra fotos, textos libres, copias en bitácora y avisos de Telegram", async () => {
    const { AdminController } = await import("../apps/api/src/admin");
    const actor = {
      id: randomUUID(),
      name: "Dueña",
      email: "owner@example.test",
      role: "manager",
      permissions: permissions.manager,
      branchId: "main",
    } as any;
    const customer = {
      id: randomUUID(),
      name: "María Pérez",
      phone: "809-555-0177",
      email: "maria.perez@example.test",
      legalId: "00177777777",
    };
    await prisma.customer.create({
      data: { ...customer, notes: "Clienta frecuente", branchId: "main" },
    });
    const cash = await prisma.cashSession.create({
      data: { userId: actor.id, openingAmount: 0, branchId: "main" },
    });
    const sale = await prisma.sale.create({
      data: {
        number: "DT-PRIV-1",
        offlineUuid: randomUUID(),
        customerId: customer.id,
        sellerId: actor.id,
        cashSessionId: cash.id,
        subtotal: 500,
        discountTotal: 50,
        discountReason: "Descuento a María Pérez por cumpleaños",
        taxTotal: 0,
        total: 450,
        costTotal: 200,
        status: "voided",
        voidedReason: "María Pérez pidió anular; llamar al 809-555-0177",
        branchId: "main",
      },
    });
    const photo = "data:image/jpeg;base64," + "C".repeat(5000);
    const payment = await prisma.payment.create({
      data: {
        saleId: sale.id,
        cashSessionId: cash.id,
        method: "transfer",
        amount: 450,
        tendered: 450,
        entryType: "installment",
        status: "rejected",
        bank: "Banco Popular",
        reference: "Transf. María Pérez 809-555-0177",
        proofUrl: photo,
      },
    });
    const saleReturn = await prisma.saleReturn.create({
      data: {
        saleId: sale.id,
        number: "NC-DT-PRIV-1",
        reason: "María Pérez trajo el producto vencido",
        total: 10,
        taxTotal: 0,
        costTotal: 5,
        refundMethod: "credit_note",
        cashSessionId: cash.id,
        userId: actor.id,
        items: [],
        branchId: "main",
      },
    });
    await prisma.creditNote.create({
      data: {
        redemptionCode: "PRIV-" + randomUUID(),
        returnId: saleReturn.id,
        customerId: customer.id,
        amount: 10,
        balance: 0,
      },
    });
    // Copias que dejaba la versión anterior: la foto completa en la
    // bitácora del pago (verify/reject) y los avisos de Telegram.
    await sql.query(
      `INSERT INTO "AuditLog"(id, "userId", action, entity, "entityId", before, after) VALUES
         (gen_random_uuid(), 'u', 'reject', 'payment', $1, $2, '{"status":"rejected","reason":"Transferencia de María Pérez no llegó"}'),
         (gen_random_uuid(), 'u', 'return', 'sale', $3, NULL, $4)`,
      [
        payment.id,
        JSON.stringify({
          id: payment.id,
          proofUrl: photo,
          reference: "Transf. María Pérez",
        }),
        sale.id,
        JSON.stringify({ reason: "María Pérez trajo el producto vencido" }),
      ],
    );
    const variant = await sql.query(`SELECT id FROM "Variant" LIMIT 1`);
    if (variant.rows[0])
      await sql.query(
        `INSERT INTO "InventoryMovement"(id, "variantId", type, qty, "unitCost", "balanceAfter", "refId", reason, "userId")
         VALUES (gen_random_uuid(), $1, 'return_waste', 1, 1, 1, $2, 'María Pérez trajo el producto vencido (no vendible)', 'u')`,
        [variant.rows[0].id, sale.id],
      );
    for (const [event, refId, status] of [
      ["sale", sale.id, "sent"],
      ["sale_voided", sale.id, "pending"],
      ["return", saleReturn.id, "failed"],
      ["collection", payment.id, "pending"],
    ])
      await sql.query(
        `INSERT INTO "NotificationOutbox"(id, "eventType", "refId", payload, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [
          event,
          refId,
          JSON.stringify({
            text: `Factura DT-PRIV-1\nCliente: ${customer.name}\nMotivo: ${customer.name} pidió anular`,
          }),
          status,
        ],
      );

    const api = new AdminController(prisma);
    await (api as any).anonymizeCustomer(
      customer.id,
      { reason: "Solicitud verificada", requestRef: "DSR-0001" },
      actor,
    );

    const after = {
      sale: await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } }),
      payment: await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      }),
      saleReturn: await prisma.saleReturn.findUniqueOrThrow({
        where: { id: saleReturn.id },
      }),
      audit: (
        await sql.query(
          `SELECT before, after FROM "AuditLog" WHERE "entityId" = ANY($1)`,
          [[sale.id, payment.id, saleReturn.id]],
        )
      ).rows,
      outbox: (
        await sql.query(
          `SELECT status, payload FROM "NotificationOutbox" WHERE "refId" = ANY($1)`,
          [[sale.id, payment.id, saleReturn.id]],
        )
      ).rows,
      movements: (
        await sql.query(
          `SELECT reason FROM "InventoryMovement" WHERE "refId" = $1`,
          [sale.id],
        )
      ).rows,
    };
    const text = JSON.stringify(after);
    for (const value of [
      customer.name,
      customer.phone,
      customer.email,
      customer.legalId,
      "María",
      "base64",
    ])
      expect(text).not.toContain(value);
    // Se conserva lo contable y el sentido del texto.
    expect(after.payment).toMatchObject({
      proofUrl: null,
      bank: "Banco Popular",
      // Con el teléfono dentro, el texto entero se reemplaza.
      reference: "[dato anonimizado]",
    });
    expect(Number(after.payment.amount)).toBe(450);
    expect(after.sale).toMatchObject({
      number: "DT-PRIV-1",
      voidedReason: "[dato anonimizado]",
      discountReason: "Descuento a [dato anonimizado] por cumpleaños",
    });
    expect(after.saleReturn.reason).toBe(
      "[dato anonimizado] trajo el producto vencido",
    );
    expect(after.outbox).toHaveLength(4);
    for (const row of after.outbox)
      expect(row.payload.text).toContain("Cliente: [dato anonimizado]");
    expect(
      after.outbox.filter((r: any) => r.status === "pending"),
    ).toHaveLength(2);
    // La bitácora del pago conserva el estado y el motivo, sin la foto.
    const paymentAudit = after.audit.find(
      (row: any) => row.before?.id === payment.id,
    );
    expect(paymentAudit).toMatchObject({
      before: { proofUrl: "(imagen)", reference: "Transf. [dato anonimizado]" },
      after: {
        status: "rejected",
        reason: "Transferencia de [dato anonimizado] no llegó",
      },
    });
    if (variant.rows[0])
      expect(after.movements).toEqual([
        {
          reason: "[dato anonimizado] trajo el producto vencido (no vendible)",
        },
      ]);
  }, 60_000);
});

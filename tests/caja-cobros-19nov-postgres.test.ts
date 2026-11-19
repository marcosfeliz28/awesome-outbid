import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { SalesController } from "../apps/api/src/sales";

// Reparar caja y cobros (19-nov-2026), con PostgreSQL real: hallazgos de la
// auditoría de dinero en cobros, créditos y transferencias.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireApi = createRequire(join(root, "apps/api/package.json"));
const PrismaClient = requireApi("@prisma/client").PrismaClient;
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
const DB_NAME = "nexora_caja_cobros_19nov";
const port = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      server.close(() =>
        typeof a === "object" && a ? done(a.port) : fail(new Error("No port")),
      );
    });
  });
let database: any, db: any, dataDir: string;
let sales: SalesController;
let actor: any;
let session: string;

// Venta de RD$ 1,000 pagada con una transferencia por verificar.
const transferSale = async () => {
  const n = randomUUID();
  const customer = await db.customer.create({
    data: { name: "Clienta " + n.slice(0, 6) },
  });
  const sale = await db.sale.create({
    data: {
      number: "CC-" + n.slice(0, 8),
      offlineUuid: n,
      sellerId: actor.id,
      customerId: customer.id,
      cashSessionId: session,
      subtotal: 1000,
      discountTotal: 0,
      taxTotal: 0,
      total: 1000,
      costTotal: 500,
      payments: {
        create: {
          cashSessionId: session,
          method: "transfer",
          amount: 1000,
          tendered: 1000,
          bank: "Popular",
          reference: "REF-" + n.slice(0, 6),
          status: "pending_verification",
        },
      },
    },
    include: { payments: true },
  });
  await db.alert.create({
    data: {
      key: "transfer:" + sale.payments[0].id,
      type: "transfer_pending",
      severity: "high",
      entityId: sale.id,
      branchId: "main",
      message: "Transferencia sin verificar",
    },
  });
  return {
    saleId: sale.id as string,
    paymentId: sale.payments[0].id as string,
    customerId: customer.id as string,
  };
};

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-caja-cobros-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const admin = new PrismaClient({ datasources: { db: { url } } });
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`,
    );
    await admin.$executeRawUnsafe(`CREATE DATABASE "${DB_NAME}"`);
    await admin.$disconnect();
    const target = new URL(url);
    target.pathname = "/" + DB_NAME;
    url = target.toString();
  } else {
    const p = await port();
    database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port: p,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase(DB_NAME);
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/${DB_NAME}`;
  }
  await run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps/api/prisma/schema.prisma"),
    ],
    { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000 },
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  const role = await db.role.create({
    data: { name: "Admin prueba " + randomUUID(), permissions: ["*"] },
  });
  const user = await db.user.create({
    data: {
      name: "Admin prueba",
      email: `qa-${randomUUID()}@example.invalid`,
      passwordHash: "x",
      pinHash: "x",
      roleId: role.id,
    },
  });
  actor = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "admin",
    permissions: ["*"],
    branchId: "main",
  };
  sales = new SalesController(db as any);
  session = (
    await db.cashSession.create({
      data: { userId: actor.id, registerId: "terminal-1", openingAmount: 0 },
    })
  ).id;
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("D5 · deuda de una transferencia de venta rechazada", () => {
  it("sale en Créditos por persona, estado de cuenta, pendientes y se puede cobrar", async () => {
    const t = await transferSale();
    await sales.reject(t.paymentId, { reason: "No llegó al banco" }, actor);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: t.saleId } });
    expect(Number(sale.creditBalance)).toBe(1000);

    const accounts: any = await sales.creditAccounts(actor);
    const row = accounts.rows.find((r: any) => r.customer.id === t.customerId);
    expect(row?.balance).toBe(1000);

    const statement: any = await sales.creditStatement(actor, t.customerId);
    expect(statement.balance).toBe(1000);
    expect(statement.sales.map((s: any) => s.id)).toContain(t.saleId);

    const pending: any[] = await sales.codPending(actor);
    const line = pending.find((p) => p.saleId === t.saleId);
    expect(line?.pending).toBe(1000);
    expect(line?.receivableAmount).toBe(1000);

    // La cajera puede cobrarla desde Créditos pendientes.
    await sales.creditCollection(
      t.saleId,
      {
        operationId: randomUUID(),
        cashSessionId: session,
        lines: [{ method: "cash", amount: 1000 }],
      },
      actor,
    );
    const paid = await db.sale.findUniqueOrThrow({ where: { id: t.saleId } });
    expect(Number(paid.creditBalance)).toBe(0);
  });
});

describe("D6 · anular una venta con transferencia por verificar", () => {
  it("cierra su alerta y la saca de Transferencias por verificar", async () => {
    const t = await transferSale();
    await sales.voidSale(t.saleId, { reason: "Venta duplicada" }, actor);
    const alert = await db.alert.findUniqueOrThrow({
      where: { key: "transfer:" + t.paymentId },
    });
    expect(alert.status).toBe("resolved");
    const list: any[] = await sales.pendingTransfers(actor, {});
    expect(list.map((p) => p.id)).not.toContain(t.paymentId);
  });
});

// Venta a crédito de RD$ 1,000 con un abono de RD$ 500 con tarjeta sin caja.
const cardCollectionWithoutCash = async () => {
  const n = randomUUID();
  const sale = await db.sale.create({
    data: {
      number: "CT-" + n.slice(0, 8),
      offlineUuid: n,
      sellerId: actor.id,
      cashSessionId: session,
      subtotal: 1000,
      discountTotal: 0,
      taxTotal: 0,
      total: 1000,
      costTotal: 500,
      creditBalance: 500,
      payments: {
        create: [
          {
            cashSessionId: session,
            method: "credit",
            amount: 1000,
            tendered: 1000,
            status: "pending",
          },
          {
            entryType: "installment",
            method: "card",
            amount: 500,
            tendered: 500,
          },
        ],
      },
    },
    include: { payments: true },
  });
  const card = sale.payments.find((p: any) => p.method === "card");
  return { saleId: sale.id as string, paymentId: card.id as string };
};

describe("D9 · corregir un cobro sin caja a efectivo", () => {
  it("sin caja ni marca de la dueña se rechaza", async () => {
    const t = await cardCollectionWithoutCash();
    const error: any = await sales
      .correctPaymentMethod(
        t.saleId,
        t.paymentId,
        { method: "cash", reason: "Fue efectivo" },
        actor,
      )
      .catch((e) => e);
    expect(error?.status).toBe(400);
    const p = await db.payment.findUniqueOrThrow({
      where: { id: t.paymentId },
    });
    expect(p.method).toBe("card");
  });
  it("con la caja indicada entra a esa caja", async () => {
    const t = await cardCollectionWithoutCash();
    await sales.correctPaymentMethod(
      t.saleId,
      t.paymentId,
      { method: "cash", cashSessionId: session, reason: "Fue efectivo" },
      actor,
    );
    const p = await db.payment.findUniqueOrThrow({
      where: { id: t.paymentId },
    });
    expect(p.method).toBe("cash");
    expect(p.cashSessionId).toBe(session);
  });
  it("marcado como de la dueña queda con su marca", async () => {
    const t = await cardCollectionWithoutCash();
    await sales.correctPaymentMethod(
      t.saleId,
      t.paymentId,
      { method: "cash", ownerConfirmed: true, reason: "Lo tiene la dueña" },
      actor,
    );
    const p = await db.payment.findUniqueOrThrow({
      where: { id: t.paymentId },
    });
    expect(p.method).toBe("cash");
    expect(p.cashSessionId).toBeNull();
    expect(p.reference).toMatch(/^Recibido por la dueña/);
    expect(p.receivedById).toBe(actor.id);
  });
});

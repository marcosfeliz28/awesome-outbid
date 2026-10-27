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
import { CashController } from "../apps/api/src/cash";

// Auditoría T2 (26-oct), con PostgreSQL real: anular una venta mientras su
// caja sigue abierta no puede dejar el efectivo esperado en negativo, ni aunque
// el retiro y la anulación lleguen a la vez.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireApi = createRequire(join(root, "apps/api/package.json"));
const PrismaClient = requireApi("@prisma/client").PrismaClient;
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
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
let sales: SalesController, cash: CashController;
let actor: any;

const openCash = async () =>
  (
    await db.cashSession.create({
      data: { userId: actor.id, registerId: "terminal-1", openingAmount: 0 },
    })
  ).id as string;
const cashSale = async (sessionId: string) => {
  const n = randomUUID();
  const sale = await db.sale.create({
    data: {
      number: "ANU-" + n.slice(0, 8),
      offlineUuid: n,
      sellerId: actor.id,
      cashSessionId: sessionId,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      total: 100,
      costTotal: 50,
      payments: {
        create: {
          cashSessionId: sessionId,
          method: "cash",
          amount: 100,
          tendered: 100,
        },
      },
    },
  });
  return sale.id as string;
};
const out = (sessionId: string) =>
  cash.movement(
    sessionId,
    {
      operationId: randomUUID(),
      type: "out",
      amount: 100,
      reason: "Retiro de prueba",
    },
    actor,
  );
const voidIt = (id: string) =>
  sales.voidSale(id, { reason: "Error de cobro" }, actor);
const statusOf = async (id: string) =>
  (await db.sale.findUniqueOrThrow({ where: { id } })).status;
const expectedCash = async (sessionId: string) => {
  const [row] = await db.$queryRaw`
    SELECT (SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END),0) FROM "CashMovement" WHERE "sessionId"=${sessionId}::uuid)
      + (SELECT COALESCE(SUM(p.amount),0) FROM "Payment" p JOIN "Sale" s ON s.id=p."saleId" WHERE p."cashSessionId"=${sessionId}::uuid AND s.status='completed' AND p.method='cash') AS cash`;
  return Number(row.cash);
};

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-anular-caja-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const admin = new PrismaClient({ datasources: { db: { url } } });
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_anular_caja" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_anular_caja"');
    await admin.$disconnect();
    const target = new URL(url);
    target.pathname = "/nexora_anular_caja";
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
      postgresFlags: [
        "-c",
        "listen_addresses=127.0.0.1",
        "-c",
        "timezone=UTC",
      ],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase("nexora_anular_caja");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_anular_caja`;
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
  cash = new CashController(db as any);
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("anular con la caja de la venta abierta", () => {
  it("no se anula si el efectivo de la venta ya salió de la caja", async () => {
    const session = await openCash();
    const saleId = await cashSale(session);
    await out(session);
    const error: any = await voidIt(saleId).catch((e) => e);
    expect(error.status).toBe(400);
    expect(JSON.stringify(error.getResponse())).not.toMatch(/\d{2,}/);
    expect(await statusOf(saleId)).toBe("completed");
    expect(await expectedCash(session)).toBe(0);
    // Una sola caja abierta por usuario: se cierra para la prueba siguiente.
    await db.cashSession.update({
      where: { id: session },
      data: { closedAt: new Date() },
    });
  });

  it("sin retiro sí se anula, y retiro y anulación simultáneos nunca dejan negativo", async () => {
    const session = await openCash();
    const first = await cashSale(session);
    await voidIt(first);
    expect(await statusOf(first)).toBe("voided");
    const second = await cashSale(session);
    const results = await Promise.allSettled([out(session), voidIt(second)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await expectedCash(session)).toBeGreaterThanOrEqual(0);
  });
});

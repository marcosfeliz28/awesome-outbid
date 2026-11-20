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
import { refreshClosedCash } from "../apps/api/src/cash";

// Caso FS-0000730 (19-nov, caja de Wendy, Computadora 75AA, ya cerrada), con
// PostgreSQL real: venta de RD$ 3,500 donde se tecleó US$ 2,360 en vez de
// US$ 40 y la tarjeta de RD$ 1,140 (ref. 406574) no quedó en la factura.
// Base efímera de la prueba: nunca toca la base real.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireApi = createRequire(join(root, "apps/api/package.json"));
const PrismaClient = requireApi("@prisma/client").PrismaClient;
const { hash } = requireApi("bcryptjs");
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
const DB_NAME = "nexora_pago_usd_reemplazo";
const RATE = 60.457;
const MANAGER_PIN = "864209";
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
let owner: any, gerente: any, wendy: any;
let customerId: string, variantId: string;

const actorOf = (user: any, permissions: string[], role: string) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role,
  permissions,
  branchId: "main",
});
const person = async (name: string, permissions: string[], pin = "111111") => {
  const role = await db.role.create({
    data: { name: name + " " + randomUUID(), permissions },
  });
  return db.user.create({
    data: {
      name,
      email: `qa-${randomUUID()}@example.invalid`,
      passwordHash: "x",
      pinHash: await hash(pin, 4),
      roleId: role.id,
    },
  });
};
// Caja con fondo de RD$ 9,000. Cerrada: contó RD$ 9,000, tarjeta RD$ 1,140
// (el lote del verifón sí trae la tarjeta) y US$ 40. Abierta: una por usuario
// (se reutiliza la que ya tenga).
const cashSession = async (userId: string, closed: boolean) => {
  if (!closed) {
    const open = await db.cashSession.findFirst({
      where: { userId, closedAt: null },
    });
    if (open) return open.id as string;
  }
  return (
    await db.cashSession.create({
      data: {
        userId,
        registerId: "Computadora 75AA",
        openingAmount: 9000,
        ...(closed
          ? {
              openedAt: new Date(Date.now() - 8 * 3600000),
              closedAt: new Date(Date.now() - 3600000),
              countedCash: 9000,
              countedCard: 1140,
              countedTransfer: 0,
              closeDetails: { countedUsd: 40, transferBySystem: true },
            }
          : {}),
      },
    })
  ).id as string;
};
const cashier = async () =>
  actorOf(
    await person("Cajera prueba", ["sale:write", "cash:write"]),
    ["sale:write", "cash:write"],
    "seller",
  );
// La venta tal como quedó: UN pago en efectivo US$ 2,360 a 60.457.
const fs730 = async (
  sessionId: string,
  sellerId: string,
  extra: any[] = [],
) => {
  const n = randomUUID();
  const sale = await db.sale.create({
    data: {
      number: "FS-" + n.slice(0, 8),
      offlineUuid: n,
      sellerId,
      customerId,
      cashSessionId: sessionId,
      subtotal: 3500,
      discountTotal: 0,
      taxTotal: 533.9,
      total: 3500,
      costTotal: 2000,
      payments: {
        create: [
          {
            cashSessionId: sessionId,
            method: "cash",
            currency: "USD",
            amountUsd: 2360,
            usdRate: RATE,
            tendered: 142678.52,
            amount: 3500,
            change: 139178.52,
          },
          ...extra.map((p) => ({ cashSessionId: sessionId, ...p })),
        ],
      },
    },
  });
  const session = await db.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  if (session.closedAt) await refreshClosedCash(db, session);
  return sale.id as string;
};
const correct = (operationId?: string) => ({
  payments: [
    {
      method: "cash",
      currency: "USD",
      amountUsd: 40,
      usdRate: RATE,
      amount: 2360,
    },
    { method: "card", amount: 1140, approvalCode: "406574" },
  ],
  reason: "FS-0000730: se tecleó US$ 2,360 en vez de US$ 40; faltó la tarjeta",
  ownerConfirmed: true,
  ...(operationId ? { operationId } : {}),
});
const status = (p: Promise<unknown>) =>
  p.then(
    () => 200,
    (e: any) => e.status ?? e.getStatus?.() ?? 500,
  );
const message = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: any) => String(e.message),
  );
const session = (id: string) =>
  db.cashSession.findUniqueOrThrow({ where: { id } });
const n = (v: unknown) => Number(v);

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-pago-usd-"));
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
  await db.settings.upsert({
    where: { id: "main" },
    create: { id: "main", data: { usdRate: RATE } },
    update: { data: { usdRate: RATE } },
  });
  owner = actorOf(await person("Dueña prueba", ["*"]), ["*"], "admin");
  gerente = actorOf(
    await person("Gerente prueba", ["sale:manage", "sale:write"], MANAGER_PIN),
    ["sale:manage", "sale:write"],
    "manager",
  );
  wendy = actorOf(
    await person("Wendy prueba", ["sale:write", "cash:write"]),
    ["sale:write", "cash:write"],
    "seller",
  );
  customerId = (await db.customer.create({ data: { name: "Clienta USD" } })).id;
  const category = await db.category.create({
    data: { name: "Suplementos " + randomUUID() },
  });
  const product = await db.product.create({
    data: {
      name: "Proteína prueba",
      sku: "P-" + randomUUID(),
      categoryId: category.id,
    },
  });
  variantId = (
    await db.variant.create({
      data: {
        productId: product.id,
        sku: "V-" + randomUUID(),
        barcode: "B-" + randomUUID(),
        costAvg: 2000,
        price: 3500,
        stock: 50,
      },
    })
  ).id;
  sales = new SalesController(db as any);
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("POST /sales/:id/payments/replace · caso FS-0000730 en caja cerrada", () => {
  it("antes → después: efectivo, tarjeta y dólares cuadran; alerta y bitácora", async () => {
    const sid = await cashSession(wendy.id, true);
    const saleId = await fs730(sid, wendy.id);

    // ANTES: esperado efectivo 9,000 − 139,178.52 = −130,178.52; sobrante
    // +139,178.52; US$ esperados 2,360 contra 40 contados; tarjeta +1,140.
    const before = await session(sid);
    expect(n(before.expectedCash)).toBe(-130178.52);
    expect(n(before.differenceCash)).toBe(139178.52);
    expect(n(before.expectedCard)).toBe(0);
    expect(n(before.differenceCard)).toBe(1140);
    expect(before.closeDetails.expectedUsd).toBe(2360);
    expect(before.closeDetails.differenceUsd).toBe(-2320);

    // Caja cerrada sin la confirmación de la dueña: 400.
    const { ownerConfirmed: _ignored, ...unconfirmed } = correct();
    void _ignored;
    expect(
      await message(sales.replacePayments(saleId, unconfirmed, owner)),
    ).toMatch(/ownerConfirmed/);

    const operationId = randomUUID();
    const result: any = await sales.replacePayments(
      saleId,
      correct(operationId),
      owner,
    );
    expect(result.payments).toHaveLength(2);

    // DESPUÉS: esperado efectivo 9,000 − 58.28 = 8,941.72; contado 9,000;
    // queda +58.28 (el vuelto en pesos que el sistema da por entregado).
    const after = await session(sid);
    expect(n(after.expectedCash)).toBe(8941.72);
    expect(n(after.differenceCash)).toBe(58.28);
    expect(n(after.expectedCard)).toBe(1140);
    expect(n(after.differenceCard)).toBe(0);
    expect(after.closeDetails.expectedUsd).toBe(40);
    expect(after.closeDetails.differenceUsd).toBe(0);
    expect(result.cashSessions[0].before.differenceCash).toBe("139178.52");
    expect(result.cashSessions[0].after.differenceCash).toBe("58.28");

    const payments = await db.payment.findMany({
      where: { saleId },
      orderBy: { method: "asc" },
    });
    expect(
      payments.map((p: any) => ({
        method: p.method,
        currency: p.currency,
        amountUsd: p.amountUsd === null ? null : n(p.amountUsd),
        usdRate: p.usdRate === null ? null : n(p.usdRate),
        tendered: n(p.tendered),
        amount: n(p.amount),
        change: n(p.change),
        approvalCode: p.approvalCode,
        feeAmount: n(p.feeAmount),
        cashSessionId: p.cashSessionId,
      })),
    ).toEqual([
      {
        method: "card",
        currency: "DOP",
        amountUsd: null,
        usdRate: null,
        tendered: 1140,
        amount: 1140,
        change: 0,
        approvalCode: "406574",
        feeAmount: 28.5,
        cashSessionId: sid,
      },
      {
        method: "cash",
        currency: "USD",
        amountUsd: 40,
        usdRate: RATE,
        tendered: 2418.28,
        amount: 2360,
        change: 58.28,
        approvalCode: null,
        feeAmount: 0,
        cashSessionId: sid,
      },
    ]);

    const alert = await db.alert.findUnique({
      where: { key: `cash-after-close:${sid}:replace:${saleId}` },
    });
    expect(alert?.type).toBe("cash_after_close");
    expect(alert?.message).toContain("US$ 2,360.00");
    expect(alert?.message).toContain("US$ 40.00");
    expect(alert?.message).toContain("FS-0000730");
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "sale_payments_replaced", entityId: saleId },
    });
    expect(log.userId).toBe(owner.id);
    expect(log.before.payments[0].amountUsd).toBe("2360");
    expect(log.before.cashSessions[0].differenceCash).toBe("139178.52");
    expect(log.after.cashSessions[0].differenceCash).toBe("58.28");
    expect(log.after.operationId).toBe(operationId);
    expect(log.after.ownerConfirmed).toBe(true);

    // Idempotencia: la misma operación no se aplica dos veces.
    expect(
      await status(sales.replacePayments(saleId, correct(operationId), owner)),
    ).toBe(409);
    // Sin clave, los mismos pagos tampoco: no hay nada que cambiar.
    expect(
      await message(sales.replacePayments(saleId, correct(), owner)),
    ).toMatch(/ya son esos/);
    expect(
      await db.auditLog.count({
        where: { action: "sale_payments_replaced", entityId: saleId },
      }),
    ).toBe(1);
    // La misma clave en otra venta es un error.
    const other = await fs730(await cashSession(wendy.id, true), wendy.id);
    expect(
      await message(sales.replacePayments(other, correct(operationId), owner)),
    ).toMatch(/otra venta/);
  });
});

describe("POST /sales/:id/payments/replace · reglas", () => {
  it("caja abierta propia: sin confirmación de la dueña ni alerta", async () => {
    const sid = await cashSession(owner.id, false);
    const saleId = await fs730(sid, owner.id);
    const { ownerConfirmed: _x, ...body } = correct();
    void _x;
    const result: any = await sales.replacePayments(saleId, body, owner);
    expect(result.cashSessions).toEqual([]);
    expect(
      await db.alert.count({
        where: { key: { startsWith: `cash-after-close:${sid}:` } },
      }),
    ).toBe(0);
    const { cashExpected } = await import("../apps/api/src/cash");
    const expected = await cashExpected(db, await session(sid));
    expect(expected.cash).toBe(8941.72);
    expect(expected.card).toBe(1140);
    expect(expected.usd).toBe(40);
  });
  it("caja abierta de otra persona: 400", async () => {
    const ana = await cashier();
    const sid = await cashSession(ana.id, false);
    const saleId = await fs730(sid, ana.id);
    expect(
      await message(sales.replacePayments(saleId, correct(), owner)),
    ).toMatch(/abierta y es de otra persona/);
  });
  it("venta anulada: 400", async () => {
    const sid = await cashSession(wendy.id, true);
    const saleId = await fs730(sid, wendy.id);
    await db.sale.update({
      where: { id: saleId },
      data: { status: "voided" },
    });
    expect(await status(sales.replacePayments(saleId, correct(), owner))).toBe(
      400,
    );
  });
  it("USD sin tasa y suma incorrecta: 400 sin tocar nada", async () => {
    const sid = await cashSession(wendy.id, true);
    const saleId = await fs730(sid, wendy.id);
    const noRate = correct();
    delete (noRate.payments[0] as any).usdRate;
    expect(await message(sales.replacePayments(saleId, noRate, owner))).toMatch(
      /tasa/,
    );
    const short = correct();
    short.payments[1].amount = 1000;
    expect(await message(sales.replacePayments(saleId, short, owner))).toMatch(
      /deben coincidir/,
    );
    const pay = await db.payment.findMany({ where: { saleId } });
    expect(pay).toHaveLength(1);
    expect(n(pay[0].amountUsd)).toBe(2360);
  });
  it("transferencias: solo con allowTransfer", async () => {
    const sid = await cashSession(owner.id, false);
    const saleId = await fs730(sid, owner.id);
    const body: any = {
      payments: [
        {
          method: "cash",
          currency: "USD",
          amountUsd: 40,
          usdRate: RATE,
          amount: 2360,
        },
        { method: "transfer", amount: 1140, bank: "Popular", reference: "T-1" },
      ],
      reason: "Prueba de transferencia",
    };
    expect(await message(sales.replacePayments(saleId, body, owner))).toMatch(
      /flujo propio/,
    );
    const done: any = await sales.replacePayments(
      saleId,
      { ...body, allowTransfer: true },
      owner,
    );
    const transfer = done.payments.find((p: any) => p.method === "transfer");
    expect(transfer.status).toBe("pending_verification");
    expect(
      await db.alert.findUnique({ where: { key: "transfer:" + transfer.id } }),
    ).not.toBeNull();
  });
});

describe("POST /sales · tope preventivo del cobro en dólares", () => {
  const sell = (actor: any, sid: string, payments: any[], extra = {}) =>
    sales.sale(
      {
        offlineUuid: randomUUID(),
        customerId,
        cashSessionId: sid,
        items: [{ variantId, qty: 1 }],
        payments,
        ...extra,
      },
      actor,
    );
  const usd2360 = {
    method: "cash",
    currency: "USD",
    amountUsd: 2360,
    usdRate: RATE,
    amount: 142678.52,
  };
  it("cajera: US$ 2,360 sobre RD$ 3,500 pide confirmación y PIN de gerente", async () => {
    const ana = await cashier();
    const sid = await cashSession(ana.id, false);
    const first = sell(ana, sid, [usd2360]);
    expect(await status(first)).toBe(409);
    expect(await message(sell(ana, sid, [usd2360]))).toMatch(
      /^Revisa el monto en dólares: US\$ 2,360\.00 a RD\$ 60\.457 son RD\$ 142,678\.52.*PIN de un gerente/,
    );
    // Confirmar sin PIN no basta para la cajera.
    expect(
      await status(sell(ana, sid, [usd2360], { confirmLargeForeign: true })),
    ).toBe(409);
    expect(await db.sale.count({ where: { cashSessionId: sid } })).toBe(0);
    const ok: any = await sell(ana, sid, [usd2360], {
      confirmLargeForeign: true,
      managerPin: MANAGER_PIN,
    });
    expect(n(ok.total)).toBe(3500);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "large_foreign_confirmed", entityId: ok.id },
    });
    expect(log.after.approvedBy).toBe(gerente.id);
  });
  it("US$ 40 + tarjeta RD$ 1,140 pasa sin confirmación", async () => {
    const ana = await cashier();
    const sid = await cashSession(ana.id, false);
    const ok: any = await sell(ana, sid, [
      {
        method: "cash",
        currency: "USD",
        amountUsd: 40,
        usdRate: RATE,
        amount: 2418.28,
      },
      {
        method: "card",
        amount: 1140,
        approvalCode: "406574",
        cardLast4: "1234",
      },
    ]);
    expect(n(ok.total)).toBe(3500);
  });
  it("gerencia: basta con confirmar", async () => {
    const sid = await cashSession(gerente.id, false);
    expect(await status(sell(gerente, sid, [usd2360]))).toBe(409);
    const ok: any = await sell(gerente, sid, [usd2360], {
      confirmLargeForeign: true,
    });
    expect(n(ok.total)).toBe(3500);
  });
});

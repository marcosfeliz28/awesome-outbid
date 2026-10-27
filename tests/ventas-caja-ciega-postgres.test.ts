import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SalesController, hideSaleAmounts } from "../apps/api/src/sales";

// B-01 (caja ciega) con PostgreSQL real y el esquema de nexora-cloud (sin
// tenantId). Con NEXORA_VENTAS_CAJA_CIEGA=1 y la caja abierta, quien no ve el
// esperado de caja no recibe importes de las ventas de esa caja. Apagada (por
// defecto) la respuesta no cambia.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireApi = createRequire(join(root, "apps/api/package.json"));
const PrismaClient = requireApi("@prisma/client").PrismaClient;
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
const FLAG = "NEXORA_VENTAS_CAJA_CIEGA";
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
let cajera: any, admin: any;
let OLD: string, OPEN: string;
const CAJERA_PERMS = ["sale:write", "cash:write"];
const actorOf = (u: any, permissions: string[]): any => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: "test",
  permissions,
  branchId: "main",
});

// PDFKit guarda el texto en hexadecimal dentro de streams Flate.
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const pieces: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)) {
    let c = Buffer.from(m[1]!, "latin1");
    try {
      c = inflateSync(c);
    } catch {
      continue;
    }
    for (const h of c.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      pieces.push(Buffer.from(h[1]!, "hex").toString("latin1"));
  }
  return pieces.join("");
}

const list = (actor: any) => sales.list(actor, {} as any) as Promise<any[]>;
const byNumber = (rows: any[], n: string) =>
  rows.find((s: any) => s.number === n);
// receipt.pdf de una venta; el texto sale de los streams de PDFKit.
const receiptText = async (actor: any, number: string) => {
  const s = await db.sale.findUniqueOrThrow({ where: { number } });
  const res: any = new PassThrough();
  res.setHeader = () => undefined;
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(c));
  const end = new Promise((done) => res.on("end", done));
  await sales.receipt(s.id, actor, res);
  await end;
  return pdfText(Buffer.concat(chunks));
};
const voids = (actor: any) =>
  sales.voidRequests("all", actor) as Promise<any[]>;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-ventas-ciega-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const adminDb = new PrismaClient({ datasources: { db: { url } } });
    await adminDb.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_ventas_ciega" WITH (FORCE)',
    );
    await adminDb.$executeRawUnsafe('CREATE DATABASE "nexora_ventas_ciega"');
    await adminDb.$disconnect();
    const target = new URL(url);
    target.pathname = "/nexora_ventas_ciega";
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
    await database.createDatabase("nexora_ventas_ciega");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_ventas_ciega`;
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

  const cajeraRole = await db.role.create({
    data: { name: "Cajera ventas ciega " + randomUUID(), permissions: CAJERA_PERMS },
  });
  const adminRole = await db.role.create({
    data: { name: "Admin ventas ciega " + randomUUID(), permissions: ["*"] },
  });
  const mkUser = (name: string, roleId: string) =>
    db.user.create({
      data: {
        name,
        email: `qa-${randomUUID()}@example.invalid`,
        passwordHash: "x",
        pinHash: "x",
        roleId,
      },
    });
  cajera = actorOf(await mkUser("Cajera Uno", cajeraRole.id), CAJERA_PERMS);
  admin = actorOf(await mkUser("Admin Uno", adminRole.id), ["*"]);

  // Una caja ya cerrada y la caja abierta de la cajera.
  OLD = (
    await db.cashSession.create({
      data: {
        userId: cajera.id,
        openingAmount: 100,
        openedAt: new Date(Date.now() - 2 * 864e5),
        closedAt: new Date(Date.now() - 864e5),
      },
    })
  ).id;
  OPEN = (
    await db.cashSession.create({
      data: { userId: cajera.id, openingAmount: 500 },
    })
  ).id;

  const sale = (n: number, session: string | null, total: number, extra = {}) =>
    db.sale.create({
      data: {
        number: "QA-" + n,
        offlineUuid: randomUUID(),
        sellerId: cajera.id,
        cashSessionId: session,
        subtotal: total,
        discountTotal: 0,
        taxTotal: 0,
        total,
        costTotal: 1,
        ...extra,
        payments: {
          create: {
            cashSessionId: session,
            method: "cash",
            amount: total,
            tendered: total + 7,
            change: 7,
          },
        },
      },
    });
  await sale(1, OLD, 321.45);
  const open = await sale(2, OPEN, 123.45);
  // Sin caja asignada: una creada después de la apertura (createdAt >=
  // openedAt) y otra anterior a ella.
  await sale(6, null, 77.77);
  await sale(7, null, 55.55, {
    createdAt: new Date(Date.now() - 3 * 864e5),
  });
  // Solicitudes de anulación de la caja abierta y de la cerrada.
  const old = await db.sale.findUniqueOrThrow({ where: { number: "QA-1" } });
  for (const saleId of [open.id, old.id])
    await db.saleVoidRequest.create({
      data: {
        saleId,
        requestedById: cajera.id,
        operationId: randomUUID(),
        reasonCode: "payment_error",
        reason: "Error al cobrar",
      },
    });

  // Ventas a crédito: QA-3 en la caja abierta (100 en efectivo y 200 a crédito,
  // con un abono de 50 a esa caja); QA-4 en la caja vieja con un abono de 40 a
  // la abierta; QA-5 en la caja vieja con su propio abono.
  const credit = (n: number, session: string, total: number, balance: number) =>
    db.sale.create({
      data: {
        number: "QA-" + n,
        offlineUuid: randomUUID(),
        sellerId: cajera.id,
        cashSessionId: session,
        subtotal: total,
        discountTotal: 0,
        taxTotal: 0,
        total,
        costTotal: 1,
        creditBalance: balance,
        receivableKind: "credit",
      },
    });
  const pay = (saleId: string, session: string, entryType: string, method: string, amount: number) =>
    db.payment.create({
      data: { saleId, cashSessionId: session, entryType, method, amount, tendered: amount },
    });
  const c3 = await credit(3, OPEN, 300, 150);
  const c4 = await credit(4, OLD, 400, 360);
  const c5 = await credit(5, OLD, 500, 450);
  await pay(c3.id, OPEN, "sale", "credit", 200);
  await pay(c3.id, OPEN, "sale", "cash", 100);
  await pay(c3.id, OPEN, "installment", "cash", 50);
  await pay(c4.id, OLD, "sale", "credit", 400);
  await pay(c4.id, OPEN, "installment", "cash", 40);
  await pay(c5.id, OLD, "sale", "credit", 500);
  await pay(c5.id, OLD, "installment", "cash", 50);

  sales = new SalesController(db as any);
}, 240_000);

afterAll(async () => {
  delete process.env[FLAG];
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("Ventas con caja ciega (B-01)", () => {
  it("bandera APAGADA: la cajera con caja abierta recibe lo de siempre", async () => {
    delete process.env[FLAG];
    const sale = byNumber(await list(cajera), "QA-2");
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(sale.payments).toHaveLength(1);
    expect(sale.payments[0]).toMatchObject({ method: "cash" });
    expect(Number(sale.payments[0].amount)).toBe(123.45);
    expect(Number(sale.payments[0].change)).toBe(7);
  });

  it("bandera APAGADA: misma forma de respuesta en la caja abierta y en la cerrada", async () => {
    delete process.env[FLAG];
    const rows = await list(cajera);
    const keys = (o: any) => Object.keys(o).sort();
    expect(keys(byNumber(rows, "QA-2"))).toEqual(keys(byNumber(rows, "QA-1")));
    expect(byNumber(rows, "QA-2").hiddenUntilClose).toBeUndefined();
    const v = await voids(cajera);
    expect(keys(v.find((x) => x.sale.number === "QA-2").sale)).toEqual(
      keys(v.find((x) => x.sale.number === "QA-1").sale),
    );
    expect(v.find((x) => x.sale.number === "QA-2").sale.hiddenUntilClose).toBeUndefined();
  });

  it("bandera ENCENDIDA: sin importes de la caja abierta en la respuesta cruda", async () => {
    process.env[FLAG] = "1";
    const rows = await list(cajera);
    const sale = byNumber(rows, "QA-2");
    expect(sale).toMatchObject({
      number: "QA-2",
      status: "completed",
      hiddenUntilClose: true,
      total: null,
      subtotal: null,
      taxTotal: null,
      payments: [],
    });
    expect(sale.createdAt).toBeTruthy();
    expect(JSON.stringify(sale)).not.toMatch(/123\.45|"cash"|"change"|"tendered"/);
    // La caja ya cerrada sigue visible: no ayuda a deducir la abierta.
    const old = byNumber(rows, "QA-1");
    expect(Number(old.total)).toBe(321.45);
    expect(old.payments).toHaveLength(1);
  });

  it("bandera ENCENDIDA: la administradora recibe todo", async () => {
    process.env[FLAG] = "1";
    const sale = byNumber(await list(admin), "QA-2");
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(Number(sale.payments[0].amount)).toBe(123.45);
  });

  it("bandera ENCENDIDA: venta sin caja creada tras la apertura queda oculta; la anterior no", async () => {
    process.env[FLAG] = "1";
    const rows = await list(cajera);
    expect(byNumber(rows, "QA-6")).toMatchObject({
      total: null,
      payments: [],
      hiddenUntilClose: true,
    });
    expect(Number(byNumber(rows, "QA-7").total)).toBe(55.55);
    expect(byNumber(rows, "QA-7").hiddenUntilClose).toBeUndefined();
  });

  it("bandera ENCENDIDA: /void-requests oculta importes de la caja abierta", async () => {
    process.env[FLAG] = "1";
    const rows = await voids(cajera);
    const open = rows.find((v) => v.sale.number === "QA-2").sale;
    expect(open).toMatchObject({ total: null, payments: [], hiddenUntilClose: true });
    expect(JSON.stringify(open)).not.toMatch(/123\.45|"cash"/);
    const old = rows.find((v) => v.sale.number === "QA-1").sale;
    expect(Number(old.total)).toBe(321.45);
    expect(old.payments).toHaveLength(1);
    const owner = await voids(admin);
    expect(
      Number(owner.find((v) => v.sale.number === "QA-2").sale.total),
    ).toBe(123.45);
  });

  it("hideSaleAmounts conserva número, estado y artículos sin importes", () => {
    const hidden = hideSaleAmounts({
      number: "X-1",
      status: "completed",
      subtotal: 1,
      discountTotal: 1,
      taxTotal: 1,
      total: 1,
      creditBalance: 1,
      items: [
        {
          qty: 2,
          returnedQty: 0,
          unitPrice: 1,
          discount: 0,
          tax: 0,
          lineTotal: 2,
          variant: { sku: "S" },
        },
      ],
      payments: [{ method: "cash", amount: 1 }],
      returns: [
        { number: "D-1", total: 1, taxTotal: 0, refundAmount: 1, refundMethod: "cash" },
      ],
    });
    expect(hidden).toMatchObject({
      number: "X-1",
      status: "completed",
      total: null,
      payments: [],
      hiddenUntilClose: true,
    });
    expect(hidden.items[0]).toMatchObject({
      qty: 2,
      lineTotal: null,
      unitPrice: null,
      variant: { sku: "S" },
    });
    expect(hidden.returns[0]).toMatchObject({
      number: "D-1",
      total: null,
      refundAmount: null,
    });
  });

  it("bandera APAGADA: /cod/pending con la forma de siempre", async () => {
    delete process.env[FLAG];
    const rows = (await sales.codPending(cajera, "pending")) as any[];
    const q3 = rows.find((r) => r.number === "QA-3");
    expect(q3).toMatchObject({
      total: 300,
      receivableAmount: 200,
      collected: 50,
      pending: 150,
    });
    expect(q3.collections).toHaveLength(1);
    expect(q3.hiddenUntilClose).toBeUndefined();
  });

  it("bandera ENCENDIDA: /cod/pending no entrega importes de la caja abierta", async () => {
    process.env[FLAG] = "1";
    const rows = (await sales.codPending(cajera, "pending")) as any[];
    const row = (n: string) => rows.find((r) => r.number === n);
    // QA-4 es de la caja vieja, pero tiene un abono a la caja abierta.
    for (const n of ["QA-3", "QA-4"])
      expect(row(n), n).toMatchObject({
        hiddenUntilClose: true,
        total: null,
        codAmount: null,
        receivableAmount: null,
        collected: null,
        pending: null,
        pendingVerification: null,
        collections: [],
      });
    // Una venta de la caja vieja con abono a la vieja sigue visible.
    expect(row("QA-5")).toMatchObject({ total: 500, pending: 450, collected: 50 });
    expect(row("QA-5").hiddenUntilClose).toBeUndefined();
    expect(row("QA-5").collections).toHaveLength(1);
    const owner = (await sales.codPending(admin, "pending")) as any[];
    expect(owner.find((r) => r.number === "QA-3")).toMatchObject({
      total: 300,
      pending: 150,
      collected: 50,
    });
    delete process.env[FLAG];
  });

  it("bandera APAGADA: receipt.pdf con importes, como siempre", async () => {
    delete process.env[FLAG];
    const text = await receiptText(cajera, "QA-2");
    expect(text).toContain("123.45");
    expect(text).toContain("Forma de pago");
    expect(text).not.toContain("cerrar tu caja");
  });

  it("bandera ENCENDIDA: receipt.pdf de la caja abierta sale sin importes; la administradora y la caja cerrada, completos", async () => {
    process.env[FLAG] = "1";
    const blind = await receiptText(cajera, "QA-2");
    expect(blind).toContain("QA-2");
    expect(blind).toContain("cerrar tu caja");
    expect(blind).not.toMatch(/123[.]45|Forma de pago|Subtotal|ITBIS|RD[$]/);
    // Venta sin caja posterior a la apertura: también oculta.
    expect(await receiptText(cajera, "QA-6")).not.toMatch(/77[.]77/);
    expect(await receiptText(cajera, "QA-1")).toContain("321.45");
    expect(await receiptText(admin, "QA-2")).toContain("123.45");
    delete process.env[FLAG];
  });

  it("bandera ENCENDIDA: al cerrar la caja la cajera vuelve a ver los importes", async () => {
    process.env[FLAG] = "1";
    await db.cashSession.update({
      where: { id: OPEN },
      data: { closedAt: new Date() },
    });
    const sale = byNumber(await list(cajera), "QA-2");
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(sale.payments).toHaveLength(1);
    delete process.env[FLAG];
  });
});

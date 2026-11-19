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
import { ReportsController } from "../apps/api/src/reports";
import { REPORTES } from "../apps/api/src/reportes";
import { FormalReportController } from "../apps/api/src/formal-report";
import { permissions } from "../packages/shared/src";

// Auditoría de reportes (19-nov-2026): textos del servidor en español,
// vendedoras por persona y días entre compras. Cada prueba falla con el
// código anterior.
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
let database: any, db: any, dataDir: string, admin: any;
const ids: Record<string, string> = {};

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-reportes-auditoria-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const a = new PrismaClient({ datasources: { db: { url } } });
    await a.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_reportes_auditoria" WITH (FORCE)',
    );
    await a.$executeRawUnsafe('CREATE DATABASE "nexora_reportes_auditoria"');
    await a.$disconnect();
    const target = new URL(url);
    target.pathname = "/nexora_reportes_auditoria";
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
    await database.createDatabase("nexora_reportes_auditoria");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_reportes_auditoria`;
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
    data: { name: "QA admin", permissions: permissions.admin },
  });
  const u = await db.user.create({
    data: {
      name: "Dueña QA",
      email: `qa-${randomUUID()}@example.invalid`,
      passwordHash: "x",
      pinHash: "x",
      roleId: role.id,
    },
  });
  admin = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: "admin",
    permissions: permissions.admin,
    branchId: "main",
  };
  const person = async (name: string) =>
    (
      await db.user.create({
        data: {
          name,
          email: `qa-${randomUUID()}@example.invalid`,
          passwordHash: "x",
          pinHash: "x",
          roleId: role.id,
        },
      })
    ).id as string;
  ids.ana1 = await person("Ana Pérez");
  ids.ana2 = await person("Ana Pérez");
  const c = await db.category.create({ data: { name: "Suplementos" } });
  const p = await db.product.create({
    data: { name: "Proteína QA", sku: "QA-P", categoryId: c.id },
  });
  const variant = await db.variant.create({
    data: {
      productId: p.id,
      sku: "QA-P-V",
      barcode: "QA-P-B",
      costAvg: 0,
      price: 0,
    },
  });
  const customer = await db.customer.create({ data: { name: "Clienta QA" } });
  let n = 0;
  const sale = (sellerId: string, total: number, at: string) =>
    db.sale.create({
      data: {
        number: "QA-" + ++n,
        offlineUuid: randomUUID(),
        sellerId,
        customerId: customer.id,
        subtotal: total,
        discountTotal: 0,
        taxTotal: 0,
        total,
        costTotal: total / 2,
        createdAt: new Date(at),
        items: {
          create: [
            {
              variantId: variant.id,
              qty: 1,
              unitPrice: total,
              unitCost: total / 2,
              discount: 0,
              tax: 0,
              lineTotal: total,
            },
          ],
        },
        payments: {
          create: [{ method: "cash", amount: total, tendered: total }],
        },
      },
    });
  // Dos «Ana Pérez» distintas el 10-nov; la clienta vuelve el 20-nov.
  const first = await sale(ids.ana1, 100, "2026-11-10T15:00:00Z");
  await sale(ids.ana2, 200, "2026-11-10T16:00:00Z");
  await sale(ids.ana1, 50, "2026-11-20T15:00:00Z");
  await db.auditLog.createMany({
    data: [
      {
        userId: ids.ana1,
        action: "void",
        entity: "sale",
        entityId: first.id,
        after: { status: "voided", reason: "Error de cobro" },
        createdAt: new Date("2026-11-10T17:00:00Z"),
      },
      {
        userId: ids.ana1,
        action: "discount_approved",
        entity: "sale",
        entityId: first.id,
        after: {
          actor: { id: ids.ana1, name: "Ana Pérez" },
          authorizer: { id: ids.ana1, name: "Ana Pérez" },
          reason: "Clienta frecuente",
          discount: "10",
        },
        createdAt: new Date("2026-11-10T16:59:00Z"),
      },
    ],
  });
  await db.cashSession.create({
    data: {
      userId: ids.ana1,
      openingAmount: 0,
      openedAt: new Date("2026-11-10T13:00:00Z"),
      closedAt: new Date("2026-11-10T22:00:00Z"),
    },
  });
  await db.inventoryMovement.create({
    data: {
      variantId: variant.id,
      type: "purchase",
      qty: 5,
      unitCost: 10,
      balanceAfter: 5,
      reason: "Entrada QA",
      userId: ids.ana1,
      createdAt: new Date("2026-11-10T12:00:00Z"),
    },
  });
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

const day = { from: "2026-11-10", to: "2026-11-10" };
const reports = () => new ReportsController(db as any);
async function report(name: string, query: Record<string, string> = day) {
  let body: any;
  const res: any = {
    setHeader: () => undefined,
    json: (value: unknown) => (body = value),
  };
  await reports().report(name, query, admin, res);
  return body;
}

describe("Textos del servidor en reportes", () => {
  it("Devoluciones y descuentos: evento, persona, factura y detalle legibles", async () => {
    const { rows } = await report("returns-discounts");
    expect(rows.map((r: any) => [r.Evento, r.Usuario, r.Referencia])).toEqual([
      ["Anulación", "Ana Pérez", "QA-1"],
      ["Descuento aprobado", "Ana Pérez", "QA-1"],
    ]);
    expect(rows[0].Detalle).toBe("Motivo: Error de cobro");
    expect(rows[1].Detalle).toContain("(la misma persona que vendió)");
    for (const r of rows) expect(r.Detalle).not.toMatch(/[{}]/);
  });

  it("Cierres: nombre de quien abrió, no su código", async () => {
    const { rows } = await report("cash");
    expect(rows.map((r: any) => r.Usuario)).toEqual(["Ana Pérez"]);
  });

  it("Kardex y método de pago en español", async () => {
    const kardex = await report("kardex");
    expect(kardex.rows.map((r: any) => r.Tipo)).toEqual(["Entrada"]);
    const payment = await report("by-payment");
    expect(payment.rows.map((r: any) => r.Método)).toEqual(["Efectivo"]);
  });
});

describe("P22: vendedoras con el mismo nombre en el Resumen", () => {
  it("no se suman como una", async () => {
    const s: any = await reports().dashboard(day, admin);
    expect(s.sellers).toEqual([
      { name: "Ana Pérez", total: 200 },
      { name: "Ana Pérez (2)", total: 100 },
    ]);
  });
});

describe("R26: días entre compras", () => {
  it("dos compras el mismo día no bajan el promedio", async () => {
    const range = {
      gte: new Date("2026-11-01T04:00:00Z"),
      lte: new Date("2026-12-01T03:59:59Z"),
    };
    const rows = await REPORTES["frecuencia-de-compra"].run(
      db,
      admin,
      range,
      {},
    );
    // 10-nov (2 compras) y 20-nov: 10 días, no 5.
    expect(rows[0]).toMatchObject({
      Compras: 3,
      "Promedio de días entre compras": 10,
    });
  });
});

describe("R30/R13: rótulos sin cambiar cifras", () => {
  it("el mes del año anterior sin ventas lo dice", async () => {
    const range = {
      gte: new Date("2026-11-01T04:00:00Z"),
      lte: new Date("2026-11-30T23:00:00Z"),
    };
    const rows = await REPORTES["ventas-mes-ano-anterior"].run(
      db,
      admin,
      range,
      {},
    );
    expect(rows[1].Mes).toContain("sin ventas registradas");
    expect(rows[0]["Ventas netas"]).toBe(350);
    expect(REPORTES["utilidad-bruta-por-mes"].title).toContain("con ITBIS");
  });
});

describe("D14: informe formal explica la diferencia con Ingresos por día", () => {
  it("la nota lo dice", async () => {
    let body: any;
    const res: any = {
      setHeader: () => undefined,
      json: (value: unknown) => (body = value),
    };
    await new FormalReportController(db as any).get(
      admin,
      { period: "day", date: day.from },
      res,
    );
    expect(body.note).toContain("Ingresos por día las resta el día");
  });
});

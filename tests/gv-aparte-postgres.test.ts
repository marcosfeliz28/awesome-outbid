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
import { incomeSummary, incomeOptions } from "../apps/api/src/income-report";
import { REPORTES } from "../apps/api/src/reportes";
import { FormalReportController } from "../apps/api/src/formal-report";
import { permissions } from "../packages/shared/src";

// Orden de la dueña (18-nov-2026): GV es otra empresa. Una venta GV no entra en
// los totales de Grupo Macgen (dashboard, desglose del mes, ingresos por día,
// reportes) y sí en su propio total aparte.
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
const day = { from: "2026-11-10", to: "2026-11-10" };

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-gv-aparte-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const a = new PrismaClient({ datasources: { db: { url } } });
    await a.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_gv_aparte" WITH (FORCE)',
    );
    await a.$executeRawUnsafe('CREATE DATABASE "nexora_gv_aparte"');
    await a.$disconnect();
    const target = new URL(url);
    target.pathname = "/nexora_gv_aparte";
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
    await database.createDatabase("nexora_gv_aparte");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_gv_aparte`;
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
  const variantIn = async (category: string, sku: string) => {
    const c = await db.category.create({ data: { name: category } });
    const p = await db.product.create({
      data: { name: category + " QA", sku, categoryId: c.id },
    });
    return (
      await db.variant.create({
        data: {
          productId: p.id,
          sku: sku + "-V",
          barcode: sku + "-B",
          costAvg: 0,
          price: 0,
        },
      })
    ).id as string;
  };
  const macgen = await variantIn("Suplementos", "QA-MAC");
  const gv = await variantIn("GV Servicios", "QA-GV");
  let n = 0;
  const sale = (variantId: string, total: number) =>
    db.sale.create({
      data: {
        number: "QA-" + ++n,
        offlineUuid: randomUUID(),
        sellerId: u.id,
        subtotal: total,
        discountTotal: 0,
        taxTotal: 0,
        total,
        costTotal: total / 2,
        createdAt: new Date("2026-11-10T15:00:00Z"),
        items: {
          create: [
            {
              variantId,
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
  await sale(macgen, 100);
  await sale(gv, 300);
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("GV aparte de Grupo Macgen", () => {
  const reports = () => new ReportsController(db as any);

  it("dashboard: GV no suma en ventas, categorías ni ticket; va en gv", async () => {
    const s: any = await reports().dashboard(day, admin);
    expect(s.revenue).toBe(100);
    expect(s.invoices).toBe(1);
    expect(s.ticketAverage).toBe(100);
    expect(s.category.map((c: any) => c.name)).toEqual(["Suplementos"]);
    expect(s.daily).toEqual([{ day: "2026-11-10", total: 100 }]);
    expect(s.gv).toEqual({ total: 300, count: 1 });
  });

  it("desglose del mes: total y promedios sin GV; GV aparte", async () => {
    const b: any = await reports().dashboardBreakdown(day, admin);
    expect(b.revenue).toBe(100);
    expect(b.invoices).toBe(1);
    expect(b.averageTicket).toBe(100);
    expect(b.categories.map((c: any) => c.name)).toEqual(["Suplementos"]);
    expect(b.gv).toEqual({ total: 300, count: 1 });
  });

  it("ingresos por día: Macgen sin GV y GV por su lado", async () => {
    const opt = incomeOptions(day);
    const [mac] = await incomeSummary(db, admin, opt);
    expect(mac.sold).toBe(100);
    expect(mac.cash).toBe(100);
    const [gv] = await incomeSummary(db, admin, { ...opt, gv: "only" });
    expect(gv.sold).toBe(300);
  });

  it("reportes: ventas sin GV; «por empresa» las muestra separadas", async () => {
    const range = {
      gte: new Date("2026-11-10T04:00:00Z"),
      lte: new Date("2026-11-11T03:59:59Z"),
    };
    const cat = await REPORTES["margen-por-categoria"].run(
      db,
      admin,
      range,
      {},
    );
    expect(cat.map((r) => r["Categoría"])).toEqual(["Suplementos"]);
    const emp = await REPORTES["margen-por-empresa"].run(db, admin, range, {});
    expect(Object.fromEntries(emp.map((r) => [r.Empresa, r.Venta]))).toEqual({
      MacGen: 100,
      "GV Makeup Studio": 300,
    });
  });

  it("reporte formal: totales sin GV, GV aparte y el arqueo sigue viéndolo", async () => {
    let report: any;
    const res: any = {
      setHeader: () => undefined,
      json: (body: unknown) => (report = body),
    };
    await new FormalReportController(db as any).get(
      admin,
      { period: "day", date: day.from },
      res,
    );
    expect(report.totals.sold).toBe(100);
    expect(report.totals.sales).toBe(1);
    expect(report.totals.moneyIn).toBe(100);
    expect(report.categories.map((c: any) => c.name)).toEqual(["Suplementos"]);
    expect(report.gv).toEqual({ total: 300, count: 1 });
    expect(report.cashReconciliation.moneyIn).toBe(400);
  });
});

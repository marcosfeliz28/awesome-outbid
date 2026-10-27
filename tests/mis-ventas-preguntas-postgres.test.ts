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
import { CashierSurveyController } from "../apps/api/src/cashier-survey";
import { CASHIER_SURVEY, permissions } from "../packages/shared/src";

// «Mis ventas de hoy» y encuesta de la caja, con PostgreSQL real: cada quien ve
// lo suyo, sin costos y, con caja propia abierta, sin ningún importe (caja
// ciega); los importes reaparecen al cerrar.
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
let reports: ReportsController, survey: CashierSurveyController;
const actorOf = (u: any, role: string): any => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role,
  permissions: permissions[role],
  branchId: "main",
});
let cajera: any, otra: any, gerente: any, admin: any;

let openId = "";
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-mis-ventas-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const admin = new PrismaClient({ datasources: { db: { url } } });
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_mis_ventas" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_mis_ventas"');
    await admin.$disconnect();
    const target = new URL(url);
    target.pathname = "/nexora_mis_ventas";
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
    await database.createDatabase("nexora_mis_ventas");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_mis_ventas`;
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
  const mk = async (name: string, role: string) => {
    const r = await db.role.upsert({
      where: { name: "QA " + role },
      update: {},
      create: { name: "QA " + role, permissions: permissions[role] },
    });
    const u = await db.user.create({
      data: {
        name,
        email: `qa-${randomUUID()}@example.invalid`,
        passwordHash: "x",
        pinHash: "x",
        roleId: r.id,
      },
    });
    return actorOf(u, role);
  };
  cajera = await mk("Cajera Uno", "seller");
  otra = await mk("Cajera Dos", "seller");
  gerente = await mk("Gerente", "manager");
  admin = await mk("Admin", "admin");
  reports = new ReportsController(db as any);
  survey = new CashierSurveyController(db as any);

  const open = await db.cashSession.create({
    data: { userId: cajera.id, openingAmount: 500 },
  });
  let n = 0;
  const sale = async (
    seller: any,
    total: number,
    method: string,
    opts: { status?: string; session?: string; extra?: any[] } = {},
  ) => {
    const k = randomUUID();
    return (
      await db.sale.create({
        data: {
          number: "QA-" + ++n,
          offlineUuid: k,
          sellerId: seller.id,
          status: opts.status ?? "completed",
          cashSessionId: opts.session ?? null,
          subtotal: total,
          discountTotal: 0,
          taxTotal: 0,
          total,
          costTotal: total / 2,
          payments: {
            create: [
              {
                cashSessionId: opts.session ?? null,
                method,
                amount: total,
                tendered: total,
              },
              ...(opts.extra ?? []),
            ],
          },
        },
      })
    ).id as string;
  };
  const first = await sale(cajera, 100, "cash");
  await sale(cajera, 50, "card", { session: open.id });
  await sale(cajera, 30, "credit");
  await sale(cajera, 999, "cash", { status: "voided" });
  // Una transferencia propia sin verificar y un abono de la dueña por
  // transferencia sobre la misma venta: solo la primera cuenta como pendiente.
  await sale(otra, 500, "cash", {
    extra: [
      {
        method: "transfer",
        amount: 40,
        tendered: 40,
        status: "pending_verification",
        entryType: "sale",
      },
      {
        method: "transfer",
        amount: 60,
        tendered: 60,
        status: "pending_verification",
        entryType: "installment",
      },
    ],
  });
  await db.saleReturn.create({
    data: {
      saleId: first,
      number: "DEV-QA",
      reason: "Prueba",
      total: 20,
      taxTotal: 0,
      costTotal: 10,
      refundAmount: 20,
      refundMethod: "cash",
      userId: cajera.id,
      items: [],
    },
  });
  openId = open.id;
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

const mine = (a: any, p: "today" | "week" = "today") =>
  reports.mine(p, a) as Promise<any>;

describe("mis ventas de hoy", () => {
  it("con caja propia abierta solo hay conteos: ningún importe ni costo", async () => {
    const r = await mine(cajera);
    expect(r).toEqual({
      day: r.day,
      from: r.day,
      invoices: 3,
      units: 0,
      hiddenUntilClose: true,
      topProduct: null,
    });
    expect(JSON.stringify(r)).not.toMatch(
      /cost|margin|profit|expected|total|methods|pending|lastSale|amount/i,
    );
    const week = await mine(cajera, "week");
    expect(week.hiddenUntilClose).toBe(true);
    expect(week.total).toBeUndefined();
    expect(() => reports.mine("mes", cajera)).toThrow(); // ZodError: el filtro HTTP responde 400
  });
  it("otra vendedora no se cruza y su transferencia pendiente excluye el abono", async () => {
    expect(await mine(otra)).toMatchObject({
      invoices: 1,
      total: 500,
      hiddenUntilClose: false,
      pendingTransfers: { count: 1, amount: 40 },
    });
    expect(JSON.stringify(await mine(otra))).not.toMatch(
      /cost|margin|profit|expected/i,
    );
    // Quien ve el arqueo (administración) recibe sus propias ventas: ninguna.
    expect(await mine(admin)).toMatchObject({
      invoices: 0,
      total: 0,
      hiddenUntilClose: false,
    });
    expect(await mine(gerente)).toMatchObject({ invoices: 0, total: 0 });
  });
  it("la ruta exige sale:write: un rol de almacén no entra", () => {
    const perm = (fn: any) => Reflect.getMetadata("permission", fn);
    expect(perm(ReportsController.prototype.mine)).toBe("sale:write");
    expect(permissions.warehouse).not.toContain("sale:write");
  });
  it("al cerrar la caja los importes reaparecen", async () => {
    await db.cashSession.update({
      where: { id: openId },
      data: { closedAt: new Date() },
    });
    expect(await mine(cajera)).toMatchObject({
      invoices: 3,
      total: 160,
      hiddenUntilClose: false,
      methods: { cash: 80, card: 50, transfer: 0, credit: 30 },
    });
  });
});

describe("encuesta de la caja", () => {
  it("una respuesta editable por persona y validada", async () => {
    expect((await survey.mine(cajera)).answers).toBeNull();
    await survey.save(
      {
        answers: {
          cobro_rapido: 4,
          cobro_pasos: false,
          buscar_como: "Lector de código",
          mejorar: "Más rápido",
        },
      },
      cajera,
    );
    await survey.save(
      { answers: { cobro_rapido: 5, mejorar: "Más rápido" } },
      cajera,
    );
    for (const bad of [
      { cobro_rapido: 9 },
      { inventada: true },
      { buscar_como: "Otra" },
    ])
      await expect(survey.save({ answers: bad }, cajera)).rejects.toThrow();
    expect((await survey.mine(cajera)).answers).toEqual({
      cobro_rapido: 5,
      mejorar: "Más rápido",
    });
    await survey.save({ answers: { mejorar: "De la otra" } }, otra);
    expect((await survey.mine(otra)).answers).toEqual({
      mejorar: "De la otra",
    });
    expect(await db.cashierSurvey.count()).toBe(2);
    // Una fila por persona, garantizado por la base.
    await expect(
      db.cashierSurvey.create({ data: { userId: cajera.id, answers: {} } }),
    ).rejects.toThrow();
  });
  it("el resumen es solo de gerencia y administración", async () => {
    const perm = Reflect.getMetadata(
      "permission",
      CashierSurveyController.prototype.summary,
    );
    expect(permissions.seller).not.toContain(perm);
    expect(permissions.manager).toContain(perm);
    expect(permissions.admin).toContain("*");
    for (const fn of ["mine", "save"] as const)
      expect(
        Reflect.getMetadata(
          "permission",
          CashierSurveyController.prototype[fn],
        ),
      ).toBe("sale:write");
    const s = await survey.summary(admin);
    expect(s.responses).toBe(2);
    expect(s.questions).toHaveLength(CASHIER_SURVEY.length);
    expect(s.questions).toHaveLength(30);
    expect(s.questions.find((q) => q.id === "cobro_rapido")).toMatchObject({
      average: 5,
      counts: { "5": 1 },
    });
    expect(s.questions.find((q) => q.id === "mejorar")!.texts).toHaveLength(2);
  });
});

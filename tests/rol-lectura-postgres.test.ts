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
import { AdminController } from "../apps/api/src/admin";
import { CashController } from "../apps/api/src/cash";
import { SalesController, saleHistoryDto } from "../apps/api/src/sales";
import { permissions } from "../packages/shared/src";

// Rol «lectura» (orden 107) con PostgreSQL real: la migración crea el rol, un
// administrador puede crear un usuario con él, ve ventas y cajas de toda la
// sucursal sin costos, y no ve los importes de una caja abierta (caja ciega).
const MIGRATION = "202611010001_rol_lectura";
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

let database: any, db: any, dataDir: string, url: string;
let sales: SalesController, cash: CashController, admin: AdminController;
let lecturaRole: any;
let cajera: any, otra: any, gerente: any, administrador: any, lectora: any;
let openSessionId = "";
let closedSessionId = "";

const actorOf = (u: any, role: string, perms = permissions[role]): any => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role,
  permissions: perms,
  branchId: "main",
});

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-rol-lectura-"));
  url = process.env.NEXORA_TEST_PG_URL ?? "";
  if (url) {
    const admin0 = new PrismaClient({ datasources: { db: { url } } });
    await admin0.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_rol_lectura" WITH (FORCE)',
    );
    await admin0.$executeRawUnsafe('CREATE DATABASE "nexora_rol_lectura"');
    await admin0.$disconnect();
    const target = new URL(url);
    target.pathname = "/nexora_rol_lectura";
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
    await database.createDatabase("nexora_rol_lectura");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_rol_lectura`;
  }
  const env = { ...process.env, DATABASE_URL: url };
  await run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps/api/prisma/schema.prisma"),
    ],
    { cwd: root, env, timeout: 120000 },
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  lecturaRole = await db.role.findUniqueOrThrow({ where: { name: "lectura" } });

  const mk = async (name: string, role: string, roleId?: string) => {
    const r =
      roleId ??
      (
        await db.role.upsert({
          where: { name: "QA " + role },
          update: {},
          create: { name: "QA " + role, permissions: permissions[role] },
        })
      ).id;
    const u = await db.user.create({
      data: {
        name,
        email: `qa-${randomUUID()}@example.invalid`,
        passwordHash: "x",
        pinHash: "x",
        roleId: r,
      },
    });
    return u;
  };
  cajera = actorOf(await mk("Cajera Uno", "seller"), "seller");
  otra = actorOf(await mk("Cajera Dos", "seller"), "seller");
  gerente = actorOf(await mk("Gerente", "manager"), "manager");
  administrador = actorOf(await mk("Admin", "admin"), "admin");
  const lecturaUser = await mk("Lectora", "lectura", lecturaRole.id);
  lectora = actorOf(lecturaUser, "lectura", lecturaRole.permissions);

  sales = new SalesController(db as any);
  cash = new CashController(db as any);
  admin = new AdminController(db as any);

  const open = await db.cashSession.create({
    data: { userId: cajera.id, openingAmount: 500 },
  });
  const closed = await db.cashSession.create({
    data: {
      userId: otra.id,
      openingAmount: 100,
      openedAt: new Date(Date.now() - 3_600_000),
      closedAt: new Date(),
      expectedCash: 170,
      countedCash: 170,
      differenceCash: 0,
      difference: 0,
    },
  });
  let n = 0;
  const sale = async (
    seller: any,
    total: number,
    method: string,
    session: string | null = null,
  ) =>
    (
      await db.sale.create({
        data: {
          number: "RL-" + ++n,
          offlineUuid: randomUUID(),
          sellerId: seller.id,
          status: "completed",
          cashSessionId: session,
          subtotal: total,
          discountTotal: 0,
          taxTotal: 0,
          total,
          costTotal: total / 2,
          payments: {
            create: [
              { cashSessionId: session, method, amount: total, tendered: total },
            ],
          },
        },
      })
    ).id as string;
  await sale(cajera, 111, "cash"); // venta de la caja abierta de la cajera
  await sale(otra, 222, "cash", closed.id); // venta de una caja ya cerrada
  // Venta antigua sin caja (anterior a la apertura): no es de la caja abierta.
  const legacy = await sale(otra, 333, "card");
  await db.sale.update({
    where: { id: legacy },
    data: { createdAt: new Date(Date.now() - 7_200_000) },
  });
  openSessionId = open.id;
  closedSessionId = closed.id;
}, 240_000);

afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("rol lectura · migración", () => {
  const migrationFile = join(
    root,
    "apps/api/prisma/migrations",
    MIGRATION,
    "migration.sql",
  );
  const apply = () =>
    run(
      process.execPath,
      [
        prismaCli,
        "db",
        "execute",
        "--file",
        migrationFile,
        "--schema",
        join(root, "apps/api/prisma/schema.prisma"),
      ],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000 },
    );

  it("crea el rol lectura con exactamente sus cuatro permisos", () => {
    expect([...lecturaRole.permissions].sort()).toEqual(
      ["catalog:read", "reports:read", "sale:read", "cash:read"].sort(),
    );
    expect(lecturaRole.permissions).toEqual(permissions.lectura);
  });

  it("es idempotente y no toca un rol lectura ya configurado", async () => {
    await db.role.update({
      where: { name: "lectura" },
      data: { permissions: ["catalog:read"] },
    });
    await apply();
    await apply();
    const rows = await db.role.findMany({ where: { name: "lectura" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].permissions).toEqual(["catalog:read"]);
    await db.role.update({
      where: { name: "lectura" },
      data: { permissions: permissions.lectura },
    });
  });

});

describe("rol lectura · administrador crea el usuario", () => {
  it("POST usuarios acepta el rol lectura y el usuario queda con sus permisos", async () => {
    const username = "lectura-qa-" + randomUUID().slice(0, 8);
    // Clave de prueba generada en el momento: sólo vive en esta base temporal.
    const password = "Lectura-" + randomUUID().slice(0, 8) + "Qa9!";
    await admin.user(
      {
        name: "Lectura QA",
        username,
        password,
        pin: "482913",
        roleId: lecturaRole.id,
      },
      administrador,
    );
    const created = await db.user.findFirstOrThrow({
      where: { username },
      include: { role: true },
    });
    expect(created.role.name).toBe("lectura");
    expect(created.role.permissions).toEqual(permissions.lectura);
    expect(created.role.permissions).not.toContain("profit:read");
  });
});

describe("rol lectura · ventas y cajas", () => {
  it("GET /sales: ve las ventas de toda la sucursal, pero ninguna de caja abierta", async () => {
    const rows: any[] = (await sales.list(lectora, {} as any)) as any[];
    expect(rows).toHaveLength(3);
    const hidden = rows.filter((r) => r.hiddenUntilClose === true);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({ total: null, subtotal: null });
    expect(
      rows
        .map((r) => r.total)
        .filter((t) => t !== null)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([222, 333]);
  });

  it("GET /sales: el importe de la caja abierta no se ve aunque no sea caja ciega", async () => {
    expect(process.env.NEXORA_VENTAS_CAJA_CIEGA).toBeUndefined();
    const rows: any[] = (await sales.list(lectora, {} as any)) as any[];
    expect(JSON.stringify(rows)).not.toContain('"total":111');
  });

  it("GET /sales: el historial del rol lectura nunca lleva costos", () => {
    const sale = {
      id: "s1",
      total: 10,
      costTotal: 4,
      items: [{ id: "i1", qty: 1, unitPrice: 10, unitCost: 4, lineTotal: 10, variant: null }],
      payments: [],
      returns: [],
      voidRequests: [],
    };
    const lectoraDto: any = saleHistoryDto(sale, lectora);
    expect(JSON.stringify(lectoraDto)).not.toContain("unitCost");
    expect(JSON.stringify(lectoraDto)).not.toContain("costTotal");
    const gerenteDto: any = saleHistoryDto(sale, gerente);
    expect(gerenteDto.items[0].unitCost).toBe(4);
  });

  it("GET /sales: el vendedor sigue viendo sólo lo suyo", async () => {
    const rows: any[] = (await sales.list(cajera, {} as any)) as any[];
    expect(rows.map((r) => Number(r.total))).toEqual([111]);
  });

  it("GET /cash-sessions: el rol lectura ve todas las cajas y la abierta sin importes", async () => {
    const rows: any[] = (await cash.sessions(lectora)) as any[];
    const open = rows.find((s) => s.id === openSessionId);
    const closed = rows.find((s) => s.id === closedSessionId);
    expect(open).toBeDefined();
    expect(closed).toBeDefined();
    expect(open.openingAmount).toBeNull();
    expect(open.hiddenUntilClose).toBe(true);
    expect(open).not.toHaveProperty("expectedCash");
    expect(open).not.toHaveProperty("expected");
    expect(closed).not.toHaveProperty("expected");
    expect(closed).not.toHaveProperty("differences");
  });

  it("GET /cash-sessions: el rol lectura no recibe esperados ni diferencias", async () => {
    const rows: any[] = (await cash.sessions(lectora)) as any[];
    for (const s of rows) {
      expect(s).not.toHaveProperty("expected");
      expect(s).not.toHaveProperty("difference");
      expect(s).not.toHaveProperty("differences");
    }
  });

  it("GET /cash-sessions: la cajera sigue viendo su propia caja con su apertura", async () => {
    const rows: any[] = (await cash.sessions(cajera)) as any[];
    expect(rows.map((s) => s.id)).toEqual([openSessionId]);
    expect(Number(rows[0].openingAmount)).toBe(500);
    expect(rows[0].hiddenUntilClose).toBeUndefined();
  });
});

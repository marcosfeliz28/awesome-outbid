// Producto (25-oct): una empresa nueva nace con los roles de la tienda
// (cajera = seller, gerente = manager, almacén = warehouse); la migración
// 202610280024 los agrega a las empresas existentes sin tocar lo que ya
// tienen. Una cajera con ese rol cierra a ciegas, tiene tope de descuento y
// necesita el PIN de OTRA persona; vende sin elegir cliente («Consumidor
// final»); el conteo con centavos cuadra exacto y
// una venta bajo costo avisa sin bloquearse. Postgres real.
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { permissions } from "../packages/shared/src";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { createTenantWithOwner } from "../apps/api/src/registration";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const { hash } = apiRequire("bcryptjs");
const run = promisify(execFile);
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const migration = join(
  root,
  "apps/api/prisma/migrations/202610280024_product_base_roles_customer/migration.sql",
);
const DB = "nexora_base_roles";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("roles base por empresa, backfill idempotente y la cajera con sus reglas", async () => {
  const external = process.env.NEXORA_TEST_PG_URL;
  const dataDir = external ? null : await mkdtemp(join(tmpdir(), "nexora-roles-"));
  const port = await freePort();
  const postgres = external
    ? null
    : new EmbeddedPostgres({
        databaseDir: dataDir!, user: "roles_test", password: "roles_test_only",
        port, persistent: false, authMethod: "scram-sha-256",
        initdbFlags: ["--encoding=UTF8", "--locale=C"],
        postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
        onLog: () => undefined, onError: () => undefined,
      });
  const saved = Object.fromEntries(
    ["DATABASE_URL", "PRODUCT_TENANCY", "TELEGRAM_BOT_TOKEN", "RESEND_API_KEY", "NEXORA_RETENTION"]
      .map((name) => [name, process.env[name]]),
  );
  let sql: any, app: any, prisma: any, url: string;
  try {
    if (external) {
      const admin = new Client({ connectionString: external });
      await admin.connect();
      await admin.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${DB}"`);
      await admin.end();
      const target = new URL(external);
      target.pathname = "/" + DB;
      url = target.toString();
    } else {
      await postgres!.initialise();
      await postgres!.start();
      await postgres!.createDatabase("roles_qa");
      url = `postgresql://roles_test:roles_test_only@127.0.0.1:${port}/roles_qa`;
    }
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000,
    });
    sql = new Client({ connectionString: url });
    await sql.connect();
    const roleRows = async (tenantId: string) =>
      Object.fromEntries(
        (await sql.query(`SELECT name, permissions FROM "Role" WHERE "tenantId"=$1 ORDER BY name`, [tenantId]))
          .rows.map((r: any) => [r.name, r.permissions]),
      );

    // Backfill: una empresa vieja con sólo admin y una cajera a su manera.
    const old = randomUUID();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'vieja','Vieja',now())`, [old]);
    await sql.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES (gen_random_uuid(),$1,'admin',ARRAY['*'],now()), (gen_random_uuid(),$1,'seller',ARRAY['catalog:read'],now())`, [old]);
    await sql.query(`INSERT INTO "Customer" (id,"tenantId",name,"updatedAt") VALUES (gen_random_uuid(),$1,'CONSUMIDOR FINAL',now())`, [old]);
    const backfill = await readFile(migration, "utf8");
    await sql.query(backfill);
    await sql.query(backfill); // idempotente
    const oldRoles = await roleRows(old);
    expect(Object.keys(oldRoles)).toEqual(["admin", "manager", "seller", "warehouse"]);
    expect(oldRoles.seller).toEqual(["catalog:read"]); // no se pisa
    expect(oldRoles.manager).toEqual(permissions.manager);
    expect(oldRoles.warehouse).toEqual(permissions.warehouse);
    expect((await sql.query(`SELECT count(*)::int AS n FROM "Customer" WHERE "tenantId"=$1`, [old])).rows[0].n).toBe(1);

    // Empresa nueva: el alta crea los roles con los permisos de la tienda.
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const ownerPin = "869253", managerPin = "271828", cashierPin = "314159";
    const tenant = await prisma.$transaction((tx: any) => createTenantWithOwner(tx, {
      slug: "nueva", name: "Nueva", businessType: "retail", plan: "pro", status: "active",
    }, {
      name: "Dueña Nueva", email: "owner@example.invalid", passwordHash: "x", pinHash: "x",
      verificationHash: "x", verificationExpiresAt: new Date(Date.now() + 86400000),
    }));
    const roles = await roleRows(tenant.id);
    expect(roles).toEqual({ admin: ["*"], manager: permissions.manager, seller: permissions.seller, warehouse: permissions.warehouse });
    await sql.query(`UPDATE "User" SET "pinHash"=$1, "emailVerifiedAt"=now() WHERE "tenantId"=$2`, [await hash(ownerPin, 4), tenant.id]);
    const roleId = async (name: string) =>
      (await sql.query(`SELECT id FROM "Role" WHERE "tenantId"=$1 AND name=$2`, [tenant.id, name])).rows[0].id;
    type Seat = { userId: string; sessionId: string; cash?: string };
    const seat = async (userId: string): Promise<Seat> => {
      const terminalId = randomUUID(), sessionId = randomUUID();
      await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`, [terminalId, "Caja " + userId.slice(0, 4), tenant.id]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [sessionId, userId, terminalId, tenant.id]);
      return { userId, sessionId };
    };
    const user = async (name: string, role: string, pin: string) => {
      const id = randomUUID();
      await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test',$4,$5,now(),$6)`,
        [id, name, name.replace(/\W/g, "") + "@example.invalid", await hash(pin, 4), await roleId(role), tenant.id]);
      return seat(id);
    };
    const owner = await seat((await sql.query(`SELECT id FROM "User" WHERE "tenantId"=$1`, [tenant.id])).rows[0].id);
    const manager = await user("Gerente Uno", "manager", managerPin);
    const cashier = await user("Cajera Uno", "seller", cashierPin);
    const [categoryId, productId, variantId] = [randomUUID(), randomUUID(), randomUUID()];
    await sql.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'QA',now(),$2)`, [categoryId, tenant.id]);
    await sql.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Artículo','P-1',$2,now(),$3)`, [productId, categoryId, tenant.id]);
    await sql.query(`INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,'V-1','B-1',10,20.10,1000,now(),$3)`, [variantId, productId, tenant.id]);

    const customerId = (await sql.query(`SELECT id FROM "Customer" WHERE "tenantId"=$1 AND name='Consumidor final'`, [tenant.id])).rows[0].id;
    const secret = "clave-local-aislada-solo-pruebas-roles-base";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const auth = (s: Seat) => "Bearer " + jwt.sign({ sub: s.userId, sid: s.sessionId, type: "access", version: 0, tenantId: tenant.id });

    const listed = await http.get("/api/roles").set("Authorization", auth(owner));
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.map((r: any) => r.name).sort()).toEqual(["admin", "manager", "seller", "warehouse"]);

    for (const s of [cashier, manager]) {
      const open = await http.post("/api/cash-sessions/open").set("Authorization", auth(s)).send({ openingAmount: 0 });
      expect(open.status, JSON.stringify(open.body)).toBe(201);
      s.cash = open.body.id;
    }
    // Cierre ciego: la cajera no ve el cuadre antes de cerrar.
    const blind = await http.get(`/api/cash-sessions/${cashier.cash}/cuadre`).set("Authorization", auth(cashier));
    expect(blind.status).toBe(400);

    const sell = (s: Seat, extra: Record<string, unknown> = {}, discountPercent = 0, cash?: number) =>
      http.post("/api/sales").set("Authorization", auth(s)).send({
        offlineUuid: randomUUID(), cashSessionId: s.cash, customerId,
        items: [{ variantId, qty: 1, discountPercent }],
        payments: [{ method: "cash", amount: cash ?? 20.1 }], ...extra,
      });
    // Sin elegir cliente («Pedir cliente» apagado): la venta es de «Consumidor final».
    const plain = await sell(cashier, { customerId: undefined });
    expect(plain.status, JSON.stringify(plain.body)).toBe(201);
    expect(plain.body.customerId).toBe(customerId);
    expect(plain.body.belowCost).toBeUndefined();
    // Tope de descuento: 60 % (> 10 %) pide PIN; el de la propia cajera no sirve.
    const reason = { discountReason: "Producto con caja dañada" };
    expect((await sell(cashier, reason, 60, 8.04)).body.message).toMatch(/PIN de un gerente/);
    expect((await sell(cashier, { ...reason, managerPin: cashierPin }, 60, 8.04)).status).toBeGreaterThanOrEqual(400);
    const below = await sell(cashier, { ...reason, managerPin }, 60, 8.04);
    expect(below.status, JSON.stringify(below.body)).toBe(201);
    // Bajo costo (8.04 < 10): avisa sin bloquear y sin revelar el costo.
    expect(below.body.belowCost).toBe(true);
    expect(below.body.costTotal).toBeUndefined();
    // Un gerente tampoco se aprueba a sí mismo; con el PIN de la dueña, sí.
    expect((await sell(manager, { ...reason, managerPin }, 60, 8.04)).body.message).toMatch(/otra persona con permiso/);
    expect((await sell(manager, { ...reason, managerPin: ownerPin }, 60, 8.04)).status).toBe(201);

    // Centavos: 20.10 + 8.04 = 28.14 se cuenta exacto (20 + 5 + 3×1 + 0.14).
    const close = await http.post(`/api/cash-sessions/${cashier.cash}/close`).set("Authorization", auth(cashier)).send({
      denominations: { "20": 1, "5": 1, "1": 3 }, centavos: 0.14, countedCard: 0, countedTransfer: 0,
    });
    expect(close.status, JSON.stringify(close.body)).toBe(201);
    const closed = (await sql.query(`SELECT "countedCash"::text, "differenceCash"::text FROM "CashSession" WHERE id=$1`, [cashier.cash])).rows[0];
    expect(Number(closed.countedCash)).toBe(28.14);
    expect(Number(closed.differenceCash)).toBe(0);
    const cuadre = await http.get(`/api/cash-sessions/${cashier.cash}/cuadre`).set("Authorization", auth(cashier));
    expect(cuadre.body).toMatchObject({ centavos: 0.14, denominationsSubtotal: 28.14 });
  } finally {
    await app?.close().catch(() => undefined);
    await prisma?.$disconnect().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    if (external) {
      const admin = new Client({ connectionString: external });
      await admin.connect();
      await admin.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
      await admin.end();
    }
    await postgres?.stop().catch(() => undefined);
    if (dataDir) await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180_000);

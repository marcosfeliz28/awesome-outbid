import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const prismaCli = createRequire(join(root, "apps/api/package.json")).resolve("prisma/build/index.js");
const run = promisify(execFile);
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenants = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto disponible");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("descuento, retiros, cuentas por cobrar y ajustes de incentivos no cruzan empresas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-money-final-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir, user: "money_final_qa", password: "money_final_qa_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const saved = Object.fromEntries(
    ["DATABASE_URL", "PRODUCT_TENANCY", "TELEGRAM_BOT_TOKEN", "RESEND_API_KEY", "NEXORA_RETENTION"].map(
      (name) => [name, process.env[name]],
    ),
  );
  let sql: any;
  let app: any;
  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("money_final_qa");
    const url = `postgresql://money_final_qa:money_final_qa_only@127.0.0.1:${port}/money_final_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000,
    });
    sql = postgres.getPgClient("money_final_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-final-b','Empresa B',now())`, [tenants[1]]);
    const cases = tenants.map((tenantId, i) => ({
      tenantId, roleId: id(300 + i), userId: id(310 + i), terminalId: id(320 + i),
      sessionId: id(330 + i), categoryId: id(340 + i), productId: id(350 + i),
      variantId: id(360 + i), customerId: id(370 + i),
    }));
    for (const [i, row] of cases.entries()) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test','test',$4,now(),$5)`, [row.userId, `Admin ${i}`, `final-${i}@example.invalid`, row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`, [row.terminalId, `Terminal ${i}`, row.tenantId]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [row.sessionId, row.userId, row.terminalId, row.tenantId]);
      await sql.query(`INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`, [row.customerId, `Cliente ${i}`, row.tenantId]);
      await sql.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Categoría final',now(),$2)`, [row.categoryId, row.tenantId]);
      await sql.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,$2,'PRODUCTO-FINAL',$3,now(),$4)`, [row.productId, `Artículo ${i}`, row.categoryId, row.tenantId]);
      await sql.query(`INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,'VARIANT-FINAL','BAR-FINAL',10,20,20,now(),$3)`, [row.variantId, row.productId, row.tenantId]);
      await sql.query(`INSERT INTO "Settings" ("tenantId",id,data,"updatedAt") VALUES ($1,'main',$2::jsonb,now())`, [row.tenantId, JSON.stringify({ allowCreditSales: true })]);
    }
    const [a, b] = cases;
    const sellerB2 = id(380);
    await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,'Vendedora B','seller-b@example.invalid','test','test',$2,now(),$3)`, [sellerB2, b.roleId, b.tenantId]);

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-final-solo-pruebas-monetarias";
    const apiRequire = createRequire(join(root, "apps/api/package.json"));
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const send = (request: any, row = b) => request.set("Authorization", "Bearer " + jwt.sign({
      sub: row.userId, sid: row.sessionId, type: "access", version: 0, tenantId: row.tenantId,
    }));
    const denied = (response: any) => {
      const hiddenSale = response.status === 400 && response.body?.message === "Venta no encontrada.";
      expect([403, 404].includes(response.status) || hiddenSale, JSON.stringify(response.body)).toBe(true);
    };

    const openA = await send(http.post("/api/cash-sessions/open").send({ openingAmount: 50 }), a);
    const openB = await send(http.post("/api/cash-sessions/open").send({ openingAmount: 50 }));
    expect(openA.status, JSON.stringify(openA.body)).toBe(201);
    expect(openB.status, JSON.stringify(openB.body)).toBe(201);
    const saleBody = (row: typeof a, cashSessionId: string, serial: number, method: "cash" | "credit") => ({
      offlineUuid: id(serial), customerId: row.customerId, cashSessionId,
      items: [{ variantId: row.variantId, qty: 1, discountPercent: method === "cash" ? 10 : 0 }],
      discountReason: method === "cash" ? "Oferta de prueba" : undefined,
      creditDueDate: method === "credit" ? new Date(Date.now() + 30 * 86400000).toISOString() : undefined,
      payments: [{ method, amount: method === "cash" ? 18 : 20 }],
    });
    // El descuento se descuenta en la caja, no reescribe el precio de la variante.
    const saleA = await send(http.post("/api/sales").send(saleBody(a, openA.body.id, 400, "cash")), a);
    const saleB = await send(http.post("/api/sales").send(saleBody(b, openB.body.id, 401, "cash")));
    const creditA = await send(http.post("/api/sales").send(saleBody(a, openA.body.id, 402, "credit")), a);
    const creditB = await send(http.post("/api/sales").send(saleBody(b, openB.body.id, 403, "credit")));
    for (const result of [saleA, saleB, creditA, creditB]) expect(result.status, JSON.stringify(result.body)).toBe(201);
    const prices = await sql.query(`SELECT "tenantId",price FROM "Variant" ORDER BY "tenantId"`);
    expect(prices.rows.map((r: any) => Number(r.price))).toEqual([20, 20]);
    const sold = await sql.query(`SELECT "tenantId",total FROM "Sale" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [saleA.body.id, saleB.body.id]);
    expect(sold.rows.map((r: any) => Number(r.total))).toEqual([18, 18]);

    const out = { operationId: id(410), type: "out", amount: 5, reason: "Retiro de prueba" };
    denied(await send(http.post(`/api/cash-sessions/${openA.body.id}/movements`).send(out)));
    const ownOut = await send(http.post(`/api/cash-sessions/${openB.body.id}/movements`).send(out));
    expect(ownOut.status, JSON.stringify(ownOut.body)).toBe(201);
    expect((await sql.query(`SELECT "tenantId",type,amount FROM "CashMovement" WHERE "operationId"=$1`, [out.operationId])).rows.map((r: any) => [r.tenantId, r.type, Number(r.amount)])).toEqual([[b.tenantId, "out", 5]]);

    const collection = { operationId: id(411), lines: [{ method: "transfer", amount: 5, bank: "Banco QA", ownerConfirmed: true }] };
    denied(await send(http.post(`/api/credit-accounts/${a.customerId}/collections`).send(collection)));
    const ownCollection = await send(http.post(`/api/credit-accounts/${b.customerId}/collections`).send(collection));
    expect(ownCollection.status, JSON.stringify(ownCollection.body)).toBe(201);
    const balances = await sql.query(`SELECT "tenantId","creditBalance" FROM "Sale" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [creditA.body.id, creditB.body.id]);
    expect(balances.rows.map((r: any) => Number(r.creditBalance))).toEqual([20, 15]);

    const wholesaleBody = { wholesale: true, reason: "Mayoreo de prueba" };
    denied(await send(http.post(`/api/sales/${saleA.body.id}/mark-wholesale`).send(wholesaleBody)));
    const ownWholesale = await send(http.post(`/api/sales/${saleB.body.id}/mark-wholesale`).send(wholesaleBody));
    expect(ownWholesale.status, JSON.stringify(ownWholesale.body)).toBe(201);
    const sellers = { sellerId: sellerB2, reason: "Corrección de vendedora" };
    denied(await send(http.post(`/api/sales/${saleA.body.id}/seller`).send(sellers)));
    const foreignSeller = await send(http.post(`/api/sales/${saleB.body.id}/seller`).send({ ...sellers, sellerId: a.userId }));
    expect(foreignSeller.status, JSON.stringify(foreignSeller.body)).toBe(400);
    expect(foreignSeller.body.message).toBe("Elige una vendedora activa de esta sucursal.");
    const ownSeller = await send(http.post(`/api/sales/${saleB.body.id}/seller`).send(sellers));
    expect(ownSeller.status, JSON.stringify(ownSeller.body)).toBe(201);
    const changed = await sql.query(`SELECT "tenantId","sellerId",wholesale FROM "Sale" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [saleA.body.id, saleB.body.id]);
    expect(changed.rows).toEqual([
      { tenantId: a.tenantId, sellerId: a.userId, wholesale: false },
      { tenantId: b.tenantId, sellerId: sellerB2, wholesale: true },
    ]);
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await postgres.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}, 180_000);

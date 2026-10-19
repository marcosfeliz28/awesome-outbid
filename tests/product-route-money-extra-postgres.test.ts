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

// Las peticiones propias usan exactamente el mismo cuerpo que las ajenas,
// cambiando únicamente IDs/UUID. Así un 400 de validación no puede pasar por aislamiento.
it("devoluciones, transferencias, caja, sync e incentivos quedan dentro de su empresa", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-money-extra-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "money_extra_qa",
    password: "money_extra_qa_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
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
    await postgres.createDatabase("money_extra_qa");
    const url = `postgresql://money_extra_qa:money_extra_qa_only@127.0.0.1:${port}/money_extra_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000,
    });
    sql = postgres.getPgClient("money_extra_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-extra-b','Empresa B',now())`, [tenants[1]]);
    const cases = tenants.map((tenantId, i) => ({
      tenantId, roleId: id(100 + i), userId: id(110 + i), terminalId: id(120 + i),
      authSessionId: id(130 + i), categoryId: id(140 + i), productId: id(150 + i),
      variantId: id(160 + i), customerId: id(170 + i),
    }));
    for (const [i, row] of cases.entries()) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test','test',$4,now(),$5)`, [row.userId, `Admin ${i}`, `extra-${i}@example.invalid`, row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`, [row.terminalId, `Terminal ${i}`, row.tenantId]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [row.authSessionId, row.userId, row.terminalId, row.tenantId]);
      await sql.query(`INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`, [row.customerId, `Cliente ${i}`, row.tenantId]);
      await sql.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Accesorios extra',now(),$2)`, [row.categoryId, row.tenantId]);
      await sql.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,$2,'PRODUCTO-EXTRA',$3,now(),$4)`, [row.productId, `Artículo ${i}`, row.categoryId, row.tenantId]);
      await sql.query(`INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,'VARIANT-EXTRA','BAR-EXTRA',10,20,20,now(),$3)`, [row.variantId, row.productId, row.tenantId]);
    }
    const [a, b] = cases;
    const terminalB2 = id(180);
    const sessionB2 = id(181);
    await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,'Terminal B2','main',now(),'test',$2)`, [terminalB2, b.tenantId]);
    await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [sessionB2, b.userId, terminalB2, b.tenantId]);

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-extra-solo-pruebas-monetarias";
    const apiRequire = createRequire(join(root, "apps/api/package.json"));
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const token = (row: typeof a, sid = row.authSessionId) =>
      "Bearer " + jwt.sign({ sub: row.userId, sid, type: "access", version: 0, tenantId: row.tenantId });
    const send = (request: any, row = b, sid?: string) => request.set("Authorization", token(row, sid));
    const denied = (response: any) => expect([403, 404]).toContain(response.status);

    const openA = await send(http.post("/api/cash-sessions/open").send({ openingAmount: 50 }), a);
    const openB = await send(http.post("/api/cash-sessions/open").send({ openingAmount: 50 }));
    expect(openA.status, JSON.stringify(openA.body)).toBe(201);
    expect(openB.status, JSON.stringify(openB.body)).toBe(201);
    const saleBody = (row: typeof a, cashSessionId: string, serial: number, method: "cash" | "transfer") => ({
      offlineUuid: id(serial), customerId: row.customerId, cashSessionId,
      items: [{ variantId: row.variantId, qty: 1 }],
      payments: [{ method, amount: 20, ...(method === "transfer" ? { bank: "Banco QA", reference: "REF-QA" } : {}) }],
    });
    const cashA = await send(http.post("/api/sales").send(saleBody(a, openA.body.id, 200, "cash")), a);
    const cashB = await send(http.post("/api/sales").send(saleBody(b, openB.body.id, 201, "cash")));
    const transferA = await send(http.post("/api/sales").send(saleBody(a, openA.body.id, 202, "transfer")), a);
    const transferB = await send(http.post("/api/sales").send(saleBody(b, openB.body.id, 203, "transfer")));
    for (const result of [cashA, cashB, transferA, transferB]) expect(result.status, JSON.stringify(result.body)).toBe(201);
    const itemA = (await sql.query(`SELECT id FROM "SaleItem" WHERE "saleId"=$1`, [cashA.body.id])).rows[0].id;
    const itemB = (await sql.query(`SELECT id FROM "SaleItem" WHERE "saleId"=$1`, [cashB.body.id])).rows[0].id;
    const paymentA = (await sql.query(`SELECT id FROM "Payment" WHERE "saleId"=$1`, [transferA.body.id])).rows[0].id;
    const paymentB = (await sql.query(`SELECT id FROM "Payment" WHERE "saleId"=$1`, [transferB.body.id])).rows[0].id;

    const returnBody = (saleId: string, saleItemId: string, operationId: string) => ({
      operationId, saleId, cashSessionId: openB.body.id, reason: "Devolución de prueba",
      refundMethod: "credit_note", items: [{ saleItemId, qty: 1, restock: true }],
    });
    const foreignReturn = await send(http.post("/api/returns").send(returnBody(cashA.body.id, itemA, id(210))));
    denied(foreignReturn);
    const ownReturn = await send(http.post("/api/returns").send(returnBody(cashB.body.id, itemB, id(211))));
    expect(ownReturn.status, JSON.stringify(ownReturn.body)).toBe(201);
    expect((await sql.query(`SELECT count(*)::int AS n FROM "SaleReturn" WHERE "saleId"=$1`, [cashA.body.id])).rows[0].n).toBe(0);

    const correction = { bank: "Banco actualizado", reference: "REF-ACTUALIZADA", expectedBank: "Banco QA", expectedReference: "REF-QA", reason: "Corrección de prueba" };
    const foreignCorrection = await send(http.post(`/api/payments/${paymentA}/correct-transfer`).send(correction));
    denied(foreignCorrection);
    const ownCorrection = await send(http.post(`/api/payments/${paymentB}/correct-transfer`).send(correction));
    expect(ownCorrection.status, JSON.stringify(ownCorrection.body)).toBe(201);
    const foreignReject = await send(http.post(`/api/payments/${paymentA}/reject`).send({ reason: "Transferencia no recibida" }));
    denied(foreignReject);
    const ownReject = await send(http.post(`/api/payments/${paymentB}/reject`).send({ reason: "Transferencia no recibida" }));
    expect(ownReject.status, JSON.stringify(ownReject.body)).toBe(201);
    const transferState = await sql.query(`SELECT id,bank,reference,status FROM "Payment" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [paymentA, paymentB]);
    expect(transferState.rows.map((r: any) => [r.bank, r.reference, r.status])).toEqual([
      ["Banco QA", "REF-QA", "pending_verification"],
      ["Banco actualizado", "REF-ACTUALIZADA", "rejected"],
    ]);

    const foreignCashTransfer = await send(http.post(`/api/cash-sessions/${openA.body.id}/transfer`).send({}), b, sessionB2);
    denied(foreignCashTransfer);
    const ownCashTransfer = await send(http.post(`/api/cash-sessions/${openB.body.id}/transfer`).send({}), b, sessionB2);
    expect(ownCashTransfer.status, JSON.stringify(ownCashTransfer.body)).toBe(201);
    const cashStates = await sql.query(`SELECT id,"registerId" FROM "CashSession" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [openA.body.id, openB.body.id]);
    expect(cashStates.rows.map((r: any) => r.registerId)).toEqual([a.terminalId, terminalB2]);

    await sql.query(`INSERT INTO "Settings" ("tenantId",id,data,"updatedAt") VALUES ($1,'main',$2::jsonb,now())`, [b.tenantId, JSON.stringify({ allowOfflineSales: true })]);
    const foreignSyncBody = saleBody(b, openB.body.id, 220, "cash");
    foreignSyncBody.items[0].variantId = a.variantId;
    const foreignSync = await send(http.post("/api/sales/sync").send({ sales: [foreignSyncBody] }), b, sessionB2);
    expect(foreignSync.status, JSON.stringify(foreignSync.body)).toBe(201);
    expect(foreignSync.body.results?.[0]?.status ?? foreignSync.body[0]?.status).toBe("conflict");
    const ownSync = await send(http.post("/api/sales/sync").send({ sales: [saleBody(b, openB.body.id, 221, "cash")] }), b, sessionB2);
    expect(ownSync.status, JSON.stringify(ownSync.body)).toBe(201);
    expect(ownSync.body.results?.[0]?.status ?? ownSync.body[0]?.status, JSON.stringify(ownSync.body)).toBe("synced");
    expect((await sql.query(`SELECT count(*)::int AS n FROM "Sale" WHERE "offlineUuid"=$1`, [id(220)])).rows[0].n).toBe(0);

    const foreignRate = await send(http.put("/api/incentives/rates").send({ rates: [{ categoryId: a.categoryId, amount: 7 }] }));
    expect(foreignRate.status, JSON.stringify(foreignRate.body)).toBe(400);
    expect(foreignRate.body.message).toBe("Una de las categorías ya no existe.");
    const ownRate = await send(http.put("/api/incentives/rates").send({ rates: [{ categoryId: b.categoryId, amount: 7 }] }));
    expect(ownRate.status, JSON.stringify(ownRate.body)).toBe(200);
    expect((await sql.query(`SELECT "tenantId",amount FROM "IncentiveRate"`)).rows.map((r: any) => [r.tenantId, Number(r.amount)])).toEqual([[b.tenantId, 7]]);
    const month = new Date();
    month.setUTCMonth(month.getUTCMonth() - 2);
    const period = month.toISOString().slice(0, 7);
    const ownClose = await send(http.post("/api/incentives/close").send({ month: period }));
    expect(ownClose.status, JSON.stringify(ownClose.body)).toBe(201);
    expect((await sql.query(`SELECT "tenantId",period FROM "IncentivePeriodClose"`)).rows).toEqual([{ tenantId: b.tenantId, period }]);
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

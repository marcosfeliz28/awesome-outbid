import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const prismaCli = createRequire(join(root, "apps/api/package.json")).resolve(
  "prisma/build/index.js",
);
const run = promisify(execFile);
const tenantA = "00000000-0000-0000-0000-000000000001";
const tenantB = "00000000-0000-0000-0000-000000000002";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

// No basta un 400 por Zod: todos los cuerpos son válidos. Para cada recurso
// ajeno se compara con el mismo cuerpo sobre un recurso propio que SÍ opera.
it("las rutas de caja, cobro y mensajero no mutan dinero de otra empresa", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-money-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "money_test",
    password: "money_test_only",
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
    await postgres.createDatabase("money_qa");
    const url = `postgresql://money_test:money_test_only@127.0.0.1:${port}/money_qa`;
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 },
    );
    sql = postgres.getPgClient("money_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(
      `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`,
      [tenantB],
    );
    const cases = [tenantA, tenantB].map((tenantId, i) => ({
      tenantId,
      roleId: `10000000-0000-4000-8000-00000000001${i}`,
      userId: `10000000-0000-4000-8000-00000000002${i}`,
      terminalId: `10000000-0000-4000-8000-00000000003${i}`,
      sessionId: `10000000-0000-4000-8000-00000000004${i}`,
      saleId: `10000000-0000-4000-8000-00000000005${i}`,
      paymentId: `10000000-0000-4000-8000-00000000006${i}`,
      transferId: `10000000-0000-4000-8000-00000000007${i}`,
      customerId: `10000000-0000-4000-8000-00000000008${i}`,
      categoryId: `10000000-0000-4000-8000-00000000009${i}`,
      productId: `10000000-0000-4000-8000-00000000010${i}`,
      variantId: `10000000-0000-4000-8000-00000000011${i}`,
    }));
    for (const [i, row] of cases.entries()) {
      await sql.query(
        `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
        [row.roleId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test','test',$4,now(),$5)`,
        [row.userId, `Admin ${i}`, `admin-${i}@example.invalid`, row.roleId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`,
        [row.terminalId, `Terminal ${i}`, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
        [row.sessionId, row.userId, row.terminalId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Sale" (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","creditBalance","courierFee","updatedAt","tenantId") VALUES ($1,$2,$3,$4,100,0,0,100,0,100,10,now(),$5)`,
        [row.saleId, `FS-QA-${i}`, `20000000-0000-4000-8000-00000000000${i}`, row.userId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Payment" (id,"saleId",method,amount,tendered,"tenantId") VALUES ($1,$2,'credit',100,100,$3)`,
        [row.paymentId, row.saleId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Payment" (id,"saleId",method,amount,tendered,status,"tenantId") VALUES ($1,$2,'transfer',10,10,'pending_verification',$3)`,
        [row.transferId, row.saleId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`,
        [row.customerId, `Cliente ${i}`, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Accesorios QA',now(),$2)`,
        [row.categoryId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,$2,'PRODUCTO-QA',$3,now(),$4)`,
        [row.productId, `Artículo ${i}`, row.categoryId, row.tenantId],
      );
      await sql.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,'VARIANT-QA','BAR-QA',10,20,3,now(),$3)`,
        [row.variantId, row.productId, row.tenantId],
      );
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-aislada-solo-pruebas-monetarias";
    const apiRequire = createRequire(join(root, "apps/api/package.json"));
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const auth = (row: (typeof cases)[number]) =>
      "Bearer " + jwt.sign({ sub: row.userId, sid: row.sessionId, type: "access", version: 0, tenantId: row.tenantId });
    const [a, b] = cases;
    const send = (request: any, row = b) => request.set("Authorization", auth(row));
    const foreignFailures: string[] = [];
    const hiddenResourceMessages: Record<string, string> = {
      "PATCH sales/:id/courier": "Venta no encontrada.",
      "POST courier/payouts": "Una factura no tiene un envío pendiente en esta sucursal.",
      "POST cash-sessions/drawer-open": "La referencia de caja no existe, no pertenece a esta sucursal o no permite abrir la gaveta.",
    };
    const expectForeignDenied = (route: string, response: any) => {
      const hidden = response.status === 400 &&
        response.body?.message === hiddenResourceMessages[route];
      if (![403, 404].includes(response.status) && !hidden)
        foreignFailures.push(`${route}: HTTP ${response.status} ${JSON.stringify(response.body)}`);
    };

    // Dos aperturas auténticas, una por empresa, son permitidas.
    const openA = await send(http.post("/api/cash-sessions/open").send({ openingAmount: 50 }), a);
    const openB = await send(http.post("/api/cash-sessions/open").send({ openingAmount: 60 }));
    expect(openA.status, JSON.stringify(openA.body)).toBe(201);
    expect(openB.status, JSON.stringify(openB.body)).toBe(201);
    expect(openA.body.id).not.toBe(openB.body.id);

    const saleBody = {
      offlineUuid: "30000000-0000-4000-8000-000000000010",
      customerId: b.customerId,
      cashSessionId: openB.body.id,
      items: [{ variantId: a.variantId, qty: 1 }],
      payments: [{ method: "cash", amount: 20 }],
    };
    const foreignSale = await send(http.post("/api/sales").send(saleBody));
    expectForeignDenied("POST sales", foreignSale);
    const ownSale = await send(http.post("/api/sales").send({
      ...saleBody,
      offlineUuid: "30000000-0000-4000-8000-000000000011",
      items: [{ variantId: b.variantId, qty: 1 }],
    }));
    expect(ownSale.status, JSON.stringify(ownSale.body)).toBe(201);
    expect((await sql.query(`SELECT "tenantId" FROM "Sale" WHERE id=$1`, [ownSale.body.id])).rows)
      .toEqual([{ tenantId: tenantB }]);

    const foreignDrawer = await send(
      http.post("/api/cash-sessions/drawer-open").send({
        mode: "automatic",
        operationId: "30000000-0000-4000-8000-000000000012",
        reason: "Cobro en efectivo de la venta",
        saleId: ownSale.body.id,
      }),
      a,
    );
    expectForeignDenied("POST cash-sessions/drawer-open", foreignDrawer);
    const ownDrawer = await send(
      http.post("/api/cash-sessions/drawer-open").send({
        mode: "automatic",
        operationId: "30000000-0000-4000-8000-000000000013",
        reason: "Cobro en efectivo de la venta",
        saleId: ownSale.body.id,
      }),
    );
    expect(ownDrawer.status, JSON.stringify(ownDrawer.body)).toBe(201);
    expect(
      (
        await sql.query(
          `SELECT action,"entityId","tenantId" FROM "AuditLog" WHERE action='cash_drawer_open'`,
        )
      ).rows,
    ).toEqual([{
      action: "cash_drawer_open",
      entityId: `automatic:${ownSale.body.id}`,
      tenantId: tenantB,
    }]);

    const voidBody = { reason: "Anulación de prueba válida" };
    const foreignVoid = await send(http.post(`/api/sales/${a.saleId}/void`).send(voidBody));
    expectForeignDenied("POST sales/:id/void", foreignVoid);
    const ownVoid = await send(http.post(`/api/sales/${ownSale.body.id}/void`).send(voidBody));
    expect(ownVoid.status, JSON.stringify(ownVoid.body)).toBe(201);
    expect((await sql.query(`SELECT status FROM "Sale" WHERE id=$1`, [a.saleId])).rows)
      .toEqual([{ status: "completed" }]);

    const movement = { operationId: "30000000-0000-4000-8000-000000000001", type: "in", amount: 5, reason: "Cambio de prueba" };
    const foreignMovement = await send(http.post(`/api/cash-sessions/${openA.body.id}/movements`).send(movement));
    expectForeignDenied("POST cash-sessions/:id/movements", foreignMovement);
    const ownMovement = await send(http.post(`/api/cash-sessions/${openB.body.id}/movements`).send(movement));
    expect(ownMovement.status, JSON.stringify(ownMovement.body)).toBe(201);
    expect((await sql.query(`SELECT "tenantId" FROM "CashMovement" WHERE "operationId"=$1`, [movement.operationId])).rows).toEqual([{ tenantId: tenantB }]);

    const fee = { fee: 12, reason: "Ajuste de prueba válido" };
    const foreignFee = await send(http.patch(`/api/sales/${a.saleId}/courier`).send(fee));
    expectForeignDenied("PATCH sales/:id/courier", foreignFee);
    const ownFee = await send(http.patch(`/api/sales/${b.saleId}/courier`).send(fee));
    expect(ownFee.status, JSON.stringify(ownFee.body)).toBe(200);
    const fees = await sql.query(`SELECT id,"tenantId","courierFee" FROM "Sale" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [a.saleId, b.saleId]);
    expect(fees.rows.map((r: any) => [r.id, Number(r.courierFee)])).toEqual([[a.saleId, 10], [b.saleId, 12]]);

    const payout = { operationId: "30000000-0000-4000-8000-000000000002", saleIds: [a.saleId], note: "Mensajero QA" };
    const foreignPayout = await send(http.post("/api/courier/payouts").send(payout));
    expectForeignDenied("POST courier/payouts", foreignPayout);
    const ownPayout = await send(http.post("/api/courier/payouts").send({ ...payout, saleIds: [b.saleId] }));
    expect(ownPayout.status, JSON.stringify(ownPayout.body)).toBe(201);
    expect((await sql.query(`SELECT "tenantId" FROM "CourierPayout"`)).rows).toEqual([{ tenantId: tenantB }]);

    const collection = { operationId: "30000000-0000-4000-8000-000000000003", lines: [{ method: "transfer", amount: 25, bank: "Banco QA", ownerConfirmed: true }] };
    const foreignCollection = await send(http.post(`/api/sales/${a.saleId}/credit-collections`).send(collection));
    expectForeignDenied("POST sales/:id/credit-collections", foreignCollection);
    const ownCollection = await send(http.post(`/api/sales/${b.saleId}/credit-collections`).send(collection));
    expect(ownCollection.status, JSON.stringify(ownCollection.body)).toBe(201);
    const installment = { offlineUuid: "30000000-0000-4000-8000-000000000020", cashSessionId: openB.body.id, amount: 5, method: "cash" };
    const foreignInstallment = await send(http.post(`/api/sales/${a.saleId}/installments`).send(installment));
    expectForeignDenied("POST sales/:id/installments", foreignInstallment);
    const ownInstallment = await send(http.post(`/api/sales/${b.saleId}/installments`).send(installment));
    expect(ownInstallment.status, JSON.stringify(ownInstallment.body)).toBe(201);
    const cod = { ...installment, offlineUuid: "30000000-0000-4000-8000-000000000021" };
    const foreignCod = await send(http.post(`/api/sales/${a.saleId}/cod-collections`).send(cod));
    expectForeignDenied("POST sales/:id/cod-collections", foreignCod);
    const ownCod = await send(http.post(`/api/sales/${b.saleId}/cod-collections`).send(cod));
    expect(ownCod.status, JSON.stringify(ownCod.body)).toBe(201);
    const foreignVerify = await send(http.post(`/api/payments/${a.transferId}/verify`));
    expectForeignDenied("POST payments/:id/verify", foreignVerify);
    const ownVerify = await send(http.post(`/api/payments/${b.transferId}/verify`));
    expect(ownVerify.status, JSON.stringify(ownVerify.body)).toBe(201);
    expect((await sql.query(`SELECT status FROM "Payment" WHERE id=$1`, [a.transferId])).rows)
      .toEqual([{ status: "pending_verification" }]);
    const balances = await sql.query(`SELECT id,"creditBalance" FROM "Sale" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [a.saleId, b.saleId]);
    expect(balances.rows.map((r: any) => [r.id, Number(r.creditBalance)])).toEqual([[a.saleId, 100], [b.saleId, 65]]);

    const closing = { countedCash: 75, countedCard: 0, countedTransfer: 0, notes: "Cierre de prueba" };
    const foreignClose = await send(http.post(`/api/cash-sessions/${openA.body.id}/close`).send(closing));
    expectForeignDenied("POST cash-sessions/:id/close", foreignClose);
    const ownClose = await send(http.post(`/api/cash-sessions/${openB.body.id}/close`).send(closing));
    expect(ownClose.status, JSON.stringify(ownClose.body)).toBe(201);
    const sessions = await sql.query(`SELECT id,"closedAt" FROM "CashSession" WHERE id IN ($1,$2) ORDER BY id`, [openA.body.id, openB.body.id]);
    expect(sessions.rows.find((row: any) => row.id === openA.body.id).closedAt).toBeNull();
    expect(sessions.rows.find((row: any) => row.id === openB.body.id).closedAt).not.toBeNull();
    expect(foreignFailures).toEqual([]);
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

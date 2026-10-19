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
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto disponible");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("resoluciones offline, comprobantes y pagos a proveedores son propios de la empresa", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-money-last-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir, user: "money_last_qa", password: "money_last_qa_only",
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
    await postgres.createDatabase("money_last_qa");
    const url = `postgresql://money_last_qa:money_last_qa_only@127.0.0.1:${port}/money_last_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000,
    });
    sql = postgres.getPgClient("money_last_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-last-b','Empresa B',now())`, [tenants[1]]);
    const cases = tenants.map((tenantId, i) => ({
      tenantId, roleId: id(500 + i), userId: id(510 + i), terminalId: id(520 + i),
      sessionId: id(530 + i), saleId: id(540 + i), paymentId: id(550 + i),
      supplierId: id(560 + i), offlineUuid: id(570 + i), reviewUuid: id(580 + i),
    }));
    for (const [i, row] of cases.entries()) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test','test',$4,now(),$5)`, [row.userId, `Admin ${i}`, `last-${i}@example.invalid`, row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`, [row.terminalId, `Terminal ${i}`, row.tenantId]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [row.sessionId, row.userId, row.terminalId, row.tenantId]);
      await sql.query(`INSERT INTO "Sale" (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","creditBalance","updatedAt","tenantId") VALUES ($1,$2,$3,$4,100,0,0,100,0,95,now(),$5)`, [row.saleId, `FS-LAST-${i}`, id(590 + i), row.userId, row.tenantId]);
      await sql.query(`INSERT INTO "Payment" (id,"saleId",method,amount,tendered,"entryType",status,"tenantId") VALUES ($1,$2,'cash',5,5,'installment','ok',$3)`, [row.paymentId, row.saleId, row.tenantId]);
      await sql.query(`INSERT INTO "Supplier" (id,name,"createdBy","updatedAt","tenantId") VALUES ($1,$2,$3,now(),$4)`, [row.supplierId, `Proveedor ${i}`, row.userId, row.tenantId]);
      for (const offlineUuid of [row.offlineUuid, row.reviewUuid]) {
        await sql.query(`INSERT INTO "AuditLog" (id,"userId",action,entity,"entityId",after,"tenantId") VALUES ($1,$2,'offline_sale_conflict','offline_sale',$3,$4::jsonb,$5)`, [id(i * 10 + (offlineUuid === row.offlineUuid ? 600 : 601)), row.userId, offlineUuid, JSON.stringify({ paymentTotal: 0, attemptedExpectedTotal: 0 }), row.tenantId]);
        await sql.query(`INSERT INTO "Alert" (id,key,type,severity,"entityId",message,"updatedAt","tenantId") VALUES ($1,$2,'offline_conflict','high',$3,'Conflicto de prueba',now(),$4)`, [id(i * 10 + (offlineUuid === row.offlineUuid ? 620 : 621)), `offline:${offlineUuid}`, offlineUuid, row.tenantId]);
      }
    }

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-last-solo-pruebas-monetarias";
    const apiRequire = createRequire(join(root, "apps/api/package.json"));
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const [a, b] = cases;
    const send = (request: any, row = b) => request.set("Authorization", "Bearer " + jwt.sign({
      sub: row.userId, sid: row.sessionId, type: "access", version: 0, tenantId: row.tenantId,
    }));
    const denied = (response: any) => expect([403, 404], JSON.stringify(response.body)).toContain(response.status);

    const resolution = (offlineUuid: string) => ({ offlineUuid, previousTotal: 0, action: "discard", reason: "Descartar venta de prueba" });
    denied(await send(http.post("/api/sales/offline-resolution").send(resolution(a.offlineUuid))));
    const ownResolution = await send(http.post("/api/sales/offline-resolution").send(resolution(b.offlineUuid)));
    expect(ownResolution.status, JSON.stringify(ownResolution.body)).toBe(201);
    expect((await sql.query(`SELECT status FROM "Alert" WHERE key=$1`, [`offline:${a.offlineUuid}`])).rows[0].status).toBe("new");

    const review = (offlineUuid: string) => ({
      offlineUuid, reason: "Revisión de prueba", outcome: "returned",
      detail: { receiptNumber: "LOCAL-QA", total: 0, items: [], payments: [] },
    });
    denied(await send(http.post("/api/sales/offline-review/discard").send(review(a.reviewUuid))));
    const ownReview = await send(http.post("/api/sales/offline-review/discard").send(review(b.reviewUuid)));
    expect(ownReview.status, JSON.stringify(ownReview.body)).toBe(201);
    expect((await sql.query(`SELECT status FROM "Alert" WHERE key=$1`, [`offline:${a.reviewUuid}`])).rows[0].status).toBe("new");

    const proof = (paymentId: string) => http.post(`/api/payments/${paymentId}/proof`).attach("file", tinyPng, { filename: "evidencia.png", contentType: "image/png" });
    denied(await send(proof(a.paymentId)));
    const ownProof = await send(proof(b.paymentId));
    expect(ownProof.status, JSON.stringify(ownProof.body)).toBe(201);
    const images = await sql.query(`SELECT "tenantId","proofUrl" FROM "Payment" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [a.paymentId, b.paymentId]);
    expect(images.rows[0].proofUrl).toBeNull();
    expect(images.rows[1].proofUrl).toMatch(/^data:image\/png;base64,/);

    const supplierPayment = (supplierId: string) => ({ operationId: id(650), supplierId, amount: 7, method: "transfer", reference: "PROVEEDOR-QA" });
    denied(await send(http.post("/api/supplier-payments").send(supplierPayment(a.supplierId))));
    const ownSupplierPayment = await send(http.post("/api/supplier-payments").send(supplierPayment(b.supplierId)));
    expect(ownSupplierPayment.status, JSON.stringify(ownSupplierPayment.body)).toBe(201);
    expect((await sql.query(`SELECT "tenantId",amount FROM "SupplierPayment" WHERE "operationId"=$1`, [id(650)])).rows.map((r: any) => [r.tenantId, Number(r.amount)])).toEqual([[b.tenantId, 7]]);
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

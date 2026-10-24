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
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const tenants = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const secret = "clave-exclusiva-de-prueba-rutas-finales-producto-2026";
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function freePort() {
  const listener = createServer();
  await new Promise<void>((done) => listener.listen(0, "127.0.0.1", done));
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => listener.close(() => done()));
  return address.port;
}

it("recepciones y traspasos con lotes son idempotentes y aislados entre empresas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-route-final-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir, user: "route_final_test", password: "route_final_test_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const oldUrl = process.env.DATABASE_URL;
  const oldMode = process.env.PRODUCT_TENANCY;
  const oldObjects = process.env.PRODUCT_OBJECT_STORE_DIR;
  let client: any;
  let app: any;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("route_final_qa");
    const url = `postgresql://route_final_test:route_final_test_only@127.0.0.1:${port}/route_final_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 });
    client = pg.getPgClient("route_final_qa", "127.0.0.1");
    await client.connect();
    await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [tenants[1]]);
    for (let i = 0; i < 2; i++) {
      await client.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1,$2,'Administración',ARRAY['*'],now())`, [id(i * 10 + 1), tenants[i]]);
      await client.query(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
        VALUES ($1,$2,'QA','qa-final@example.invalid','test-only','test-only',$3,'main',now())`, [id(i * 10 + 2), tenants[i], id(i * 10 + 1)]);
      await client.query(`INSERT INTO "Terminal" (id,"tenantId",name,"branchId","approvedAt","secretHash")
        VALUES ($1,$2,'Equipo QA','main',now(),'test-only')`, [id(i * 10 + 4), tenants[i]]);
      await client.query(`INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1,$2,$3,$4)`,
        [id(i * 10 + 3), tenants[i], id(i * 10 + 2), id(i * 10 + 4)]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_OBJECT_STORE_DIR = join(dataDir, "objects");
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = new JwtService({ secret });
    const tokens = tenants.map((tenantId, i) => "Bearer " + jwt.sign({ sub: id(i * 10 + 2), sid: id(i * 10 + 3), type: "access", version: 0, tenantId }));
    const http = supertest(app.getHttpServer());
    const [a, b] = tokens;
    const fixtures: { token: string; variantId: string; orderId: string; orderItemId: string; receiptId: string; lotId: string; storeId: string; homeId: string }[] = [];
    const receiptOperationId = id(301);
    for (const [i, token] of tokens.entries()) {
      const category = await http.post("/api/categories").set("Authorization", token)
        .send({ name: `Con lote ${i}`, requiresLot: true, requiresExpiry: true });
      expect(category.status, JSON.stringify(category.body)).toBe(201);
      const product = await http.post("/api/products").set("Authorization", token).send({
        name: `Producto lote ${i}`, sku: "CODIGO-COMPARTIDO", categoryId: category.body.id,
        variants: [{ sku: "VARIANTE-COMPARTIDA", barcode: "BAR-COMPARTIDO", costAvg: 10, price: 20 }],
      });
      expect(product.status, JSON.stringify(product.body)).toBe(201);
      const variantId = product.body.variants[0].id;
      const supplier = await http.post("/api/suppliers").set("Authorization", token).send({ name: `Proveedor ${i}` });
      expect(supplier.status, JSON.stringify(supplier.body)).toBe(201);
      const order = await http.post("/api/purchase-orders").set("Authorization", token)
        .send({ supplierId: supplier.body.id, items: [{ variantId, qty: 2, unitCost: 10 }] });
      expect(order.status, JSON.stringify(order.body)).toBe(201);
      const receiptBody = { operationId: receiptOperationId, items: [{ itemId: order.body.items[0].id,
        qty: 2, lotNumber: "LOTE-COMPARTIDO", expiryDate: "2027-10-01T00:00:00.000Z" }] };
      const receipt = await http.post(`/api/purchase-orders/${order.body.id}/receive`).set("Authorization", token).send(receiptBody);
      expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
      const retry = await http.post(`/api/purchase-orders/${order.body.id}/receive`).set("Authorization", token).send(receiptBody);
      expect(retry.status, JSON.stringify(retry.body)).toBe(201);
      expect(retry.body.id).toBe(receipt.body.id);
      const lot = await client.query(`SELECT id,"tenantId",qty FROM "Lot" WHERE "variantId"=$1`, [variantId]);
      expect(lot.rows).toHaveLength(1);
      expect(lot.rows[0].tenantId).toBe(tenants[i]);
      expect(Number(lot.rows[0].qty)).toBe(2);
      const warehouses = await http.get("/api/inventory/warehouses").set("Authorization", token);
      expect(warehouses.status).toBe(200);
      const store = warehouses.body.find((row: any) => row.sellable);
      const home = warehouses.body.find((row: any) => !row.sellable);
      expect(store?.id).toBeTruthy();
      expect(home?.id).toBeTruthy();
      fixtures.push({ token, variantId, orderId: order.body.id, orderItemId: order.body.items[0].id,
        receiptId: receipt.body.id, lotId: lot.rows[0].id, storeId: store.id, homeId: home.id });
    }
    expect(fixtures[0].receiptId).not.toBe(fixtures[1].receiptId);
    expect((await client.query(`SELECT count(*)::int AS n FROM "GoodsReceipt" WHERE "operationId"=$1`, [receiptOperationId])).rows[0].n).toBe(2);
    const foreignReceipt = await http.get(`/api/goods-receipts/${fixtures[0].receiptId}`).set("Authorization", b);
    expect(foreignReceipt.status).toBe(404);
    const transferOperationId = id(302);
    const foreignLotTransfer = await http.post("/api/inventory/transfers").set("Authorization", b).send({
      operationId: transferOperationId, fromId: fixtures[1].storeId, toId: fixtures[1].homeId,
      reason: "Traspaso lote propio", lines: [{ variantId: fixtures[1].variantId, lotId: fixtures[0].lotId, qty: 1 }],
    });
    expect(foreignLotTransfer.status).toBe(400);
    for (const [i, fixture] of fixtures.entries()) {
      const transferBody = { operationId: transferOperationId, fromId: fixture.storeId, toId: fixture.homeId,
        reason: "Traspaso lote propio", lines: [{ variantId: fixture.variantId, lotId: fixture.lotId, qty: 1 }] };
      const transfer = await http.post("/api/inventory/transfers").set("Authorization", fixture.token).send(transferBody);
      expect(transfer.status, JSON.stringify(transfer.body)).toBe(201);
      const retry = await http.post("/api/inventory/transfers").set("Authorization", fixture.token).send(transferBody);
      expect(retry.status, JSON.stringify(retry.body)).toBe(201);
      expect(retry.body.id).toBe(transfer.body.id);
      if (i === 0) {
        const foreignWarehouse = await http.post("/api/inventory/transfers").set("Authorization", b).send({
          operationId: id(303), fromId: fixture.storeId, toId: fixtures[1].homeId,
          reason: "Almacén ajeno", lines: [{ variantId: fixtures[1].variantId, lotId: fixtures[1].lotId, qty: 1 }],
        });
        expect(foreignWarehouse.status).toBe(400);
      }
    }
    expect((await client.query(`SELECT count(*)::int AS n FROM "StockTransfer" WHERE "operationId"=$1`, [transferOperationId])).rows[0].n).toBe(2);
    const foreignLotWaste = await http.post("/api/inventory/adjustments").set("Authorization", b).send({
      variantId: fixtures[1].variantId, warehouseId: fixtures[1].homeId, lotId: fixtures[0].lotId,
      qty: -1, reason: "Merma controlada", type: "waste",
    });
    expect(foreignLotWaste.status).toBe(400);
    const beforeWaste = await client.query(`SELECT qty FROM "LotStock" WHERE "lotId"=$1 AND "warehouseId"=$2`,
      [fixtures[1].lotId, fixtures[1].homeId]);
    expect(beforeWaste.rows).toHaveLength(1);
    expect(Number(beforeWaste.rows[0].qty)).toBe(1);
    const ownLotWaste = await http.post("/api/inventory/adjustments").set("Authorization", b).send({
      variantId: fixtures[1].variantId, warehouseId: fixtures[1].homeId, lotId: fixtures[1].lotId,
      qty: -1, reason: "Merma controlada", type: "waste",
    });
    expect(ownLotWaste.status, JSON.stringify(ownLotWaste.body)).toBe(201);
    const stocks = await client.query(`SELECT "tenantId", "variantId", "warehouseId",qty FROM "VariantStock"
      WHERE "variantId" IN ($1,$2) ORDER BY "tenantId"`, [fixtures[0].variantId, fixtures[1].variantId]);
    expect(stocks.rows.find((row: any) => row.variantId === fixtures[0].variantId && row.warehouseId === fixtures[0].homeId)?.qty).toBe("1.000");
    expect(stocks.rows.find((row: any) => row.variantId === fixtures[1].variantId && row.warehouseId === fixtures[1].homeId)?.qty).toBe("0.000");

    const ownMerchandise = await http.post("/api/merchandise/operations").set("Authorization", b).send({
      id: id(401), direction: "entry", items: [{ variantId: fixtures[1].variantId,
        qty: 1, unitCost: 10, lotNumber: "LOTE-COMPARTIDO", expiryDate: "2027-10-01T00:00:00.000Z" }],
    });
    expect(ownMerchandise.status, JSON.stringify(ownMerchandise.body)).toBe(201);
    const foreignMerchandise = await http.post("/api/merchandise/operations").set("Authorization", b).send({
      id: id(402), direction: "entry", items: [{ variantId: fixtures[0].variantId,
        qty: 1, unitCost: 10, lotNumber: "LOTE-COMPARTIDO", expiryDate: "2027-10-01T00:00:00.000Z" }],
    });
    expect(foreignMerchandise.status).toBe(404);
    const supplierA = (await client.query(`SELECT id FROM "Supplier" WHERE "tenantId"=$1`, [tenants[0]])).rows[0].id;
    const mapping = JSON.stringify({ code: "codigo", description: "descripcion", qty: "cantidad", unitCost: "costo" });
    const csv = Buffer.from("codigo,descripcion,cantidad,costo\nVARIANTE-COMPARTIDA,Producto lote 1,1,10\n");
    const foreignImport = await http.post("/api/merchandise/import").set("Authorization", b)
      .field("mapping", mapping).field("supplierId", supplierA).attach("file", csv, "factura.csv");
    expect(foreignImport.status).toBe(404);
    const ownImport = await http.post("/api/merchandise/import").set("Authorization", b)
      .field("mapping", mapping).attach("file", csv, "factura.csv");
    expect(ownImport.status, JSON.stringify(ownImport.body)).toBe(201);
    expect(ownImport.body.lines[0].variantId).toBe(fixtures[1].variantId);
    const storedAttachment = await client.query(`SELECT data,"objectKey" FROM "InvoiceAttachment" WHERE id=$1`, [ownImport.body.attachmentId]);
    expect(storedAttachment.rows).toHaveLength(1);
    expect(storedAttachment.rows[0].data).toBeNull();
    expect(storedAttachment.rows[0].objectKey).toMatch(/^invoice\/[0-9a-f-]{36}$/);
    const foreignAttachment = await http.get(`/api/merchandise/attachments/${ownImport.body.attachmentId}`).set("Authorization", a);
    expect(foreignAttachment.status).toBe(404);
    const ownAttachment = await http.get(`/api/merchandise/attachments/${ownImport.body.attachmentId}`).set("Authorization", b);
    expect(ownAttachment.status).toBe(200);
    expect(ownAttachment.text).toContain("VARIANTE-COMPARTIDA");
    expect(ownAttachment.text).toBe(csv.toString("utf8"));
    const foreignQuote = await http.post("/api/quotes").set("Authorization", b)
      .send({ items: [{ variantId: fixtures[0].variantId, qty: 1 }] });
    expect(foreignQuote.status).toBe(400);
    const ownQuote = await http.post("/api/quotes").set("Authorization", b)
      .send({ items: [{ variantId: fixtures[1].variantId, qty: 1 }] });
    expect(ownQuote.status, JSON.stringify(ownQuote.body)).toBe(201);
  } finally {
    await app?.close().catch(() => undefined);
    await client?.end().catch(() => undefined);
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = oldMode;
    if (oldObjects === undefined) delete process.env.PRODUCT_OBJECT_STORE_DIR;
    else process.env.PRODUCT_OBJECT_STORE_DIR = oldObjects;
    await pg.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180_000);

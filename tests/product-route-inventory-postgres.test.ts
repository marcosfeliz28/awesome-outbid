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
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const aTenant = "00000000-0000-0000-0000-000000000001";
const bTenant = "00000000-0000-0000-0000-000000000002";
const secret = "clave-larga-aleatoria-solo-para-qa-de-aislamiento";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("rutas reales de catálogo, inventario y almacenes no cruzan empresas con cuerpos válidos", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-routes-stock-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "product_routes_test",
    password: "product_routes_test_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const oldUrl = process.env.DATABASE_URL;
  const oldMode = process.env.PRODUCT_TENANCY;
  let client: any;
  let app: any;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("routes_stock_qa");
    const url = `postgresql://product_routes_test:product_routes_test_only@127.0.0.1:${port}/routes_stock_qa`;
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 },
    );
    client = pg.getPgClient("routes_stock_qa", "127.0.0.1");
    await client.connect();
    await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'negocio-b','Negocio B',now())`, [bTenant]);
    const ids = [
      { tenant: aTenant, role: "10000000-0000-4000-8000-000000000101", user: "10000000-0000-4000-8000-000000000102", session: "10000000-0000-4000-8000-000000000103", terminal: "10000000-0000-4000-8000-000000000104" },
      { tenant: bTenant, role: "10000000-0000-4000-8000-000000000201", user: "10000000-0000-4000-8000-000000000202", session: "10000000-0000-4000-8000-000000000203", terminal: "10000000-0000-4000-8000-000000000204" },
    ];
    for (const id of ids) {
      await client.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1,$2,'Administración',ARRAY['*'],now())`, [id.role, id.tenant]);
      await client.query(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
        VALUES ($1,$2,'QA','qa@example.invalid','test-only','test-only',$3,'main',now())`, [id.user, id.tenant, id.role]);
      await client.query(`INSERT INTO "Terminal" (id,"tenantId",name,"branchId","approvedAt","secretHash")
        VALUES ($1,$2,'Equipo QA','main',now(),'test-only')`, [id.terminal, id.tenant]);
      await client.query(`INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1,$2,$3,$4)`, [id.session, id.tenant, id.user, id.terminal]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = new JwtService({ secret });
    const token = (index: number) => {
      const id = ids[index];
      return "Bearer " + jwt.sign({ sub: id.user, sid: id.session, type: "access", version: 0, tenantId: id.tenant });
    };
    const http = supertest(app.getHttpServer());
    const a = token(0);
    const b = token(1);
    const categoryA = await http.post("/api/categories").set("Authorization", a).send({ name: "Categoría secreta A" });
    const categoryB = await http.post("/api/categories").set("Authorization", b).send({ name: "Categoría propia B" });
    expect(categoryA.status, JSON.stringify(categoryA.body)).toBe(201);
    expect(categoryB.status, JSON.stringify(categoryB.body)).toBe(201);
    const brandA = await http.post("/api/brands").set("Authorization", a).send({ name: "Marca secreta A" });
    const brandB = await http.post("/api/brands").set("Authorization", b).send({ name: "Marca propia B" });
    expect(brandA.status).toBe(201);
    expect(brandB.status).toBe(201);
    const brandsB = await http.get("/api/brands").set("Authorization", b);
    expect(brandsB.status).toBe(200);
    expect(JSON.stringify(brandsB.body)).toContain("Marca propia B");
    expect(JSON.stringify(brandsB.body)).not.toContain("Marca secreta A");
    const validProduct = (categoryId: string, name: string) => ({
      name, sku: "SKU-COMPARTIDO", categoryId,
      variants: [{ sku: "VAR-COMPARTIDA", barcode: "BARRA-COMPARTIDA", price: 20, costAvg: 10 }],
    });
    const foreignCategory = await http.post("/api/products").set("Authorization", b)
      .send(validProduct(categoryA.body.id, "Cruce prohibido"));
    expect(foreignCategory.status, JSON.stringify(foreignCategory.body)).toBe(400);
    const productA = await http.post("/api/products").set("Authorization", a)
      .send(validProduct(categoryA.body.id, "Producto secreto A"));
    const productB = await http.post("/api/products").set("Authorization", b)
      .send(validProduct(categoryB.body.id, "Producto propio B"));
    expect(productA.status, JSON.stringify(productA.body)).toBe(201);
    expect(productB.status, JSON.stringify(productB.body)).toBe(201);
    const variantA = productA.body.variants[0].id;
    const variantB = productB.body.variants[0].id;

    for (const [path, own, foreign] of [
      ["/api/categories", "Categoría propia B", "Categoría secreta A"],
      ["/api/products", "Producto propio B", "Producto secreto A"],
      ["/api/inventory/stock", variantB, variantA],
      ["/api/inventory/location-report", variantB, variantA],
    ]) {
      const response = await http.get(path).set("Authorization", b);
      expect(response.status, `${path}: ${JSON.stringify(response.body)}`).toBe(200);
      expect(JSON.stringify(response.body), path).toContain(own);
      expect(JSON.stringify(response.body), path).not.toContain(foreign);
    }
    const productDetail = await http.get(`/api/products/${productA.body.id}`).set("Authorization", b);
    expect(productDetail.status).toBe(404);
    const foreignPatch = await http.patch(`/api/products/${productA.body.id}`).set("Authorization", b)
      .send({ name: "Alteración desde B" });
    expect(foreignPatch.status).toBe(404);
    const foreignVariantPatch = await http.patch(`/api/variants/${variantA}`).set("Authorization", b)
      .send({ price: 99 });
    expect(foreignVariantPatch.status).toBe(404);
    const foreignAdjustment = await http.post("/api/inventory/adjustments").set("Authorization", b)
      .send({ variantId: variantA, qty: 2, reason: "Conteo QA entre empresas" });
    expect(foreignAdjustment.status).toBe(404);

    const warehousesA = await http.get("/api/inventory/warehouses").set("Authorization", a);
    const warehousesB = await http.get("/api/inventory/warehouses").set("Authorization", b);
    expect(warehousesA.status).toBe(200);
    expect(warehousesB.status).toBe(200);
    expect(warehousesA.body).toHaveLength(2);
    expect(warehousesB.body).toHaveLength(2);
    expect(warehousesA.body.map((w: any) => w.id)).not.toEqual(warehousesB.body.map((w: any) => w.id));
    const aStore = warehousesA.body.find((w: any) => w.kind === "store");
    const aHome = warehousesA.body.find((w: any) => w.kind === "home");
    const bStore = warehousesB.body.find((w: any) => w.kind === "store");
    const bHome = warehousesB.body.find((w: any) => w.kind === "home");
    const foreignTransfer = await http.post("/api/inventory/transfers").set("Authorization", b)
      .send({ operationId: "10000000-0000-4000-8000-000000000301", fromId: aStore.id,
        toId: aHome.id, reason: "Traspaso ajeno QA", lines: [{ variantId: variantB, qty: 1 }] });
    expect(foreignTransfer.status).toBe(400);
    const addStock = await http.post("/api/inventory/adjustments").set("Authorization", b)
      .send({ variantId: variantB, qty: 2, reason: "Conteo propio QA" });
    expect(addStock.status, JSON.stringify(addStock.body)).toBe(201);
    const transfer = await http.post("/api/inventory/transfers").set("Authorization", b)
      .send({ operationId: "10000000-0000-4000-8000-000000000302", fromId: bStore.id,
        toId: bHome.id, reason: "Traspaso propio QA", lines: [{ variantId: variantB, qty: 1 }] });
    expect(transfer.status, JSON.stringify(transfer.body)).toBe(201);
    const transfersA = await http.get("/api/inventory/transfers").set("Authorization", a);
    const transfersB = await http.get("/api/inventory/transfers").set("Authorization", b);
    expect(transfersA.status).toBe(200);
    expect(transfersA.body).toHaveLength(0);
    expect(transfersB.status).toBe(200);
    expect(JSON.stringify(transfersB.body)).toContain(transfer.body.id);
    expect((await http.get(`/api/inventory/movements?variantId=${variantA}`).set("Authorization", b)).body).toEqual([]);
    const foreignCount = await http.post("/api/inventory/counts").set("Authorization", b)
      .send({ warehouseId: bHome.id, items: [{ variantId: variantA, counted: 1 }] });
    expect(foreignCount.status).toBe(404);
    const countB = await http.post("/api/inventory/counts").set("Authorization", b)
      .send({ warehouseId: bHome.id, items: [{ variantId: variantB, counted: 1 }] });
    expect(countB.status, JSON.stringify(countB.body)).toBe(201);
    const foreignApplyCount = await http.post(`/api/inventory/counts/${countB.body.id}/apply`)
      .set("Authorization", a).send({});
    expect(foreignApplyCount.status).toBe(404);
    const applyCount = await http.post(`/api/inventory/counts/${countB.body.id}/apply`)
      .set("Authorization", b).send({});
    expect(applyCount.status, JSON.stringify(applyCount.body)).toBe(201);
    const countsA = await http.get("/api/inventory/counts").set("Authorization", a);
    const countsB = await http.get("/api/inventory/counts").set("Authorization", b);
    expect(countsA.status).toBe(200);
    expect(countsA.body).toHaveLength(0);
    expect(countsB.status).toBe(200);
    expect(JSON.stringify(countsB.body)).toContain(countB.body.id);
    const supplierA = await http.post("/api/suppliers").set("Authorization", a)
      .send({ name: "Proveedor secreto A" });
    const supplierB = await http.post("/api/suppliers").set("Authorization", b)
      .send({ name: "Proveedor propio B" });
    expect(supplierA.status).toBe(201);
    expect(supplierB.status).toBe(201);
    const foreignOrder = await http.post("/api/purchase-orders").set("Authorization", b)
      .send({ supplierId: supplierA.body.id, items: [{ variantId: variantB, qty: 2, unitCost: 10 }] });
    expect(foreignOrder.status).toBe(404);
    const orderA = await http.post("/api/purchase-orders").set("Authorization", a)
      .send({ supplierId: supplierA.body.id, items: [{ variantId: variantA, qty: 2, unitCost: 10 }] });
    const orderB = await http.post("/api/purchase-orders").set("Authorization", b)
      .send({ supplierId: supplierB.body.id, items: [{ variantId: variantB, qty: 2, unitCost: 10 }] });
    expect(orderA.status, JSON.stringify(orderA.body)).toBe(201);
    expect(orderB.status, JSON.stringify(orderB.body)).toBe(201);
    expect(orderA.body.number).toBe("OC-000001");
    expect(orderB.body.number).toBe("OC-000001");
    const ordersA = await http.get("/api/purchase-orders").set("Authorization", a);
    const ordersB = await http.get("/api/purchase-orders").set("Authorization", b);
    expect(ordersA.status).toBe(200);
    expect(ordersB.status).toBe(200);
    expect(JSON.stringify(ordersA.body)).toContain(orderA.body.id);
    expect(JSON.stringify(ordersA.body)).not.toContain(orderB.body.id);
    expect(JSON.stringify(ordersB.body)).toContain(orderB.body.id);
    expect(JSON.stringify(ordersB.body)).not.toContain(orderA.body.id);
    const foreignDocument = await http.patch(`/api/purchase-orders/${orderA.body.id}/document`)
      .set("Authorization", b).send({ supplierInvoice: "AJENA" });
    expect(foreignDocument.status).toBe(404);
    const foreignReceive = await http.post(`/api/purchase-orders/${orderA.body.id}/receive`)
      .set("Authorization", b).send({ operationId: "10000000-0000-4000-8000-000000000305",
        items: [{ itemId: orderA.body.items[0].id, qty: 1 }] });
    expect(foreignReceive.status).toBe(404);
    const receiptB = await http.post(`/api/purchase-orders/${orderB.body.id}/receive`)
      .set("Authorization", b).send({ operationId: "10000000-0000-4000-8000-000000000306",
        items: [{ itemId: orderB.body.items[0].id, qty: 1 }] });
    expect(receiptB.status, JSON.stringify(receiptB.body)).toBe(201);
    const receiptsA = await http.get("/api/goods-receipts").set("Authorization", a);
    const receiptsB = await http.get("/api/goods-receipts").set("Authorization", b);
    expect(receiptsA.status).toBe(200);
    expect(receiptsA.body).toHaveLength(0);
    expect(receiptsB.status).toBe(200);
    expect(JSON.stringify(receiptsB.body)).toContain(receiptB.body.id);
    const foreignReceipt = await http.get(`/api/goods-receipts/${receiptB.body.id}`).set("Authorization", a);
    expect(foreignReceipt.status).toBe(404);
    const foreignReceiptPatch = await http.patch(`/api/goods-receipts/${receiptB.body.id}/document`)
      .set("Authorization", a).send({ supplierInvoice: "AJENA" });
    expect(foreignReceiptPatch.status).toBe(404);
    const receiptDetail = await http.get(`/api/goods-receipts/${receiptB.body.id}`).set("Authorization", b);
    expect(receiptDetail.status).toBe(200);
    expect(receiptDetail.body.id).toBe(receiptB.body.id);
    // El mismo ID de variante existe en ambas empresas. El Excel debe tocar
    // únicamente la fila de B, desde su vista previa hasta la transacción.
    const ExcelJS = apiRequire("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Inventario");
    sheet.addRow(["ID", "DESCRIPCION", "REFERENCIA", "SUB-GRUPO DE ARTICULO", "EXISTENCIA", "COSTO", "PRECIO DETALLE"]);
    sheet.addRow(["VAR-COMPARTIDA", "Producto importado B", "VAR-COMPARTIDA", "Categoría propia B", 4, 12, 30]);
    const excel = Buffer.from(await workbook.xlsx.writeBuffer());
    sheet.getRow(2).getCell(5).value = 2;
    const casaExcel = Buffer.from(await workbook.xlsx.writeBuffer());
    const casaPreview = await http.post("/api/inventory-import/casa/preview").set("Authorization", b)
      .attach("file", casaExcel, "casa-qa.xlsx");
    expect(casaPreview.status, JSON.stringify(casaPreview.body)).toBe(201);
    expect(casaPreview.body.canApply, JSON.stringify(casaPreview.body)).toBe(true);
    const casaApply = await http.post("/api/inventory-import/casa/apply").set("Authorization", b)
      .field("hash", casaPreview.body.hash).field("state", casaPreview.body.state)
      .attach("file", casaExcel, "casa-qa.xlsx");
    expect(casaApply.status, JSON.stringify(casaApply.body)).toBe(201);
    const homeB = await client.query(`SELECT qty FROM "VariantStock" WHERE "variantId"=$1 AND "warehouseId"=$2`, [variantB, bHome.id]);
    expect(homeB.rows[0].qty).toBe("2.000");
    const homeA = await client.query(`SELECT qty FROM "VariantStock" WHERE "variantId"=$1 AND "warehouseId"=$2`, [variantA, aHome.id]);
    expect(homeA.rows).toHaveLength(0);
    const preview = await http.post("/api/inventory-import/preview").set("Authorization", b)
      .attach("file", excel, "inventario-qa.xlsx");
    expect(preview.status, JSON.stringify(preview.body)).toBe(201);
    expect(preview.body.canApply, JSON.stringify(preview.body)).toBe(true);
    expect(preview.body.rows).toBe(1);
    const applied = await http.post("/api/inventory-import/apply").set("Authorization", b)
      .field("hash", preview.body.hash).field("state", preview.body.state)
      .attach("file", excel, "inventario-qa.xlsx");
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    const afterImportB = await http.get("/api/inventory/stock").set("Authorization", b);
    expect(JSON.stringify(afterImportB.body)).toContain("Producto propio B");
    expect(JSON.stringify(afterImportB.body)).not.toContain("Producto secreto A");
    expect((await client.query(`SELECT stock,price,"costAvg" FROM "Variant" WHERE id=$1`, [variantB])).rows[0])
      .toMatchObject({ stock: "4.000", price: "30.00", costAvg: "12.00" });
    const stockA = await http.get("/api/inventory/stock").set("Authorization", a);
    expect(JSON.stringify(stockA.body)).not.toContain("Traspaso propio QA");
    expect((await client.query(`SELECT stock FROM "Variant" WHERE id=$1`, [variantA])).rows[0].stock).toBe("0.000");
  } finally {
    await app?.close().catch(() => undefined);
    await client?.end().catch(() => undefined);
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = oldMode;
    await pg.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180_000);

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
const secret = "clave-exclusiva-de-prueba-rutas-extra-producto-2026";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function freePort() {
  const listener = createServer();
  await new Promise<void>((done) => listener.listen(0, "127.0.0.1", done));
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => listener.close(() => done()));
  return address.port;
}

const binary = (request: any) => request.buffer(true).parse((res: any, done: any) => {
  const parts: Buffer[] = [];
  res.on("data", (part: Buffer) => parts.push(part));
  res.on("end", () => done(null, Buffer.concat(parts)));
  res.on("error", done);
});

it("rutas restantes de catálogo, kits, lotes y documentos de compra separan dos empresas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-route-extra-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir, user: "route_extra_test", password: "route_extra_test_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const oldUrl = process.env.DATABASE_URL;
  const oldMode = process.env.PRODUCT_TENANCY;
  let client: any;
  let app: any;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("route_extra_qa");
    const url = `postgresql://route_extra_test:route_extra_test_only@127.0.0.1:${port}/route_extra_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 });
    client = pg.getPgClient("route_extra_qa", "127.0.0.1");
    await client.connect();
    await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [tenants[1]]);
    for (let i = 0; i < 2; i++) {
      await client.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1,$2,'Administración',ARRAY['*'],now())`, [id(i * 10 + 1), tenants[i]]);
      await client.query(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
        VALUES ($1,$2,'QA','qa-extra@example.invalid','test-only','test-only',$3,'main',now())`, [id(i * 10 + 2), tenants[i], id(i * 10 + 1)]);
      await client.query(`INSERT INTO "Terminal" (id,"tenantId",name,"branchId","approvedAt","secretHash")
        VALUES ($1,$2,'Equipo QA','main',now(),'test-only')`, [id(i * 10 + 4), tenants[i]]);
      await client.query(`INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1,$2,$3,$4)`,
        [id(i * 10 + 3), tenants[i], id(i * 10 + 2), id(i * 10 + 4)]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const ExcelJS = apiRequire("exceljs");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = new JwtService({ secret });
    const tokens = tenants.map((tenantId, i) => "Bearer " + jwt.sign({ sub: id(i * 10 + 2), sid: id(i * 10 + 3), type: "access", version: 0, tenantId }));
    const http = supertest(app.getHttpServer());
    const [a, b] = tokens;
    const catA = await http.post("/api/categories").set("Authorization", a).send({ name: "Categoría A secreta" });
    const catB = await http.post("/api/categories").set("Authorization", b).send({ name: "Categoría B propia" });
    expect(catA.status).toBe(201);
    expect(catB.status).toBe(201);
    const templateA = await binary(http.get("/api/catalog-template.xlsx").set("Authorization", a));
    const templateB = await binary(http.get("/api/catalog-template.xlsx").set("Authorization", b));
    expect(templateA.status).toBe(200);
    expect(templateB.status).toBe(200);
    const templateBookA = new ExcelJS.Workbook();
    const templateBookB = new ExcelJS.Workbook();
    await templateBookA.xlsx.load(templateA.body);
    await templateBookB.xlsx.load(templateB.body);
    const categoryRows = (book: any) => book.getWorksheet("Categorías").getColumn(2).values.join("|");
    expect(categoryRows(templateBookA)).toContain("Categoría A secreta");
    expect(categoryRows(templateBookA)).not.toContain("Categoría B propia");
    expect(categoryRows(templateBookB)).toContain("Categoría B propia");
    expect(categoryRows(templateBookB)).not.toContain("Categoría A secreta");

    const create = (categoryId: string, name: string, code: string) => ({ name, sku: code, categoryId,
      variants: [{ sku: code + "-V", barcode: code + "-BAR", costAvg: 10, price: 20 }] });
    const productA = await http.post("/api/products").set("Authorization", a).send(create(catA.body.id, "Kit secreto A", "KIT-A"));
    const productB = await http.post("/api/products").set("Authorization", b).send(create(catB.body.id, "Kit propio B", "KIT-B"));
    const componentB = await http.post("/api/products").set("Authorization", b).send(create(catB.body.id, "Componente B", "COMP-B"));
    expect(productA.status).toBe(201);
    expect(productB.status).toBe(201);
    expect(componentB.status).toBe(201);
    const variantA = productA.body.variants[0].id;
    const variantB = productB.body.variants[0].id;
    const componentVariantB = componentB.body.variants[0].id;
    const foreignMatrix = await http.post(`/api/products/${productA.body.id}/variants`).set("Authorization", b)
      .send({ attributes: { talla: ["L"] }, price: 20, costAvg: 10 });
    expect(foreignMatrix.status).toBe(404);
    const matrixB = await http.post(`/api/products/${productB.body.id}/variants`).set("Authorization", b)
      .send({ attributes: { talla: ["L"] }, price: 20, costAvg: 10 });
    expect(matrixB.status, JSON.stringify(matrixB.body)).toBe(201);
    expect(matrixB.body).toHaveLength(1);
    const foreignKit = await http.post("/api/kits").set("Authorization", b)
      .send({ kitVariantId: variantB, components: [{ componentVariantId: variantA, qty: 1 }] });
    expect(foreignKit.status).toBe(400);
    const kitB = await http.post("/api/kits").set("Authorization", b)
      .send({ kitVariantId: variantB, components: [{ componentVariantId: componentVariantB, qty: 1 }] });
    expect(kitB.status, JSON.stringify(kitB.body)).toBe(201);
    expect((await client.query(`SELECT "isKit" FROM "Product" WHERE id=$1`, [productA.body.id])).rows[0].isKit).toBe(false);

    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Productos");
    sheet.addRow(["Nombre", "SKU", "ID categoría", "Código de barras", "Precio", "Costo"]);
    sheet.addRow(["Importado B", "KIT-A", catB.body.id, "IMPORT-B-BAR", 20, 10]);
    const imported = await http.post("/api/products/import").set("Authorization", b)
      .attach("file", Buffer.from(await book.xlsx.writeBuffer()), "catalogo.xlsx");
    expect(imported.status, JSON.stringify(imported.body)).toBe(201);
    expect(imported.body.imported).toBe(1);
    const productsA = await http.get("/api/products").set("Authorization", a);
    const productsB = await http.get("/api/products").set("Authorization", b);
    expect(JSON.stringify(productsA.body)).not.toContain("Importado B");
    expect(JSON.stringify(productsB.body)).toContain("Importado B");

    const supplierB = await http.post("/api/suppliers").set("Authorization", b).send({ name: "Proveedor B" });
    expect(supplierB.status).toBe(201);
    const orderB = await http.post("/api/purchase-orders").set("Authorization", b)
      .send({ supplierId: supplierB.body.id, items: [{ variantId: componentVariantB, qty: 2, unitCost: 10 }] });
    expect(orderB.status, JSON.stringify(orderB.body)).toBe(201);
    const orderDoc = await http.patch(`/api/purchase-orders/${orderB.body.id}/document`).set("Authorization", b)
      .send({ supplierInvoice: "DOC-B-001", paymentType: "cash" });
    expect(orderDoc.status, JSON.stringify(orderDoc.body)).toBe(200);
    const foreignOrderDoc = await http.patch(`/api/purchase-orders/${orderB.body.id}/document`).set("Authorization", a)
      .send({ supplierInvoice: "AJENA" });
    expect(foreignOrderDoc.status).toBe(404);
    const receiptB = await http.post(`/api/purchase-orders/${orderB.body.id}/receive`).set("Authorization", b)
      .send({ operationId: id(301), items: [{ itemId: orderB.body.items[0].id, qty: 1,
        lotNumber: "LOTE-B", expiryDate: "2027-10-01T00:00:00.000Z" }] });
    expect(receiptB.status, JSON.stringify(receiptB.body)).toBe(201);
    const lotB = await client.query(`SELECT "tenantId", "lotNumber" FROM "Lot" WHERE "variantId"=$1`, [componentVariantB]);
    expect(lotB.rows).toMatchObject([{ tenantId: tenants[1], lotNumber: "LOTE-B" }]);
    const receiptDoc = await http.patch(`/api/goods-receipts/${receiptB.body.id}/document`).set("Authorization", b)
      .send({ supplierNcf: "B0100000123" });
    expect(receiptDoc.status, JSON.stringify(receiptDoc.body)).toBe(200);
    const foreignReceiptDoc = await http.patch(`/api/goods-receipts/${receiptB.body.id}/document`).set("Authorization", a)
      .send({ supplierNcf: "B0100000456" });
    expect(foreignReceiptDoc.status).toBe(404);
    const exportA = await binary(http.get("/api/goods-receipts/export").set("Authorization", a));
    const exportB = await binary(http.get("/api/goods-receipts/export").set("Authorization", b));
    expect(exportA.status).toBe(200);
    expect(exportB.status).toBe(200);
    const excelA = new ExcelJS.Workbook();
    const excelB = new ExcelJS.Workbook();
    await excelA.xlsx.load(exportA.body);
    await excelB.xlsx.load(exportB.body);
    const rows = (workbook: any) => workbook.worksheets[0].getColumn(3).values.join("|");
    expect(rows(excelA)).not.toContain("Proveedor B");
    expect(rows(excelB)).toContain("Proveedor B");
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

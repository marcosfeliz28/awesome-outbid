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
import { Database } from "../apps/api/src/common";
import { createAppModule } from "../apps/api/src/app";
import { tenantScope } from "../apps/api/src/tenant-context";

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const prismaCli = createRequire(join(root, "apps/api/package.json")).resolve(
  "prisma/build/index.js",
);
const run = promisify(execFile);
const demo = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("migra datos existentes y aísla lectura, escritura y cambio de tenant con RLS", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-db-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "product_test",
    password: "product_test_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  let client: any;
  try {
    await db.initialise();
    await db.start();
    await db.createDatabase("product_qa");
    const url = `postgresql://product_test:product_test_only@127.0.0.1:${port}/product_qa`;
    const migrated = await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000 },
    );
    expect(migrated.stdout).toContain("202610260001_product_tenant");
    client = db.getPgClient("product_qa", "127.0.0.1");
    await client.connect();
    // W6: la caja es de la persona, no del terminal. La migración de
    // unicidad SaaS no puede reintroducir la restricción por equipo.
    const registerIndex = (await client.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='one_open_cash_per_register'`,
    )).rows;
    expect(registerIndex).toHaveLength(0);
    await client.query(
      `INSERT INTO "CashSession" (id, "registerId", "userId", "openingAmount") VALUES
        ('30000000-0000-4000-8000-000000000001', 'mismo-terminal', 'cajera-a', 100),
        ('30000000-0000-4000-8000-000000000002', 'mismo-terminal', 'cajera-b', 200)`,
    );
    const simultaneous = (await client.query(
      `SELECT count(*)::int AS total FROM "CashSession" WHERE "registerId"='mismo-terminal' AND "closedAt" IS NULL`,
    )).rows[0];
    expect(simultaneous.total).toBe(2);
    await expect(client.query(
      `INSERT INTO "CashSession" (id, "registerId", "userId", "openingAmount") VALUES
        ('30000000-0000-4000-8000-000000000003', 'otro-terminal', 'cajera-a', 300)`,
    )).rejects.toMatchObject({ code: "23505", constraint: "one_open_cash_per_user" });
    await client.query(`INSERT INTO "Tenant" (id, slug, name, "updatedAt") VALUES ($1, 'otro-negocio', 'Otro negocio', now())`, [other]);
    const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' AND tablename <> 'Tenant'`)).rows.map((r: any) => r.tablename);
    expect(tables).toHaveLength(61);
    for (const table of tables) {
      const status = (await client.query(`SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass`, [`public."${table}"`])).rows[0];
      expect(status.relrowsecurity, table).toBe(true);
      const column = (await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='tenantId'`, [table])).rows;
      expect(column, table).toHaveLength(1);
      const def = (await client.query(`SELECT column_default FROM information_schema.columns WHERE table_name=$1 AND column_name='tenantId'`, [table])).rows[0]?.column_default;
      expect(def, table).toContain(demo);
    }
    await client.query(`INSERT INTO "Brand" (id, name) VALUES ($1, 'Marca demo')`, ["10000000-0000-4000-8000-000000000001"]);
    const check = async (tenantId: string, statement: string, values: unknown[] = []) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE nexora_tenant_runtime");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const result = await client.query(statement, values);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    };
    expect((await check(demo, `SELECT name FROM "Brand"`)).rows).toEqual([{ name: "Marca demo" }]);
    expect((await check(other, `SELECT name FROM "Brand"`)).rows).toEqual([]);
    await expect(check(other, `UPDATE "Brand" SET "tenantId"=$1 WHERE name='Marca demo'`, [other])).resolves.toHaveProperty("rowCount", 0);
    await expect(check(demo, `INSERT INTO "Brand" (id,name,"tenantId") VALUES ($1,'Intruso',$2)`, ["10000000-0000-4000-8000-000000000002", other])).rejects.toThrow();
    await check(other, `INSERT INTO "Brand" (id,name) VALUES ($1,'Marca otro negocio')`, ["10000000-0000-4000-8000-000000000003"]);
    expect((await check(other, `SELECT name FROM "Brand"`)).rows).toEqual([{ name: "Marca otro negocio" }]);
    const categoryId = "10000000-0000-4000-8000-000000000004";
    await check(demo, `INSERT INTO "Category" (id,name,"updatedAt") VALUES ($1,'Categoría demo',now())`, [categoryId]);
    await expect(check(other, `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt") VALUES ($1,'Cruce','CROSS-01',$2,now())`, ["10000000-0000-4000-8000-000000000005", categoryId])).rejects.toThrow();
    const oldUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    const apiDb = new Database();
    try {
      await apiDb.$connect();
      expect((await tenantScope.run({ tenantId: demo }, () => apiDb.brand.findMany())).map((row) => row.name)).toEqual(["Marca demo"]);
      expect((await tenantScope.run({ tenantId: other }, () => apiDb.brand.findMany())).map((row) => row.name)).toEqual(["Marca otro negocio"]);
      const inside = await tenantScope.run({ tenantId: other }, () => apiDb.$transaction(async (tx) => {
        const rows = await tx.brand.findMany();
        const raw = await tx.$queryRaw<{ name: string }[]>`SELECT name FROM "Brand"`;
        return [rows[0]?.name, raw[0]?.name];
      }));
      expect(inside).toEqual(["Marca otro negocio", "Marca otro negocio"]);
    } finally {
      await apiDb.$disconnect();
      if (oldUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = oldUrl;
    }
    const secret = "solo-prueba-producto-clave-larga-aleatoria-2026";
    const apiRequire = createRequire(join(root, "apps/api/package.json"));
    const { JwtService } = apiRequire("@nestjs/jwt");
    const { NestFactory } = apiRequire("@nestjs/core");
    const userA = "10000000-0000-4000-8000-000000000010";
    const userB = "10000000-0000-4000-8000-000000000011";
    const sessionA = "10000000-0000-4000-8000-000000000012";
    const sessionB = "10000000-0000-4000-8000-000000000013";
    const roleA = "10000000-0000-4000-8000-000000000014";
    const roleB = "10000000-0000-4000-8000-000000000015";
    for (const [tenantId, roleId, userId, sessionId, suffix] of [
      [demo, roleA, userA, sessionA, "a"],
      [other, roleB, userB, sessionB, "b"],
    ]) {
      await client.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [roleId, tenantId]);
      await client.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,'qa-product@example.invalid','test-only','test-only',$3,'main',now(),$4)`, [userId, `Admin ${suffix}`, roleId, tenantId]);
      await client.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [sessionId, userId, tenantId]);
    }
    const categoryB = "10000000-0000-4000-8000-000000000016";
    await client.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Categoría B',now(),$2)`, [categoryB, other]);
    const productA = "10000000-0000-4000-8000-000000000017";
    await client.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Producto secreto A','QA-PRODUCT-SHARED',$2,now(),$3)`, [productA, categoryId, demo]);
    await client.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Producto B','QA-PRODUCT-SHARED',$2,now(),$3)`, ["10000000-0000-4000-8000-000000000018", categoryB, other]);
    const variantA = "10000000-0000-4000-8000-000000000023";
    const variantB = "10000000-0000-4000-8000-000000000024";
    for (const [tenantId, variantId, productId] of [
      [demo, variantA, productA],
      [other, variantB, "10000000-0000-4000-8000-000000000018"],
    ]) {
      await client.query(`INSERT INTO "Variant" (id,"tenantId","productId",sku,barcode,"costAvg",price,stock,"updatedAt")
        VALUES ($1,$2,$3,'QA-VARIANT-SHARED','QA-BARCODE-SHARED',10,20,1,now())`, [variantId, tenantId, productId]);
      const stock = await client.query(`SELECT s.qty, w."tenantId" FROM "VariantStock" s
        JOIN "Warehouse" w ON w.id=s."warehouseId" WHERE s."variantId"=$1 AND w.kind='store'`, [variantId]);
      expect(stock.rows).toMatchObject([{ qty: "1.000", tenantId }]);
    }
    await expect(client.query(`INSERT INTO "Variant" (id,"tenantId","productId",sku,barcode,"costAvg",price,"updatedAt")
      VALUES (gen_random_uuid(),$1,$2,' qa-variant-shared ','QA-NEW-BARCODE',10,20,now())`, [other, "10000000-0000-4000-8000-000000000018"]))
      .rejects.toMatchObject({ code: "23505", constraint: "Variant_tenantId_sku_ci_key" });
    for (const [tenantId, sellerId, saleId, offlineUuid] of [
      [demo, userA, "10000000-0000-4000-8000-000000000019", "10000000-0000-4000-8000-000000000020"],
      [other, userB, "10000000-0000-4000-8000-000000000021", "10000000-0000-4000-8000-000000000022"],
    ]) {
      await client.query(`INSERT INTO "Counter" (key,value,"tenantId") VALUES ('sale:main',1,$1)`, [tenantId]);
      await client.query(`INSERT INTO "Sale" (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","tenantId") VALUES ($1,'FS-0000001',$2,$3,0,0,0,0,0,now(),$4)`, [saleId, offlineUuid, sellerId, tenantId]);
    }
    expect((await client.query(`SELECT "tenantId" FROM "Sale" WHERE number='FS-0000001'`)).rows).toHaveLength(2);
    const payoutOperationId = "10000000-0000-4000-8000-000000000025";
    const creditOperationId = "10000000-0000-4000-8000-000000000026";
    for (const [tenantId, userId, saleId] of [
      [demo, userA, "10000000-0000-4000-8000-000000000019"],
      [other, userB, "10000000-0000-4000-8000-000000000021"],
    ]) {
      await client.query(`INSERT INTO "CourierPayout" ("operationId","tenantId","branchId","actorId","requestHash",total)
        VALUES ($1,$2,'main',$3,'test',0)`, [payoutOperationId, tenantId, userId]);
      await client.query(`INSERT INTO "CourierPayoutItem" (id,"tenantId","payoutId","saleId",fee)
        VALUES (gen_random_uuid(),$1,$2,$3,0)`, [tenantId, payoutOperationId, saleId]);
      await client.query(`INSERT INTO "CreditAllocationOperation" ("operationId","tenantId","branchId","customerId","actorId","requestHash",result)
        VALUES ($1,$2,'main',$3,$3,'test','{}'::jsonb)`, [creditOperationId, tenantId, userId]);
    }
    expect((await client.query(`SELECT "tenantId" FROM "CourierPayout" WHERE "operationId"=$1`, [payoutOperationId])).rows).toHaveLength(2);
    expect((await client.query(`SELECT "tenantId" FROM "CreditAllocationOperation" WHERE "operationId"=$1`, [creditOperationId])).rows).toHaveLength(2);
    const onlyAOperationId = "10000000-0000-4000-8000-000000000027";
    const secondBSaleId = "10000000-0000-4000-8000-000000000028";
    await client.query(`INSERT INTO "CourierPayout" ("operationId","tenantId","branchId","actorId","requestHash",total)
      VALUES ($1,$2,'main',$3,'test',0)`, [onlyAOperationId, demo, userA]);
    await client.query(`INSERT INTO "Sale" (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","tenantId")
      VALUES ($1,'FS-0000002',gen_random_uuid(),$2,0,0,0,0,0,now(),$3)`, [secondBSaleId, userB, other]);
    await expect(client.query(`INSERT INTO "CourierPayoutItem" (id,"tenantId","payoutId","saleId",fee)
      VALUES (gen_random_uuid(),$1,$2,$3,0)`, [other, onlyAOperationId, secondBSaleId]))
      .rejects.toMatchObject({ code: "23503", constraint: "CourierPayoutItem_tenantId_payoutId_fkey" });
    await expect(client.query(`INSERT INTO "Counter" (key,value,"tenantId") VALUES ('sale:main',2,$1)`, [other])).rejects.toThrow();
    const oldMode = process.env.PRODUCT_TENANCY;
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const app = await NestFactory.create(createAppModule(secret), { logger: false });
    try {
      app.setGlobalPrefix("api");
      await app.init();
      const jwt = new JwtService({ secret });
      const auth = (tenantId: string, userId: string, sid: string) =>
        "Bearer " + jwt.sign({ sub: userId, sid, type: "access", version: 0, tenantId });
      const http = supertest(app.getHttpServer());
      const a = auth(demo, userA, sessionA);
      const b = auth(other, userB, sessionB);
      expect((await http.get("/api/health/live")).status).toBe(200);
      expect((await http.get("/api/health")).status).toBe(200);
      expect((await http.get("/api/categories")).status).toBe(400);
      expect((await http.post("/api/auth/login").send({ login: "x", password: "x" })).status).toBe(400);
      expect((await http.post("/api/auth/login").set("x-tenant-id", other)
        .send({ login: "x", password: "x" })).status).toBe(400);
      expect(() => app.get(Database).brand.findMany()).toThrow("Falta el contexto de empresa");
      const { hashSync } = apiRequire("bcryptjs");
      await client.query(`UPDATE "User" SET "passwordHash"=$1 WHERE id=$2`, [hashSync("Clave solo para prueba B", 4), userB]);
      const loginB = await http.post("/api/auth/login").set("x-tenant-id", "otro-negocio")
        .send({ login: "qa-product@example.invalid", password: "Clave solo para prueba B" });
      expect(loginB.status).toBe(201);
      expect(loginB.body.user.tenantId).toBe(other);
      expect((await http.post("/api/auth/login").set("x-tenant-id", "demo")
        .send({ login: "qa-product@example.invalid", password: "Clave solo para prueba B" })).status).toBeGreaterThanOrEqual(400);
      const categoriesA = await http.get("/api/categories").set("Authorization", a);
      const categoriesB = await http.get("/api/categories").set("Authorization", b);
      expect(categoriesA.status).toBe(200);
      expect(categoriesB.status).toBe(200);
      expect(categoriesA.body.map((row: any) => row.name)).toContain("Categoría demo");
      expect(categoriesB.body.map((row: any) => row.name)).toEqual(["Categoría B"]);
      const productsB = await http.get("/api/products").set("Authorization", b);
      expect(productsB.status).toBe(200);
      expect(productsB.body.items.map((row: any) => row.name)).toEqual(["Producto B"]);
      const foreignDetail = await http.get(`/api/products/${productA}`).set("Authorization", b);
      expect(foreignDetail.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(foreignDetail.body)).not.toContain("Producto secreto A");
      expect((await http.get("/api/backups/status").set("Authorization", b)).status).toBe(404);
      expect((await http.get("/api/categories").set("Authorization", auth(demo, userB, sessionB))).status).toBe(401);
      const listed = await http.get("/api/reportes").set("Authorization", b);
      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(43);
      for (const { name } of listed.body) {
        const result = await http.get(`/api/reports/${name}`).set("Authorization", b);
        expect(result.status, `Reporte ${name}: ${JSON.stringify(result.body)}`).toBe(200);
        expect(JSON.stringify(result.body)).not.toContain("Producto secreto A");
      }
    } finally {
      await app.close();
      if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
      else process.env.PRODUCT_TENANCY = oldMode;
      if (oldUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = oldUrl;
    }
  } finally {
    await client?.end().catch(() => undefined);
    await db.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

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
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
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
    await client.query(`INSERT INTO "Tenant" (id, name, "updatedAt") VALUES ($1, 'Otro negocio', now())`, [other]);
    const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' AND tablename <> 'Tenant'`)).rows.map((r: any) => r.tablename);
    expect(tables).toHaveLength(58);
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
      await client.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,$2,ARRAY['*'],now(),$3)`, [roleId, `qa-product-${suffix}`, tenantId]);
      await client.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,$3,'test-only','test-only',$4,'main',now(),$5)`, [userId, `Admin ${suffix}`, `qa-product-${suffix}@example.invalid`, roleId, tenantId]);
      await client.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [sessionId, userId, tenantId]);
    }
    const categoryB = "10000000-0000-4000-8000-000000000016";
    await client.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Categoría B',now(),$2)`, [categoryB, other]);
    const productA = "10000000-0000-4000-8000-000000000017";
    await client.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Producto secreto A','QA-PRODUCT-A',$2,now(),$3)`, [productA, categoryId, demo]);
    await client.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Producto B','QA-PRODUCT-B',$2,now(),$3)`, ["10000000-0000-4000-8000-000000000018", categoryB, other]);
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
      const { hashSync } = apiRequire("bcryptjs");
      await client.query(`UPDATE "User" SET "passwordHash"=$1 WHERE id=$2`, [hashSync("Clave solo para prueba B", 4), userB]);
      const loginB = await http.post("/api/auth/login").set("x-tenant-id", other)
        .send({ login: "qa-product-b@example.invalid", password: "Clave solo para prueba B" });
      expect(loginB.status).toBe(201);
      expect(loginB.body.user.tenantId).toBe(other);
      expect((await http.post("/api/auth/login").set("x-tenant-id", demo)
        .send({ login: "qa-product-b@example.invalid", password: "Clave solo para prueba B" })).status).toBeGreaterThanOrEqual(400);
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
      expect(listed.body).toHaveLength(40);
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

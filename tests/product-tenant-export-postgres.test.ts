import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter, Database } from "../apps/api/src/common";
import { exportExcel, exportModels, exportTenant, exportTenantToFile } from "../apps/api/src/tenant-export";
import { tenantScope } from "../apps/api/src/tenant-context";
import { tenantObjectStore } from "../apps/api/src/tenant-object-store";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const a = "70000000-0000-4000-8000-000000000001";
const b = "70000000-0000-4000-8000-000000000002";

it("el Excel conserva textos largos por fragmentos y no ejecuta fórmulas suministradas por clientes", async () => {
  const tables = Object.fromEntries(exportModels().map(model => [model.name, []]));
  tables.Brand = [{ tenantId: a, id: "marca-1", name: "=HYPERLINK(\"https://example.invalid\")" }];
  tables.Settings = [{ tenantId: a, id: "main", data: { note: "x".repeat(70000) } }];
  const excel = await exportExcel({ formatVersion: 1, generatedAt: new Date().toISOString(), tenantId: a, tables,
    objects: { "billing/70000000-0000-4000-8000-000000000003": { mime: "image/png", sha256: "a".repeat(64), base64: Buffer.from("abc").toString("base64") } },
  });
  const workbook = new (apiRequire("exceljs").Workbook)();
  await workbook.xlsx.load(excel);
  expect(workbook.getWorksheet("Brand")?.getCell("C2").value).toBe("'=HYPERLINK(\"https://example.invalid\")");
  const chunks = workbook.getWorksheet("__valores_largos");
  expect(chunks?.rowCount).toBe(4);
  expect([2,3,4].map(row => String(chunks?.getCell(`E${row}`).value)).join("")).toBe(JSON.stringify({ note: "x".repeat(70000) }));
  expect(workbook.getWorksheet("__objetos")?.getCell("E2").value).toBe("YWJj");
});

async function port() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Sin puerto");
  await new Promise<void>(done => server.close(() => done()));
  return addr.port;
}

it("exporta todas las tablas de su empresa, nunca secretos ni datos ajenos, incluso suspendida", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-export-"));
  const pgPort = await port();
  const pg = new EmbeddedPostgres({
    databaseDir: directory, user: "export_qa", password: "local_test_only", port: pgPort,
    persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const prior = { DATABASE_URL: process.env.DATABASE_URL, PRODUCT_TENANCY: process.env.PRODUCT_TENANCY, PRODUCT_OBJECT_STORE_DIR: process.env.PRODUCT_OBJECT_STORE_DIR };
  let sql: any;
  let app: any;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("export_qa");
    process.env.DATABASE_URL = `postgresql://export_qa:local_test_only@127.0.0.1:${pgPort}/export_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], { cwd: root, env: process.env, timeout: 120000 });
    sql = pg.getPgClient("export_qa", "127.0.0.1"); await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,status,"updatedAt") VALUES ($1,'empresa-a','Empresa A','suspended',now()),($2,'empresa-b','Empresa B','active',now())`, [a,b]);
    for (const [id, tag, roleName, permissions] of [[a,"A","admin",["*"]],[b,"B","admin",["*"]]] as const) {
      await sql.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,now())`, [id,roleName,permissions]);
      const role = (await sql.query(`SELECT id FROM "Role" WHERE "tenantId"=$1`, [id])).rows[0].id;
      await sql.query(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,'secret-password-hash','secret-pin-hash',$4,'main',now())`, [id,`Owner ${tag}`,`owner${tag}@example.invalid`,role]);
      const user = (await sql.query(`SELECT id FROM "User" WHERE "tenantId"=$1`, [id])).rows[0].id;
      await sql.query(`INSERT INTO "AuthSession" (id,"tenantId","userId") VALUES (gen_random_uuid(),$1,$2)`, [id,user]);
      await sql.query(`INSERT INTO "Brand" (id,"tenantId",name) VALUES (gen_random_uuid(),$1,$2)`, [id,`Marca ${tag}`]);
      await sql.query(`INSERT INTO "Settings" (id,"tenantId",data,"updatedAt") VALUES ('main',$1,$2,now())`, [id, JSON.stringify({ shop: `Shop ${tag}`, apiKey: "secret-api-key", nested: { refreshToken: "secret-refresh-token" } })]);
    }
    await sql.query(`INSERT INTO "DriveBackup" (id,"tenantId","refreshTokenEnc") VALUES ('main',$1,'secret-oauth-token')`, [a]);
    const mcpUser = (await sql.query(`SELECT id FROM "User" WHERE "tenantId"=$1`, [a])).rows[0].id;
    const mcpSession = (await sql.query(`SELECT id FROM "AuthSession" WHERE "tenantId"=$1`, [a])).rows[0].id;
    await sql.query(`INSERT INTO "McpAuthorizationCode" (id,"tenantId","branchId","userId","sessionId","authVersion","clientId","redirectUri",challenge,"codeHash","expiresAt")
      VALUES (gen_random_uuid(),$1,'main',$2,$3,0,'client-qa','https://example.invalid/callback','secret-pkce-challenge','secret-mcp-code-hash',now()+interval '5 minutes')`, [a,mcpUser,mcpSession]);
    await sql.query(`UPDATE "Role" SET permissions=ARRAY['catalog:read'] WHERE "tenantId"=$1`, [b]);
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_OBJECT_STORE_DIR = join(directory, "objects");
    const objectKey = "billing/70000000-0000-4000-8000-000000000003";
    const objectBytes = Buffer.from("foto de comprobante ficticio");
    await tenantObjectStore().put(a, objectKey, objectBytes, "image/png");
    await sql.query(`INSERT INTO "BillingRequest" (id,"tenantId",plan,provider,amount,"proofObjectKey","proofMime","updatedAt")
      VALUES (gen_random_uuid(),$1,'basic','bank_transfer',100,$2,'image/png',now())`, [a, objectKey]);
    const db = new Database();
    await db.$connect();
    try {
      const snapshot = await tenantScope.run({ tenantId: a }, () => exportTenant(db, a));
      expect(Object.keys(snapshot.tables).sort()).toEqual(exportModels().map(model => model.name).sort());
      expect(snapshot.tables.Tenant).toHaveLength(1);
      expect(snapshot.tables.Brand).toHaveLength(1);
      expect(snapshot.tables.Brand[0].name).toBe("Marca A");
      const portable = JSON.stringify(snapshot);
      for (const secret of ["secret-password-hash","secret-pin-hash","secret-api-key","secret-refresh-token","secret-oauth-token","secret-pkce-challenge","secret-mcp-code-hash","Marca B","Empresa B"])
        expect(portable).not.toContain(secret);
      expect(portable).toContain("[RESERVADO]");
      expect(snapshot.objects?.[objectKey]?.base64).toBe(objectBytes.toString("base64"));
      const excel = await exportExcel(snapshot);
      const workbook = new (apiRequire("exceljs").Workbook)();
      await workbook.xlsx.load(excel);
      expect(workbook.getWorksheet("Brand")?.getCell("C2").value).toBe("Marca A");
      expect(workbook.worksheets.length).toBe(exportModels().length + 2);
      expect(workbook.getWorksheet("__objetos")?.getCell("E2").value).toBe(objectBytes.toString("base64"));
      expect(excel.toString("latin1")).not.toContain("secret-password-hash");
      await expect(tenantScope.run({ tenantId: b }, () => exportTenant(db, a))).rejects.toThrow("Empresa incorrecta");
      // Fail closed if an unmapped table is added in a migration.
      await sql.query(`CREATE TABLE "FutureBusinessTable" ("tenantId" uuid)`);
      await expect(tenantScope.run({ tenantId: a }, () => exportTenant(db, a))).rejects.toThrow("sobran FutureBusinessTable");
      await sql.query(`DROP TABLE "FutureBusinessTable"`);
    } finally { await db.$disconnect(); }

    const secret = "solo-test-exportacion-tenant-clave-larga";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api"); app.useGlobalFilters(new ApiExceptionFilter()); await app.init();
    const jwt = new JwtService({ secret });
    const token = async (id: string) => {
      const u = (await sql.query(`SELECT id FROM "User" WHERE "tenantId"=$1`, [id])).rows[0].id;
      const sid = (await sql.query(`SELECT id FROM "AuthSession" WHERE "tenantId"=$1`, [id])).rows[0].id;
      return "Bearer " + jwt.sign({ sub: u, sid, type: "access", version: 0, tenantId: id });
    };
    const http = supertest(app.getHttpServer());
    expect((await http.get("/api/tenant/export?format=json")).status).toBe(400);
    const admin = await http.get("/api/tenant/export?format=json").set("Authorization", await token(a));
    expect(admin.status, JSON.stringify(admin.body)).toBe(200);
    expect(admin.body.tables.Brand.map((row: any) => row.name)).toEqual(["Marca A"]);
    expect(admin.body.objects[objectKey].base64).toBe(objectBytes.toString("base64"));
    expect(admin.headers["cache-control"]).toContain("no-store");
    expect((await http.get("/api/tenant/export?format=json").set("Authorization", await token(b))).status).toBe(403);
    expect((await http.get("/api/tenant/export?format=csv").set("Authorization", await token(a))).status).toBe(400);

    // Regression: an export much larger than a page must use bounded FETCHes,
    // preserve tenant isolation, and produce valid JSON and XLSX without a
    // process-wide workbook or a LIMIT/OFFSET scan.
    await sql.query(`INSERT INTO "Brand" (id,"tenantId",name)
      SELECT gen_random_uuid(),$1,'Marca volumen ' || n::text FROM generate_series(1,1500) n`, [a]);
    await sql.query(`INSERT INTO "Brand" (id,"tenantId",name) VALUES (gen_random_uuid(),$1,'=2+2')`, [a]);
    await sql.query(`UPDATE "Settings" SET data=$2 WHERE "tenantId"=$1`, [a, JSON.stringify({ note: "x".repeat(70000) })]);
    const volumeDb = new Database(); await volumeDb.$connect();
    try {
      for (const format of ["json", "xlsx"] as const) {
        const file = await tenantScope.run({ tenantId: a }, () => exportTenantToFile(volumeDb, a, format));
        try {
          expect(file.maxRowsBuffered).toBeLessThanOrEqual(100);
          expect(file.rows).toBeGreaterThan(1500);
          if (format === "json") {
            const parsed = JSON.parse(await readFile(file.path, "utf8"));
            expect(parsed.tables.Brand).toHaveLength(1502);
            expect(JSON.stringify(parsed)).not.toContain("Marca B");
            expect(parsed.objects[objectKey].base64).toBe(objectBytes.toString("base64"));
          } else {
            const workbook = new (apiRequire("exceljs").Workbook)();
            await workbook.xlsx.readFile(file.path);
            expect(workbook.getWorksheet("Brand")?.rowCount).toBe(1503);
            const names = workbook.getWorksheet("Brand")!.getColumn(3).values;
            expect(names).toContain("Marca A");
            expect(names).toContain("'=2+2");
            expect(names).not.toContain("Marca B");
            expect(workbook.getWorksheet("__valores_largos")?.rowCount).toBeGreaterThanOrEqual(4);
            expect(workbook.getWorksheet("__objetos")?.getCell("E2").value).toBe(objectBytes.toString("base64"));
          }
        } finally { await rm(file.directory, { recursive: true, force: true }); }
      }
      await expect(tenantScope.run({ tenantId: b }, () => exportTenantToFile(volumeDb, a, "json"))).rejects.toThrow("Empresa incorrecta");
      const temporaryBefore = new Set((await readdir(tmpdir())).filter(name => name.startsWith("nexora-tenant-export-")));
      const aborted = new AbortController(); aborted.abort();
      await expect(tenantScope.run({ tenantId: a }, () => exportTenantToFile(volumeDb, a, "json", aborted.signal)))
        .rejects.toThrow("Exportación cancelada");
      const temporaryAfter = (await readdir(tmpdir())).filter(name => name.startsWith("nexora-tenant-export-"));
      expect(temporaryAfter.filter(name => !temporaryBefore.has(name))).toEqual([]);
      await tenantObjectStore().delete(a, objectKey);
      await expect(tenantScope.run({ tenantId: a }, () => exportTenantToFile(volumeDb, a, "json")))
        .rejects.toThrow();
      const afterMissing = (await readdir(tmpdir())).filter(name => name.startsWith("nexora-tenant-export-"));
      expect(afterMissing.filter(name => !temporaryBefore.has(name))).toEqual([]);
    } finally { await volumeDb.$disconnect(); }
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    if (prior.DATABASE_URL === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior.DATABASE_URL;
    if (prior.PRODUCT_TENANCY === undefined) delete process.env.PRODUCT_TENANCY; else process.env.PRODUCT_TENANCY = prior.PRODUCT_TENANCY;
    if (prior.PRODUCT_OBJECT_STORE_DIR === undefined) delete process.env.PRODUCT_OBJECT_STORE_DIR; else process.env.PRODUCT_OBJECT_STORE_DIR = prior.PRODUCT_OBJECT_STORE_DIR;
    await pg.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

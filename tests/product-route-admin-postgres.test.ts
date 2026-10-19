import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
const ids = {
  a: "00000000-0000-0000-0000-000000000001",
  b: "00000000-0000-0000-0000-000000000002",
  roleA: "60000000-0000-4000-8000-000000000001",
  roleB: "60000000-0000-4000-8000-000000000002",
  userA: "60000000-0000-4000-8000-000000000003",
  userB: "60000000-0000-4000-8000-000000000004",
  sessionA: "60000000-0000-4000-8000-000000000005",
  sessionB: "60000000-0000-4000-8000-000000000006",
};

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto PostgreSQL");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

/**
 * Distinct routes covered here: POST/PATCH customers, POST suppliers,
 * POST/PATCH expense-categories, POST/PATCH promotions, PUT settings,
 * PUT roles/:id, POST/PATCH users, PUT alert-rules, POST alerts/evaluate
 * (13 routes).
 * A 2xx response from a real valid body is required; a 400 never counts.
 */
it("aísla trece escrituras administrativas válidas entre dos empresas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-admin-tenant-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: dataDir, user: "admin_test", password: "admin_test_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.PRODUCT_TENANCY;
  let client: any;
  let app: any;
  try {
    await db.initialise();
    await db.start();
    await db.createDatabase("admin_tenants_test");
    const url = `postgresql://admin_test:admin_test_only@127.0.0.1:${port}/admin_tenants_test`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000,
    });
    client = db.getPgClient("admin_tenants_test", "127.0.0.1");
    await client.connect();
    await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [ids.b]);
    for (const [tenant, role, user, session, marker] of [
      [ids.a, ids.roleA, ids.userA, ids.sessionA, "A_ONLY_SECRET"],
      [ids.b, ids.roleB, ids.userB, ids.sessionB, "B_VISIBLE"],
    ]) {
      await client.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [role, tenant]);
      await client.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,$3,'test-only','test-only',$4,'main',now(),$5)`, [user, `Usuario ${marker}`, `${tenant}@example.invalid`, role, tenant]);
      await client.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [session, user, tenant]);
      await client.query(`INSERT INTO "Settings" (id,data,"updatedAt","tenantId") VALUES ('main',$1::jsonb,now(),$2)`, [JSON.stringify({ name: `Negocio ${marker}` }), tenant]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "admin-route-matrix-only-test-secret-2026";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const token = (tenant: string, user: string, session: string) =>
      "Bearer " + jwt.sign({ sub: user, sid: session, type: "access", version: 0, tenantId: tenant });
    const aToken = token(ids.a, ids.userA, ids.sessionA);
    const bToken = token(ids.b, ids.userB, ids.sessionB);
    const valid = (response: supertest.Response, route: string) => {
      expect([200, 201], `${route}: ${JSON.stringify(response.body)}`).toContain(response.status);
      expect(JSON.stringify(response.body), route).not.toContain("A_ONLY_SECRET");
    };
    const absentFromA = async (path: string, marker: string) => {
      const response = await http.get(path).set("Authorization", aToken);
      expect(response.status, `${path}: ${JSON.stringify(response.body)}`).toBe(200);
      expect(JSON.stringify(response.body), path).not.toContain(marker);
    };

    const customer = await http.post("/api/customers").set("Authorization", bToken).send({ name: "Cliente B_VISIBLE" });
    valid(customer, "POST customers");
    await absentFromA("/api/customers", "Cliente B_VISIBLE");
    const customerId = customer.body.id;
    const customerPatch = await http.patch(`/api/customers/${customerId}`).set("Authorization", bToken).send({ name: "Cliente B_VISIBLE editado" });
    valid(customerPatch, "PATCH customers/:id");
    const foreignCustomer = await http.patch(`/api/customers/${customerId}`).set("Authorization", aToken).send({ name: "Ataque A_ONLY_SECRET" });
    expect([403, 404], JSON.stringify(foreignCustomer.body)).toContain(foreignCustomer.status);

    const supplier = await http.post("/api/suppliers").set("Authorization", bToken).send({ name: "Proveedor B_VISIBLE" });
    valid(supplier, "POST suppliers");
    await absentFromA("/api/suppliers", "Proveedor B_VISIBLE");

    const category = await http.post("/api/expense-categories").set("Authorization", bToken).send({ name: "Categoría B_VISIBLE", monthlyBudget: 100 });
    valid(category, "POST expense-categories");
    await absentFromA("/api/expense-categories", "Categoría B_VISIBLE");
    const categoryPatch = await http.patch(`/api/expense-categories/${category.body.id}`).set("Authorization", bToken).send({ monthlyBudget: 150 });
    valid(categoryPatch, "PATCH expense-categories/:id");
    const foreignCategory = await http.patch(`/api/expense-categories/${category.body.id}`).set("Authorization", aToken).send({ monthlyBudget: 999 });
    expect([403, 404], JSON.stringify(foreignCategory.body)).toContain(foreignCategory.status);

    const promotion = await http.post("/api/promotions").set("Authorization", bToken).send({
      name: "Promoción B_VISIBLE", type: "percent", value: 10,
      startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", scope: {},
    });
    valid(promotion, "POST promotions");
    await absentFromA("/api/promotions", "Promoción B_VISIBLE");
    const promotionPatch = await http.patch(`/api/promotions/${promotion.body.id}`).set("Authorization", bToken).send({ active: false });
    valid(promotionPatch, "PATCH promotions/:id");
    const foreignPromotion = await http.patch(`/api/promotions/${promotion.body.id}`).set("Authorization", aToken).send({ active: true });
    expect([403, 404], JSON.stringify(foreignPromotion.body)).toContain(foreignPromotion.status);

    const config = {
      name: "Negocio B_VISIBLE cambiado", legalId: "", address: "", phone: "", currency: "DOP",
      taxIncluded: true, sellerDiscountLimit: 10, cardFeePercent: 0, returnDays: 7,
      idleDays: 30, expiryDays: 30, lowMargin: 15, cashDifferenceLimit: 100,
      receiptWidth: "80", sessionTimeoutMinutes: 30,
    };
    const settings = await http.put("/api/settings").set("Authorization", bToken).send(config);
    valid(settings, "PUT settings");
    await absentFromA("/api/settings", "Negocio B_VISIBLE cambiado");

    const role = await http.put(`/api/roles/${ids.roleB}`).set("Authorization", bToken).send({ permissions: ["*"] });
    valid(role, "PUT roles/:id");
    const foreignRole = await http.put(`/api/roles/${ids.roleB}`).set("Authorization", aToken).send({ permissions: ["*"] });
    expect([403, 404], JSON.stringify(foreignRole.body)).toContain(foreignRole.status);

    const user = await http.patch(`/api/users/${ids.userB}`).set("Authorization", bToken).send({ name: "Usuario B_VISIBLE editado" });
    valid(user, "PATCH users/:id");
    const foreignUser = await http.patch(`/api/users/${ids.userB}`).set("Authorization", aToken).send({ name: "Ataque A_ONLY_SECRET" });
    expect([403, 404], JSON.stringify(foreignUser.body)).toContain(foreignUser.status);

    const newUser = await http.post("/api/users").set("Authorization", bToken).send({
      name: "Nueva B_VISIBLE", username: "nueva-b", password: "SoloPrueba2026!", pin: "135790", roleId: ids.roleB,
    });
    valid(newUser, "POST users");
    await absentFromA("/api/users", "Nueva B_VISIBLE");

    const rules = await http.put("/api/alert-rules").set("Authorization", bToken).send({
      rules: [{ type: "B_VISIBLE", active: true, threshold: { count: 1 } }],
    });
    valid(rules, "PUT alert-rules");
    await absentFromA("/api/alert-rules", "B_VISIBLE");
    const evaluation = await http.post("/api/alerts/evaluate").set("Authorization", bToken).send({});
    valid(evaluation, "POST alerts/evaluate");
    expect(JSON.stringify(evaluation.body)).not.toContain("A_ONLY_SECRET");
  } finally {
    await app?.close().catch(() => undefined);
    if (previousMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = previousMode;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await client?.end().catch(() => undefined);
    await db.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

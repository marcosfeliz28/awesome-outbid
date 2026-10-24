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
import { passwordHash } from "../apps/api/src/auth";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const ids = {
  aRole: "80000000-0000-4000-8000-000000000001", bRole: "80000000-0000-4000-8000-000000000002",
  aSellerRole: "80000000-0000-4000-8000-000000000003", bSellerRole: "80000000-0000-4000-8000-000000000004",
  aAdmin: "80000000-0000-4000-8000-000000000005", bAdmin: "80000000-0000-4000-8000-000000000006",
  aSeller: "80000000-0000-4000-8000-000000000007", bSeller: "80000000-0000-4000-8000-000000000008",
};

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("login por código de empresa, refresh, cambio de clave y PIN aíslan identidades", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-auth-routes-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: dataDir, user: "auth_routes", password: "auth_routes_test_only", port,
    persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.PRODUCT_TENANCY;
  let sql: any;
  let app: any;
  try {
    await db.initialise();
    await db.start();
    await db.createDatabase("auth_routes_qa");
    const url = `postgresql://auth_routes:auth_routes_test_only@127.0.0.1:${port}/auth_routes_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000,
    });
    sql = db.getPgClient("auth_routes_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [B]);
    // La prueba de aislamiento necesita dos equipos aprobados por empresa.
    await sql.query(`UPDATE "Tenant" SET plan='pro' WHERE id IN ($1,$2)`, [A, B]);
    const adminPassword = "AdminPrueba2026!";
    const sellerTemporary = "348269";
    const sellerNew = "286437";
    const sellerPin = "583716";
    const adminHash = await passwordHash(adminPassword);
    const sellerHash = await passwordHash(sellerTemporary);
    const pinHash = await passwordHash(sellerPin);
    for (const [tenant, role, sellerRole, admin, seller, marker] of [
      [A, ids.aRole, ids.aSellerRole, ids.aAdmin, ids.aSeller, "A_ONLY_SECRET"],
      [B, ids.bRole, ids.bSellerRole, ids.bAdmin, ids.bSeller, "B_VISIBLE"],
    ]) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2),($3,'seller',ARRAY['sale:write','cash:write'],now(),$2)`, [role, tenant, sellerRole]);
      await sql.query(`INSERT INTO "User" (id,name,username,"usernameKey",email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,'admin','admin',$3,$4,$5,$6,'main',now(),$7)`, [admin, `Admin ${marker}`, `${tenant}@example.invalid`, adminHash, pinHash, role, tenant]);
      await sql.query(`INSERT INTO "User" (id,name,username,"usernameKey",email,"passwordHash","pinHash","roleId","branchId","mustChangePassword","updatedAt","tenantId") VALUES ($1,$2,'caja','caja',$3,$4,$5,$6,'main',true,now(),$7)`, [seller, `Caja ${marker}`, `${seller}@example.invalid`, sellerHash, pinHash, sellerRole, tenant]);
      await sql.query(`INSERT INTO "Settings" (id,data,"updatedAt","tenantId") VALUES ('main',$1::jsonb,now(),$2)`, [JSON.stringify({ name: `Empresa ${marker}`, sessionTimeoutMinutes: 30 }), tenant]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const secret = "auth-route-test-only-local-jwt-secret";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.use(apiRequire("cookie-parser")());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const ok = (response: supertest.Response, route: string) =>
      expect([200, 201], `${route}: ${JSON.stringify(response.body)}`).toContain(response.status);
    const login = (slug: string, username: string, password: string) =>
      http.post("/api/auth/login").set("x-tenant-id", slug).send({ login: username, password });

    const aAdmin = await login("demo", "admin", adminPassword);
    const bAdmin = await login("empresa-b", "admin", adminPassword);
    ok(aAdmin, "POST auth/login A");
    ok(bAdmin, "POST auth/login B");
    expect(aAdmin.body.user.name).toContain("A_ONLY_SECRET");
    expect(bAdmin.body.user.name).toContain("B_VISIBLE");
    expect(bAdmin.body.accessToken).not.toBe(aAdmin.body.accessToken);
    const bAccess = bAdmin.body.accessToken as string;
    const bCookies = (bAdmin.headers["set-cookie"] as unknown as string[]).map((value) => value.split(";")[0]);
    expect(bCookies.some((value) => value.startsWith("nexora_tenant="))).toBe(true);
    const refresh = await http.post("/api/auth/refresh").set("Cookie", bCookies).send({});
    ok(refresh, "POST auth/refresh");
    expect(refresh.body.user.name).toContain("B_VISIBLE");
    // JWT can be byte-identical if renewed within the same second; the
    // one-use refresh cookie is what must rotate.
    const rotatedCookies = (refresh.headers["set-cookie"] as unknown as string[]).map((value) => value.split(";")[0]);
    expect(rotatedCookies.find((value) => value.startsWith("fitstore_refresh=")))
      .not.toBe(bCookies.find((value) => value.startsWith("fitstore_refresh=")));
    const reusedRefresh = await http.post("/api/auth/refresh").set("Cookie", bCookies).send({});
    expect(reusedRefresh.status).toBe(400);

    const sellerLogin = await login("empresa-b", "caja", sellerTemporary);
    ok(sellerLogin, "POST auth/login clave temporal");
    expect(sellerLogin.body.requiresPasswordChange).toBe(true);
    const change = await http.post("/api/auth/change-password").set("x-tenant-id", "empresa-b").send({
      login: "caja", currentPassword: sellerTemporary, newPassword: sellerNew, confirmPassword: sellerNew,
    });
    ok(change, "POST auth/change-password");
    expect(change.body.user.name).toContain("B_VISIBLE");
    const aSellerState = await sql.query(`SELECT "mustChangePassword" FROM "User" WHERE id=$1`, [ids.aSeller]);
    expect(aSellerState.rows[0].mustChangePassword).toBe(true);

    const switched = await http.post("/api/auth/pin").set("Authorization", `Bearer ${bAccess}`)
      .send({ userId: ids.bSeller, pin: sellerPin });
    ok(switched, "POST auth/pin");
    expect(switched.body.user.name).toContain("B_VISIBLE");
    const foreignPin = await http.post("/api/auth/pin").set("Authorization", `Bearer ${bAccess}`)
      .send({ userId: ids.aSeller, pin: sellerPin });
    expect(foreignPin.status, JSON.stringify(foreignPin.body)).toBe(400);
    expect(foreignPin.body.message).toContain("PIN incorrecto");

    const newAdminPassword = "AdminNuevo2026!";
    const ownPassword = await http.post("/api/auth/password").set("Authorization", `Bearer ${bAccess}`).send({
      currentPassword: adminPassword, newPassword: newAdminPassword, confirmPassword: newAdminPassword,
    });
    ok(ownPassword, "POST auth/password");
    const oldB = await login("empresa-b", "admin", adminPassword);
    expect(oldB.status).toBe(400);
    const newB = await login("empresa-b", "admin", newAdminPassword);
    ok(newB, "POST auth/login clave nueva");
    const stillA = await login("demo", "admin", adminPassword);
    ok(stillA, "POST auth/login A intacto");

    // Exercise the real void-request workflow on three real sales, not an
    // invalid body or a hand-inserted request that bypasses business checks.
    const adminToken = `Bearer ${newB.body.accessToken}`;
    const sellerToken = `Bearer ${change.body.accessToken}`;
    const sellerTerminal = "80000000-0000-4000-8000-000000000020";
    const managerTerminal = "80000000-0000-4000-8000-000000000021";
    const register = (authorization: string, id: string, name: string) =>
      http.post("/api/terminals/register").set("Authorization", authorization)
        .send({ id, name, secret: `local-test-secret-${id}` });
    ok(await register(sellerToken, sellerTerminal, "Caja B"), "registro terminal cajera");
    ok(await register(adminToken, managerTerminal, "Gerencia B"), "registro terminal gerente");
    ok(await http.post(`/api/terminals/${sellerTerminal}/approve`).set("Authorization", adminToken).send({}), "aprobación terminal cajera");
    const cash = await http.post("/api/cash-sessions/open").set("Authorization", sellerToken)
      .send({ openingAmount: 100 });
    ok(cash, "apertura de caja propia");
    const category = await http.post("/api/categories").set("Authorization", adminToken)
      .send({ name: "Categoría B" });
    ok(category, "categoría propia");
    const product = await http.post("/api/products").set("Authorization", adminToken).send({
      name: "Producto B", sku: "SKU-B-QA", categoryId: category.body.id,
      variants: [{ sku: "VAR-B-QA", barcode: "BAR-B-QA", price: 20, costAvg: 10 }],
    });
    ok(product, "producto propio");
    const variantId = product.body.variants[0].id;
    ok(await http.post("/api/inventory/adjustments").set("Authorization", adminToken)
      .send({ variantId, qty: 5, reason: "Inventario inicial de prueba" }), "stock propio");
    const customer = await http.post("/api/customers").set("Authorization", adminToken)
      .send({ name: "Cliente B" });
    ok(customer, "cliente propio");
    const sales: string[] = [];
    for (let index = 1; index <= 3; index++) {
      const sale = await http.post("/api/sales").set("Authorization", sellerToken).send({
        offlineUuid: `80000000-0000-4000-8000-00000000003${index}`,
        customerId: customer.body.id, cashSessionId: cash.body.id,
        items: [{ variantId, qty: 1 }], payments: [{ method: "cash", amount: 20 }],
      });
      ok(sale, "venta propia válida");
      sales.push(sale.body.id);
    }
    // Existing A row makes cross-tenant denial meaningful.
    const foreignSaleId = "80000000-0000-4000-8000-000000000040";
    await sql.query(`INSERT INTO "Sale" (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","tenantId") VALUES ($1,'FS-A-1',$2,$3,20,0,0,20,10,now(),$4)`, [foreignSaleId, "80000000-0000-4000-8000-000000000041", ids.aSeller, A]);
    const sellerB = change.body.accessToken as string;
    const voidBody = (operationId: string) => ({ operationId, reasonCode: "customer_request", reason: "Cliente pidió anular venta de prueba" });
    const foreignRequest = await http.post(`/api/sales/${foreignSaleId}/void-requests`)
      .set("Authorization", `Bearer ${sellerB}`).send(voidBody("80000000-0000-4000-8000-000000000042"));
    expect([403, 404], JSON.stringify(foreignRequest.body)).toContain(foreignRequest.status);
    const requests: string[] = [];
    for (let index = 0; index < sales.length; index++) {
      const response = await http.post(`/api/sales/${sales[index]}/void-requests`)
        .set("Authorization", sellerToken)
        .send(voidBody(`80000000-0000-4000-8000-00000000005${index}`));
      ok(response, "POST sales/:id/void-requests");
      requests.push(response.body.id);
    }
    const foreignCancel = await http.post(`/api/void-requests/${requests[0]}/cancel`)
      .set("Authorization", `Bearer ${stillA.body.accessToken}`).send({});
    expect([403, 404], JSON.stringify(foreignCancel.body)).toContain(foreignCancel.status);
    ok(await http.post(`/api/void-requests/${requests[0]}/cancel`).set("Authorization", sellerToken).send({}), "POST void-requests/:id/cancel");
    const foreignReject = await http.post(`/api/void-requests/${requests[1]}/reject`)
      .set("Authorization", `Bearer ${stillA.body.accessToken}`).send({ note: "Rechazo de revisión externa" });
    expect([403, 404], JSON.stringify(foreignReject.body)).toContain(foreignReject.status);
    ok(await http.post(`/api/void-requests/${requests[1]}/reject`).set("Authorization", adminToken)
      .send({ note: "No corresponde anular esta venta" }), "POST void-requests/:id/reject");
    const foreignApprove = await http.post(`/api/void-requests/${requests[2]}/approve`)
      .set("Authorization", `Bearer ${stillA.body.accessToken}`).send({});
    expect([403, 404], JSON.stringify(foreignApprove.body)).toContain(foreignApprove.status);
    ok(await http.post(`/api/void-requests/${requests[2]}/approve`).set("Authorization", adminToken).send({}), "POST void-requests/:id/approve");
    expect((await sql.query(`SELECT status FROM "Sale" WHERE id=$1`, [sales[2]])).rows[0].status).toBe("voided");
    expect((await sql.query(`SELECT status FROM "Sale" WHERE id=$1`, [foreignSaleId])).rows[0].status).toBe("completed");
  } finally {
    await app?.close().catch(() => undefined);
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = previousMode;
    await sql?.end().catch(() => undefined);
    await db.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);

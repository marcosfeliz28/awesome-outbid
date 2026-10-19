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
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const ids = {
  roleA: "70000000-0000-4000-8000-000000000001", roleB: "70000000-0000-4000-8000-000000000002",
  userA: "70000000-0000-4000-8000-000000000003", userB: "70000000-0000-4000-8000-000000000004",
  sessionA: "70000000-0000-4000-8000-000000000005", sessionB: "70000000-0000-4000-8000-000000000006",
  customerA: "70000000-0000-4000-8000-000000000007", customerB: "70000000-0000-4000-8000-000000000008",
  expenseCategoryA: "70000000-0000-4000-8000-000000000009", expenseCategoryB: "70000000-0000-4000-8000-000000000010",
  alertA: "70000000-0000-4000-8000-000000000011", alertB: "70000000-0000-4000-8000-000000000012",
  targetA: "70000000-0000-4000-8000-000000000013", targetB: "70000000-0000-4000-8000-000000000014",
  categoryB: "70000000-0000-4000-8000-000000000015",
  productB: "70000000-0000-4000-8000-000000000016",
  variantB: "70000000-0000-4000-8000-000000000017",
};

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

/** Extra routes not exercised by matrix/export/admin/money/inventory. */
it("aísla alertas, gastos, anonimización, usuarios y cotizaciones", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-admin-extra-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: dataDir, user: "admin_extra", password: "admin_extra_test_only", port,
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
    await db.createDatabase("admin_extra_qa");
    const url = `postgresql://admin_extra:admin_extra_test_only@127.0.0.1:${port}/admin_extra_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000,
    });
    sql = db.getPgClient("admin_extra_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [B]);
    for (const [tenant, role, user, session, customer, expenseCategory, alert, target, marker] of [
      [A, ids.roleA, ids.userA, ids.sessionA, ids.customerA, ids.expenseCategoryA, ids.alertA, ids.targetA, "A_ONLY_SECRET"],
      [B, ids.roleB, ids.userB, ids.sessionB, ids.customerB, ids.expenseCategoryB, ids.alertB, ids.targetB, "B_VISIBLE"],
    ]) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [role, tenant]);
      for (const [id, name] of [[user, `Admin ${marker}`], [target, `Objetivo ${marker}`]])
        await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,$3,'test-only','test-only',$4,'main',now(),$5)`, [id, name, `${id}@example.invalid`, role, tenant]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [session, user, tenant]);
      await sql.query(`INSERT INTO "Settings" (id,data,"updatedAt","tenantId") VALUES ('main',$1::jsonb,now(),$2)`, [JSON.stringify({ name: marker }), tenant]);
      await sql.query(`INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`, [customer, `Cliente ${marker}`, tenant]);
      await sql.query(`INSERT INTO "ExpenseCategory" (id,name,"tenantId") VALUES ($1,$2,$3)`, [expenseCategory, `Categoría ${marker}`, tenant]);
      await sql.query(`INSERT INTO "Alert" (id,key,type,severity,"entityId",message,"updatedAt","tenantId") VALUES ($1,$2,'low_stock','warning',$3,$4,now(),$5)`, [alert, `alert-${marker}`, user, `Aviso ${marker}`, tenant]);
    }
    await sql.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Categoría B',now(),$2)`, [ids.categoryB, B]);
    await sql.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Producto B','SKU-EXTRA-B',$2,now(),$3)`, [ids.productB, ids.categoryB, B]);
    await sql.query(`INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,"updatedAt","tenantId") VALUES ($1,$2,'VAR-EXTRA-B','BAR-EXTRA-B',10,20,now(),$3)`, [ids.variantB, ids.productB, B]);
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "admin-extra-test-only-local-token-secret";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = new JwtService({ secret });
    const token = (tenant: string, user: string, session: string) =>
      "Bearer " + jwt.sign({ sub: user, sid: session, type: "access", version: 0, tenantId: tenant });
    const a = token(A, ids.userA, ids.sessionA);
    const b = token(B, ids.userB, ids.sessionB);
    const http = supertest(app.getHttpServer());
    const ok = (response: supertest.Response, route: string) =>
      expect([200, 201], `${route}: ${JSON.stringify(response.body)}`).toContain(response.status);
    const denied = (response: supertest.Response, route: string) =>
      expect([403, 404], `${route}: ${JSON.stringify(response.body)}`).toContain(response.status);

    const alert = await http.patch(`/api/alerts/${ids.alertB}`).set("Authorization", b).send({ status: "seen" });
    ok(alert, "PATCH alerts/:id");
    denied(await http.patch(`/api/alerts/${ids.alertA}`).set("Authorization", b).send({ status: "seen" }), "PATCH alerts/:id extranjero");
    expect((await sql.query(`SELECT status FROM "Alert" WHERE id=$1`, [ids.alertA])).rows[0].status).toBe("new");

    const expenseBody = { categoryId: ids.expenseCategoryB, amount: 25, description: "Gasto B_VISIBLE", method: "transfer" };
    const expense = await http.post("/api/expenses").set("Authorization", b).send(expenseBody);
    ok(expense, "POST expenses");
    const foreignExpense = await http.post("/api/expenses").set("Authorization", b).send({ ...expenseBody, categoryId: ids.expenseCategoryA });
    // Foreign-key tenant trigger reports an integrity conflict, not a Zod 400.
    expect(foreignExpense.status, JSON.stringify(foreignExpense.body)).toBe(409);
    expect(foreignExpense.body.code).toBe("CONSTRAINT_VIOLATION");
    const expensesA = await http.get("/api/expenses").set("Authorization", a);
    expect(JSON.stringify(expensesA.body)).not.toContain("Gasto B_VISIBLE");
    const voided = await http.post(`/api/expenses/${expense.body.id}/void`).set("Authorization", b).send({ reason: "Anulación de prueba" });
    ok(voided, "POST expenses/:id/void");
    denied(await http.post(`/api/expenses/${expense.body.id}/void`).set("Authorization", a).send({ reason: "Intento ajeno" }), "POST expenses/:id/void extranjero");

    const anonymized = await http.post(`/api/customers/${ids.customerB}/anonymize`).set("Authorization", b)
      .send({ reason: "Solicitud de prueba", requestRef: "QA-2026-B" });
    ok(anonymized, "POST customers/:id/anonymize");
    denied(await http.post(`/api/customers/${ids.customerA}/anonymize`).set("Authorization", b)
      .send({ reason: "Solicitud ajena", requestRef: "QA-2026-A" }), "POST customers/:id/anonymize extranjero");
    expect((await sql.query(`SELECT "anonymizedAt" FROM "Customer" WHERE id=$1`, [ids.customerA])).rows[0].anonymizedAt).toBeNull();

    const reset = await http.post(`/api/users/${ids.targetB}/reset-password`).set("Authorization", b).send({ password: "SoloPrueba2026!" });
    ok(reset, "POST users/:id/reset-password");
    denied(await http.post(`/api/users/${ids.targetA}/reset-password`).set("Authorization", b).send({ password: "SoloPrueba2026!" }), "POST users/:id/reset-password extranjero");

    const quoteBody = { items: [{ variantId: ids.variantB, qty: 1 }] };
    const quote = await http.post("/api/quotes").set("Authorization", b).send(quoteBody);
    ok(quote, "POST quotes");
    const quotesA = await http.get("/api/quotes").set("Authorization", a);
    expect(JSON.stringify(quotesA.body)).not.toContain(quote.body.id);
    const foreignConvert = await http.post(`/api/quotes/${quote.body.id}/convert`).set("Authorization", a).send({});
    denied(foreignConvert, "POST quotes/:id/convert extranjero");
    const converted = await http.post(`/api/quotes/${quote.body.id}/convert`).set("Authorization", b).send({});
    ok(converted, "POST quotes/:id/convert");

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lNcAAAAASUVORK5CYII=", "base64");
    const logo = await http.post("/api/settings/logo").set("Authorization", b).attach("file", png, "marca.png");
    ok(logo, "POST settings/logo");
    expect(logo.body.logo).toMatch(/^data:image\/png;base64,/);
    const settingsA = await http.get("/api/settings").set("Authorization", a);
    expect(settingsA.body.logo).toBeUndefined();

    const terminalA = "70000000-0000-4000-8000-000000000020";
    const terminalB = "70000000-0000-4000-8000-000000000021";
    const terminalB2 = "70000000-0000-4000-8000-000000000022";
    const secretA = "solo-test-terminal-a-2026";
    const secretB = "solo-test-terminal-b-2026";
    ok(await http.post("/api/terminals/register").set("Authorization", a)
      .send({ id: terminalA, name: "Equipo A_ONLY_SECRET", secret: secretA }), "POST terminals/register A");
    ok(await http.post("/api/terminals/register").set("Authorization", b)
      .send({ id: terminalB, name: "Equipo B_VISIBLE", secret: secretB }), "POST terminals/register B");
    const terminalListB = await http.get("/api/terminals").set("Authorization", b);
    expect(JSON.stringify(terminalListB.body)).not.toContain("A_ONLY_SECRET");
    denied(await http.post(`/api/terminals/${terminalA}/approve`).set("Authorization", b).send({}), "POST terminals/:id/approve extranjero");
    ok(await http.post(`/api/terminals/${terminalB}/approve`).set("Authorization", b).send({}), "POST terminals/:id/approve propio");
    denied(await http.post(`/api/terminals/${terminalA}/rename`).set("Authorization", b).send({ name: "Ataque A" }), "POST terminals/:id/rename extranjero");
    ok(await http.post(`/api/terminals/${terminalB}/rename`).set("Authorization", b).send({ name: "Equipo B_VISIBLE editado" }), "POST terminals/:id/rename propio");
    const registerInfo = { registerNumber: 4021, registerName: "Caja B_VISIBLE" };
    denied(await http.patch(`/api/terminals/${terminalA}/register`).set("Authorization", b).send(registerInfo), "PATCH terminals/:id/register extranjero");
    ok(await http.patch(`/api/terminals/${terminalB}/register`).set("Authorization", b).send(registerInfo), "PATCH terminals/:id/register propio");
    denied(await http.post(`/api/terminals/${terminalA}/revoke`).set("Authorization", b).send({}), "POST terminals/:id/revoke extranjero");
    ok(await http.post("/api/terminals/register").set("Authorization", b)
      .send({ id: terminalB2, name: "Equipo B segundo", secret: secretB }), "POST terminals/register B segundo");
    ok(await http.post(`/api/terminals/${terminalB}/revoke`).set("Authorization", b).send({}), "POST terminals/:id/revoke propio");
    const terminalAState = await sql.query(`SELECT "revokedAt",name FROM "Terminal" WHERE id=$1`, [terminalA]);
    expect(terminalAState.rows[0].revokedAt).toBeNull();
    expect(terminalAState.rows[0].name).toBe("Equipo A_ONLY_SECRET");

    // Logout is intentionally last: it invalidates B's session. A must stay live.
    ok(await http.post("/api/auth/logout").set("Authorization", b).send({}), "POST auth/logout");
    expect((await sql.query(`SELECT id FROM "AuthSession" WHERE id=$1`, [ids.sessionB])).rows).toHaveLength(0);
    const aSession = await http.get("/api/auth/me").set("Authorization", a);
    expect(aSession.status).toBe(200);
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

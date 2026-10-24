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
import { pkceChallenge } from "../apps/api/src/mcp-oauth-core";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const actor = {
  aRole: "67000000-0000-4000-8000-000000000001", bRole: "67000000-0000-4000-8000-000000000002",
  aUser: "67000000-0000-4000-8000-000000000003", bUser: "67000000-0000-4000-8000-000000000004",
  aSession: "67000000-0000-4000-8000-000000000005", bSession: "67000000-0000-4000-8000-000000000006",
};
async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto PostgreSQL");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("MCP OAuth usa PKCE, código único, RLS y herramientas de solo lectura", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-mcp-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({ databaseDir: dataDir, user: "mcp_test", password: "mcp_local_only", port,
    persistent: false, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"], onLog: () => undefined, onError: () => undefined });
  const keys = ["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_MCP_ENABLED", "MCP_TOKEN_SECRET", "MCP_OAUTH_CLIENTS", "APP_PUBLIC_URL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let sql: any;
  let app: any;
  try {
    await db.initialise(); await db.start(); await db.createDatabase("mcp_qa");
    const url = `postgresql://mcp_test:mcp_local_only@127.0.0.1:${port}/mcp_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000,
    });
    sql = db.getPgClient("mcp_qa", "127.0.0.1"); await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'mcp-b','Empresa B',now())`, [B]);
    for (const [tenant, role, user, session, total, marker] of [
      [A, actor.aRole, actor.aUser, actor.aSession, 99, "A_ONLY_SECRET"],
      [B, actor.bRole, actor.bUser, actor.bSession, 42, "B_VISIBLE"],
    ] as const) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [role, tenant]);
      await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,$3,'test-only','test-only',$4,'main',now(),$5)`, [user, `Usuario ${marker}`, `${user}@example.invalid`, role, tenant]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [session, user, tenant]);
      await sql.query(`INSERT INTO "Settings" (id,data,"updatedAt","tenantId") VALUES ('main','{}'::jsonb,now(),$1)`, [tenant]);
      await sql.query(`INSERT INTO "Sale" (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","tenantId","branchId") VALUES (gen_random_uuid(),$1,gen_random_uuid(),$2,$3,0,0,$3,0,now(),$4,'main')`, [marker, user, total, tenant]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_MCP_ENABLED = "enabled";
    process.env.MCP_TOKEN_SECRET = "mcp-test-secret-only-for-disposable-db-2026";
    process.env.MCP_OAUTH_CLIENTS = JSON.stringify([{ id: "client-qa", name: "Cliente de prueba", redirectUris: ["https://client.example/callback"] }]);
    process.env.APP_PUBLIC_URL = "http://127.0.0.1:4173";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "mcp-main-test-only-jwt-secret";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api"); app.useGlobalFilters(new ApiExceptionFilter()); await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const auth = (tenant: string, user: string, session: string) =>
      "Bearer " + jwt.sign({ sub: user, sid: session, type: "access", version: 0, tenantId: tenant });
    const verifier = "a".repeat(43);
    const approval = { response_type: "code", client_id: "client-qa", redirect_uri: "https://client.example/callback",
      code_challenge: pkceChallenge(verifier), code_challenge_method: "S256", scope: "read", state: "safe-state-123" };
    const bAuth = auth(B, actor.bUser, actor.bSession);
    expect((await http.get("/api/mcp/oauth/metadata")).body.scopes_supported).toEqual(["read"]);
    expect((await http.get("/api/mcp/oauth/client").query(approval)).body.name).toBe("Cliente de prueba");
    expect((await http.post("/api/mcp/oauth/authorize").set("Authorization", bAuth)
      .send({ ...approval, redirect_uri: "https://client.example.evil/callback" })).status).toBe(400);
    const granted = await http.post("/api/mcp/oauth/authorize").set("Authorization", bAuth).send(approval);
    expect([200, 201], JSON.stringify(granted.body)).toContain(granted.status);
    const redirect = new URL(granted.body.redirectTo);
    expect(redirect.origin).toBe("https://client.example");
    expect(redirect.searchParams.get("state")).toBe(approval.state);
    const code = redirect.searchParams.get("code")!;
    await sql.query("BEGIN");
    try {
      await sql.query("SET LOCAL ROLE nexora_tenant_runtime");
      await sql.query("SELECT set_config('app.tenant_id', $1, true)", [A]);
      const foreign = await sql.query(`SELECT count(*)::int AS n FROM "McpAuthorizationCode"`);
      expect(foreign.rows[0].n).toBe(0);
    } finally { await sql.query("ROLLBACK"); }
    const exchange = { grant_type: "authorization_code", client_id: approval.client_id,
      redirect_uri: approval.redirect_uri, code, code_verifier: verifier };
    expect((await http.post("/api/mcp/oauth/token").send({ ...exchange, code_verifier: "b".repeat(43) })).status).toBe(401);
    const token = await http.post("/api/mcp/oauth/token").send(exchange);
    expect([200, 201], JSON.stringify(token.body)).toContain(token.status);
    expect(token.body.scope).toBe("read");
    expect((await http.post("/api/mcp/oauth/token").send(exchange)).status).toBe(401);
    const bearer = "Bearer " + token.body.access_token;
    const list = await http.post("/api/mcp").set("Authorization", bearer).send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(list.status).toBe(200);
    expect(list.body.result.tools.map((tool: any) => tool.name)).toEqual(["ventas_hoy", "stock_bajo"]);
    const call = await http.post("/api/mcp").set("Authorization", bearer).send({ jsonrpc: "2.0", id: 2,
      method: "tools/call", params: { name: "ventas_hoy", arguments: {} } });
    expect(call.status, JSON.stringify(call.body)).toBe(200);
    expect(JSON.parse(call.body.result.content[0].text)).toMatchObject({ facturas: 1, totalFacturado: 42 });
    expect(JSON.stringify(call.body)).not.toContain("A_ONLY_SECRET");
    expect((await http.post("/api/mcp").set("Authorization", bearer).send({ jsonrpc: "2.0", id: 3,
      method: "tools/call", params: { name: "ajustar_stock", arguments: {} } })).status).toBe(400);
    expect(token.body.expires_in).toBe(900);
    await sql.query(`UPDATE "AuthSession" SET "lastActivityAt" = now() - interval '2 hours' WHERE id=$1`, [actor.bSession]);
    expect((await http.post("/api/mcp").set("Authorization", bearer).send({ jsonrpc: "2.0", id: 31, method: "tools/list" })).status).toBe(401);
    await sql.query(`UPDATE "AuthSession" SET "lastActivityAt" = now() WHERE id=$1`, [actor.bSession]);
    expect((await http.post("/api/mcp").set("Authorization", bearer).send({ jsonrpc: "2.0", id: 32, method: "tools/list" })).status).toBe(200);
    await sql.query(`UPDATE "User" SET "authVersion" = "authVersion" + 1 WHERE id=$1`, [actor.bUser]);
    expect((await http.post("/api/mcp").set("Authorization", bearer).send({ jsonrpc: "2.0", id: 4, method: "tools/list" })).status).toBe(401);
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    await db.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true });
    for (const key of keys) { const value = previous[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

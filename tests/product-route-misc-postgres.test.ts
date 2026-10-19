import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
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
const { hashSync } = apiRequire("bcryptjs");
const run = promisify(execFile);
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenants = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto disponible");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("el PIN de equipos y las pruebas Telegram no cruzan empresas", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-route-misc-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir, user: "misc_route_qa", password: "misc_route_qa_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const saved = Object.fromEntries(
    ["DATABASE_URL", "PRODUCT_TENANCY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY", "NEXORA_RETENTION"].map(
      (name) => [name, process.env[name]],
    ),
  );
  let sql: any;
  let app: any;
  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("misc_route_qa");
    const url = `postgresql://misc_route_qa:misc_route_qa_only@127.0.0.1:${port}/misc_route_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000,
    });
    sql = postgres.getPgClient("misc_route_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-misc-b','Empresa B',now())`, [tenants[1]]);
    const cases = tenants.map((tenantId, i) => ({
      tenantId, roleId: id(700 + i), userId: id(710 + i), terminalId: id(720 + i), sessionId: id(730 + i),
    }));
    const pin = "847295"; // PIN sintético de prueba, nunca de una usuaria real.
    for (const [i, row] of cases.entries()) {
      await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test',$4,$5,now(),$6)`, [row.userId, `Admin ${i}`, `misc-${i}@example.invalid`, hashSync(pin, 4), row.roleId, row.tenantId]);
      await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","secretHash","tenantId") VALUES ($1,$2,'main','test',$3)`, [row.terminalId, `Equipo ${i}`, row.tenantId]);
      await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [row.sessionId, row.userId, row.terminalId, row.tenantId]);
    }
    const [a, b] = cases;
    const bTerminal2 = id(740);
    await sql.query(`INSERT INTO "Terminal" (id,name,"branchId","secretHash","tenantId") VALUES ($1,'Equipo B2','main','test',$2)`, [bTerminal2, b.tenantId]);
    const cashierRole = id(741), cashierUser = id(742), cashierSession = id(743);
    await sql.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Cajero',ARRAY['sale:write'],now(),$2)`, [cashierRole, b.tenantId]);
    await sql.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,'Caja B','caja-misc@example.invalid','test','test',$2,now(),$3)`, [cashierUser, cashierRole, b.tenantId]);
    await sql.query(`INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`, [cashierSession, cashierUser, b.terminalId, b.tenantId]);

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-misc-solo-pruebas";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const send = (request: any, row = b, userId = row.userId, sessionId = row.sessionId) =>
      request.set("Authorization", "Bearer " + jwt.sign({ sub: userId, sid: sessionId, type: "access", version: 0, tenantId: row.tenantId }));

    const foreignPin = await send(http.post(`/api/terminals/${a.terminalId}/approve-with-pin`).send({ managerPin: pin }));
    expect(foreignPin.status, JSON.stringify(foreignPin.body)).toBe(403);
    const ownPin = await send(http.post(`/api/terminals/${b.terminalId}/approve-with-pin`).send({ managerPin: pin }));
    expect(ownPin.status, JSON.stringify(ownPin.body)).toBe(201);
    const states = await sql.query(`SELECT id,"approvedAt" FROM "Terminal" WHERE id IN ($1,$2) ORDER BY "tenantId"`, [a.terminalId, b.terminalId]);
    expect(states.rows[0].approvedAt).toBeNull();
    expect(states.rows[1].approvedAt).not.toBeNull();

    // Se habilita después de arrancar el módulo: el trabajador de envío no se
    // registró, por lo que esta prueba nunca contacta a Telegram. Se verifica
    // el encolado real de Nest/Prisma, separado por tenant.
    process.env.TELEGRAM_BOT_TOKEN = "bot-local-sin-red";
    process.env.TELEGRAM_CHAT_ID = "chat-local-sin-red";
    const deniedTelegram = await send(http.post("/api/notifications/telegram/test"), b, cashierUser, cashierSession);
    expect(deniedTelegram.status, JSON.stringify(deniedTelegram.body)).toBe(403);
    const aTelegram = await send(http.post("/api/notifications/telegram/test"), a);
    const bTelegram = await send(http.post("/api/notifications/telegram/test"));
    expect(aTelegram.status, JSON.stringify(aTelegram.body)).toBe(201);
    expect(bTelegram.status, JSON.stringify(bTelegram.body)).toBe(201);
    expect(aTelegram.body).toMatchObject({ enabled: true, queued: true });
    expect(bTelegram.body).toMatchObject({ enabled: true, queued: true });
    const queued = await sql.query(`SELECT "tenantId",count(*)::int AS n FROM "NotificationOutbox" WHERE "eventType"='test' GROUP BY "tenantId" ORDER BY "tenantId"`);
    expect(queued.rows).toEqual([{ tenantId: a.tenantId, n: 1 }, { tenantId: b.tenantId, n: 1 }]);

    const foreignApprove = await send(http.post(`/api/terminals/${a.terminalId}/approve`));
    expect([403, 404]).toContain(foreignApprove.status);
    const ownApprove = await send(http.post(`/api/terminals/${bTerminal2}/approve`));
    expect(ownApprove.status, JSON.stringify(ownApprove.body)).toBe(201);
    const foreignRename = await send(http.post(`/api/terminals/${a.terminalId}/rename`).send({ name: "Nombre cambiado" }));
    expect([403, 404]).toContain(foreignRename.status);
    const ownRename = await send(http.post(`/api/terminals/${bTerminal2}/rename`).send({ name: "Nombre cambiado" }));
    expect(ownRename.status, JSON.stringify(ownRename.body)).toBe(201);
    const foreignRevoke = await send(http.post(`/api/terminals/${a.terminalId}/revoke`));
    expect([403, 404]).toContain(foreignRevoke.status);
    const ownRevoke = await send(http.post(`/api/terminals/${bTerminal2}/revoke`));
    expect(ownRevoke.status, JSON.stringify(ownRevoke.body)).toBe(201);
    const b2 = (await sql.query(`SELECT name,"revokedAt" FROM "Terminal" WHERE id=$1`, [bTerminal2])).rows[0];
    expect(b2.name).toBe("Nombre cambiado");
    expect(b2.revokedAt).not.toBeNull();
    expect((await sql.query(`SELECT "revokedAt" FROM "Terminal" WHERE id=$1`, [a.terminalId])).rows[0].revokedAt).toBeNull();
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await postgres.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}, 180_000);

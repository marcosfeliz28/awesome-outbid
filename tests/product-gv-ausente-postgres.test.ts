// GV Makeup Studio es de la tienda: en el producto (PRODUCT_TENANCY=required)
// sus rutas no se registran. Esta prueba convierte esa ausencia en garantía:
// con una sesión válida de administración, las rutas GV responden 404 y una
// ruta normal (control) responde 200. La cobertura GV corre en modo tienda
// (vitest.integration.config.ts).
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
import { DEMO_TENANT_ID } from "../apps/api/src/tenant-context";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Sin puerto disponible");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("en el producto las rutas GV no existen (404) y una ruta normal sí responde", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-product-gv-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "gv_absent_qa",
    password: "gv_absent_qa_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const saved = Object.fromEntries(
    [
      "DATABASE_URL",
      "PRODUCT_TENANCY",
      "TELEGRAM_BOT_TOKEN",
      "RESEND_API_KEY",
      "NEXORA_RETENTION",
    ].map((name) => [name, process.env[name]]),
  );
  let sql: any;
  let app: any;
  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("gv_absent_qa");
    const url = `postgresql://gv_absent_qa:gv_absent_qa_only@127.0.0.1:${port}/gv_absent_qa`;
    await run(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "deploy",
        "--schema",
        join(root, "apps/api/prisma/schema.prisma"),
      ],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: url },
        timeout: 120_000,
      },
    );
    sql = postgres.getPgClient("gv_absent_qa", "127.0.0.1");
    await sql.connect();
    const [roleId, userId, terminalId, sessionId] = [
      id(900),
      id(901),
      id(902),
      id(903),
    ];
    await sql.query(
      `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
      [roleId, DEMO_TENANT_ID],
    );
    await sql.query(
      `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,'Admin','gv-absent@example.invalid','test','test',$2,now(),$3)`,
      [userId, roleId, DEMO_TENANT_ID],
    );
    await sql.query(
      `INSERT INTO "Terminal" (id,name,"branchId","secretHash","tenantId") VALUES ($1,'Equipo','main','test',$2)`,
      [terminalId, DEMO_TENANT_ID],
    );
    await sql.query(
      `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
      [sessionId, userId, terminalId, DEMO_TENANT_ID],
    );

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-gv-ausente-solo-pruebas";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const token = new JwtService({ secret }).sign({
      sub: userId,
      sid: sessionId,
      type: "access",
      version: 0,
      tenantId: DEMO_TENANT_ID,
    });
    const send = (request: any) =>
      request.set("Authorization", "Bearer " + token);

    // Control: la sesión es válida, así que un 404 no es un 401/403 disfrazado.
    const me = await send(http.get("/api/auth/me"));
    expect(me.status, JSON.stringify(me.body)).toBe(200);
    for (const [method, path] of [
      ["get", "/api/gv/catalog"],
      ["get", "/api/gv/courses"],
      ["post", "/api/gv/courses"],
      ["post", "/api/gv/enrollments"],
      ["get", "/api/gv/appointments"],
      ["post", "/api/gv/appointments"],
      ["get", "/api/gv/leads"],
      ["get", "/api/gv/cash/current"],
      ["post", "/api/gv/cash/open"],
      ["post", "/api/gv/cash/close"],
    ] as const) {
      const response = await send(http[method](path).send({}));
      expect(
        response.status,
        `${method.toUpperCase()} ${path}: ${JSON.stringify(response.body)}`,
      ).toBe(404);
    }
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    await postgres.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}, 180_000);

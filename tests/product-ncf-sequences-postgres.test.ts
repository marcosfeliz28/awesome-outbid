import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { ncfSequenceWarnings } from "../apps/api/src/ncf-sequences";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const tenantA = "e1000000-0000-4000-8000-000000000001";
const tenantB = "e1000000-0000-4000-8000-000000000002";
const DAY = 86_400_000;

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto de prueba");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("PC-13: avisa con 19 números o 15 días, aísla empresas y deniega cajera/gerente", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-pc13-"));
  const pgPort = await freePort();
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "pc13_test", password: "only_local_test",
    port: pgPort, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined });
  const saved = Object.fromEntries(["DATABASE_URL", "PRODUCT_TENANCY"].map((key) => [key, process.env[key]]));
  let app: any; let client: any;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("pc13_qa");
    const url = `postgresql://pc13_test:only_local_test@127.0.0.1:${pgPort}/pc13_qa`;
    process.env.DATABASE_URL = url;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
      { cwd: root, env: process.env, timeout: 120_000 });
    process.env.PRODUCT_TENANCY = "required";
    client = pg.getPgClient("pc13_qa", "127.0.0.1"); await client.connect();
    const users: Array<{ tenant: string; role: string; id: string; sid: string }> = [];
    for (const [tenant, slug] of [[tenantA, "empresa-pc13-a"], [tenantB, "empresa-pc13-b"]]) {
      await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,$2,$2,now())`, [tenant, slug]);
      for (const [role, permissions] of [["admin", ["*"]], ["manager", ["alerts:write", "sale:manage"]], ["seller", ["sale:write"]]] as const) {
        const rid = crypto.randomUUID(), uid = crypto.randomUUID(), sid = crypto.randomUUID();
        await client.query(`INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1,$2,$3,$4,now())`, [rid, tenant, role, permissions]);
        await client.query(`INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","updatedAt") VALUES ($1,$2,$3,$4,'test-only','test-only',$5,now())`,
          [uid, tenant, role, `${role}-${slug}@example.invalid`, rid]);
        await client.query(`INSERT INTO "AuthSession" (id,"tenantId","userId") VALUES ($1,$2,$3)`, [sid, tenant, uid]);
        users.push({ tenant, role, id: uid, sid });
      }
    }
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "test-pc13-secret-at-least-32-characters";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api"); app.useGlobalFilters(new ApiExceptionFilter()); await app.init();
    const http = supertest(app.getHttpServer());
    const token = (tenant: string, role: string) => {
      const user = users.find((item) => item.tenant === tenant && item.role === role)!;
      return "Bearer " + new JwtService({ secret }).sign({ sub: user.id, sid: user.sid,
        type: "access", version: 0, tenantId: tenant });
    };
    const as = (tenant: string, role: string) => ({ Authorization: token(tenant, role) });
    const todayParts = new Intl.DateTimeFormat("en", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const today = ["year", "month", "day"].map((name) => todayParts.find((part) => part.type === name)!.value).join("-");
    const plus = (days: number) => new Date(Date.parse(today + "T12:00:00Z") + days * DAY).toISOString().slice(0, 10);
    const payload = { type: "B01", authorizationReference: "autorización-de-prueba",
      firstNumber: "00000001", lastNumber: "00000100", nextNumber: "00000081", expiryApplies: true, expiresOn: plus(15) };

    expect((await http.get("/api/ncf-sequences").set(as(tenantA, "seller"))).status).toBe(403);
    expect((await http.get("/api/ncf-sequences").set(as(tenantA, "manager"))).status).toBe(403);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "seller")).send(payload)).status).toBe(403);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "manager")).send(payload)).status).toBe(403);
    expect((await http.get("/api/ncf-sequences").set(as(tenantA, "admin"))).body).toEqual([]);
    const created = await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send(payload);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.warnings.map((warning: { kind: string }) => warning.kind)).toEqual(["expiry"]);
    // 20 números no alertan; 16 días tampoco. 15 días sí.
    const at16 = ncfSequenceWarnings({ id: created.body.id, type: "B01", nextNumber: { toString: () => "81" },
      lastNumber: { toString: () => "100" }, expiryApplies: true,
      expiresOn: new Date(plus(16) + "T00:00:00Z"), active: true,
      nextConfirmedAt: new Date(today + "T00:00:00Z") }, today);
    expect(at16).toEqual([]);
    expect(created.body.firstNumber).toBe("00000001");
    expect(created.body.nextNumber).toBe("00000081");
    expect(created.body.nextConfirmedAt).toBeTruthy();
    const id = created.body.id;
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send(payload)).body.id).toBe(id);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      authorizationReference: "rango-solapado", nextNumber: "00000082" })).status).toBe(409);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      type: "B02", authorizationReference: "consumo-no-vence" })).status).toBe(400);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      type: "B04", authorizationReference: "nota-no-vence" })).status).toBe(400);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      type: "B12", authorizationReference: "rui-no-vence" })).status).toBe(400);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      authorizationReference: "sin-fecha", expiryApplies: false, expiresOn: null })).status).toBe(400);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      authorizationReference: "ancho-inválido", firstNumber: "1", lastNumber: "100", nextNumber: "81" })).status).toBe(400);
    expect((await http.patch(`/api/ncf-sequences/${id}`).set(as(tenantA, "manager")).send({ nextNumber: "00000082" })).status).toBe(403);
    const advanced = await http.patch(`/api/ncf-sequences/${id}`).set(as(tenantA, "admin")).send({ nextNumber: "00000082" });
    expect(advanced.body.warnings).toHaveLength(2);
    expect(advanced.body.warnings.find((warning: { kind: string }) => warning.kind === "numbers").message)
      .toContain("Confirma uso fuera de Nexora");
    expect((await http.patch(`/api/ncf-sequences/${id}`).set(as(tenantA, "admin")).send({ nextNumber: "00000081" })).status).toBe(400);
    const expiring = await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      type: "B14", authorizationReference: "otra-autorización-de-prueba", nextNumber: "00000001", expiresOn: plus(14) });
    expect(expiring.body.warnings).toHaveLength(1);
    expect(expiring.body.warnings[0].kind).toBe("expiry");
    const exempt = await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      type: "B02", authorizationReference: "sin-vencimiento-declarado", expiryApplies: false, expiresOn: null });
    expect(exempt.body.warnings).toEqual([]);
    expect((await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      authorizationReference: "incompleto", expiryApplies: true, expiresOn: null })).status).toBe(400);
    const sameOther = await http.post("/api/ncf-sequences").set(as(tenantB, "admin")).send(payload);
    expect(sameOther.status).toBe(201);
    expect(sameOther.body.id).not.toBe(id);
    expect((await http.get("/api/ncf-sequences").set(as(tenantB, "admin"))).body).toHaveLength(1);
    expect((await http.patch(`/api/ncf-sequences/${id}`).set(as(tenantB, "admin")).send({ active: false })).status).toBe(400);

    const alerts1 = await http.get("/api/alerts?type=ncf_sequence").set(as(tenantA, "admin"));
    expect(alerts1.status, JSON.stringify(alerts1.body)).toBe(200);
    expect(alerts1.body).toHaveLength(3);
    expect((await http.get("/api/alerts?type=ncf_sequence").set(as(tenantA, "admin"))).body).toHaveLength(3);
    expect((await http.get("/api/alerts?type=ncf_sequence").set(as(tenantA, "manager"))).body).toEqual([]);
    const alertsB = (await http.get("/api/alerts?type=ncf_sequence").set(as(tenantB, "admin"))).body;
    expect(alertsB).toHaveLength(1);
    expect(alertsB[0].tenantId).toBe(tenantB);
    expect(alertsB[0].entityId).toBe(sameOther.body.id);
    expect((await client.query(`SELECT count(*)::int AS n FROM "Alert" WHERE "tenantId"=$1 AND type='ncf_sequence'`, [tenantA])).rows[0].n).toBe(3);
    await client.query(`UPDATE "Tenant" SET "timeZone"='Not/A_Real_Zone' WHERE id=$1`, [tenantA]);
    expect((await http.get("/api/alerts").set(as(tenantA, "admin"))).status).toBe(200);
    await client.query(`UPDATE "Tenant" SET "timeZone"='America/Santo_Domingo' WHERE id=$1`, [tenantA]);
    const inactive = await http.patch(`/api/ncf-sequences/${id}`).set(as(tenantA, "admin")).send({ active: false });
    expect(inactive.status).toBe(200);
    expect(inactive.body.nextConfirmedAt).toBe(advanced.body.nextConfirmedAt);
    expect((await http.get("/api/alerts?type=ncf_sequence&status=new").set(as(tenantA, "admin"))).body).toHaveLength(1);
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE nexora_tenant_runtime");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantB]);
    expect((await client.query(`SELECT id FROM "NcfSequence" WHERE id=$1`, [id])).rows).toEqual([]);
    await client.query("COMMIT");
    expect((await client.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "tenantId"=$1 AND entity='ncf-sequence'`, [tenantA])).rows[0].n).toBe(5);
    const overlappingLater = await http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...payload,
      authorizationReference: "rango-declarado-mientras-inactivo", nextNumber: "00000081" });
    expect(overlappingLater.status).toBe(201);
    expect((await http.patch(`/api/ncf-sequences/${id}`).set(as(tenantA, "admin")).send({ active: true })).status).toBe(409);

    // La migración se puede reaplicar y no toca las secuencias declaradas.
    const migration = await readFile(join(root, "apps/api/prisma/migrations/202610280013_pc13_ncf_sequence/migration.sql"), "utf8");
    await client.query(migration);
    expect((await client.query(`SELECT count(*)::int AS n FROM "NcfSequence" WHERE "tenantId"=$1`, [tenantA])).rows[0].n).toBe(4);

    const parallelPayload = { ...payload, type: "E89", firstNumber: "0000000001", lastNumber: "0000000100", nextNumber: "0000000081" };
    const concurrent = await Promise.all([
      http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...parallelPayload, authorizationReference: "carrera-uno" }),
      http.post("/api/ncf-sequences").set(as(tenantA, "admin")).send({ ...parallelPayload, authorizationReference: "carrera-dos" }),
    ]);
    expect(concurrent.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((await client.query(`SELECT count(*)::int AS n FROM "NcfSequence" WHERE "tenantId"=$1 AND type='E89'`, [tenantA])).rows[0].n).toBe(1);
  } finally {
    if (app) await app.close();
    if (client) await client.end();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.stop().catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  }
}, 180_000);

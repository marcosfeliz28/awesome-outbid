import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { AdminController } from "../apps/api/src/admin";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = requireApi("@prisma/client");
const migrationsDir = fileURLToPath(
  new URL("../apps/api/prisma/migrations", import.meta.url),
);
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("No se pudo reservar el puerto de PostgreSQL."));
      });
    });
  });
const actor: any = {
  id: randomUUID(),
  name: "Administración de prueba",
  email: "audit-admin@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: "main",
};
let database: EmbeddedPostgres | undefined;
let dataDir: string | undefined;
let db: any;
let sql: any;
let api: AdminController;
let sellerRoleId: string;
let adminRoleId: string;

const promotionInput = () => ({
  name: `Promoción ${randomUUID()}`,
  type: "percent",
  value: 15,
  startsAt: new Date(Date.now() - 60_000).toISOString(),
  endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  scope: {},
});
const newUserInput = () => ({
  name: "Usuario de prueba",
  username: `audit-${randomUUID()}`,
  email: `${randomUUID()}@example.invalid`,
  password: `Aa1!${randomUUID()}`,
  pin: String(randomInt(1_000_000)).padStart(6, "0"),
  roleId: adminRoleId,
});
const rejectAudit = () =>
  sql.query('ALTER TABLE "AuditLog" ENABLE TRIGGER fail_security_audit_3ag');
const allowAudit = () =>
  sql.query('ALTER TABLE "AuditLog" DISABLE TRIGGER fail_security_audit_3ag');

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-auditlog-3ag-"));
  const port = await freePort();
  const password = randomBytes(24).toString("hex");
  database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "auditlog_test",
    password,
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  await database.initialise();
  await database.start();
  await database.createDatabase("security_auditlog_3ag");
  sql = database.getPgClient("security_auditlog_3ag", "127.0.0.1");
  await sql.connect();
  const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of migrations)
    await sql.query(
      await readFile(join(migrationsDir, name, "migration.sql"), "utf8"),
    );
  db = new PrismaClient({
    datasources: {
      db: {
        url: `postgresql://auditlog_test:${password}@127.0.0.1:${port}/security_auditlog_3ag`,
      },
    },
  });
  api = new AdminController(db);
  sellerRoleId = (
    await db.role.create({
      data: { name: "seller", permissions: ["sales:write"] },
    })
  ).id;
  adminRoleId = (
    await db.role.create({ data: { name: "admin", permissions: ["*"] } })
  ).id;
  // El fallo ocurre en PostgreSQL después de que el controlador haya escrito
  // el negocio. Así se comprueba el rollback real, sin simular transacciones.
  await sql.query(`
    CREATE FUNCTION reject_security_audit_3ag() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'Fallo de bitácora inyectado 3ag';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_security_audit_3ag BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION reject_security_audit_3ag();
    ALTER TABLE "AuditLog" DISABLE TRIGGER fail_security_audit_3ag;
  `);
}, 120_000);

beforeEach(async () => {
  await allowAudit();
});

afterAll(async () => {
  await db?.$disconnect().catch(() => undefined);
  await sql?.end().catch(() => undefined);
  await database?.stop().catch(() => undefined);
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

describe("3ag · bitácora atómica con PostgreSQL real", () => {
  it("no crea un cliente con límite de crédito si falla la bitácora", async () => {
    const name = `Cliente ${randomUUID()}`;
    await rejectAudit();
    await expect(
      api.customer({ name, creditLimit: 1000 }, actor),
    ).rejects.toThrow("Fallo de bitácora inyectado 3ag");
    expect(await db.customer.count({ where: { name } })).toBe(0);
  });

  it("confirma el cliente y su límite de crédito junto a su evidencia", async () => {
    const name = `Cliente ${randomUUID()}`;
    const customer = await api.customer({ name, creditLimit: 1000 }, actor);
    const persisted = await db.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(Number(persisted.creditLimit)).toBe(1000);
    const log = await db.auditLog.findFirstOrThrow({
      where: { entityId: customer.id, entity: "customer", action: "create" },
    });
    expect(log).toMatchObject({ userId: actor.id, branchId: actor.branchId });
    expect(log.after.name).toBe(name);
    expect(Number(log.after.creditLimit)).toBe(1000);
  });

  it("no crea un usuario con permisos si no se puede guardar su bitácora", async () => {
    const input = newUserInput();
    const auditCount = await db.auditLog.count();
    await rejectAudit();
    await expect(api.user(input, actor)).rejects.toThrow(
      "Fallo de bitácora inyectado 3ag",
    );
    expect(
      await db.user.findUnique({ where: { email: input.email } }),
    ).toBeNull();
    expect(await db.auditLog.count()).toBe(auditCount);
  });

  it("revierte cambio de rol, credenciales y revocación de sesiones si falla la bitácora", async () => {
    const user = await db.user.create({
      data: {
        name: "Usuario sin modificar",
        email: `${randomUUID()}@example.invalid`,
        passwordHash: randomBytes(32).toString("hex"),
        pinHash: randomBytes(32).toString("hex"),
        roleId: sellerRoleId,
      },
    });
    const session = await db.authSession.create({ data: { userId: user.id } });
    const refresh = await db.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        hash: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await rejectAudit();
    await expect(
      api.editUser(
        user.id,
        {
          name: "Usuario modificado",
          roleId: adminRoleId,
          password: `Aa1!${randomUUID()}`,
          pin: String(randomInt(1_000_000)).padStart(6, "0"),
        },
        actor,
      ),
    ).rejects.toThrow("Fallo de bitácora inyectado 3ag");
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toEqual(
      user,
    );
    expect(
      await db.authSession.findUnique({ where: { id: session.id } }),
    ).toEqual(session);
    expect(
      await db.refreshToken.findUnique({ where: { id: refresh.id } }),
    ).toEqual(refresh);
    expect(await db.auditLog.count({ where: { entityId: user.id } })).toBe(0);
  });

  it("no publica una promoción que cambia precios si falla la bitácora", async () => {
    const input = promotionInput();
    await rejectAudit();
    await expect(api.promotion(input, actor)).rejects.toThrow(
      "Fallo de bitácora inyectado 3ag",
    );
    expect(await db.promotion.count({ where: { name: input.name } })).toBe(0);
  });

  it("no cambia el estado de una promoción si falla la bitácora", async () => {
    const promotion = await api.promotion(promotionInput(), actor);
    await rejectAudit();
    await expect(
      api.deactivate(promotion.id, { active: false }, actor),
    ).rejects.toThrow("Fallo de bitácora inyectado 3ag");
    expect(
      await db.promotion.findUniqueOrThrow({ where: { id: promotion.id } }),
    ).toEqual(promotion);
    expect(
      await db.auditLog.count({
        where: { entityId: promotion.id, action: "state" },
      }),
    ).toBe(0);
  });

  it("confirma usuarios y cambios de acceso con evidencia sin credenciales", async () => {
    const input = newUserInput();
    const user = await api.user(input, actor);
    const session = await db.authSession.create({ data: { userId: user.id } });
    await db.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        hash: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const password = `Bb2!${randomUUID()}`;
    const pin = String(randomInt(1_000_000)).padStart(6, "0");
    await api.editUser(user.id, { password, pin, active: false }, actor);
    const persisted = await db.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(persisted).toMatchObject({
      active: false,
      authVersion: 1,
      mustChangePassword: true,
    });
    expect(await db.authSession.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
    const logs = await db.auditLog.findMany({ where: { entityId: user.id } });
    expect(logs).toHaveLength(2);
    expect(logs.map((log: any) => log.action).sort()).toEqual(
      ["create", "access_change"].sort(),
    );
    expect(
      logs.find((log: any) => log.action === "access_change").after,
    ).toEqual({
      active: false,
      passwordReset: true,
      pinReset: true,
    });
    const serialized = JSON.stringify({ response: user, logs });
    for (const secret of [input.password, input.pin, password, pin])
      expect(serialized).not.toContain(JSON.stringify(secret));
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("pinHash");
    expect(logs.every((log: any) => log.userId === actor.id)).toBe(true);
  });

  it("confirma precio y desactivación junto a sus dos registros", async () => {
    const promotion = await api.promotion(promotionInput(), actor);
    const deactivated = await api.deactivate(
      promotion.id,
      { active: false },
      actor,
    );
    expect(deactivated.active).toBe(false);
    expect(Number(deactivated.value)).toBe(15);
    const logs = await db.auditLog.findMany({
      where: { entityId: promotion.id },
    });
    expect(logs).toHaveLength(2);
    expect(logs.map((log: any) => log.action).sort()).toEqual([
      "create",
      "state",
    ]);
    expect(
      Number(logs.find((log: any) => log.action === "create").after.value),
    ).toBe(15);
    expect(logs.find((log: any) => log.action === "state").after).toEqual({
      active: false,
    });
  });
});

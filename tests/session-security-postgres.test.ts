import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { AuthController } from "../apps/api/src/auth";
import {
  ApiExceptionFilter,
  AuthGuard,
  Database,
} from "../apps/api/src/common";
import { CashController } from "../apps/api/src/cash";
import { SalesController } from "../apps/api/src/sales";
import { OfflineSaleReviewController } from "../apps/api/src/offline-sale-review";
import { RealtimeController } from "../apps/api/src/realtime";
import {
  AuthenticatedRateLimitGuard,
  RequestRateLimitService,
} from "../apps/api/src/rate-limit";
import {
  managerPinApproval,
  SecurityMaintenance,
} from "../apps/api/src/security";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = requireApi("@prisma/client");
const { JwtService } = requireApi("@nestjs/jwt");
const { Module } = requireApi("@nestjs/common");
const { APP_GUARD, NestFactory } = requireApi("@nestjs/core");
const { hash } = requireApi("bcryptjs");
const run = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
let db: any, database: any, dataDir: string;
let auth: AuthController;
let httpApp: any;
let httpBase: string;
const jwt = new JwtService({ secret: randomBytes(32).toString("hex") });
const limits = new RequestRateLimitService();
const password = randomBytes(18).toString("base64url") + "aA1!";
const pin = "583904";

const freePort = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? done(address.port)
          : fail(new Error("Sin puerto")),
      );
    });
  });

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-session-security-"));
  const port = await freePort();
  const pgPassword = randomBytes(18).toString("hex");
  database = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "nexora_session",
    password: pgPassword,
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
  await database.createDatabase("nexora_session_security");
  const url = `postgresql://nexora_session:${pgPassword}@127.0.0.1:${port}/nexora_session_security`;
  await run(
    process.execPath,
    [
      requireApi.resolve("prisma/build/index.js"),
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps/api/prisma/schema.prisma"),
    ],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url },
      timeout: 120000,
    },
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  auth = new AuthController(db, jwt, limits);
  class PinHttpTestModule {}
  Module({
    controllers: [
      CashController,
      SalesController,
      OfflineSaleReviewController,
      RealtimeController,
    ],
    providers: [
      { provide: Database, useValue: db },
      { provide: JwtService, useValue: jwt },
      { provide: RequestRateLimitService, useValue: limits },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: AuthenticatedRateLimitGuard },
    ],
  })(PinHttpTestModule);
  httpApp = await NestFactory.create(PinHttpTestModule, { logger: false });
  httpApp.setGlobalPrefix("api");
  httpApp.useGlobalFilters(new ApiExceptionFilter());
  await httpApp.listen(0, "127.0.0.1");
  httpBase = (await httpApp.getUrl()) + "/api";
}, 120000);

afterAll(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await httpApp?.close();
  await db?.$disconnect();
  await database?.stop();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function user(
  extra: Record<string, unknown> = {},
  permissions = ["sale:manage"],
) {
  const key = "qa-session-" + randomUUID();
  const role = await db.role.create({ data: { name: key, permissions } });
  const row = await db.user.create({
    data: {
      name: "Prueba sesión",
      username: key,
      usernameKey: key,
      email: key + "@example.invalid",
      roleId: role.id,
      passwordHash: await hash(password, 4),
      pinHash: await hash(pin, 4),
      branchId: "qa-" + randomUUID(),
      ...extra,
    },
    include: { role: true },
  });
  limits.rememberAuthIdentity(key);
  return row;
}
function response() {
  const cookies = new Map<string, { value: string; options: any }>();
  const res: any = {
    cookie: (name: string, value: string, options: any) =>
      cookies.set(name, { value, options }),
    clearCookie: (name: string) => cookies.delete(name),
  };
  return { res, cookies };
}
async function login(row: any) {
  const out = response();
  const body = await auth.login(
    { login: row.username, password },
    { ip: "127.0.0.1" } as any,
    out.res,
  );
  return {
    ...out,
    body: body as any,
    refresh: out.cookies.get("fitstore_refresh")?.value,
  };
}
function activate(token: string) {
  const req: any = {
    headers: { authorization: "Bearer " + token },
    ip: "127.0.0.1",
  };
  const context: any = {
    getHandler: () => AuthController.prototype.me,
    getClass: () => AuthController,
    switchToHttp: () => ({ getRequest: () => req }),
  };
  const reflector: any = {
    getAllAndOverride: (key: string) =>
      key === "permission" ? "authenticated" : undefined,
  };
  return new AuthGuard(db, jwt, reflector).canActivate(context);
}
const requester = (row: any) => ({
  id: randomUUID(),
  branchId: row.branchId,
  name: "Solicitante",
  email: "qa@example.invalid",
  role: "seller",
  permissions: ["sale:write"],
});

describe("3ag · sesión y credenciales con PostgreSQL descartable", () => {
  it("declara los cuatro endpoints privados como operaciones autenticadas", () => {
    for (const handler of ["changeOwnPassword", "logout", "me", "pin"] as const)
      expect(
        Reflect.getMetadata("permission", AuthController.prototype[handler]),
        handler,
      ).toBe("authenticated");
  });

  it("emite JWT de 15 minutos y guarda sólo hash del refresh de siete días", async () => {
    const row = await user();
    const session = await login(row);
    const payload = jwt.verify(session.body.accessToken);
    expect(payload.exp - payload.iat).toBe(900);
    const saved = await db.refreshToken.findFirstOrThrow({
      where: { userId: row.id },
    });
    expect(saved.hash).toBe(
      createHash("sha256").update(session.refresh).digest("hex"),
    );
    expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      6.9 * 86400000,
    );
    expect(session.cookies.get("fitstore_refresh")?.options).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/api/auth",
    });
    expect(
      Reflect.getMetadata("__headers__", AuthController.prototype.login),
    ).toContainEqual({ name: "Cache-Control", value: "no-store" });
    await expect(activate(session.body.accessToken)).resolves.toBe(true);
    await expect(
      activate(
        jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 1 }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each(["mustChangePassword", "authVersion", "active", "session"])(
    "revoca acceso y refresh tras cambiar %s",
    async (field) => {
      const row = await user();
      const session = await login(row);
      if (field === "session")
        await db.authSession.deleteMany({ where: { userId: row.id } });
      else
        await db.user.update({
          where: { id: row.id },
          data:
            field === "authVersion"
              ? { authVersion: { increment: 1 } }
              : { [field]: field === "mustChangePassword" },
        });
      await expect(activate(session.body.accessToken)).rejects.toMatchObject({
        status: 401,
      });
      await expect(
        auth.refresh(
          {
            ip: "127.0.0.1",
            cookies: { fitstore_refresh: session.refresh },
          } as any,
          response().res,
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it("cinco contraseñas incorrectas bloquean incluso la contraseña correcta", async () => {
    const row = await user();
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        auth.login(
          { login: row.username, password: "incorrecta-" + attempt },
          { ip: "127.0.0.1" } as any,
          response().res,
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: "Usuario o contraseña incorrectos.",
      });
    await expect(login(row)).rejects.toMatchObject({ status: 400 });
    const counter = await db.authAttempt.findUniqueOrThrow({
      where: { key: `login:${row.id}:${row.authVersion}:127.0.0.1` },
    });
    expect(counter.failedAttempts).toBe(5);
    expect(counter.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    const logs = await db.auditLog.findMany({
      where: { entityId: row.id, action: "login_locked" },
    });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(password);
  });

  it("un equipo con campos extra no obtiene la excepción al bloqueo de login", async () => {
    const row = await user();
    const secret = randomBytes(24).toString("hex");
    const terminal = await db.terminal.create({
      data: {
        id: randomUUID(),
        name: "Equipo validado",
        branchId: row.branchId,
        secretHash: createHash("sha256").update(secret).digest("hex"),
        approvedAt: new Date(),
      },
    });
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        auth.login(
          { login: row.username, password: "incorrecta-" + attempt },
          { ip: "127.0.0.1" } as any,
          response().res,
        ),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      auth.login(
        {
          login: row.username,
          password,
          terminal: { id: terminal.id, secret, extra: true },
        },
        { ip: "127.0.0.1" } as any,
        response().res,
      ),
    ).rejects.toMatchObject({ status: 400 });
    const accepted = await auth.login(
      { login: row.username, password, terminal: { id: terminal.id, secret } },
      { ip: "127.0.0.1" } as any,
      response().res,
    );
    expect(accepted).toHaveProperty("accessToken");
  });

  it("cinco PIN incorrectos bloquean también un PIN válido del mismo solicitante", async () => {
    const manager = await user();
    const actor = requester(manager);
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        managerPinApproval(db, actor, "000000"),
      ).rejects.toMatchObject({ status: 400, response: "PIN incorrecto." });
    await expect(managerPinApproval(db, actor, pin)).rejects.toMatchObject({
      status: 400,
      response:
        "PIN bloqueado temporalmente para este usuario. Espera 15 minutos.",
    });
    const counter = await db.authAttempt.findUniqueOrThrow({
      where: { key: "pin-requester:" + actor.id },
    });
    expect(counter.failedAttempts).toBe(5);
    const logs = await db.auditLog.findMany({ where: { userId: actor.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].after).toEqual({ scope: "endpoint", check: "approval" });
  });

  it("consume una sola vez un refresh enviado simultáneamente", async () => {
    const row = await user();
    const session = await login(row);
    const replies = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        auth.refresh(
          {
            ip: "127.0.0.1",
            cookies: { fitstore_refresh: session.refresh },
          } as any,
          response().res,
        ),
      ),
    );
    expect(replies.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.refreshToken.count({ where: { userId: row.id } })).toBe(1);
  });

  it("cerrar sesión invalida el token de acceso y la renovación", async () => {
    const row = await user();
    const session = await login(row);
    await auth.logout(
      {
        headers: { authorization: "Bearer " + session.body.accessToken },
        cookies: { fitstore_refresh: session.refresh },
      } as any,
      session.res,
    );
    await expect(activate(session.body.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      auth.refresh(
        {
          ip: "127.0.0.1",
          cookies: { fitstore_refresh: session.refresh },
        } as any,
        response().res,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("cerrar sesión funciona aunque cookie-parser entregue una cookie JSON", async () => {
    const row = await user();
    const session = await login(row);
    await expect(
      auth.logout(
        {
          headers: { authorization: "Bearer " + session.body.accessToken },
          cookies: { fitstore_refresh: { dato: "no es un token" } },
        } as any,
        session.res,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(activate(session.body.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    expect(session.cookies.has("fitstore_refresh")).toBe(false);
  });

  it.each([
    { label: "objeto JSON", token: {} },
    { label: "lista JSON", token: [] },
    { label: "número", token: 42 },
    { label: "alfabeto inválido", token: "x".repeat(96) },
    { label: "tamaño inválido", token: "a".repeat(97) },
  ])(
    "rechaza cookie malformada ($label) antes de consultar tokens",
    async ({ token }) => {
      const lookup = vi.fn(async () => null);
      const malformedAuth = new AuthController(
        { refreshToken: { findUnique: lookup } } as any,
        jwt,
        limits,
      );
      await expect(
        malformedAuth.refresh(
          { cookies: { fitstore_refresh: token } } as any,
          response().res,
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: "La sesión ha expirado.",
      });
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it("el refresh vence también en el instante exacto de expiresAt", async () => {
    const row = await user();
    const session = await login(row);
    const cutoff = new Date();
    await db.refreshToken.updateMany({
      where: { userId: row.id },
      data: { expiresAt: cutoff },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(cutoff);
    try {
      await expect(
        auth.refresh(
          {
            ip: "127.0.0.1",
            cookies: { fitstore_refresh: session.refresh },
          } as any,
          response().res,
        ),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("un fallo de bitácora revierte el cambio obligatorio de contraseña", async () => {
    const row = await user({ mustChangePassword: true });
    const nextPassword = randomBytes(18).toString("base64url") + "aA2!";
    await db.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ADD CONSTRAINT "qa_password_audit_failure" CHECK (action <> 'password_changed') NOT VALID`,
    );
    try {
      await expect(
        auth.changePassword(
          {
            login: row.username,
            currentPassword: password,
            newPassword: nextPassword,
            confirmPassword: nextPassword,
          },
          { ip: "127.0.0.1" } as any,
          response().res,
        ),
      ).rejects.toThrow();
      const current = await db.user.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(current).toMatchObject({
        passwordHash: row.passwordHash,
        mustChangePassword: true,
        authVersion: row.authVersion,
      });
      expect(await db.authSession.count({ where: { userId: row.id } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'ALTER TABLE "AuditLog" DROP CONSTRAINT "qa_password_audit_failure"',
      );
    }
  });

  it("un gerente vigente aprueba con PIN y un cambio obligatorio lo impide", async () => {
    const manager = await user();
    const actor = requester(manager);
    await expect(managerPinApproval(db, actor, pin)).resolves.toBe(manager.id);
    await db.user.update({
      where: { id: manager.id },
      data: { mustChangePassword: true },
    });
    await expect(managerPinApproval(db, actor, pin)).rejects.toMatchObject({
      status: 400,
      response: "PIN incorrecto.",
    });
  });

  it("un PIN de otra sucursal no aprueba", async () => {
    const manager = await user();
    await expect(
      managerPinApproval(
        db,
        { ...requester(manager), branchId: "otra-sucursal" },
        pin,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("relee la vigencia del gerente después de esperar el bloqueo de intentos", async () => {
    const manager = await user();
    const actor = requester(manager);
    const key = "approval:" + actor.id;
    let release!: () => void, ready!: () => void;
    const held = new Promise<void>((resolveHeld) => {
      release = resolveHeld;
    });
    const acquired = new Promise<void>((resolveReady) => {
      ready = resolveReady;
    });
    const blocker = db.$transaction(
      async (tx: any) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        ready();
        await held;
      },
      { timeout: 20000 },
    );
    await acquired;
    const pending = managerPinApproval(db, actor, pin).then(
      (id) => ({ id }),
      (error) => ({ error }),
    );
    try {
      await expect
        .poll(
          async () => {
            const rows =
              await db.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND wait_event='advisory'`;
            return rows[0].n;
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);
      await db.user.update({
        where: { id: manager.id },
        data: { active: false },
      });
    } finally {
      release();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { status: 400 } });
  });
});

describe("3ag · PIN en rutas HTTP con PostgreSQL real", () => {
  it.each([
    "venta",
    "salida de caja",
    "traslado de caja",
    "descarte sin conexión",
    "aprobación de equipo",
  ])(
    "%s exige gerente vigente y admite el PIN tras cambiar la contraseña",
    async (kind) => {
      const manager = await user({ mustChangePassword: true });
      const seller = await user({ branchId: manager.branchId }, [
        "sale:write",
        "cash:write",
      ]);
      await db.settings.create({
        data: {
          id: seller.branchId,
          data: {
            sellerDiscountLimit: 0,
            cashMovementApprovalLimit: 0,
            taxIncluded: true,
          },
        },
      });
      const terminal = await db.terminal.create({
        data: {
          id: randomUUID(),
          name: "Equipo de prueba",
          branchId: seller.branchId,
          secretHash: createHash("sha256")
            .update(randomBytes(32))
            .digest("hex"),
          approvedAt: kind === "aprobación de equipo" ? null : new Date(),
        },
      });
      const session = await db.authSession.create({
        data: { userId: seller.id, terminalId: terminal.id },
      });
      const access = jwt.sign(
        {
          type: "access",
          sub: seller.id,
          version: seller.authVersion,
          sid: session.id,
        },
        { expiresIn: "15m" },
      );
      const cash = await db.cashSession.create({
        data: {
          userId: seller.id,
          registerId: kind === "traslado de caja" ? randomUUID() : terminal.id,
          openingAmount: 100,
          branchId: seller.branchId,
        },
      });
      let path: string, body: Record<string, unknown>;
      let saleId: string | undefined, variantId: string | undefined;
      if (kind === "venta") {
        const category = await db.category.create({
          data: { name: randomUUID(), branchId: seller.branchId },
        });
        const product = await db.product.create({
          data: {
            name: "Producto de prueba",
            sku: randomUUID(),
            categoryId: category.id,
            branchId: seller.branchId,
          },
        });
        const variant = await db.variant.create({
          data: {
            productId: product.id,
            sku: randomUUID(),
            barcode: randomUUID(),
            price: 100,
            costAvg: 10,
            stock: 10,
            branchId: seller.branchId,
          },
        });
        variantId = variant.id;
        const customer = await db.customer.create({
          data: { name: "Cliente ficticio", branchId: seller.branchId },
        });
        saleId = randomUUID();
        path = "/sales";
        body = {
          offlineUuid: saleId,
          cashSessionId: cash.id,
          customerId: customer.id,
          items: [{ variantId: variant.id, qty: 1 }],
          globalDiscount: 10,
          discountReason: "Descuento de prueba",
          payments: [{ method: "cash", amount: 90 }],
          managerPin: pin,
        };
      } else if (kind === "salida de caja") {
        path = `/cash-sessions/${cash.id}/movements`;
        body = {
          operationId: randomUUID(),
          type: "out",
          amount: 10,
          reason: "Salida de prueba",
          managerPin: pin,
        };
      } else if (kind === "traslado de caja") {
        path = `/cash-sessions/${cash.id}/transfer`;
        body = { managerPin: pin };
      } else if (kind === "descarte sin conexión") {
        saleId = randomUUID();
        await db.auditLog.create({
          data: {
            userId: seller.id,
            action: "offline_sale_conflict",
            entity: "offline_sale",
            entityId: saleId,
            branchId: seller.branchId,
            after: {},
          },
        });
        await db.alert.create({
          data: {
            key: "offline:" + saleId,
            type: "offline_conflict",
            severity: "high",
            entityId: saleId,
            branchId: seller.branchId,
            message: "Conflicto ficticio",
          },
        });
        path = "/sales/offline-review/discard";
        body = {
          offlineUuid: saleId,
          reason: "Descarte de prueba",
          managerPin: pin,
          detail: {
            receiptNumber: "PRUEBA",
            total: 0,
            items: [],
            payments: [],
          },
        };
      } else {
        path = `/terminals/${terminal.id}/approve-with-pin`;
        body = { managerPin: pin };
      }
      const post = async () => {
        const reply = await fetch(httpBase + path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + access,
          },
          body: JSON.stringify(body),
        });
        return { status: reply.status, body: await reply.json() };
      };
      expect(await post()).toMatchObject({
        status: 400,
        body: { message: "PIN incorrecto." },
      });
      expect(
        await db.sale.count({ where: { branchId: seller.branchId } }),
      ).toBe(0);
      expect(
        await db.cashMovement.count({ where: { sessionId: cash.id } }),
      ).toBe(0);
      if (kind === "aprobación de equipo")
        expect(
          (await db.terminal.findUniqueOrThrow({ where: { id: terminal.id } }))
            .approvedAt,
        ).toBeNull();
      const changedPassword = randomBytes(18).toString("base64url") + "aA2!";
      await auth.changePassword(
        {
          login: manager.username,
          currentPassword: password,
          newPassword: changedPassword,
          confirmPassword: changedPassword,
        },
        { ip: "127.0.0.1" } as any,
        response().res,
      );
      const accepted = await post();
      expect(accepted, JSON.stringify(accepted.body)).toMatchObject({
        status: 201,
      });
      if (kind === "venta") {
        const sale = await db.sale.findUniqueOrThrow({
          where: { offlineUuid: saleId },
        });
        expect(Number(sale.total)).toBe(90);
        expect(
          Number(
            (await db.variant.findUniqueOrThrow({ where: { id: variantId } }))
              .stock,
          ),
        ).toBe(9);
      } else if (kind === "salida de caja")
        expect(
          await db.cashMovement.count({ where: { sessionId: cash.id } }),
        ).toBe(1);
      else if (kind === "traslado de caja")
        expect(
          (await db.cashSession.findUniqueOrThrow({ where: { id: cash.id } }))
            .registerId,
        ).toBe(terminal.id);
      else if (kind === "descarte sin conexión")
        expect(
          await db.auditLog.count({
            where: { action: "offline_sale_discarded", entityId: saleId },
          }),
        ).toBe(1);
      else
        expect(
          (await db.terminal.findUniqueOrThrow({ where: { id: terminal.id } }))
            .approvedBy,
        ).toBe(manager.id);
    },
  );
});

describe("3ag · secretos en errores de mantenimiento", () => {
  it("no registra el texto libre del error de base de datos", async () => {
    vi.useFakeTimers();
    const secret = "postgresql://user:clave-no-publicable@db.internal/nexora";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const maintenance = new SecurityMaintenance({
      $executeRaw: async () => {
        throw new Error(secret);
      },
    } as any);
    try {
      maintenance.onModuleInit();
      await vi.advanceTimersByTimeAsync(6 * 3600000);
      expect(warn).toHaveBeenCalledOnce();
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
      expect(warn.mock.calls[0][0]).toMatch(/mantenimiento de seguridad/i);
    } finally {
      maintenance.onModuleDestroy();
      warn.mockRestore();
      vi.useRealTimers();
    }
  });
});

import { readFileSync } from "node:fs";
import { Module } from "../apps/api/node_modules/@nestjs/common";
import { NestFactory } from "../apps/api/node_modules/@nestjs/core";
import { JwtService } from "../apps/api/node_modules/@nestjs/jwt";
import { hashSync } from "../apps/api/node_modules/bcryptjs";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  AuthenticatedRateLimitGuard,
  RequestRateLimitService,
  ValidatedRateLimitStore,
} from "../apps/api/src/rate-limit";
import { AuthController } from "../apps/api/src/auth";
import { Database } from "../apps/api/src/common";

const context = (request: any) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

describe("L1 · rate limiting sólo con identidades validadas", () => {
  it("el parser JSON queda instalado una sola vez", () => {
    const main = readFileSync("apps/api/src/main.ts", "utf8");
    expect(main).toContain("bodyParser: false");
    expect(main.match(/app\.use\(jsonBodyParser/g)).toHaveLength(1);
    expect(main).not.toContain("createRequestRateLimiter");
  });
  it("61 intentos de una cuenta no bloquean otra cuenta", () => {
    const store = new ValidatedRateLimitStore();
    for (let attempt = 1; attempt <= 60; attempt++)
      expect(store.exceeds("auth-account", ["10.0.0.1", "user-a"], 60)).toBe(
        false,
      );
    expect(store.exceeds("auth-account", ["10.0.0.1", "user-a"], 60)).toBe(
      true,
    );
    expect(store.exceeds("auth-account", ["10.0.0.1", "user-b"], 60)).toBe(
      false,
    );
  });
  it("10,001 claves falsas no ocupan memoria ni abren el límite de sesiones válidas", () => {
    const service = new RequestRateLimitService();
    const guard = new AuthenticatedRateLimitGuard(service);
    for (let i = 0; i < 10_001; i++)
      expect(
        guard.canActivate(
          context({
            method: "POST",
            path: "/api/sales",
            ip: "10.0.0.1",
            headers: { authorization: `Bearer falsa-${i}` },
          }),
        ),
      ).toBe(true);
    const valid = {
      method: "POST",
      path: "/api/sales",
      ip: "10.0.0.1",
      actor: { sessionId: "session-valid-a" },
    };
    for (let attempt = 1; attempt <= 120; attempt++)
      expect(guard.canActivate(context(valid))).toBe(true);
    expect(() => guard.canActivate(context(valid))).toThrowError(
      "Demasiados intentos",
    );
    expect(() =>
      guard.canActivate(context({ ...valid, ip: "203.0.113.99" })),
    ).toThrowError("Demasiados intentos");
    expect(
      guard.canActivate(
        context({ ...valid, actor: { sessionId: "session-valid-b" } }),
      ),
    ).toBe(true);
  });

  it("limita identidades inexistentes antes de consultar la base", async () => {
    const db = { user: { findFirst: vi.fn(async () => null) } };
    const limits = new RequestRateLimitService();
    const controller = new AuthController(db as any, {} as any, limits as any);
    for (let i = 0; i < 60; i++)
      await expect(
        controller.login(
          {
            login: i % 2 ? "  USUARIO   FALSO " : "usuario falso",
            password: "x",
          },
          { ip: "10.0.0.1" } as any,
          {} as any,
        ),
      ).rejects.toBeTruthy();
    await expect(
      controller.login(
        { login: "Usuario Falso", password: "x" },
        { ip: "10.0.0.1" } as any,
        {} as any,
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(db.user.findFirst).toHaveBeenCalledTimes(60);
  });
  it("el tope de memoria no expulsa cubos activos y recicla vencidos en O(1)", () => {
    let now = 0;
    const store = new ValidatedRateLimitStore({
      windowMs: 1_000,
      maxBuckets: 2,
      now: () => now,
    });
    expect(store.exceeds("auth", ["cuenta-activa"], 2)).toBe(false);
    expect(store.exceeds("auth", ["atacante"], 2)).toBe(false);
    expect(store.exceeds("auth", ["tercera"], 2)).toBe(true);
    expect(store.size()).toBe(2);
    // El rechazo anterior no retiro el cubo legitimo activo.
    expect(store.exceeds("auth", ["cuenta-activa"], 2)).toBe(false);
    now = 1_001;
    expect(store.exceeds("auth", ["tercera"], 2)).toBe(false);
    expect(store.size()).toBe(2);
  });
  it("cada sesión conserva su propio límite de PIN y ventas", () => {
    const store = new ValidatedRateLimitStore();
    expect(store.exceeds("sales-session", ["sale-a"], 1)).toBe(false);
    expect(store.exceeds("sales-session", ["sale-a"], 1)).toBe(true);
    expect(store.exceeds("sales-session", ["sale-b"], 1)).toBe(false);
    expect(store.exceeds("auth-pin-session", ["pin-a"], 1)).toBe(false);
    expect(store.exceeds("auth-pin-session", ["pin-a"], 1)).toBe(true);
    expect(store.exceeds("auth-pin-session", ["pin-b"], 1)).toBe(false);
  });
  it("logout queda limitado por sesion autenticada", () => {
    const service = new RequestRateLimitService();
    const guard = new AuthenticatedRateLimitGuard(service);
    const logout = {
      method: "POST",
      path: "/api/auth/logout",
      actor: { sessionId: "sesion-logout" },
    };
    for (let attempt = 1; attempt <= 60; attempt++)
      expect(guard.canActivate(context(logout))).toBe(true);
    expect(() => guard.canActivate(context(logout))).toThrowError(
      "Demasiados intentos",
    );
    expect(
      guard.canActivate(
        context({ ...logout, actor: { sessionId: "otra-sesion" } }),
      ),
    ).toBe(true);
  });

  it("aplica B5 sobre una app Nest real mediante supertest", async () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      active: true,
      mustChangePassword: false,
      authVersion: 0,
      passwordHash: hashSync("Clave-correcta-2026!", 4),
      name: "Jose Perez",
      username: "jose perez",
      usernameKey: "jose perez",
      email: "jose@example.test",
      branchId: "22222222-2222-4222-8222-222222222222",
      role: { name: "seller", permissions: [] },
    };
    const findFirst = vi.fn(async ({ where }: any) =>
      where?.usernameKey === user.usernameKey || where?.email === user.email
        ? user
        : null,
    );
    const tx = {
      $queryRaw: vi.fn(async () => []),
      user: {
        findUnique: vi.fn(async () => user),
        findUniqueOrThrow: vi.fn(async () => user),
      },
      authAttempt: {
        upsert: vi.fn(async ({ create }: any) => ({
          key: create.key,
          failedAttempts: 0,
          lockedUntil: null,
        })),
        update: vi.fn(async () => ({})),
      },
      authSession: {
        create: vi.fn(async () => ({
          id: "33333333-3333-4333-8333-333333333333",
          lastActivityAt: new Date(),
        })),
      },
      refreshToken: { create: vi.fn(async () => ({})) },
    };
    const db = {
      user: {
        findMany: vi.fn(async () => [
          { usernameKey: user.usernameKey, email: user.email },
        ]),
        findFirst,
      },
      settings: { findUnique: vi.fn(async () => null) },
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: any) => callback(tx)),
    };
    class B5TestModule {}
    Module({
      controllers: [AuthController],
      providers: [
        { provide: Database, useValue: db },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: "b5-test-secret-32-bytes-minimum-ok",
          }),
        },
        RequestRateLimitService,
      ],
    })(B5TestModule);
    const app = await NestFactory.create(B5TestModule, { logger: false });
    app.setGlobalPrefix("api");
    app.getHttpAdapter().getInstance().set("trust proxy", true);
    await app.init();
    try {
      const server = app.getHttpServer();
      let lastFalseStatus = 0;
      for (let i = 0; i < 1_000; i++)
        lastFalseStatus = (
          await request(server)
            .post("/api/auth/login")
            .set("X-Forwarded-For", "198.51.100.10")
            .send({ login: `fantasma-${i}`, password: "x" })
        ).status;
      expect(lastFalseStatus).toBe(429);
      expect(findFirst).toHaveBeenCalledTimes(600);

      // Mismo origen: tanto una identidad falsa como una cuenta real con
      // clave incorrecta conservan 429; la cuenta real con la clave correcta
      // si inicia sesion y no queda bloqueada por el barrido anonimo.
      expect(
        (
          await request(server)
            .post("/api/auth/login")
            .set("X-Forwarded-For", "198.51.100.10")
            .send({ login: "otra-falsa", password: "incorrecta" })
        ).status,
      ).toBe(429);
      expect(
        (
          await request(server)
            .post("/api/auth/login")
            .set("X-Forwarded-For", "198.51.100.10")
            .send({ login: "jose perez", password: "incorrecta" })
        ).status,
      ).toBe(429);
      expect(
        (
          await request(server)
            .post("/api/auth/login")
            .set("X-Forwarded-For", "198.51.100.10")
            .send({
              login: "jose perez",
              password: "Clave-correcta-2026!",
            })
        ).status,
      ).toBe(201);

      const realStatuses: number[] = [];
      for (let i = 0; i < 61; i++)
        realStatuses.push(
          (
            await request(server)
              .post("/api/auth/login")
              .set("X-Forwarded-For", "198.51.100.20")
              .send({
                login: i % 2 ? "  JOSÉ   PÉREZ " : "jose perez",
                password: "incorrecta",
              })
          ).status,
        );
      expect(realStatuses.slice(0, 60).every((status) => status === 400)).toBe(
        true,
      );
      expect(realStatuses[60]).toBe(429);

      const changeStatuses: number[] = [];
      for (let i = 0; i < 61; i++)
        changeStatuses.push(
          (
            await request(server)
              .post("/api/auth/change-password")
              .set("X-Forwarded-For", "198.51.100.40")
              .send({
                login: i % 2 ? " CUENTA   TEMPORAL " : "cuenta temporal",
                currentPassword: "Temporal-2026!",
                newPassword: "Nueva-segura-2026!",
                confirmPassword: "Nueva-segura-2026!",
              })
          ).status,
        );
      expect(
        changeStatuses.slice(0, 60).every((status) => status === 400),
      ).toBe(true);
      expect(changeStatuses[60]).toBe(429);
    } finally {
      await app.close();
    }
  }, 30_000);
});

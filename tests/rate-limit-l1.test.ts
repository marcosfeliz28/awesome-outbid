import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  AuthenticatedRateLimitGuard,
  RequestRateLimitService,
  ValidatedRateLimitStore,
} from "../apps/api/src/rate-limit";
import { AuthController } from "../apps/api/src/auth";

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

  it("10,001 nombres inexistentes no crean cubos de cuenta", async () => {
    const db = { user: { findFirst: vi.fn(async () => null) } };
    const limits = {
      assert: vi.fn(() => {
        throw new Error("cuenta-limitada");
      }),
    };
    const controller = new AuthController(db as any, {} as any, limits as any);
    for (let i = 0; i < 10_001; i++)
      await expect(
        controller.login(
          { login: `inexistente-${i}`, password: "x" },
          { ip: "10.0.0.1" } as any,
          {} as any,
        ),
      ).rejects.toBeTruthy();
    expect(limits.assert).not.toHaveBeenCalled();
    db.user.findFirst.mockResolvedValueOnce({ id: "user-real" } as never);
    await expect(
      controller.login(
        { login: "real", password: "x" },
        { ip: "10.0.0.1" } as any,
        {} as any,
      ),
    ).rejects.toThrow("cuenta-limitada");
    expect(limits.assert).toHaveBeenCalledTimes(1);
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
});

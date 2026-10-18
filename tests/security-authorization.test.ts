import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createAppModule } from "../apps/api/src/app";
import { AuthGuard } from "../apps/api/src/common";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("reflect-metadata");
const { RequestMethod } = requireApi("@nestjs/common");
const { Reflector } = requireApi("@nestjs/core");
const reflector = new Reflector();
const controllers: any[] = Reflect.getMetadata(
  "controllers",
  createAppModule("clave-de-prueba-local-de-al-menos-32-caracteres"),
);
const publicRoutes = new Set([
  "GET /health/live",
  "GET /health",
  "GET /health/ready",
  "POST /auth/login",
  "POST /auth/change-password",
  "POST /auth/refresh",
  // OAuth se autentica con state firmado, de un uso y ligado al administrador.
  "GET /backups/google/callback",
]);

export const authorizationInventory = controllers.flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler = controller.prototype[name];
    const method = Reflect.getMetadata("method", handler);
    if (method === undefined) return [];
    const prefix = Reflect.getMetadata("path", controller) ?? "";
    const paths = Reflect.getMetadata("path", handler) ?? "";
    return (Array.isArray(paths) ? paths : [paths]).map((path) => ({
      controller,
      handler,
      route: `${RequestMethod[method]} /${[prefix, path]
        .flatMap((p) => p.split("/"))
        .filter(Boolean)
        .join("/")}`,
      permission: reflector.getAllAndOverride("permission", [
        handler,
        controller,
      ]),
      public: !!reflector.getAllAndOverride("public", [handler, controller]),
    }));
  }),
);

function requestFor(
  route: (typeof authorizationInventory)[number],
  permissions: string[],
  authenticated = true,
) {
  const userId = randomUUID(),
    sessionId = randomUUID(),
    terminalId = randomUUID();
  const db: any = {
    user: {
      findUnique: async () => ({
        id: userId,
        name: "QA permisos",
        email: "qa@example.invalid",
        active: true,
        mustChangePassword: false,
        authVersion: 0,
        branchId: "qa",
        role: { name: "qa", permissions },
      }),
    },
    settings: { findUnique: async () => null },
    authSession: {
      findUnique: async () => ({
        id: sessionId,
        userId,
        terminalId,
        lastActivityAt: new Date(),
      }),
    },
    terminal: {
      findUnique: async () => ({
        id: terminalId,
        branchId: "qa",
        lastUserId: userId,
        revokedAt: null,
        approvedAt: new Date(),
        lastActivityAt: new Date(),
        secretHash: "hash",
      }),
    },
  };
  const guard = new AuthGuard(
    db,
    {
      verify: () => ({
        sub: userId,
        sid: sessionId,
        type: "access",
        version: 0,
      }),
    } as any,
    reflector,
  );
  const req: any = {
    headers: authenticated ? { authorization: "Bearer qa" } : {},
  };
  const context: any = {
    getHandler: () => route.handler,
    getClass: () => route.controller,
    switchToHttp: () => ({ getRequest: () => req }),
  };
  return guard.canActivate(context);
}

describe("3ag · inventario completo de autorización de los controladores registrados", () => {
  it("una ruta privada sin declaración de permiso falla de forma cerrada", async () => {
    await expect(
      requestFor(
        {
          controller: class UndeclaredController {},
          handler: () => undefined,
          route: "GET /sin-declaracion",
          permission: undefined,
          public: false,
        },
        ["*"],
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  for (const route of authorizationInventory) {
    it(route.route, async () => {
      if (route.public) {
        expect(
          publicRoutes.has(route.route),
          "Excepción pública sin justificar",
        ).toBe(true);
        await expect(requestFor(route, [], false)).resolves.toBe(true);
        return;
      }
      expect(route.permission, "Falta @Permit en " + route.route).toBeTruthy();
      await expect(requestFor(route, [], false)).rejects.toMatchObject({
        status: 401,
      });
      if (route.permission !== "authenticated") {
        await expect(requestFor(route, [])).rejects.toMatchObject({
          status: 403,
        });
        await expect(requestFor(route, [route.permission!])).resolves.toBe(
          true,
        );
      } else {
        // Registro, contraseña, sesión y comprobantes autorizan además por
        // recurso en el controlador; no requieren un permiso de negocio.
        await expect(requestFor(route, [])).resolves.toBe(true);
      }
    });
  }
  it("conserva el inventario de excepciones públicas completo", () => {
    expect(
      new Set(
        authorizationInventory.filter((r) => r.public).map((r) => r.route),
      ),
    ).toEqual(publicRoutes);
  });
  it("el inventario entregado coincide con todas las rutas registradas", () => {
    const documented = JSON.parse(
      readFileSync(
        new URL(
          "../docs/validacion/3ag-autorizacion-rutas.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      authorizationInventory.map((r) => ({
        controller: r.controller.name,
        method: r.route.slice(0, r.route.indexOf(" ")),
        path: r.route.slice(r.route.indexOf(" ") + 1),
        permission: r.permission ?? null,
        public: r.public,
      })),
    ).toEqual(documented);
  });
});

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const requireApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
requireApi("reflect-metadata");
const { RequestMethod } = requireApi("@nestjs/common");
const { Reflector } = requireApi("@nestjs/core");
import { AuthGuard, denied } from "../apps/api/src/common";
import { createAppModule } from "../apps/api/src/app";
import { RealtimeController } from "../apps/api/src/realtime";
import { can, permissions } from "../packages/shared/src";

// Rol «lectura» (orden 107): ventas, cajas, reportes e inventario en solo
// lectura. Ninguna ruta que escriba debe aceptarlo, y los GET nuevos sólo
// abren /sales y /cash-sessions.

const USER_ID = "8f2b1c1e-5c1a-4a43-9d37-3a5b0c1d2e3f";
const SESSION_ID = "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c";

const LECTURA = permissions.lectura;

// Rutas declaradas con `@Permit("authenticated")`: cualquier cuenta con sesión
// puede llamarlas (su propia cuenta: cerrar sesión, cambiar su clave, etc.).
// Cualquier ruta nueva con esta marca debe revisarse aquí a propósito.
// Los equipos (registrar, renombrar, aprobar con PIN) se niegan a quien no
// escribe: ver la prueba «los equipos se niegan…» más abajo.
const AUTHENTICATED_WRITES = [
  "AuthController.changeOwnPassword",
  "AuthController.logout",
  "AuthController.pin",
  "RealtimeController.approveWithPin",
  "RealtimeController.register",
  "RealtimeController.rename",
];

type Route = {
  controller: string;
  klass: new (...args: any[]) => unknown;
  name: string;
  handler: (...args: any[]) => unknown;
  method: RequestMethod;
  permission: string | undefined;
  isPublic: boolean;
};

function routes(): Route[] {
  const controllers: any[] = Reflect.getMetadata(
    "controllers",
    createAppModule("test-secret"),
  );
  return controllers.flatMap((C) =>
    Object.getOwnPropertyNames(C.prototype)
      .filter((name) => name !== "constructor")
      .flatMap((name) => {
        const handler = C.prototype[name];
        const method = Reflect.getMetadata("method", handler);
        if (method === undefined) return [];
        return [
          {
            controller: C.name,
            klass: C,
            name,
            handler,
            method,
            permission: Reflect.getMetadata("permission", handler),
            isPublic: !!Reflect.getMetadata("public", handler),
          },
        ];
      }),
  );
}

const ALL = routes();
const isRead = (r: Route) =>
  r.method === RequestMethod.GET || r.method === RequestMethod.HEAD;
const writes = ALL.filter((r) => !isRead(r) && !r.isPublic);

function context(route: Route, token = "token") {
  const req: any = { headers: { authorization: "Bearer " + token } };
  return {
    req,
    ctx: {
      getHandler: () => route.handler,
      getClass: () => route.klass,
      switchToHttp: () => ({ getRequest: () => req }),
    } as any,
  };
}

const payload = () => ({
  sub: USER_ID,
  type: "access",
  version: 1,
  sid: SESSION_ID,
});

function guardFor(roleName: string, grants: string[]) {
  const user = {
    id: USER_ID,
    active: true,
    mustChangePassword: false,
    authVersion: 1,
    branchId: "main",
    name: "Lectora",
    email: "lectura@example.test",
    role: { name: roleName, permissions: grants },
  };
  const db: any = {
    user: { findUnique: async () => user },
    settings: { findUnique: async () => null },
    authSession: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({
        id: SESSION_ID,
        userId: USER_ID,
        terminalId: null,
        lastActivityAt: new Date(),
      }),
    },
    terminal: { findUnique: async () => null, update: async () => ({}) },
  };
  return new AuthGuard(
    db,
    { verify: () => payload() } as any,
    new Reflector(),
  );
}

async function outcome(guard: AuthGuard, route: Route) {
  const { ctx } = context(route);
  try {
    await guard.canActivate(ctx);
    return "allowed";
  } catch (error: any) {
    return error?.getStatus?.() === 403
      ? "forbidden"
      : "error:" + (error?.message ?? error);
  }
}

const DENIED_MESSAGE = (() => {
  try {
    denied();
  } catch (error: any) {
    return error.message as string;
  }
  return "";
})();

describe("rol lectura · permisos del rol", () => {
  it("tiene exactamente catalog:read, reports:read, sale:read y cash:read", () => {
    expect([...LECTURA].sort()).toEqual(
      ["catalog:read", "reports:read", "sale:read", "cash:read"].sort(),
    );
  });

  it("no tiene ningún permiso de escritura, administración ni costos", () => {
    for (const p of LECTURA) {
      expect(p.endsWith(":read")).toBe(true);
    }
    expect(can(LECTURA, "profit:read")).toBe(false);
    expect(can(LECTURA, "sale:manage")).toBe(false);
    expect(can(LECTURA, "*")).toBe(false);
  });

  it("los roles existentes conservan su acceso y no ganan datos nuevos", () => {
    expect(can(permissions.seller, "sale:read")).toBe(true);
    expect(can(permissions.seller, "cash:read")).toBe(true);
    expect(can(permissions.manager, "sale:read")).toBe(true);
    expect(can(permissions.manager, "cash:read")).toBe(true);
    expect(can(permissions.admin, "sale:read")).toBe(true);
    expect(can(permissions.warehouse, "sale:read")).toBe(false);
    expect(can(permissions.warehouse, "cash:read")).toBe(false);
    expect(can(permissions.gv, "sale:read")).toBe(false);
    expect(can(permissions.gv, "cash:read")).toBe(false);
  });
});

describe("rol lectura · ninguna escritura la acepta", () => {
  it("las rutas con @Permit('authenticated') que escriben son sólo las revisadas", () => {
    const found = writes
      .filter((r) => r.permission === "authenticated")
      .map((r) => `${r.controller}.${r.name}`)
      .sort();
    expect(found).toEqual([...AUTHENTICATED_WRITES].sort());
  });

  it("toda ruta de escritura exige un permiso que el rol lectura no tiene", () => {
    const leaks = writes
      .filter((r) => r.permission !== "authenticated")
      .filter((r) => !r.permission || can(LECTURA, r.permission))
      .map((r) => `${r.controller}.${r.name} (${r.permission ?? "sin permiso"})`);
    expect(leaks).toEqual([]);
  });

  it("el guard responde 403 a cada escritura (ventas, cobros, anulaciones, precios, mercancía, usuarios, roles, configuración)", async () => {
    const guard = guardFor("lectura", LECTURA);
    const protectedWrites = writes.filter(
      (r) => r.permission !== "authenticated",
    );
    expect(protectedWrites.length).toBeGreaterThan(50);
    const results = await Promise.all(
      protectedWrites.map(async (r) => [
        `${r.controller}.${r.name}`,
        await outcome(guard, r),
      ]),
    );
    expect(results.filter(([, o]) => o !== "forbidden")).toEqual([]);
  });

  it("los equipos (registrar, renombrar, aprobar con PIN) se niegan a quien no escribe", async () => {
    // Sin base de datos: la negativa llega antes de tocar la tabla de equipos.
    const realtime = new RealtimeController({} as any);
    const actor: any = {
      id: USER_ID,
      name: "Lectora",
      email: "lectura@example.test",
      role: "lectura",
      permissions: LECTURA,
      branchId: "main",
    };
    const id = "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c";
    for (const call of [
      () => realtime.register({}, actor),
      () => realtime.rename(id, {}, actor),
      () => realtime.approveWithPin(id, {}, actor),
    ]) {
      await expect(call()).rejects.toMatchObject({ message: DENIED_MESSAGE });
    }
  });

  it("la denegación es la de permisos, no una comprobación de terminal", async () => {
    const guard = guardFor("lectura", LECTURA);
    const sale = ALL.find(
      (r) => r.controller === "SalesController" && r.name === "sale",
    )!;
    const { ctx } = context(sale);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: DENIED_MESSAGE,
    });
  });

  it("GET /admin/users y GET /admin/roles siguen siendo sólo de administración", async () => {
    const guard = guardFor("lectura", LECTURA);
    for (const name of ["users", "roles", "auditLog"]) {
      const route = ALL.find(
        (r) => r.controller === "AdminController" && r.name === name,
      )!;
      expect(route, name).toBeDefined();
      expect(await outcome(guard, route), name).toBe("forbidden");
    }
  });
});

describe("rol lectura · GET nuevos", () => {
  const sales = () =>
    ALL.find((r) => r.controller === "SalesController" && r.name === "list")!;
  const sessions = () =>
    ALL.find((r) => r.controller === "CashController" && r.name === "sessions")!;

  it("GET /sales y GET /cash-sessions dejan entrar al rol lectura", async () => {
    const guard = guardFor("lectura", LECTURA);
    expect(await outcome(guard, sales())).toBe("allowed");
    expect(await outcome(guard, sessions())).toBe("allowed");
  });

  it("sólo cambian esos GET: la escritura de ventas y caja sigue cerrada", async () => {
    const guard = guardFor("lectura", LECTURA);
    const saleWrite = ALL.find(
      (r) => r.controller === "SalesController" && r.name === "sale",
    )!;
    const openCash = ALL.find(
      (r) => r.controller === "CashController" && r.name === "open",
    )!;
    expect(await outcome(guard, saleWrite)).toBe("forbidden");
    expect(await outcome(guard, openCash)).toBe("forbidden");
  });

  it("warehouse y gv no reciben GET de ventas ni de caja", async () => {
    for (const [role, grants] of [
      ["warehouse", permissions.warehouse],
      ["gv", permissions.gv],
    ] as const) {
      const guard = guardFor(role, grants);
      expect(await outcome(guard, sales()), role).toBe("forbidden");
      expect(await outcome(guard, sessions()), role).toBe("forbidden");
    }
  });

  it("seller, manager y admin siguen entrando a ambos GET", async () => {
    for (const [role, grants] of [
      ["seller", permissions.seller],
      ["manager", permissions.manager],
      ["admin", permissions.admin],
    ] as const) {
      const guard = guardFor(role, grants);
      expect(await outcome(guard, sales()), role).toBe("allowed");
      expect(await outcome(guard, sessions()), role).toBe("allowed");
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { permissions } from "../packages/shared/src/index";
import { AuthGuard } from "../apps/api/src/common";
import { tenantScope } from "../apps/api/src/tenant-context";
import { createAppModule } from "../apps/api/src/app";
import { SupportAccessWorker } from "../apps/api/src/support-access";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const apiRequire = createRequire(resolve(import.meta.dirname, "../apps/api/package.json"));
const { MODULE_METADATA, METHOD_METADATA, PATH_METADATA } = apiRequire("@nestjs/common/constants");
const { RequestMethod } = apiRequire("@nestjs/common");

function productWriteRoutes() {
  const previous = process.env.PRODUCT_TENANCY;
  process.env.PRODUCT_TENANCY = "required";
  let module: ReturnType<typeof createAppModule>;
  try { module = createAppModule("test-only-route-inventory-secret"); }
  finally {
    if (previous === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = previous;
  }
  const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) as Array<new (...args: never[]) => object>;
  return controllers.flatMap((controller) => {
    const prefix = String(Reflect.getMetadata(PATH_METADATA, controller) ?? "");
    return Object.getOwnPropertyNames(controller.prototype).flatMap((key) => {
      const handler = (controller.prototype as Record<string, unknown>)[key];
      if (typeof handler !== "function") return [];
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (method === undefined || !["POST", "PATCH", "PUT", "DELETE"].includes(RequestMethod[method])) return [];
      const route = String(Reflect.getMetadata(PATH_METADATA, handler) ?? "");
      return [`${RequestMethod[method]} /api/${[prefix, route].filter(Boolean).join("/")}`];
    });
  });
}

const tenantId = "00000000-0000-0000-0000-000000000123";
const userId = "00000000-0000-0000-0000-000000000124";
const sid = "00000000-0000-0000-0000-000000000125";

function fixture(method: string, expiresAt = new Date(Date.now() + 3600000)) {
  const req: any = { method, path: "/api/products", headers: { authorization: "Bearer prueba" } };
  const db: any = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: userId, name: "Soporte", email: "support@example.invalid", tenantId, branchId: "main", active: true, authVersion: 1, mustChangePassword: false, supportExpiresAt: expiresAt, role: { name: "support", permissions: ["*"] } }) },
    settings: { findUnique: vi.fn().mockResolvedValue(null) },
    authSession: { findUnique: vi.fn().mockResolvedValue({ id: sid, userId, lastActivityAt: new Date() }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
  };
  const reflector: any = { getAllAndOverride: (key: string) => key === "permission" ? "catalog:read" : undefined };
  const guard = new AuthGuard(db, { verify: () => ({ sub: userId, sid, type: "access", version: 1, tenantId }) } as any, reflector, { statusForTenant: async () => ({ status: "active" }) } as any);
  const context: any = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => req }) };
  return { req, db, guard, context };
}

describe("N-05 · soporte solo lectura", () => {
  it("un barrido manual espera al automático y vuelve a comprobar vencimientos", async () => {
    const previous = process.env.PRODUCT_TENANCY;
    delete process.env.PRODUCT_TENANCY;
    let release!: (users: any[]) => void;
    const first = new Promise<any[]>((resolve) => { release = resolve; });
    const db: any = { user: { findMany: vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce([]) } };
    try {
      const worker = new SupportAccessWorker(db);
      const automatic = worker.run(new Date());
      await Promise.resolve();
      const manual = worker.run(new Date());
      release([]);
      await Promise.all([automatic, manual]);
      expect(db.user.findMany).toHaveBeenCalledTimes(2);
    } finally {
      if (previous === undefined) delete process.env.PRODUCT_TENANCY;
      else process.env.PRODUCT_TENANCY = previous;
    }
  });
  it("SOP-01: su rol solo lee el catálogo (sin reportes, costos ni margen)", () => {
    expect(permissions.support).toEqual(["catalog:read"]);
  });

  it("niega POST, PATCH, PUT y DELETE aun si el rol de base fue alterado a asterisco", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const { guard, context, db } = fixture(method);
      await tenantScope.run({ tenantId }, () => expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 }));
      // CPC-6 punto 5: el intento queda anotado; nada más se escribe.
      expect(db.auditLog.create).toHaveBeenCalledTimes(1);
      expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "support.write_denied" });
    }
  });

  it("niega cada ruta de escritura protegida del producto", async () => {
    const writeRoutes = productWriteRoutes().filter((route) =>
      !["POST /api/auth/login", "POST /api/auth/refresh", "POST /api/auth/logout"].includes(route));
    expect(writeRoutes.length).toBeGreaterThan(60);
    for (const route of writeRoutes) {
      const [method, path] = route.split(" ");
      const { guard, context, req } = fixture(method);
      req.path = path;
      await tenantScope.run({ tenantId }, () => expect(guard.canActivate(context), route).rejects.toMatchObject({ status: 403 }));
    }
  });

  it("GET queda en transacción de solo lectura y audita fuera de ella", async () => {
    const { guard, context, req, db } = fixture("GET");
    await tenantScope.run({ tenantId }, async () => {
      expect(await guard.canActivate(context)).toBe(true);
      expect(tenantScope.getStore()?.readOnly).toBe(true);
    });
    expect(req.actor.permissions).toEqual(permissions.support);
    expect(db.auditLog.create).toHaveBeenCalledOnce();
  });

  it("permite únicamente cerrar sesión como excepción POST", async () => {
    const { guard, context, req } = fixture("POST");
    req.path = "/api/auth/logout";
    await tenantScope.run({ tenantId }, async () => {
      expect(await guard.canActivate(context)).toBe(true);
      expect(tenantScope.getStore()?.readOnly).not.toBe(true);
    });
  });

  it("vence con 401 aunque la sesión siga viva", async () => {
    const { guard, context } = fixture("GET", new Date(Date.now() - 1000));
    await tenantScope.run({ tenantId }, () => expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 }));
  });
});

import { describe, expect, it, vi } from "vitest";
import { permissions } from "../packages/shared/src/index";
import { AuthGuard } from "../apps/api/src/common";
import { tenantScope } from "../apps/api/src/tenant-context";

const tenantId = "00000000-0000-0000-0000-000000000123";
const userId = "00000000-0000-0000-0000-000000000124";
const sid = "00000000-0000-0000-0000-000000000125";

function fixture(method: string, expiresAt = new Date(Date.now() + 3600000)) {
  const req: any = { method, path: "/api/reports/ranking-cajeras", headers: { authorization: "Bearer prueba" } };
  const db: any = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: userId, name: "Soporte", email: "support@example.invalid", tenantId, branchId: "main", active: true, authVersion: 1, mustChangePassword: false, supportExpiresAt: expiresAt, role: { name: "support", permissions: ["*"] } }) },
    settings: { findUnique: vi.fn().mockResolvedValue(null) },
    authSession: { findUnique: vi.fn().mockResolvedValue({ id: sid, userId, lastActivityAt: new Date() }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
  };
  const reflector: any = { getAllAndOverride: (key: string) => key === "permission" ? "reports:read" : undefined };
  const guard = new AuthGuard(db, { verify: () => ({ sub: userId, sid, type: "access", version: 1, tenantId }) } as any, reflector, { statusForTenant: async () => ({ status: "active" }) } as any);
  const context: any = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => req }) };
  return { req, db, guard, context };
}

describe("N-05 · soporte solo lectura", () => {
  it("su rol tiene solo los tres permisos de lectura declarados", () => {
    expect(permissions.support).toEqual(["catalog:read", "reports:read", "profit:read"]);
  });

  it("niega POST, PATCH, PUT y DELETE aun si el rol de base fue alterado a asterisco", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const { guard, context, db } = fixture(method);
      await tenantScope.run({ tenantId }, () => expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 }));
      expect(db.auditLog.create).not.toHaveBeenCalled();
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

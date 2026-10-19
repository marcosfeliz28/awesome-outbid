import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantScope = { tenantId: string; transaction?: unknown };
export const tenantScope = new AsyncLocalStorage<TenantScope>();

// Sólo el AuthGuard confía en la firma. Esta lectura previa selecciona la
// partición RLS para que el propio guard pueda cargar el usuario.
export function tenantFromRequest(req: Request): string {
  const token = req.headers.authorization?.match(/^Bearer ([^.]+)\.([^.]+)\./)?.[2];
  if (token) {
    try {
      const claim = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
      if (typeof claim.tenantId === "string" && uuid.test(claim.tenantId))
        return claim.tenantId;
    } catch {
      // El AuthGuard rechazará el token mal formado.
    }
  }
  // Antes del registro autoservicio, los clientes de prueba eligen su empresa
  // para el login con este encabezado. La firma decide toda operación privada.
  const header = req.headers["x-tenant-id"];
  if (typeof header === "string" && uuid.test(header)) return header;
  const cookie = req.headers.cookie?.match(/(?:^|;\s*)nexora_tenant=([^;]+)/)?.[1];
  return cookie && uuid.test(cookie) ? cookie : DEMO_TENANT_ID;
}

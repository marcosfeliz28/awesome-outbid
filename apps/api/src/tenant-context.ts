import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantScope = { tenantId: string; transaction?: unknown; readOnly?: boolean };
export const tenantScope = new AsyncLocalStorage<TenantScope>();

export function currentTenantId(): string {
  const tenantId = tenantScope.getStore()?.tenantId;
  if (tenantId) return tenantId;
  if (process.env.PRODUCT_TENANCY === "required")
    throw new Error("Falta el contexto de empresa para consultar la base de datos.");
  return DEMO_TENANT_ID;
}

// Claves compuestas de Prisma: no se puede consultar el identificador de otra
// empresa ni reservar su clave, incluso si dos empresas usan el mismo texto.
export function tenantUnique<Field extends string>(field: Field, value: string | undefined): {
  [Key in `tenantId_${Field}`]: { tenantId: string } & Record<Field, string>
} {
  if (value === undefined) throw new Error(`Falta ${field} para buscar el registro.`);
  return {
    [`tenantId_${field}`]: { tenantId: currentTenantId(), [field]: value },
  } as { [Key in `tenantId_${Field}`]: { tenantId: string } & Record<Field, string> };
}

export async function forEachActiveTenant<Result>(
  db: { activeTenantIds(): Promise<string[]> },
  task: () => Promise<Result>,
): Promise<Result[]> {
  if (process.env.PRODUCT_TENANCY !== "required" || tenantScope.getStore()?.tenantId)
    return [await task()];
  const results: Result[] = [];
  for (const tenantId of await db.activeTenantIds())
    results.push(await tenantScope.run({ tenantId }, task));
  return results;
}

// Sólo el AuthGuard confía en la firma. Esta lectura previa selecciona la
// partición RLS para que el propio guard pueda cargar el usuario.
export function tenantFromRequest(req: Request): string | null {
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
  if (process.env.PRODUCT_TENANCY !== "required" && typeof header === "string" && uuid.test(header)) return header;
  const name = tenantCookieName();
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part: string) => part.trim().split("="))
    .find(([key]: string[]) => key === name)?.[1];
  if (cookie && uuid.test(cookie)) return cookie;
  return process.env.PRODUCT_TENANCY === "required" ? null : DEMO_TENANT_ID;
}

// CPC-8: las cookies no distinguen puerto; la edición local (localhost:4473)
// usa nombres propios para no pisar la sesión de la tienda (localhost:4173).
const localProfile = () => process.env.PRODUCT_LOCAL_LICENSE === "required";
export const refreshCookieName = () => (localProfile() ? "nexora_local_refresh" : "fitstore_refresh");
export const tenantCookieName = () => (localProfile() ? "nexora_local_tenant" : "nexora_tenant");

// Palabras y valores propios de la tienda (la dueña, su mensajero) que el
// producto no muestra a otras empresas.
export const productMode = () => process.env.PRODUCT_TENANCY === "required";
export const ownerWord = () => (productMode() ? "la administración" : "la dueña");
export const defaultCourier = () => (productMode() ? "Mensajero" : "Addison");

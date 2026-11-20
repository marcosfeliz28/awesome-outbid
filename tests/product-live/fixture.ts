// Fixture de las pruebas contra la API REAL en modo producto
// (PRODUCT_TENANCY=required), que arranca scripts/verify-product.mjs: empresa
// ficticia creada por invitación del operador, administradora y cajera con
// sesión de verdad (login por código de empresa). Sin SQL ni tokens fabricados.
import { randomUUID } from "node:crypto";

export const API = (
  process.env.FITSTORE_API_URL || "http://127.0.0.1:3101/api"
).replace(/\/+$/, "");
export const PLATFORM_TOKEN = process.env.NEXORA_CI_PLATFORM_TOKEN || "";
export const ADMIN_PASSWORD = "ClaveAdmin-Ficticia-2026!";
export const ADMIN_PIN = "869253";
export const CASHIER_TEMPORARY = "739205";
export const CASHIER_PASSWORD = "583904";
export const CASHIER_PIN = "246813";

export type Reply = { status: number; body: any; headers: Headers };

export async function call(
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
    tenant?: string;
    platform?: boolean;
    raw?: boolean;
  } = {},
): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = "Bearer " + options.token;
  if (options.platform) headers.Authorization = "Platform " + PLATFORM_TOKEN;
  if (options.tenant) headers["x-tenant-id"] = options.tenant;
  const response = await fetch(API + path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000),
  });
  if (options.raw)
    return {
      status: response.status,
      body: Buffer.from(await response.arrayBuffer()),
      headers: response.headers,
    };
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Texto o binario.
  }
  return { status: response.status, body, headers: response.headers };
}

/** Igual que call, pero falla con el cuerpo de la respuesta si no es 2xx. */
export async function ok(
  method: string,
  path: string,
  options: Parameters<typeof call>[2] = {},
) {
  const reply = await call(method, path, options);
  if (reply.status >= 300)
    throw new Error(
      `${method} ${path}: ${reply.status} ${JSON.stringify(reply.body)}`,
    );
  return reply.body;
}

export type Company = {
  slug: string;
  tenantId: string;
  adminEmail: string;
  admin: string;
  cashier: string;
  cashierId: string;
  cashierEmail: string;
};

async function registerTerminal(token: string, approver: string, name: string) {
  const id = randomUUID();
  const terminal = await ok("POST", "/terminals/register", {
    token,
    body: { id, name, secret: "terminal-ficticia-" + id },
  });
  if (terminal.status === "pending")
    await ok("POST", `/terminals/${id}/approve`, { token: approver, body: {} });
  return id;
}

export async function login(slug: string, email: string, password: string) {
  return call("POST", "/auth/login", {
    tenant: slug,
    body: { login: email, password },
  });
}

/**
 * Empresa ficticia completa por el camino real del producto: el operador la
 * invita (plan pro: 2 sucursales), la dueña acepta y entra con su código de
 * empresa; crea una cajera, que cambia su clave temporal y entra; los dos
 * equipos quedan aprobados.
 */
export async function createCompany(slug: string): Promise<Company> {
  const adminEmail = `duena@${slug}.example.invalid`;
  const invited = await ok("POST", "/platform/tenants", {
    platform: true,
    body: {
      businessName: `Empresa ficticia ${slug}`,
      companyCode: slug,
      businessType: "retail",
      plan: "pro",
      adminName: `Dueña ficticia ${slug}`,
      adminEmail,
      operadora: "Operadora CI",
      acuerdo: {
        version: "ci-1",
        fecha: "2026-11-20",
        referencia: "Carpeta CI",
      },
    },
  });
  const token = String(invited.invitationUrl).split("#token=")[1];
  await ok("POST", "/auth/accept-invitation", {
    body: {
      token,
      password: ADMIN_PASSWORD,
      managerPin: ADMIN_PIN,
      consentAccepted: true,
    },
  });
  const session = await login(slug, adminEmail, ADMIN_PASSWORD);
  if (session.status !== 201)
    throw new Error(
      `login admin ${slug}: ${session.status} ${JSON.stringify(session.body)}`,
    );
  const admin = session.body.accessToken as string;
  await registerTerminal(admin, admin, `Caja dueña ${slug}`);

  const roles = await ok("GET", "/roles", { token: admin });
  const seller = roles.find((role: any) => role.name === "seller");
  if (!seller)
    throw new Error(`${slug}: sin rol seller ${JSON.stringify(roles)}`);
  const cashierEmail = `cajera@${slug}.example.invalid`;
  const user = await ok("POST", "/users", {
    token: admin,
    body: {
      name: `Cajera ficticia ${slug}`,
      email: cashierEmail,
      password: CASHIER_TEMPORARY,
      pin: CASHIER_PIN,
      roleId: seller.id,
    },
  });
  const changed = await ok("POST", "/auth/change-password", {
    tenant: slug,
    body: {
      login: cashierEmail,
      currentPassword: CASHIER_TEMPORARY,
      newPassword: CASHIER_PASSWORD,
      confirmPassword: CASHIER_PASSWORD,
    },
  });
  const cashier = changed.accessToken as string;
  await registerTerminal(cashier, admin, `Caja cajera ${slug}`);
  return {
    slug,
    tenantId: invited.id,
    adminEmail,
    admin,
    cashier,
    cashierId: user.id,
    cashierEmail,
  };
}

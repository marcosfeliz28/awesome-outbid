import { createHash } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";

type Bucket = { count: number; until: number };
export type RequestRateLimitOptions = {
  windowMs?: number;
  now?: () => number;
  maxBuckets?: number;
};
const digest = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\u0000")).digest("hex");
const positiveLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const REQUEST_RATE_LIMITS = {
  authAccount: positiveLimit(process.env.AUTH_ACCOUNT_RATE_LIMIT, 60),
  authIp: positiveLimit(process.env.AUTH_IP_RATE_LIMIT, 600),
  pinSession: positiveLimit(process.env.PIN_SESSION_RATE_LIMIT, 60),
  refreshSession: positiveLimit(process.env.REFRESH_SESSION_RATE_LIMIT, 60),
  logoutSession: positiveLimit(process.env.LOGOUT_SESSION_RATE_LIMIT, 60),
  salesSession: positiveLimit(process.env.SALES_SESSION_RATE_LIMIT, 120),
  // SEC-01: cada importación descomprime y analiza un Excel; una sesión no
  // necesita más de unas pocas por minuto.
  importSession: positiveLimit(process.env.IMPORT_SESSION_RATE_LIMIT, 30),
};

/** Sólo recibe identidades ya verificadas contra la base de datos. */
export class ValidatedRateLimitStore {
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxBuckets: number;
  private readonly buckets = new Map<string, Bucket>();
  constructor(options: RequestRateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.now = options.now ?? Date.now;
    this.maxBuckets = positiveLimit(
      options.maxBuckets === undefined ? undefined : String(options.maxBuckets),
      10_000,
    );
  }
  exceeds(scope: string, identity: string[], limit: number) {
    const at = this.now();
    const key = digest(scope, ...identity);
    const item = this.buckets.get(key);
    if (item?.until && item.until > at) {
      if (item.count >= limit) return true;
      item.count += 1;
      return false;
    }
    if (item) this.buckets.delete(key);
    if (this.buckets.size >= this.maxBuckets) {
      // Map conserva el orden de inserción. Expulsar siempre el cubo FIFO
      // mantiene memoria y admisión acotadas en O(1): llenar el mapa con IPs
      // falsas nunca convierte su capacidad interna en un 429 global.
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }
    this.buckets.set(key, { count: 1, until: at + this.windowMs });
    return false;
  }
  limited(scope: string, identity: string[], limit: number) {
    const item = this.buckets.get(digest(scope, ...identity));
    return !!item && item.until > this.now() && item.count >= limit;
  }
  size() {
    return this.buckets.size;
  }
}

@Injectable()
export class RequestRateLimitService {
  private readonly store = new ValidatedRateLimitStore();
  private readonly knownAuthIdentities = new Set<string>();
  assert(scope: string, identity: string[], limit: number) {
    if (this.store.exceeds(scope, identity, limit))
      throw new HttpException(
        "Demasiados intentos. Espera un minuto.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  limited(scope: string, identity: string[], limit: number) {
    return this.store.limited(scope, identity, limit);
  }
  rememberAuthIdentity(identity: string) {
    this.knownAuthIdentities.add(identity);
  }
  knowsAuthIdentity(identity: string) {
    return this.knownAuthIdentities.has(identity);
  }
}

export const normalizeRequestIp = (value: unknown) => {
  const ip = String(value ?? "")
    .trim()
    .toLowerCase();
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
};

const requestPath = (req: any) => {
  const path = String(req.path ?? req.url ?? "")
    .split("?", 1)[0]
    .trim()
    .toLowerCase()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
  return path || "/";
};
/** Se ejecuta después de AuthGuard; los Bearer falsos nunca crean un cubo. */
@Injectable()
export class AuthenticatedRateLimitGuard implements CanActivate {
  constructor(
    @Inject(RequestRateLimitService)
    private readonly limits: RequestRateLimitService,
  ) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<any>();
    const actor = req.actor;
    if (!actor?.sessionId) return true;
    const method = String(req.method ?? "GET").toUpperCase();
    const path = requestPath(req);
    // La sesión ya está firmada y validada por AuthGuard. No añadir la IP:
    // además de cambiar legítimamente en celulares, una cabecera reenviada
    // manipulable permitiría reiniciar el contador de la misma sesión.
    const identity = [String(actor.sessionId)];
    if (method === "POST" && (path === "/api/auth/pin" || path === "/auth/pin"))
      this.limits.assert(
        "auth-pin-session",
        identity,
        REQUEST_RATE_LIMITS.pinSession,
      );
    else if (
      method === "POST" &&
      (path === "/api/auth/logout" || path === "/auth/logout")
    )
      this.limits.assert(
        "auth-logout-session",
        identity,
        REQUEST_RATE_LIMITS.logoutSession,
      );
    else if (
      method === "POST" &&
      (path === "/api/sales" ||
        path.startsWith("/api/sales/") ||
        path === "/sales" ||
        path.startsWith("/sales/"))
    )
      this.limits.assert(
        "sales-session",
        identity,
        REQUEST_RATE_LIMITS.salesSession,
      );
    // Un solo cubo para todos los */import (catálogo y facturas): alternar
    // entre importadores no multiplica el cupo.
    else if (method === "POST" && /^(\/api)?\/[^/]+\/import$/.test(path))
      this.limits.assert(
        "import-session",
        identity,
        REQUEST_RATE_LIMITS.importSession,
      );
    return true;
  }
}

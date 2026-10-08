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
export type RequestRateLimitOptions = { windowMs?: number; now?: () => number };
const digest = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\u0000")).digest("hex");
const positiveLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const REQUEST_RATE_LIMITS = {
  authAccount: positiveLimit(process.env.AUTH_ACCOUNT_RATE_LIMIT, 60),
  pinSession: positiveLimit(process.env.PIN_SESSION_RATE_LIMIT, 60),
  refreshSession: positiveLimit(process.env.REFRESH_SESSION_RATE_LIMIT, 60),
  salesSession: positiveLimit(process.env.SALES_SESSION_RATE_LIMIT, 120),
};

/** Sólo recibe identidades ya verificadas contra la base de datos. */
export class ValidatedRateLimitStore {
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();
  private nextPurgeAt = 0;
  constructor(options: RequestRateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }
  exceeds(scope: string, identity: string[], limit: number) {
    const at = this.now();
    if (at >= this.nextPurgeAt) {
      for (const [key, value] of this.buckets)
        if (value.until <= at) this.buckets.delete(key);
      this.nextPurgeAt = at + Math.max(1_000, Math.min(this.windowMs, 60_000));
    }
    const key = digest(scope, ...identity);
    const item = this.buckets.get(key);
    if (item?.until && item.until > at) {
      if (item.count >= limit) return true;
      item.count += 1;
      return false;
    }
    this.buckets.set(key, { count: 1, until: at + this.windowMs });
    return false;
  }
  size() {
    return this.buckets.size;
  }
}

@Injectable()
export class RequestRateLimitService {
  private readonly store = new ValidatedRateLimitStore();
  assert(scope: string, identity: string[], limit: number) {
    if (this.store.exceeds(scope, identity, limit))
      throw new HttpException(
        "Demasiados intentos. Espera un minuto.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
}

const requestPath = (req: any) =>
  String(req.path ?? req.url?.split("?")[0] ?? "").toLowerCase();
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
    return true;
  }
}

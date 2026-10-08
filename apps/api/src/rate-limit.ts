import { createHash } from "node:crypto";

type Bucket = { count: number; until: number };

export type RequestRateLimitOptions = {
  windowMs?: number;
  authAccountLimit?: number;
  salesSessionLimit?: number;
  now?: () => number;
};

const loginIdentifier = (req: any) =>
  String(req.body?.login ?? req.body?.email ?? "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("es");

const sessionIdentifier = (req: any) => {
  const authorization = String(req.headers?.authorization ?? "");
  return authorization
    ? createHash("sha256").update(authorization).digest("hex")
    : "anonymous";
};

/**
 * Render puede presentar varias cajas bajo la dirección del proxy. Por eso no
 * existe un contador compartido por IP: login se limita por cuenta+IP y ventas
 * por sesión+IP. Tráfico anónimo o con tokens falsos sólo agota su propia clave.
 * La protección persistente de cinco claves erróneas sigue en AuthAttempt.
 */
export function createRequestRateLimiter(
  options: RequestRateLimitOptions = {},
) {
  const windowMs = options.windowMs ?? 60_000;
  const authAccountLimit = options.authAccountLimit ?? 60;
  const salesSessionLimit = options.salesSessionLimit ?? 120;
  const now = options.now ?? Date.now;
  const attempts = new Map<string, Bucket>();

  const exceeds = (key: string, limit: number, at: number) => {
    const item = attempts.get(key);
    const current = item && item.until > at ? item : null;
    if (current && current.count >= limit) return true;
    attempts.set(key, {
      count: (current?.count ?? 0) + 1,
      until: current?.until ?? at + windowMs,
    });
    return false;
  };

  return (req: any, res: any, next: () => void) => {
    const path = String(req.path ?? req.url?.split("?")[0] ?? "").toLowerCase();
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
    const at = now();
    const auth = path.startsWith("/api/auth/");
    const sale = req.method === "POST" && path.startsWith("/api/sales");
    let blocked = false;

    if (auth) {
      const identifier = loginIdentifier(req);
      if (identifier)
        blocked = exceeds(
          `auth-account:${ip}:${identifier}`,
          authAccountLimit,
          at,
        );
    } else if (sale) {
      blocked = exceeds(
        `sales-session:${ip}:${sessionIdentifier(req)}`,
        salesSessionLimit,
        at,
      );
    }

    if (blocked) {
      res
        .status(429)
        .json({ message: "Demasiados intentos. Espera un minuto." });
      return;
    }
    if (attempts.size > 10_000) {
      for (const [key, value] of attempts)
        if (value.until < at) attempts.delete(key);
      while (attempts.size > 10_000) {
        const oldest = attempts.keys().next().value;
        if (!oldest) break;
        attempts.delete(oldest);
      }
    }
    next();
  };
}

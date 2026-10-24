import { createPublicKey, verify } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type LicenseClaims = {
  version: 1;
  installationId: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "unpaid";
};
export type SignedLicense = { claims: LicenseClaims; signature: string };
export type LicenseState = {
  mode: "write" | "read-only";
  reason: string;
  expiresAt?: string;
};
const DAY = 86400000;
const CLOCK_TOLERANCE = 5 * 60000;
// Fixed serialization; signing JSON with caller-selected key order is ambiguous.
export function licensePayload(c: LicenseClaims) {
  return JSON.stringify([
    c.version,
    c.installationId,
    c.issuedAt,
    c.expiresAt,
    c.status,
  ]);
}
function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}
function persist(path: string, value: unknown) {
  const temporary = path + ".new";
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}
export class LocalLicense {
  private readonly tokenPath: string;
  private readonly clockPath: string;
  private readonly key: ReturnType<typeof createPublicKey>;
  constructor(
    private readonly options: {
      directory: string;
      publicKey: string;
      installationId: string;
      now?: () => number;
    },
  ) {
    this.key = createPublicKey(options.publicKey);
    if (this.key.asymmetricKeyType !== "ed25519")
      throw new Error("La clave de licencia debe ser Ed25519.");
    mkdirSync(options.directory, { recursive: true, mode: 0o700 });
    this.tokenPath = join(options.directory, "license.json");
    this.clockPath = join(options.directory, "clock.json");
  }
  private validate(value: unknown): SignedLicense {
    if (!value || typeof value !== "object")
      throw new Error("Licencia inválida.");
    const { claims: c, signature } = value as SignedLicense;
    if (
      !c ||
      c.version !== 1 ||
      c.installationId !== this.options.installationId ||
      !["active", "unpaid"].includes(c.status) ||
      typeof signature !== "string" ||
      ![c.issuedAt, c.expiresAt].every(
        (s) =>
          typeof s === "string" &&
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) &&
          new Date(s).toISOString() === s,
      )
    )
      throw new Error("Licencia inválida.");
    const issued = Date.parse(c.issuedAt),
      expires = Date.parse(c.expiresAt);
    if (
      expires <= issued ||
      expires - issued > 7 * DAY ||
      !/^[A-Za-z0-9_-]{86}$/.test(signature) ||
      !verify(
        null,
        Buffer.from(licensePayload(c)),
        this.key,
        Buffer.from(signature, "base64url"),
      )
    )
      throw new Error("Firma o plazo de licencia inválido.");
    return value as SignedLicense;
  }
  private tokens(): SignedLicense[] {
    const raw = readJson(this.tokenPath);
    if (!raw) return [];
    if (!Array.isArray(raw)) throw new Error("Historial de licencia inválido.");
    return raw.map((item) => this.validate(item));
  }
  install(value: unknown) {
    const token = this.validate(value);
    const now = (this.options.now ?? Date.now)();
    const history = this.tokens();
    if (history.length) {
      const oldClaims = history[history.length - 1].claims;
      if (Date.parse(token.claims.issuedAt) <= Date.parse(oldClaims.issuedAt))
        throw new Error("La renovación debe ser más reciente.");
    }
    if (Date.parse(token.claims.issuedAt) > now + CLOCK_TOLERANCE)
      throw new Error("La licencia viene del futuro.");
    persist(this.tokenPath, [...history, token].slice(-60));
    // Una respuesta nueva y firmada por el servidor es una fuente de tiempo
    // más fiable que el máximo local. Esto permite recuperarse si Windows se
    // adelantó por accidente, sin aceptar el token anterior ni uno futuro.
    this.advanceClock(now, true);
  }
  private advanceClock(now: number, trustedRenewal = false) {
    const old = readJson(this.clockPath) as { lastSeen?: number } | undefined;
    if (old && typeof old.lastSeen !== "number")
      throw new Error("Registro del reloj inválido.");
    if (trustedRenewal) {
      persist(this.clockPath, { lastSeen: now });
      return true;
    }
    if (old && now + CLOCK_TOLERANCE < old.lastSeen!) return false;
    if (!old || now > old.lastSeen! + 60000)
      persist(this.clockPath, { lastSeen: now });
    return true;
  }
  state(now = (this.options.now ?? Date.now)()): LicenseState {
    try {
      if (!this.advanceClock(now))
        return { mode: "read-only", reason: "clock-backwards" };
      const history = this.tokens();
      if (!history.length) return { mode: "read-only", reason: "missing" };
      const { claims } = history[history.length - 1];
      if (now + CLOCK_TOLERANCE < Date.parse(claims.issuedAt))
        return {
          mode: "read-only",
          reason: "clock-backwards",
          expiresAt: claims.expiresAt,
        };
      if (claims.status === "unpaid")
        return {
          mode: "read-only",
          reason: "unpaid",
          expiresAt: claims.expiresAt,
        };
      if (now >= Date.parse(claims.expiresAt))
        return {
          mode: "read-only",
          reason: "expired",
          expiresAt: claims.expiresAt,
        };
      return { mode: "write", reason: "active", expiresAt: claims.expiresAt };
    } catch {
      return { mode: "read-only", reason: "invalid" };
    }
  }
  canWrite(now = (this.options.now ?? Date.now)(), capturedAt?: number) {
    if (this.state(now).mode !== "write") return false;
    if (capturedAt === undefined) return true;
    if (!Number.isFinite(capturedAt) || capturedAt > now + CLOCK_TOLERANCE)
      return false;
    try {
      const tokenAtCapture = this.tokens()
        .filter(
          ({ claims }) =>
            Date.parse(claims.issuedAt) <= capturedAt + CLOCK_TOLERANCE,
        )
        .at(-1);
      if (!tokenAtCapture) return false;
      const { claims } = tokenAtCapture;
      return (
        claims.status === "active" &&
        capturedAt >= Date.parse(claims.issuedAt) - CLOCK_TOLERANCE &&
        capturedAt < Date.parse(claims.expiresAt)
      );
    } catch {
      return false;
    }
  }
  async renew(url: string) {
    if (!/^https:\/\//.test(url))
      throw new Error("La renovación requiere HTTPS.");
    const renewalToken = process.env.PRODUCT_LOCAL_LICENSE_RENEW_TOKEN;
    if (!renewalToken)
      throw new Error("Falta la credencial de renovación local.");
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${renewalToken}`,
      },
      body: JSON.stringify({ installationId: this.options.installationId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("No se pudo renovar la licencia.");
    this.install(await response.json());
  }
}

let configured: LocalLicense | undefined;
export function localLicense() {
  if (configured) return configured;
  if (process.env.PRODUCT_LOCAL_LICENSE !== "required") return undefined;
  const directory = process.env.PRODUCT_LOCAL_LICENSE_DIR;
  const publicKey = process.env.PRODUCT_LOCAL_LICENSE_PUBLIC_KEY?.replace(
    /\\n/g,
    "\n",
  );
  const installationId = process.env.PRODUCT_LOCAL_INSTALLATION_ID;
  if (!directory || !publicKey || !installationId)
    throw new Error("Falta configurar la licencia de Nexora POS Local.");
  configured = new LocalLicense({ directory, publicKey, installationId });
  return configured;
}

export function localLicenseHttp(
  method: string,
  path: string,
  license: LocalLicense | undefined,
  body?: unknown,
) {
  if (!license) return { status: 0 };
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.toLowerCase();
  if (
    normalizedMethod === "GET" &&
    normalizedPath === "/api/local-license/status"
  )
    return { status: 200, body: license.state() };
  if (
    ["GET", "HEAD", "OPTIONS"].includes(normalizedMethod) ||
    (normalizedMethod === "POST" &&
      /^\/api\/auth\/(?:login|refresh|logout)\/?$/.test(normalizedPath))
  )
    return { status: 0 };
  const state = license.state();
  if (
    normalizedMethod === "POST" &&
    /^\/api\/sales\/sync\/?$/.test(normalizedPath) &&
    state.mode === "write"
  ) {
    const sales = (body as { sales?: unknown })?.sales;
    if (
      !Array.isArray(sales) ||
      sales.some((item) => {
        const capturedAt = (item as { capturedAt?: unknown })?.capturedAt;
        return (
          typeof capturedAt !== "string" ||
          !license.canWrite(undefined, Date.parse(capturedAt))
        );
      })
    )
      return {
        status: 423,
        body: {
          message:
            "La cola contiene una venta capturada fuera de la vigencia de la licencia.",
        },
      };
  }
  return state.mode === "write"
    ? { status: 0 }
    : {
        status: 423,
        body: {
          message:
            "La licencia local está en solo lectura. Conéctate para renovarla o consulta al administrador.",
          reason: state.reason,
        },
      };
}

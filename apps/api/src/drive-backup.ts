// Respaldo diario CIFRADO de la base de datos a la carpeta de Google Drive de
// la dueña (docs/RESPALDO_DRIVE.md).
//
// Se activa sólo con GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET y
// BACKUP_ENCRYPTION_KEY (frase de 24 caracteres o más); sin ellas el estado
// dice «no configurado» y nada más ocurre.
//
// Aislamiento: nada de aquí se llama desde ventas ni caja. El temporizador y
// cada respaldo van dentro de try/catch, con tiempos máximos, y un fallo sólo
// queda en el estado (y, si se repite, en un aviso por Telegram). Jamás se
// registran ni devuelven tokens, la URL de la base ni la frase.
//
// Flujo: pg_dump -Fc (cliente PostgreSQL de la imagen, PG_DUMP_BIN) → cifrado
// en flujo NXBK/AES-256-GCM (drive-backup-core.ts) → archivo temporal (sólo
// cifrado) → subida reanudable a Drive → verificación de tamaño y suma →
// retención 30 diarias + 12 mensuales. Un solo respaldo a la vez: arriendo en
// la fila «main» de DriveBackup (como el de NotificationOutbox) más un
// indicador en memoria.
import {
  Controller,
  Get,
  HttpException,
  Inject,
  Injectable,
  Post,
  Query,
  Req,
  Res,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, open, readdir, rm, stat } from "node:fs/promises";
import { setPriority, tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";
import { can } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit, Public, audit } from "./common";
import {
  ALERT_AFTER_FAILURES,
  FRESH_SUCCESS_MS,
  MAX_DAILY_ATTEMPTS,
  MIN_PASSPHRASE,
  RETRY_DELAYS_MS,
  STALE_ALERT_MS,
  backupName,
  createEncryptStream,
  localDay,
  maskAccount,
  nextScheduledRun,
  openSecret,
  pkceChallenge,
  pkceVerifier,
  retentionPlan,
  sameText,
  sanitizeBackupError,
  scheduledRunDue,
  sealSecret,
  sha256Hex,
  signState,
  stateKey,
  verifyState,
  type DriveFileInfo,
} from "./drive-backup-core";
import {
  enqueue,
  escapeHtml,
  formatDate,
  telegramSettings,
} from "./notifications";

// ---------------------------------------------------------------------------
// Configuración

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const FOLDER_NAME = "Nexora POS respaldos";
const STATE_TTL_MS = 10 * 60000;
const COOKIE = "nexora_drive_oauth";
const COOKIE_PATH = "/api/backups/google";
const REQUEST_TIMEOUT_MS = 30000;
const UPLOAD_REQUEST_TIMEOUT_MS = 120000;
const RUN_TIMEOUT_MS = 45 * 60000;
const LEASE_MINUTES = 60;
const UPLOAD_RETRIES = 6;

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function driveBackupSettings(env: NodeJS.ProcessEnv = process.env) {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const passphrase = env.BACKUP_ENCRYPTION_KEY ?? "";
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (passphrase.trim().length < MIN_PASSPHRASE)
    missing.push(`BACKUP_ENCRYPTION_KEY (${MIN_PASSPHRASE} caracteres o más)`);
  const strip = (v: string) => v.replace(/\/+$/, "");
  // GOOGLE_OAUTH_BASE y GOOGLE_DRIVE_BASE existen para probar con un servidor
  // falso local, como TELEGRAM_API_BASE.
  const oauthBase = env.GOOGLE_OAUTH_BASE?.trim();
  const webOrigin = strip(env.WEB_ORIGIN?.trim() || "http://localhost:5173");
  const production = env.NODE_ENV === "production";
  // Perillas sólo para pruebas: en producción se ignoran.
  const test = (name: string) => (production ? undefined : env[name]);
  return {
    configured: missing.length === 0,
    missing,
    clientId,
    clientSecret,
    passphrase,
    authUrl:
      strip(oauthBase || "https://accounts.google.com") + "/o/oauth2/v2/auth",
    tokenUrl: strip(oauthBase || "https://oauth2.googleapis.com") + "/token",
    revokeUrl: strip(oauthBase || "https://oauth2.googleapis.com") + "/revoke",
    driveBase: strip(
      env.GOOGLE_DRIVE_BASE?.trim() || "https://www.googleapis.com",
    ),
    webOrigin,
    redirectUri:
      env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
      webOrigin + "/api/backups/google/callback",
    secureCookie: production,
    pgDumpBin: env.PG_DUMP_BIN?.trim() || "pg_dump",
    maxBytes: num(env.DRIVE_BACKUP_MAX_BYTES, 2 * 1024 ** 3),
    startDelayMs: num(test("DRIVE_BACKUP_START_DELAY_MS"), 2 * 60000),
    tickMs: num(test("DRIVE_BACKUP_TICK_MS"), 60000),
    retryDelaysMs: test("DRIVE_BACKUP_RETRY_MS")
      ? RETRY_DELAYS_MS.map(() => num(test("DRIVE_BACKUP_RETRY_MS"), 1000))
      : RETRY_DELAYS_MS,
    ignoreHour: test("DRIVE_BACKUP_TEST_IGNORE_HOUR") === "1",
    uploadChunkBytes: num(test("DRIVE_BACKUP_UPLOAD_CHUNK"), 8 * 1024 * 1024),
    retryBaseMs: num(test("DRIVE_BACKUP_UPLOAD_RETRY_MS"), 1000),
  };
}
type Settings = ReturnType<typeof driveBackupSettings>;

/** Error con un mensaje en español sencillo, seguro para mostrar. */
export class BackupError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "revoked"
      | "auth"
      | "drive"
      | "dump"
      | "config"
      | "busy"
      | "other" = "other",
  ) {
    super(message);
  }
}

function summarize(error: any, settings: Settings) {
  if (error instanceof BackupError) return error.message;
  if (error?.name === "AbortError" || error?.name === "TimeoutError")
    return "Se agotó el tiempo máximo del respaldo.";
  return (
    "Error inesperado: " +
    sanitizeBackupError(error?.message ?? error, [
      settings.clientSecret,
      settings.passphrase,
    ])
  );
}

// ---------------------------------------------------------------------------
// Google (OAuth y Drive) con tiempos máximos

const timeoutSignal = (ms: number, outer?: AbortSignal) =>
  outer
    ? AbortSignal.any([outer, AbortSignal.timeout(ms)])
    : AbortSignal.timeout(ms);

async function googleFetch(
  url: string,
  init: RequestInit,
  what: string,
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  try {
    return await fetch(url, {
      ...init,
      // Sin seguir redirecciones; «manual» además deja ver el 308 de la
      // subida reanudable (Google lo usa para «sigue enviando»).
      redirect: "manual",
      signal: timeoutSignal(timeoutMs, signal),
    });
  } catch (error: any) {
    if (signal?.aborted) throw error;
    throw new BackupError(
      error?.name === "TimeoutError" || error?.name === "AbortError"
        ? `${what}: Google no respondió a tiempo.`
        : `${what}: no se pudo conectar con Google.`,
      "drive",
    );
  }
}

const form = (data: Record<string, string>) =>
  new URLSearchParams(data).toString();

async function tokenRequest(settings: Settings, data: Record<string, string>) {
  const response = await googleFetch(
    settings.tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        ...data,
      }),
    },
    "Permiso de Google",
  );
  const body: any = await response.json().catch(() => null);
  return { response, body };
}

/** Cambia el permiso guardado por un acceso de una hora. */
async function accessToken(settings: Settings, refreshToken: string) {
  const { response, body } = await tokenRequest(settings, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (response.ok && typeof body?.access_token === "string")
    return body.access_token as string;
  if (body?.error === "invalid_grant" || body?.error === "unauthorized_client")
    throw new BackupError(
      "Google retiró el permiso (se revocó, caducó o cambió la contraseña). Pulsa «Conectar con Google» otra vez.",
      "revoked",
    );
  throw new BackupError(
    `Google no entregó el acceso (HTTP ${response.status}).`,
    "drive",
  );
}

class Drive {
  constructor(
    private readonly settings: Settings,
    private readonly token: string,
    private readonly signal: AbortSignal,
  ) {}
  private headers(extra: Record<string, string> = {}) {
    return { Authorization: "Bearer " + this.token, ...extra };
  }
  private files(path = "") {
    return this.settings.driveBase + "/drive/v3/files" + path;
  }
  private async json(response: globalThis.Response, what: string) {
    const body: any = await response.json().catch(() => null);
    if (response.ok) return body;
    if (response.status === 401)
      throw new BackupError(`${what}: Google rechazó el acceso.`, "auth");
    if (
      response.status === 403 &&
      /storageQuota|quota/i.test(JSON.stringify(body ?? {}))
    )
      throw new BackupError(`${what}: Google Drive está lleno.`, "drive");
    throw new BackupError(
      `${what}: Google Drive respondió HTTP ${response.status}.`,
      "drive",
    );
  }
  async get(id: string, fields: string) {
    const r = await googleFetch(
      this.files(
        "/" + encodeURIComponent(id) + "?fields=" + encodeURIComponent(fields),
      ),
      { headers: this.headers() },
      "Drive",
      this.signal,
    );
    if (r.status === 404) return null;
    return this.json(r, "Drive");
  }
  async list(q: string, fields: string) {
    const out: any[] = [];
    let page: string | undefined;
    for (let i = 0; i < 20; i++) {
      const params = new URLSearchParams({
        q,
        fields: "nextPageToken,files(" + fields + ")",
        pageSize: "1000",
        spaces: "drive",
      });
      if (page) params.set("pageToken", page);
      const body = await this.json(
        await googleFetch(
          this.files("?" + params),
          { headers: this.headers() },
          "Drive",
          this.signal,
        ),
        "Listar Drive",
      );
      out.push(...(Array.isArray(body?.files) ? body.files : []));
      page = body?.nextPageToken;
      if (!page) return out;
    }
    throw new BackupError("Drive devolvió demasiadas páginas.", "drive");
  }
  async create(metadata: object) {
    return this.json(
      await googleFetch(
        this.files("?fields=id"),
        {
          method: "POST",
          headers: this.headers({
            "Content-Type": "application/json; charset=UTF-8",
          }),
          body: JSON.stringify(metadata),
        },
        "Drive",
        this.signal,
      ),
      "Crear carpeta",
    );
  }
  async trash(id: string) {
    await this.json(
      await googleFetch(
        this.files("/" + encodeURIComponent(id) + "?fields=id"),
        {
          method: "PATCH",
          headers: this.headers({
            "Content-Type": "application/json; charset=UTF-8",
          }),
          body: JSON.stringify({ trashed: true }),
        },
        "Drive",
        this.signal,
      ),
      "Mover a la papelera",
    );
  }
  async about() {
    const r = await googleFetch(
      this.settings.driveBase + "/drive/v3/about?fields=user(emailAddress)",
      { headers: this.headers() },
      "Drive",
      this.signal,
    );
    const body: any = r.ok ? await r.json().catch(() => null) : null;
    const email = body?.user?.emailAddress;
    return typeof email === "string" && email.length < 320 ? email : null;
  }

  /** Subida reanudable (por partes de 8 MiB; se reanuda tras un corte). */
  async upload(path: string, size: number, metadata: object) {
    const init = await googleFetch(
      this.settings.driveBase +
        "/upload/drive/v3/files?uploadType=resumable&fields=id",
      {
        method: "POST",
        headers: this.headers({
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "application/octet-stream",
          "X-Upload-Content-Length": String(size),
        }),
        body: JSON.stringify(metadata),
      },
      "Iniciar subida",
      this.signal,
    );
    if (!init.ok) await this.json(init, "Iniciar subida");
    const location = init.headers.get("location") ?? "";
    let session: URL;
    try {
      session = new URL(location);
    } catch {
      throw new BackupError(
        "Drive no entregó la dirección de subida.",
        "drive",
      );
    }
    if (session.origin !== new URL(this.settings.driveBase).origin)
      throw new BackupError(
        "Drive entregó una dirección de subida inesperada.",
        "drive",
      );
    const handle = await open(path, "r");
    try {
      let offset = 0;
      let failures = 0;
      const chunk = Buffer.allocUnsafe(
        Math.min(this.settings.uploadChunkBytes, size),
      );
      const nextOffset = (r: globalThis.Response) => {
        const range = /bytes=0-(\d+)/.exec(r.headers.get("range") ?? "");
        return range ? Number(range[1]) + 1 : 0;
      };
      for (;;) {
        let response: globalThis.Response | null = null;
        try {
          if (failures > 0) {
            // Tras un corte se pregunta cuánto recibió Google y se sigue de ahí.
            response = await googleFetch(
              session.toString(),
              {
                method: "PUT",
                headers: this.headers({ "Content-Range": `bytes */${size}` }),
              },
              "Subida",
              this.signal,
            );
            if (response.status === 308) {
              offset = nextOffset(response);
              await response.body?.cancel().catch(() => {});
              response = null;
            }
          }
          if (!response) {
            const end = Math.min(offset + chunk.length, size);
            const { bytesRead } = await handle.read(
              chunk,
              0,
              end - offset,
              offset,
            );
            if (bytesRead !== end - offset)
              throw new BackupError(
                "No se pudo leer el archivo temporal.",
                "other",
              );
            response = await googleFetch(
              session.toString(),
              {
                method: "PUT",
                headers: this.headers({
                  "Content-Range": `bytes ${offset}-${end - 1}/${size}`,
                }),
                body: chunk.subarray(0, end - offset),
              },
              "Subida",
              this.signal,
              UPLOAD_REQUEST_TIMEOUT_MS,
            );
          }
        } catch (error) {
          if (!(error instanceof BackupError) || error.kind !== "drive")
            throw error;
          response = null;
        }
        if (response && (response.status === 200 || response.status === 201)) {
          const body: any = await response.json().catch(() => null);
          if (typeof body?.id !== "string")
            throw new BackupError(
              "Drive no confirmó el archivo subido.",
              "drive",
            );
          return body.id as string;
        }
        if (response?.status === 308) {
          offset = nextOffset(response);
          await response.body?.cancel().catch(() => {});
          failures = 0;
          continue;
        }
        if (response && response.status < 500 && response.status !== 429) {
          await response.body?.cancel().catch(() => {});
          if (response.status === 404 || response.status === 410)
            throw new BackupError(
              "La sesión de subida de Drive caducó.",
              "drive",
            );
          await this.json(response, "Subida");
        }
        await response?.body?.cancel().catch(() => {});
        if (++failures > UPLOAD_RETRIES)
          throw new BackupError(
            "Google Drive no aceptó la subida después de varios intentos.",
            "drive",
          );
        await sleep(
          this.settings.retryBaseMs * 2 ** (failures - 1),
          this.signal,
        );
      }
    } finally {
      await handle.close();
    }
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

// ---------------------------------------------------------------------------
// pg_dump

/** Variables de libpq a partir de DATABASE_URL (sin pasar nada por argv). */
export function pgEnvironment(databaseUrl: string | undefined) {
  let url: URL;
  try {
    url = new URL(String(databaseUrl ?? ""));
  } catch {
    throw new BackupError("DATABASE_URL no es válida.", "config");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new BackupError("DATABASE_URL no es de PostgreSQL.", "config");
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    PGHOST:
      url.searchParams.get("host") ||
      decodeURIComponent(url.hostname.replace(/^\[|\]$/g, "")),
    PGPORT: url.port || url.searchParams.get("port") || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGAPPNAME: "nexora-drive-backup",
    PGCONNECT_TIMEOUT: "15",
  };
  for (const [param, name] of [
    ["sslmode", "PGSSLMODE"],
    ["sslrootcert", "PGSSLROOTCERT"],
    ["options", "PGOPTIONS"],
  ] as const) {
    const value = url.searchParams.get(param);
    if (value) env[name] = value;
  }
  if (!env.PGHOST || !env.PGDATABASE || !env.PGUSER)
    throw new BackupError("DATABASE_URL está incompleta.", "config");
  return env;
}

type DumpResult = { size: number; sha256: string; md5: string };

/** pg_dump -Fc → cifrado → archivo. Sólo el contenido cifrado toca el disco. */
async function dumpEncrypted(
  settings: Settings,
  path: string,
  signal: AbortSignal,
): Promise<DumpResult> {
  const env = pgEnvironment(process.env.DATABASE_URL);
  const child = spawn(
    settings.pgDumpBin,
    ["--format=custom", "--no-password", "--lock-wait-timeout=60s"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  // Baja prioridad: la caja manda.
  if (child.pid)
    try {
      setPriority(child.pid, 10);
    } catch {
      /* sin permiso: sigue con la prioridad normal */
    }
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (c: string) => (stderr = (stderr + c).slice(-4000)));
  const exited = new Promise<{ code: number | null; error?: any }>(
    (resolve) => {
      child.once("error", (error) => resolve({ code: null, error }));
      child.once("close", (code) => resolve({ code }));
    },
  );
  const kill = () => child.kill("SIGKILL");
  signal.addEventListener("abort", kill, { once: true });

  let plainBytes = 0;
  let checked = false;
  let head = Buffer.alloc(0);
  const guard = new Transform({
    transform(chunk: Buffer, _e, done) {
      plainBytes += chunk.length;
      if (plainBytes > settings.maxBytes)
        return done(
          new BackupError(
            `La copia supera el máximo permitido (${Math.round(settings.maxBytes / 1024 ** 2)} MB).`,
            "dump",
          ),
        );
      if (!checked) {
        head = Buffer.concat([head, chunk]).subarray(0, 5);
        if (head.length >= 5) {
          checked = true;
          if (head.toString("latin1") !== "PGDMP")
            return done(
              new BackupError("pg_dump no produjo un archivo válido.", "dump"),
            );
        }
      }
      done(null, chunk);
    },
  });
  const sha = createHash("sha256");
  const md5 = createHash("md5");
  let size = 0;
  const hasher = new Transform({
    transform(chunk: Buffer, _e, done) {
      sha.update(chunk);
      md5.update(chunk);
      size += chunk.length;
      done(null, chunk);
    },
  });
  try {
    await pipeline(
      child.stdout,
      guard,
      await createEncryptStream(settings.passphrase),
      hasher,
      createWriteStream(path, { mode: 0o600 }),
      { signal },
    );
  } catch (error) {
    kill();
    await exited;
    if (signal.aborted) throw error;
    const result = await exited;
    if (result.error?.code === "ENOENT")
      throw new BackupError("El servidor no tiene pg_dump instalado.", "dump");
    throw error;
  } finally {
    signal.removeEventListener("abort", kill);
  }
  const result = await exited;
  if (result.error?.code === "ENOENT")
    throw new BackupError("El servidor no tiene pg_dump instalado.", "dump");
  if (result.code !== 0 || !checked) {
    const detail = sanitizeBackupError(
      stderr
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-1)[0]
        ?.replace(/"[^"]*"/g, "«…»")
        .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "[ip]") ?? "",
      [env.PGPASSWORD ?? "", env.PGUSER ?? ""],
    ).slice(0, 160);
    throw new BackupError(
      `pg_dump no terminó bien (código ${result.code ?? "?"})${detail ? ": " + detail : "."}`,
      "dump",
    );
  }
  return { size, sha256: sha.digest("hex"), md5: md5.digest("hex") };
}

// ---------------------------------------------------------------------------
// Servicio

export type Trigger = "schedule" | "manual";
const SYSTEM = (branchId: string): Actor => ({
  id: "system",
  name: "Respaldo automático",
  email: "",
  role: "system",
  permissions: [],
  branchId,
});

@Injectable()
export class DriveBackupService {
  private current: { lockId: string; abort: AbortController } | null = null;
  private stopped = false;
  constructor(@Inject(Database) private readonly db: Database) {}

  settings() {
    return driveBackupSettings();
  }

  async row() {
    return this.db.driveBackup.upsert({
      where: { id: "main" },
      create: { id: "main" },
      update: {},
    });
  }

  stop() {
    this.stopped = true;
    this.current?.abort.abort(
      new BackupError("La API se está apagando.", "other"),
    );
  }

  /** Estado para la tarjeta de Configuración. Nunca incluye secretos. */
  async status() {
    const settings = this.settings();
    const row = await this.row();
    const now = new Date();
    const connected = !!row.refreshTokenEnc;
    const running =
      !!row.lockedUntil && row.lockedUntil.getTime() > now.getTime();
    return {
      configured: settings.configured,
      missing: settings.missing,
      redirectUri: settings.redirectUri,
      folderName: FOLDER_NAME,
      connected,
      needsReconnect: !connected && !!row.authError,
      account: connected ? maskAccount(row.accountEmail) : null,
      connectedAt: connected ? row.connectedAt : null,
      running,
      runningSince: running ? row.runningSince : null,
      lastRun: row.lastRunAt
        ? {
            at: row.lastRunAt,
            trigger: row.lastTrigger,
            status: row.lastStatus,
            error: row.lastError,
            durationMs: row.lastDurationMs,
          }
        : null,
      lastSuccess: row.lastSuccessAt
        ? {
            at: row.lastSuccessAt,
            size: row.lastSize === null ? null : Number(row.lastSize),
            fileName: row.lastFileName,
          }
        : null,
      consecutiveFailures: row.consecutiveFailures,
      nextRunAt:
        settings.configured && connected ? nextScheduledRun(row, now) : null,
      telegramAlerts: telegramSettings().enabled,
    };
  }

  /** Toma el arriendo; null si ya hay un respaldo en curso. */
  private async lease(trigger: Trigger) {
    await this.row();
    const lockId = randomUUID();
    const today = localDay(new Date());
    const rows =
      trigger === "schedule"
        ? await this.db.$queryRaw<{ id: string }[]>`
            UPDATE "DriveBackup"
            SET "lockId" = ${lockId},
                "lockedUntil" = timezone('UTC', now()) + make_interval(mins => ${LEASE_MINUTES}::int),
                "runningSince" = timezone('UTC', now()),
                "dayAttempts" = CASE WHEN "dayKey" = ${today} THEN "dayAttempts" + 1 ELSE 1 END,
                "dayKey" = ${today},
                "updatedAt" = timezone('UTC', now())
            WHERE id = 'main'
              AND ("lockedUntil" IS NULL OR "lockedUntil" < timezone('UTC', now()))
            RETURNING id`
        : await this.db.$queryRaw<{ id: string }[]>`
            UPDATE "DriveBackup"
            SET "lockId" = ${lockId},
                "lockedUntil" = timezone('UTC', now()) + make_interval(mins => ${LEASE_MINUTES}::int),
                "runningSince" = timezone('UTC', now()),
                "updatedAt" = timezone('UTC', now())
            WHERE id = 'main'
              AND ("lockedUntil" IS NULL OR "lockedUntil" < timezone('UTC', now()))
            RETURNING id`;
    return rows.length ? lockId : null;
  }

  private async release(lockId: string) {
    await this.db.$executeRaw`
      UPDATE "DriveBackup"
      SET "lockId" = NULL, "lockedUntil" = NULL, "runningSince" = NULL
      WHERE id = 'main' AND "lockId" = ${lockId}`;
  }

  /**
   * Comprueba requisitos y toma el candado; el respaldo sigue en segundo plano.
   * Lanza BackupError si no se puede empezar.
   */
  async start(
    trigger: Trigger,
    actor?: Actor,
  ): Promise<{ done: Promise<void> }> {
    const settings = this.settings();
    if (!settings.configured)
      throw new BackupError(
        "El respaldo a Google Drive no está configurado en el servidor.",
        "config",
      );
    if (this.stopped) throw new BackupError("La API se está apagando.", "busy");
    const row = await this.row();
    if (!row.refreshTokenEnc)
      throw new BackupError("Primero conecta Google Drive.", "config");
    if (this.current)
      throw new BackupError("Ya hay un respaldo en curso.", "busy");
    const lockId = await this.lease(trigger);
    if (!lockId) throw new BackupError("Ya hay un respaldo en curso.", "busy");
    const abort = new AbortController();
    this.current = { lockId, abort };
    return {
      done: this.execute(
        settings,
        trigger,
        lockId,
        abort,
        actor ?? SYSTEM(row.branchId),
      ),
    };
  }

  private async execute(
    settings: Settings,
    trigger: Trigger,
    lockId: string,
    abort: AbortController,
    actor: Actor,
  ) {
    const started = Date.now();
    const timer = setTimeout(
      () =>
        abort.abort(
          new BackupError(
            "Se agotó el tiempo máximo del respaldo (45 min).",
            "other",
          ),
        ),
      RUN_TIMEOUT_MS,
    );
    let dir: string | undefined;
    try {
      const result = await this.backup(
        settings,
        abort.signal,
        (d) => (dir = d),
      );
      await this.db.driveBackup.update({
        where: { id: "main" },
        data: {
          lastRunAt: new Date(),
          lastTrigger: trigger,
          lastStatus: "success",
          lastError: result.warning,
          lastDurationMs: Date.now() - started,
          lastSuccessAt: new Date(),
          lastSize: BigInt(result.size),
          lastFileName: result.name,
          consecutiveFailures: 0,
          nextRetryAt: null,
          authError: null,
        },
      });
      await audit(
        this.db,
        actor,
        "backup_run",
        "DriveBackup",
        "main",
        undefined,
        {
          trigger,
          file: result.name,
          bytes: result.size,
          durationMs: Date.now() - started,
          removed: result.removed,
          ...(result.warning ? { warning: result.warning } : {}),
        },
      ).catch(() => {});
    } catch (error: any) {
      const reason =
        abort.signal.aborted && abort.signal.reason instanceof BackupError
          ? abort.signal.reason.message
          : summarize(error, settings);
      await this.failed(settings, trigger, reason, error, started, actor).catch(
        (e) =>
          console.warn(
            "[respaldo] No se pudo guardar el fallo: " + summarize(e, settings),
          ),
      );
    } finally {
      clearTimeout(timer);
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
      this.current = null;
      await this.release(lockId).catch(() => {});
    }
  }

  private async failed(
    settings: Settings,
    trigger: Trigger,
    reason: string,
    error: any,
    started: number,
    actor: Actor,
  ) {
    console.warn("[respaldo] Falló el respaldo a Google Drive: " + reason);
    const row = await this.row();
    const attempts = row.dayAttempts;
    const revoked = error instanceof BackupError && error.kind === "revoked";
    await this.db.driveBackup.update({
      where: { id: "main" },
      data: {
        lastRunAt: new Date(),
        lastTrigger: trigger,
        lastStatus: "failed",
        lastError: reason,
        lastDurationMs: Date.now() - started,
        consecutiveFailures: { increment: 1 },
        ...(trigger === "schedule"
          ? {
              nextRetryAt:
                attempts < MAX_DAILY_ATTEMPTS
                  ? new Date(
                      Date.now() +
                        settings.retryDelaysMs[
                          Math.min(attempts, settings.retryDelaysMs.length) - 1
                        ]!,
                    )
                  : null,
            }
          : {}),
        // Permiso revocado: se borra el token inútil y se pide reconectar.
        ...(revoked
          ? { refreshTokenEnc: null, authError: "revoked", folderId: null }
          : {}),
      },
    });
    await audit(
      this.db,
      actor,
      "backup_failed",
      "DriveBackup",
      "main",
      undefined,
      {
        trigger,
        error: reason,
      },
    ).catch(() => {});
    await this.maybeAlert();
  }

  /** El respaldo en sí. Devuelve nombre, tamaño y lo borrado por retención. */
  private async backup(
    settings: Settings,
    signal: AbortSignal,
    tempDir: (dir: string) => void,
  ) {
    const row = await this.row();
    if (!row.refreshTokenEnc)
      throw new BackupError("Primero conecta Google Drive.", "config");
    let refresh: string;
    try {
      refresh = await openSecret(row.refreshTokenEnc, settings.passphrase);
    } catch {
      throw new BackupError(
        "No se pudo abrir el permiso guardado de Google (¿cambió BACKUP_ENCRYPTION_KEY?). Pulsa «Conectar con Google» otra vez.",
        "config",
      );
    }
    const drive = new Drive(
      settings,
      await accessToken(settings, refresh),
      signal,
    );
    const folderId = await this.folder(drive, row.folderId);

    const dir = await mkdtemp(join(tmpdir(), "nexora-drive-"));
    tempDir(dir);
    const now = new Date();
    const name = backupName(now);
    const path = join(dir, name);
    const dump = await dumpEncrypted(settings, path, signal);
    if ((await stat(path)).size !== dump.size)
      throw new BackupError("El archivo temporal quedó incompleto.", "dump");

    const id = await drive.upload(path, dump.size, {
      name,
      parents: [folderId],
      mimeType: "application/octet-stream",
      description:
        "Respaldo cifrado de Nexora POS. Se abre con scripts/decrypt-backup.mjs y la frase BACKUP_ENCRYPTION_KEY.",
      appProperties: {
        nexoraBackup: "1",
        format: "NXBK1",
        sha256: dump.sha256,
      },
    });
    // Verificación: sin esto no se borra nada.
    const meta = await drive.get(
      id,
      "id,name,size,md5Checksum,sha256Checksum,trashed,parents,appProperties",
    );
    const sizeOk = meta && String(meta.size) === String(dump.size);
    const shaOk = meta?.sha256Checksum
      ? meta.sha256Checksum === dump.sha256
      : undefined;
    const md5Ok = meta?.md5Checksum ? meta.md5Checksum === dump.md5 : undefined;
    const verified =
      !!sizeOk &&
      !meta.trashed &&
      shaOk !== false &&
      md5Ok !== false &&
      (shaOk === true || md5Ok === true) &&
      meta.appProperties?.sha256 === dump.sha256;
    if (!verified) {
      await drive.trash(id).catch(() => {});
      throw new BackupError(
        "Google Drive no confirmó la copia subida (tamaño o suma distintos). No se borró ningún respaldo anterior.",
        "drive",
      );
    }

    let removed = 0;
    let warning: string | null = null;
    try {
      removed = await this.retention(drive, folderId, id);
    } catch (error: any) {
      warning =
        "Respaldo guardado, pero no se pudieron borrar copias antiguas: " +
        summarize(error, settings);
    }
    return { name, size: dump.size, removed, warning };
  }

  private async folder(drive: Drive, saved: string | null) {
    if (saved) {
      const found = await drive.get(saved, "id,trashed,mimeType");
      if (
        found &&
        !found.trashed &&
        found.mimeType === "application/vnd.google-apps.folder"
      )
        return saved;
    }
    const existing = await drive.list(
      "mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='nexoraBackupFolder' and value='1' }",
      "id,name",
    );
    const id: string =
      existing[0]?.id ??
      (
        await drive.create({
          name: FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
          appProperties: { nexoraBackupFolder: "1" },
        })
      )?.id;
    if (typeof id !== "string" || !id)
      throw new BackupError("No se pudo crear la carpeta en Drive.", "drive");
    await this.db.driveBackup.update({
      where: { id: "main" },
      data: { folderId: id },
    });
    return id;
  }

  private async retention(drive: Drive, folderId: string, currentId: string) {
    const files = (
      await drive.list(
        `'${folderId.replace(/[^\w-]/g, "")}' in parents and trashed = false`,
        "id,name,createdTime,appProperties",
      )
    ).filter(
      (f: any) =>
        typeof f?.id === "string" && f.appProperties?.nexoraBackup === "1",
    ) as (DriveFileInfo & { appProperties?: any })[];
    // Si el listado no trae la copia recién subida, no es fiable: no se borra.
    if (!files.some((f) => f.id === currentId))
      throw new BackupError(
        "el listado de Drive no incluye la copia nueva.",
        "drive",
      );
    const plan = retentionPlan(files, { keep: [currentId] });
    let removed = 0;
    for (const file of plan.remove.slice(0, 200)) {
      await drive.trash(file.id);
      removed++;
    }
    return removed;
  }

  // -------------------------------------------------------------------------
  // Aviso por Telegram

  async maybeAlert(now = new Date()) {
    if (!telegramSettings().enabled || !this.settings().configured) return;
    const row = await this.row();
    const active = !!row.refreshTokenEnc || !!row.authError;
    if (!active) return;
    if (
      row.lastAlertAt &&
      now.getTime() - row.lastAlertAt.getTime() < FRESH_SUCCESS_MS
    )
      return;
    const reference = row.lastSuccessAt ?? row.connectedAt;
    const stale =
      !!reference && now.getTime() - reference.getTime() > STALE_ALERT_MS;
    const failing = row.consecutiveFailures >= ALERT_AFTER_FAILURES;
    const revoked = !row.refreshTokenEnc && !!row.authError;
    if (!stale && !failing && !revoked) return;
    const reason = revoked
      ? "Google retiró el permiso: hay que pulsar «Conectar con Google» otra vez."
      : failing
        ? `Falló ${row.consecutiveFailures} veces seguidas. Último error: ${row.lastError ?? "—"}`
        : "Pasaron más de 36 horas sin un respaldo bueno.";
    const text = [
      "⚠️ <b>Respaldo diario a Google Drive con problemas</b>",
      escapeHtml(reason),
      `Último respaldo bueno: ${row.lastSuccessAt ? formatDate(row.lastSuccessAt) : "ninguno"}`,
      "Revisa Configuración › Respaldo diario a Google Drive.",
    ].join("\n");
    await enqueue(
      this.db,
      "backup_alert",
      "drive-backup:" + localDay(now),
      row.branchId,
      text,
    );
    await this.db.driveBackup.update({
      where: { id: "main" },
      data: { lastAlertAt: now },
    });
  }

  // -------------------------------------------------------------------------
  // Conexión con Google

  connectUrl(actor: Actor, res: Response) {
    const settings = this.settings();
    if (!settings.configured)
      throw new HttpException(
        "El respaldo a Google Drive no está configurado en el servidor.",
        409,
      );
    if (!actor.sessionId)
      throw new HttpException("Inicia sesión para continuar.", 401);
    const nonce = randomBytes(32).toString("base64url");
    const key = stateKey(process.env.JWT_SECRET ?? "");
    const state = signState(
      {
        u: actor.id,
        s: actor.sessionId,
        n: sha256Hex(nonce),
        e: Date.now() + STATE_TTL_MS,
      },
      key,
    );
    res.cookie(COOKIE, nonce, {
      httpOnly: true,
      secure: settings.secureCookie,
      // Lax: la vuelta desde Google es una navegación de otro sitio.
      sameSite: "lax",
      path: COOKIE_PATH,
      maxAge: STATE_TTL_MS,
    });
    const params = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      response_type: "code",
      scope: DRIVE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state,
      code_challenge: pkceChallenge(pkceVerifier(key, nonce)),
      code_challenge_method: "S256",
    });
    return { url: settings.authUrl + "?" + params };
  }

  /** Vuelta desde Google. Devuelve el resultado para la URL de Configuración. */
  async callback(query: Record<string, unknown>, cookie: unknown) {
    const settings = this.settings();
    if (!settings.configured) return "unconfigured";
    const key = stateKey(process.env.JWT_SECRET ?? "");
    const state = verifyState(query.state, key);
    if (
      !state ||
      typeof cookie !== "string" ||
      !sameText(sha256Hex(cookie), state.n)
    )
      return "invalid";
    const session = await this.db.authSession.findFirst({
      where: { id: state.s, userId: state.u },
    });
    const user = session
      ? await this.db.user.findUnique({
          where: { id: state.u },
          include: { role: true },
        })
      : null;
    if (
      !user?.active ||
      user.mustChangePassword ||
      !can(user.role.permissions, "*")
    )
      return "invalid";
    if (typeof query.error === "string") return "denied";
    if (
      typeof query.code !== "string" ||
      !query.code ||
      query.code.length > 2048
    )
      return "invalid";
    const { response, body } = await tokenRequest(settings, {
      grant_type: "authorization_code",
      code: query.code,
      redirect_uri: settings.redirectUri,
      code_verifier: pkceVerifier(key, cookie),
    });
    if (
      !response.ok ||
      typeof body?.refresh_token !== "string" ||
      !body.refresh_token
    )
      return "error";
    const scopes = String(body.scope ?? "").split(/\s+/);
    if (!scopes.includes(DRIVE_SCOPE)) {
      await this.revoke(settings, body.refresh_token);
      return "scope";
    }
    let email: string | null = null;
    if (typeof body.access_token === "string")
      email = await new Drive(
        settings,
        body.access_token,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      )
        .about()
        .catch(() => null);
    const previous = await this.row();
    if (previous.refreshTokenEnc)
      // El permiso anterior deja de servir: se revoca para no dejarlo vivo.
      await openSecret(previous.refreshTokenEnc, settings.passphrase)
        .then((old) =>
          old !== body.refresh_token ? this.revoke(settings, old) : undefined,
        )
        .catch(() => {});
    await this.db.driveBackup.update({
      where: { id: "main" },
      data: {
        refreshTokenEnc: await sealSecret(
          body.refresh_token,
          settings.passphrase,
        ),
        accountEmail: email,
        folderId: null,
        branchId: user.branchId,
        connectedAt: new Date(),
        connectedBy: user.id,
        authError: null,
        consecutiveFailures: 0,
        nextRetryAt: null,
      },
    });
    await audit(
      this.db,
      { id: user.id, branchId: user.branchId } as Actor,
      "drive_connected",
      "DriveBackup",
      "main",
      undefined,
      { account: maskAccount(email) },
    );
    return "connected";
  }

  private async revoke(settings: Settings, token: string) {
    await googleFetch(
      settings.revokeUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ token }),
      },
      "Revocar",
    ).catch(() => {});
  }

  async disconnect(actor: Actor) {
    const settings = this.settings();
    const row = await this.row();
    if (row.refreshTokenEnc && settings.configured) {
      const token = await openSecret(
        row.refreshTokenEnc,
        settings.passphrase,
      ).catch(() => null);
      if (token) await this.revoke(settings, token);
    }
    await this.db.driveBackup.update({
      where: { id: "main" },
      data: {
        refreshTokenEnc: null,
        accountEmail: null,
        folderId: null,
        connectedAt: null,
        connectedBy: null,
        authError: null,
        consecutiveFailures: 0,
        nextRetryAt: null,
      },
    });
    await audit(this.db, actor, "drive_disconnected", "DriveBackup", "main");
    return { connected: false };
  }

  // -------------------------------------------------------------------------
  // Temporizador

  async tick(now = new Date()) {
    const settings = this.settings();
    if (!settings.configured || this.current || this.stopped) return;
    const row = await this.row();
    if (row.refreshTokenEnc) {
      if (scheduledRunDue(row, now, { ignoreHour: settings.ignoreHour })) {
        const run = await this.start("schedule").catch((error) => {
          if (error instanceof BackupError && error.kind === "busy")
            return null;
          throw error;
        });
        await run?.done;
        return;
      }
    }
    await this.maybeAlert(now);
  }
}

@Injectable()
export class DriveBackupWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  constructor(
    @Inject(DriveBackupService) private readonly service: DriveBackupService,
  ) {}

  onApplicationBootstrap() {
    const settings = driveBackupSettings();
    if (!settings.configured) return;
    this.timer = setTimeout(() => {
      void this.cleanTemp();
      void this.run();
      this.interval = setInterval(() => void this.run(), settings.tickMs);
      this.interval.unref();
    }, settings.startDelayMs);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
    this.service.stop();
  }
  private async run() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.service.tick();
    } catch (error: any) {
      console.warn(
        "[respaldo] Error del temporizador: " +
          sanitizeBackupError(error?.message ?? error),
      );
    } finally {
      this.busy = false;
    }
  }
  /** Restos de un respaldo interrumpido (sólo contenido cifrado). */
  private async cleanTemp() {
    try {
      const base = tmpdir();
      for (const name of await readdir(base)) {
        if (!name.startsWith("nexora-drive-")) continue;
        const path = join(base, name);
        const info = await stat(path).catch(() => null);
        if (info && Date.now() - info.mtimeMs > 2 * 3600000)
          await rm(path, { recursive: true, force: true });
      }
    } catch {
      /* nada que limpiar */
    }
  }
}

// ---------------------------------------------------------------------------
// Rutas (sólo administración, salvo la vuelta desde Google)

@Controller("backups")
export class DriveBackupController {
  constructor(
    @Inject(DriveBackupService) private readonly service: DriveBackupService,
  ) {}

  @Get("status")
  @Permit("*")
  status() {
    return this.service.status();
  }

  @Post("run")
  @Permit("*")
  async run(@CurrentUser() actor: Actor) {
    try {
      // El respaldo sigue en segundo plano; execute() nunca rechaza.
      await this.service.start("manual", actor);
      return {
        started: true,
        message:
          "Respaldo iniciado. Tarda unos minutos; el estado se actualiza solo.",
      };
    } catch (error) {
      if (error instanceof BackupError)
        throw new HttpException(error.message, 409);
      throw error;
    }
  }

  @Get("google/connect")
  @Permit("*")
  connect(
    @CurrentUser() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.connectUrl(actor, res);
  }

  @Post("google/disconnect")
  @Permit("*")
  disconnect(@CurrentUser() actor: Actor) {
    return this.service.disconnect(actor);
  }

  /** Google vuelve aquí. Siempre redirige a Configuración con el resultado. */
  @Public()
  @Get("google/callback")
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let result = "error";
    try {
      result = await this.service.callback(query, req.cookies?.[COOKIE]);
    } catch (error: any) {
      console.warn(
        "[respaldo] Falló la conexión con Google: " +
          sanitizeBackupError(error?.message ?? error),
      );
    }
    res.clearCookie(COOKIE, { path: COOKIE_PATH });
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.redirect(
      302,
      driveBackupSettings().webOrigin + "/?drive=" + result + "#settings",
    );
  }
}

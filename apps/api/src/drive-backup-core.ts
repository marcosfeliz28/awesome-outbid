// Respaldo diario a Google Drive: piezas puras (sin Nest, sin red, sin base).
// Cifrado de archivos y del token, nombres, retención y calendario. Las usa
// drive-backup.ts y las prueban tests/drive-backup-core.test.ts y
// scripts/decrypt-backup.mjs (que reimplementa el descifrado sin depender de
// este archivo, para comprobar que el formato documentado es el real).
//
// FORMATO DEL ARCHIVO .dump.enc («NXBK», versión 1)
//
//   Cabecera de 36 bytes:
//     0..3   «NXBK» (ASCII)
//     4      versión = 1
//     5      derivación de clave = 1 (scrypt)
//     6      log2(N) de scrypt (15)
//     7      r de scrypt (8)
//     8      p de scrypt (1)
//     9..12  tamaño de bloque en bytes, entero sin signo big-endian (1 MiB)
//     13..28 sal aleatoria de 16 bytes, distinta en cada archivo
//     29..35 prefijo aleatorio de nonce, 7 bytes
//   Clave = scrypt(frase en UTF-8 NFC, sal, 32 bytes, N, r, p).
//   Después vienen los bloques. El contenido (pg_dump -Fc) se corta en bloques
//   de exactamente «tamaño de bloque» bytes; el último bloque tiene de 0 a
//   «tamaño de bloque» bytes y siempre existe (aunque esté vacío). Cada bloque
//   se cifra con AES-256-GCM:
//     nonce (12 bytes) = prefijo (7) ‖ número de bloque (4, big-endian) ‖
//                        1 si es el último bloque, 0 si no (1)
//     datos asociados  = los 36 bytes de la cabecera
//     salida           = texto cifrado (mismo largo) ‖ etiqueta de 16 bytes
//   Así se detecta cualquier cambio en la cabecera o en un bloque (etiqueta),
//   bloques reordenados (número en el nonce) y archivos cortados (el último
//   bloque lleva la marca de final), y se cifra y descifra en flujo con
//   memoria acotada (un bloque).
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { Transform, type TransformCallback } from "node:stream";

export const MAGIC = Buffer.from("NXBK", "ascii");
export const FORMAT_VERSION = 1;
export const HEADER_BYTES = 36;
export const TAG_BYTES = 16;
export const DEFAULT_CHUNK_BYTES = 1024 * 1024;
export const SCRYPT = { log2N: 15, r: 8, p: 1 } as const;
/** Mínimo de la frase BACKUP_ENCRYPTION_KEY. */
export const MIN_PASSPHRASE = 24;
/** Zona horaria de la tienda: nombres de archivo, retención y calendario. */
export const TIME_ZONE = "America/Santo_Domingo";

export class BackupFormatError extends Error {}

type ScryptParams = { log2N: number; r: number; p: number };

function scryptKey(
  passphrase: string,
  salt: Buffer,
  { log2N, r, p }: ScryptParams,
): Promise<Buffer> {
  const N = 2 ** log2N;
  return new Promise((resolve, reject) =>
    scryptCallback(
      Buffer.from(passphrase.normalize("NFC"), "utf8"),
      salt,
      32,
      { N, r, p, maxmem: 128 * N * r * p + 32 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}

export function encodeHeader(fields: {
  params: ScryptParams;
  chunkBytes: number;
  salt: Buffer;
  noncePrefix: Buffer;
}) {
  const header = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(header, 0);
  header[4] = FORMAT_VERSION;
  header[5] = 1;
  header[6] = fields.params.log2N;
  header[7] = fields.params.r;
  header[8] = fields.params.p;
  header.writeUInt32BE(fields.chunkBytes, 9);
  fields.salt.copy(header, 13);
  fields.noncePrefix.copy(header, 29);
  return header;
}

export function decodeHeader(header: Buffer) {
  if (header.length < HEADER_BYTES)
    throw new BackupFormatError("El archivo es demasiado corto.");
  if (!header.subarray(0, 4).equals(MAGIC))
    throw new BackupFormatError("No es un respaldo cifrado de Nexora (NXBK).");
  if (header[4] !== FORMAT_VERSION)
    throw new BackupFormatError(
      `Versión de formato no soportada: ${header[4]}.`,
    );
  if (header[5] !== 1)
    throw new BackupFormatError("Derivación de clave no soportada.");
  const params = { log2N: header[6]!, r: header[7]!, p: header[8]! };
  const chunkBytes = header.readUInt32BE(9);
  // Límites: una cabecera manipulada no debe pedir gigabytes de memoria.
  if (
    params.log2N < 14 ||
    params.log2N > 20 ||
    params.r < 1 ||
    params.r > 16 ||
    params.p < 1 ||
    params.p > 4 ||
    chunkBytes < 4096 ||
    chunkBytes > 16 * 1024 * 1024
  )
    throw new BackupFormatError("Parámetros de cabecera fuera de rango.");
  return {
    params,
    chunkBytes,
    salt: Buffer.from(header.subarray(13, 29)),
    noncePrefix: Buffer.from(header.subarray(29, 36)),
    header: Buffer.from(header.subarray(0, HEADER_BYTES)),
  };
}

export function chunkNonce(prefix: Buffer, index: number, last: boolean) {
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff)
    throw new BackupFormatError("Demasiados bloques.");
  const nonce = Buffer.alloc(12);
  prefix.copy(nonce, 0);
  nonce.writeUInt32BE(index, 7);
  nonce[11] = last ? 1 : 0;
  return nonce;
}

function sealChunk(
  key: Buffer,
  header: Buffer,
  prefix: Buffer,
  index: number,
  last: boolean,
  plain: Buffer,
) {
  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    chunkNonce(prefix, index, last),
  );
  cipher.setAAD(header);
  return Buffer.concat([
    cipher.update(plain),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}

function openChunk(
  key: Buffer,
  header: Buffer,
  prefix: Buffer,
  index: number,
  last: boolean,
  sealed: Buffer,
) {
  if (sealed.length < TAG_BYTES)
    throw new BackupFormatError("El archivo está cortado.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    chunkNonce(prefix, index, last),
  );
  decipher.setAAD(header);
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  try {
    return Buffer.concat([
      decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)),
      decipher.final(),
    ]);
  } catch {
    throw new BackupFormatError(
      "La frase no es correcta o el archivo fue modificado o está incompleto.",
    );
  }
}

/** Acumula trozos sin copiar en cada escritura. */
class ByteQueue {
  private parts: Buffer[] = [];
  length = 0;
  push(chunk: Buffer) {
    if (chunk.length) {
      this.parts.push(chunk);
      this.length += chunk.length;
    }
  }
  take(bytes: number) {
    const out = Buffer.allocUnsafe(bytes);
    let offset = 0;
    while (offset < bytes) {
      const part = this.parts[0]!;
      const n = Math.min(part.length, bytes - offset);
      part.copy(out, offset, 0, n);
      offset += n;
      if (n === part.length) this.parts.shift();
      else this.parts[0] = part.subarray(n);
    }
    this.length -= bytes;
    return out;
  }
}

/** Flujo que cifra: entra el pg_dump, sale el .dump.enc. */
export async function createEncryptStream(
  passphrase: string,
  options: { chunkBytes?: number; params?: ScryptParams } = {},
) {
  const params = options.params ?? SCRYPT;
  const chunkBytes = options.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const salt = randomBytes(16);
  const noncePrefix = randomBytes(7);
  const header = encodeHeader({ params, chunkBytes, salt, noncePrefix });
  const key = await scryptKey(passphrase, salt, params);
  const queue = new ByteQueue();
  let index = 0;
  let started = false;
  const start = (stream: Transform) => {
    if (!started) {
      started = true;
      stream.push(header);
    }
  };
  return new Transform({
    transform(chunk: Buffer, _encoding, done: TransformCallback) {
      try {
        start(this);
        queue.push(chunk);
        // Sólo se cierra un bloque cuando hay datos después: el último bloque
        // lleva otra marca y se decide al final.
        while (queue.length > chunkBytes)
          this.push(
            sealChunk(
              key,
              header,
              noncePrefix,
              index++,
              false,
              queue.take(chunkBytes),
            ),
          );
        done();
      } catch (error) {
        done(error as Error);
      }
    },
    flush(done: TransformCallback) {
      try {
        start(this);
        this.push(
          sealChunk(
            key,
            header,
            noncePrefix,
            index++,
            true,
            queue.take(queue.length),
          ),
        );
        key.fill(0);
        done();
      } catch (error) {
        done(error as Error);
      }
    },
  });
}

/**
 * Flujo que descifra (pruebas y herramientas). Cada bloque se entrega sólo
 * después de comprobar su etiqueta; si el archivo está cortado o alterado, el
 * flujo termina con error.
 */
export function createDecryptStream(passphrase: string) {
  const queue = new ByteQueue();
  let state:
    | {
        key: Buffer;
        header: Buffer;
        noncePrefix: Buffer;
        chunkBytes: number;
      }
    | undefined;
  let pending: Promise<void> | undefined;
  let index = 0;
  const ready = async () => {
    if (state) return state;
    if (!pending) {
      const parsed = decodeHeader(queue.take(HEADER_BYTES));
      pending = scryptKey(passphrase, parsed.salt, parsed.params).then(
        (key) => {
          state = { key, ...parsed };
        },
      );
    }
    await pending;
    return state!;
  };
  return new Transform({
    transform(chunk: Buffer, _encoding, done: TransformCallback) {
      queue.push(chunk);
      if (!state && !pending && queue.length < HEADER_BYTES) return done();
      ready()
        .then((s) => {
          while (queue.length > s.chunkBytes + TAG_BYTES)
            this.push(
              openChunk(
                s.key,
                s.header,
                s.noncePrefix,
                index++,
                false,
                queue.take(s.chunkBytes + TAG_BYTES),
              ),
            );
          done();
        })
        .catch((error) => done(error));
    },
    flush(done: TransformCallback) {
      if (!state && !pending && queue.length < HEADER_BYTES)
        return done(new BackupFormatError("El archivo es demasiado corto."));
      ready()
        .then((s) => {
          if (queue.length < TAG_BYTES)
            throw new BackupFormatError("El archivo está cortado.");
          this.push(
            openChunk(
              s.key,
              s.header,
              s.noncePrefix,
              index++,
              true,
              queue.take(queue.length),
            ),
          );
          s.key.fill(0);
          done();
        })
        .catch((error) => done(error));
    },
  });
}

// ---------------------------------------------------------------------------
// Token de Google cifrado en reposo.
//
// «v1.» + base64url(sal 16 ‖ iv 12 ‖ etiqueta 16 ‖ texto cifrado). Clave =
// HKDF-SHA256(scrypt(frase, sal), info «nexora drive refresh token v1»):
// independiente de las claves de los archivos aunque comparta la frase.

const TOKEN_INFO = "nexora drive refresh token v1";
const TOKEN_AAD = Buffer.from("nexora-drive-refresh-token", "utf8");

async function tokenKey(passphrase: string, salt: Buffer) {
  const base = await scryptKey(passphrase, salt, SCRYPT);
  const key = Buffer.from(
    hkdfSync("sha256", base, Buffer.alloc(0), TOKEN_INFO, 32),
  );
  base.fill(0);
  return key;
}

export async function sealSecret(secret: string, passphrase: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await tokenKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(TOKEN_AAD);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  key.fill(0);
  return (
    "v1." +
    Buffer.concat([salt, iv, cipher.getAuthTag(), body]).toString("base64url")
  );
}

export async function openSecret(sealed: string, passphrase: string) {
  if (!sealed.startsWith("v1."))
    throw new BackupFormatError("Token guardado con un formato desconocido.");
  const raw = Buffer.from(sealed.slice(3), "base64url");
  if (raw.length < 45) throw new BackupFormatError("Token guardado dañado.");
  const key = await tokenKey(passphrase, raw.subarray(0, 16));
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(16, 28));
  decipher.setAAD(TOKEN_AAD);
  decipher.setAuthTag(raw.subarray(28, 44));
  try {
    return Buffer.concat([
      decipher.update(raw.subarray(44)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new BackupFormatError(
      "No se pudo abrir el permiso guardado de Google (¿cambió BACKUP_ENCRYPTION_KEY?).",
    );
  } finally {
    key.fill(0);
  }
}

// ---------------------------------------------------------------------------
// «state» de OAuth firmado (anti-CSRF), atado a la sesión de la administradora
// y a una cookie HttpOnly del mismo navegador.

export type OAuthState = { u: string; s: string; n: string; e: number };

export const stateKey = (jwtSecret: string) =>
  Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(jwtSecret, "utf8"),
      Buffer.alloc(0),
      "nexora drive oauth state v1",
      32,
    ),
  );

export const sha256Hex = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export function signState(state: OAuthState, key: Buffer) {
  const body = Buffer.from(JSON.stringify({ v: 1, ...state })).toString(
    "base64url",
  );
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return body + "." + mac;
}

/** Devuelve el contenido sólo si la firma es válida y no caducó. */
export function verifyState(
  value: unknown,
  key: Buffer,
  now = Date.now(),
): OAuthState | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const [body, mac, extra] = value.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      parsed?.v !== 1 ||
      typeof parsed.u !== "string" ||
      typeof parsed.s !== "string" ||
      typeof parsed.n !== "string" ||
      typeof parsed.e !== "number" ||
      parsed.e < now
    )
      return null;
    return { u: parsed.u, s: parsed.s, n: parsed.n, e: parsed.e };
  } catch {
    return null;
  }
}

/** PKCE: el verificador sale de la cookie del navegador y del secreto. */
export const pkceVerifier = (key: Buffer, nonce: string) =>
  createHmac("sha256", key)
    .update("pkce:" + nonce)
    .digest("base64url");
export const pkceChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

export function sameText(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------------------------------------------------------------------------
// Fechas en la hora de la tienda.

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function localParts(date: Date) {
  const get = (type: string) =>
    partsFormat.formatToParts(date).find((p) => p.type === type)!.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}
export const localDay = (date: Date) => {
  const p = localParts(date);
  return `${p.year}-${p.month}-${p.day}`;
};

// ---------------------------------------------------------------------------
// Nombres: nexora-AAAA-MM-DD-HHmm.dump.enc (hora de la tienda).

export const NAME_PATTERN =
  /^nexora-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.dump\.enc$/;

export function backupName(date: Date) {
  const p = localParts(date);
  return `nexora-${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}.dump.enc`;
}

export function parseBackupName(name: unknown) {
  if (typeof name !== "string") return null;
  const m = NAME_PATTERN.exec(name);
  if (!m) return null;
  const [, year, month, day, hour, minute] = m as unknown as string[];
  const [mo, d, h, mi] = [month, day, hour, minute].map(Number) as number[];
  if (mo! < 1 || mo! > 12 || d! < 1 || d! > 31 || h! > 23 || mi! > 59)
    return null;
  return {
    day: `${year}-${month}-${day}`,
    month: `${year}-${month}`,
    stamp: `${year}${month}${day}${hour}${minute}`,
  };
}

// ---------------------------------------------------------------------------
// Retención: 30 diarios (el más reciente de cada uno de los 30 días más
// recientes con respaldo) + 12 mensuales (el primero de cada uno de los 12
// meses más recientes con respaldo). Archivos con otro nombre no se tocan.

export type DriveFileInfo = { id: string; name: string; createdTime?: string };

export function retentionPlan(
  files: DriveFileInfo[],
  options: { daily?: number; monthly?: number; keep?: string[] } = {},
) {
  const daily = options.daily ?? 30;
  const monthly = options.monthly ?? 12;
  const backups = files
    .map((file) => ({ file, parsed: parseBackupName(file.name) }))
    .filter(
      (
        b,
      ): b is {
        file: DriveFileInfo;
        parsed: NonNullable<ReturnType<typeof parseBackupName>>;
      } => !!b.parsed,
    )
    .sort((a, b) =>
      a.parsed.stamp !== b.parsed.stamp
        ? a.parsed.stamp < b.parsed.stamp
          ? -1
          : 1
        : (a.file.createdTime ?? "") !== (b.file.createdTime ?? "")
          ? (a.file.createdTime ?? "") < (b.file.createdTime ?? "")
            ? -1
            : 1
          : a.file.id < b.file.id
            ? -1
            : a.file.id > b.file.id
              ? 1
              : 0,
    );
  const keep = new Set(options.keep ?? []);
  const days = new Set<string>();
  for (let i = backups.length - 1; i >= 0; i--) {
    const b = backups[i]!;
    if (days.has(b.parsed.day)) continue;
    if (days.size >= daily) break;
    days.add(b.parsed.day);
    keep.add(b.file.id);
  }
  const firsts = new Map<string, string>();
  for (const b of backups)
    if (!firsts.has(b.parsed.month)) firsts.set(b.parsed.month, b.file.id);
  [...firsts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, monthly)
    .forEach(([, id]) => keep.add(id));
  return {
    keep: backups.filter((b) => keep.has(b.file.id)).map((b) => b.file),
    remove: backups.filter((b) => !keep.has(b.file.id)).map((b) => b.file),
  };
}

// ---------------------------------------------------------------------------
// Calendario: todos los días a las 03:30 (hora de la tienda).

export const SCHEDULE = { hour: 3, minute: 30 } as const;
/** Un éxito más reciente que esto cuenta como el respaldo del día. */
export const FRESH_SUCCESS_MS = 20 * 3600000;
/** Intentos programados por día. */
export const MAX_DAILY_ATTEMPTS = 3;
/** Espera tras el 1.º y el 2.º fallo del día. */
export const RETRY_DELAYS_MS = [15 * 60000, 60 * 60000];
/** Aviso si pasa esto sin un respaldo bueno. */
export const STALE_ALERT_MS = 36 * 3600000;
/** Aviso si falla esto seguido. */
export const ALERT_AFTER_FAILURES = 3;

export type ScheduleState = {
  lastSuccessAt?: Date | null;
  dayKey?: string | null;
  dayAttempts?: number | null;
  nextRetryAt?: Date | null;
};

const minutesOfDay = (date: Date) => {
  const p = localParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
};
const scheduleMinutes = SCHEDULE.hour * 60 + SCHEDULE.minute;

export function attemptsToday(state: ScheduleState, now: Date) {
  return state.dayKey === localDay(now) ? Number(state.dayAttempts ?? 0) : 0;
}

/** ¿Toca un respaldo programado ahora? */
export function scheduledRunDue(
  state: ScheduleState,
  now: Date,
  // Sólo pruebas (DRIVE_BACKUP_TEST_IGNORE_HOUR fuera de producción).
  options: { ignoreHour?: boolean } = {},
) {
  if (!options.ignoreHour && minutesOfDay(now) < scheduleMinutes) return false;
  if (
    state.lastSuccessAt &&
    now.getTime() - state.lastSuccessAt.getTime() < FRESH_SUCCESS_MS
  )
    return false;
  if (attemptsToday(state, now) >= MAX_DAILY_ATTEMPTS) return false;
  if (state.nextRetryAt && now.getTime() < state.nextRetryAt.getTime())
    return false;
  return true;
}

// Santo Domingo no cambia de horario: siempre UTC−4.
const OFFSET_MS = 4 * 3600000;
/** Las 03:30 del día (de la tienda) en que cae `ms`. */
function scheduleOfDay(ms: number) {
  const local = new Date(ms - OFFSET_MS);
  return (
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      SCHEDULE.hour,
      SCHEDULE.minute,
    ) + OFFSET_MS
  );
}

/** Próxima hora a la que el temporizador intentará un respaldo (aprox.). */
export function nextScheduledRun(state: ScheduleState, now: Date): Date {
  if (scheduledRunDue(state, now)) return now;
  const today = scheduleOfDay(now.getTime());
  const exhausted = attemptsToday(state, now) >= MAX_DAILY_ATTEMPTS;
  let at =
    now.getTime() < today
      ? today
      : exhausted
        ? today + 86400000
        : now.getTime();
  if (
    !exhausted &&
    now.getTime() >= today &&
    state.nextRetryAt &&
    state.nextRetryAt.getTime() > at
  )
    at = state.nextRetryAt.getTime();
  if (state.lastSuccessAt)
    at = Math.max(at, state.lastSuccessAt.getTime() + FRESH_SUCCESS_MS);
  // Antes de las 03:30 de ese día no se intenta nada.
  at = Math.max(at, scheduleOfDay(at));
  return new Date(at);
}

// ---------------------------------------------------------------------------
// Mensajes de error sin secretos.

export function sanitizeBackupError(message: unknown, secrets: string[] = []) {
  let text = String(message ?? "");
  for (const secret of secrets)
    if (secret && secret.length >= 6) text = text.split(secret).join("***");
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]")
    .replace(/ya29\.[\w.-]+/g, "***")
    .replace(/1\/\/[\w.-]+/g, "***")
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, "***")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[correo]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** «m•••@gmail.com» para mostrar qué cuenta está conectada. */
export function maskAccount(email: string | null | undefined) {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return email[0] + "•••" + email.slice(at);
}

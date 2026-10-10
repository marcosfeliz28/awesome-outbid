import { createHash, timingSafeEqual } from "node:crypto";
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Actor, Database, bad } from "./common";

export function validateSecret(
  secret: string | undefined,
  production: boolean,
) {
  if (!secret || secret.length < 32)
    throw new Error(
      "Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
    );
  if (production) {
    const frequencies = new Map<string, number>();
    for (const char of secret)
      frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
    const entropy = [...frequencies.values()].reduce(
      (sum, n) => sum - (n / secret.length) * Math.log2(n / secret.length),
      0,
    );
    const repeated = Array.from(
      { length: Math.floor(secret.length / 2) },
      (_, i) => i + 1,
    ).some(
      (length) =>
        secret ===
        secret
          .slice(0, length)
          .repeat(Math.ceil(secret.length / length))
          .slice(0, secret.length),
    );
    if (
      repeated ||
      /replace|example|changeme|fitstore|secret-of|password/i.test(secret) ||
      frequencies.size < 12 ||
      entropy < 3.5
    )
      throw new Error(
        "JWT_SECRET de producción debe ser aleatorio; genera 32 bytes con crypto.randomBytes.",
      );
  }
  return secret;
}

// Secreto de un equipo registrado (Configuración › Equipos): sólo se guarda
// su hash y se compara en tiempo constante.
export const hashTerminalSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
export const sameTerminalSecret = (secret: string, stored: string) => {
  const a = Buffer.from(hashTerminalSecret(secret), "hex"),
    b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// Contador propio de cada clave: cinco fallos la bloquean 15 minutos.
export const ATTEMPT_LIMIT = 5;
export const ATTEMPT_LOCK_MINUTES = 15;
// Cupos por ventana fija de una hora (auditoría de seguridad 2026-10-10,
// S-01 y S-03). No dependen de la IP: valen aunque el borde la colapse.
export const LOGIN_ACCOUNT_FAILURES_PER_HOUR = 10;
export const PIN_REQUESTER_FAILURES_PER_HOUR = 10;
export const SHORT_PIN_FAILURES_PER_HOUR = 10;

/**
 * Cupo adicional a la clave propia del intento: `max` fallos dentro de una
 * ventana fija de `windowMs` agotan el cupo hasta que la ventana termina. Un
 * acierto NO lo reinicia (si no, quien conoce un acierto ajeno podría renovar
 * su presupuesto); sólo vence con la ventana.
 */
export type AttemptBudget = {
  key: string;
  max: number;
  windowMs: number;
  message: string;
  scope: string;
};
export type AttemptHooks = {
  /** Ámbito de la clave propia en la auditoría (p. ej. "ip", "terminal"). */
  scope?: string;
  budgets?: AttemptBudget[];
  /** Se llama en la misma transacción cuando un fallo bloquea una clave. */
  onLocked?: (tx: any, scope: string) => Promise<unknown>;
  /** Se llama en la misma transacción cuando el intento acierta. */
  onMatched?: (tx: any, matched: string) => Promise<unknown>;
};

// Evita que una ráfaga con la misma identidad consuma todas las conexiones de
// Prisma mientras espera el advisory lock. PostgreSQL conserva el bloqueo
// entre procesos; esta cola sólo impide abrir transacciones redundantes dentro
// de una misma instancia y se elimina al vaciarse.
const attemptQueues = new Map<string, Promise<void>>();
async function serializeAttempt<T>(key: string, work: () => Promise<T>) {
  const previous = attemptQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  attemptQueues.set(key, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (attemptQueues.get(key) === tail) attemptQueues.delete(key);
  }
}

const locked = (row: { lockedUntil: Date | null }, now: Date) =>
  !!row.lockedUntil && row.lockedUntil > now;

// Cinco fallos con la misma clave la bloquean 15 minutos. La contraseña usa
// el mismo contador, con su propia clave y mensajes (R9-seguridad-1). Los
// cupos (`hooks.budgets`) se comprueban antes de verificar y cuentan cada
// fallo; un rechazo por bloqueo no verifica nada ni cuenta.
export async function verifyAttempt(
  db: any,
  key: string,
  verify: (tx: any) => Promise<string | null>,
  messages: { blocked: string; wrong: string },
  hooks: AttemptHooks = {},
) {
  const budgets = hooks.budgets ?? [];
  return serializeAttempt(key, async () => {
    const result = await db.$transaction(
      async (tx: any) => {
        // Todas las claves del intento se bloquean en un solo orden (el del
        // hash): dos intentos que comparten un cupo nunca se esperan en
        // círculo.
        const keys = [key, ...budgets.map((b) => b.key)];
        await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(h))::text AS locked FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${keys}::text[]) AS k ORDER BY 1) AS s`;
        const now = new Date();
        const row = await tx.authAttempt.upsert({
          where: { key },
          create: { key },
          update: {},
        });
        if (locked(row, now)) return { blocked: messages.blocked };
        const budgetRows = [];
        for (const budget of budgets) {
          const budgetRow = await tx.authAttempt.upsert({
            where: { key: budget.key },
            create: { key: budget.key },
            update: {},
          });
          if (locked(budgetRow, now)) return { blocked: budget.message };
          budgetRows.push(budgetRow);
        }
        if (row.lockedUntil)
          await tx.authAttempt.update({
            where: { key },
            data: {
              failedAttempts: 0,
              lockedUntil: null,
              windowStartedAt: null,
            },
          });
        const matched = await verify(tx);
        if (matched) {
          await tx.authAttempt.update({
            where: { key },
            data: {
              failedAttempts: 0,
              lockedUntil: null,
              windowStartedAt: null,
            },
          });
          await hooks.onMatched?.(tx, matched);
          return { matched };
        }
        // lockedUntil se guarda en UTC, como lo lee Prisma, y no en la zona
        // horaria de la sesión.
        const [counted] = await tx.$queryRaw<{ failedAttempts: number }[]>`
        UPDATE "AuthAttempt" SET "failedAttempts"="failedAttempts"+1,
        "windowStartedAt"=COALESCE("windowStartedAt", (NOW() AT TIME ZONE 'UTC')),
        "lockedUntil"=CASE WHEN "failedAttempts"+1 >= ${ATTEMPT_LIMIT} THEN (NOW() AT TIME ZONE 'UTC')+make_interval(mins => ${ATTEMPT_LOCK_MINUTES}::int) ELSE NULL END
        WHERE key=${key} RETURNING "failedAttempts"`;
        if (Number(counted?.failedAttempts) === ATTEMPT_LIMIT)
          await hooks.onLocked?.(tx, hooks.scope ?? "key");
        for (const [index, budget] of budgets.entries()) {
          const current = budgetRows[index];
          const start: Date | null = current.windowStartedAt;
          const fresh =
            !start || now.getTime() - start.getTime() >= budget.windowMs;
          const failedAttempts = fresh ? 1 : current.failedAttempts + 1;
          const windowStartedAt = fresh ? now : start;
          await tx.authAttempt.update({
            where: { key: budget.key },
            data: {
              failedAttempts,
              windowStartedAt,
              lockedUntil:
                failedAttempts >= budget.max
                  ? new Date(windowStartedAt.getTime() + budget.windowMs)
                  : null,
            },
          });
          if (failedAttempts === budget.max)
            await hooks.onLocked?.(tx, budget.scope);
        }
        return { matched: null };
      },
      { timeout: 20000 },
    );
    if (result.blocked) bad(result.blocked);
    if (!result.matched) bad(messages.wrong);
    return result.matched as string;
  });
}

const SHORT_PIN_MESSAGE =
  "Los PIN de 4 o 5 dígitos quedaron bloqueados hasta una hora en esta sucursal por intentos fallidos. Usa el PIN de un gerente de 6 dígitos; la administración puede cambiar un PIN corto en Configuración › Usuarios y permisos.";

// El contador pertenece al solicitante, nunca bloquea la cuenta de otro
// usuario. Además de la clave propia de cada ruta (5 fallos → 15 min), todos
// los PIN del solicitante comparten un cupo de 10 fallos por hora, y los PIN
// cortos (4 o 5 dígitos, anteriores a la regla de 6) un cupo de 10 fallos por
// hora en toda la sucursal: como cada aprobación compara contra todos los
// gerentes, ese es el límite que protege a cada gerente con PIN corto (S-03).
// Se serializan comprobación, decisión y actualización; un rechazo se
// devuelve después del COMMIT.
export const verifyPinAttempt = (
  db: any,
  key: string,
  verify: () => Promise<string | null>,
  context: { pin?: string; actor?: Actor } = {},
) => {
  const requesterId = context.actor?.id ?? key.slice(key.indexOf(":") + 1);
  const branchId = context.actor?.branchId ?? "main";
  const shortPin = !!context.pin && context.pin.length < 6;
  const budgets: AttemptBudget[] = [
    {
      key: "pin-requester:" + requesterId,
      max: PIN_REQUESTER_FAILURES_PER_HOUR,
      windowMs: HOUR,
      scope: "requester",
      message:
        "PIN bloqueado temporalmente para este usuario por demasiados intentos en la última hora. Espera o pide a un gerente que haga la operación desde su sesión.",
    },
    ...(shortPin
      ? [
          {
            key: "pin-short:" + branchId,
            max: SHORT_PIN_FAILURES_PER_HOUR,
            windowMs: HOUR,
            scope: "short-pin",
            message: SHORT_PIN_MESSAGE,
          },
        ]
      : []),
  ];
  const auditPin = (tx: any, action: string, entityId: string, after: object) =>
    tx.auditLog.create({
      data: {
        userId: requesterId,
        terminalId: context.actor?.terminalId,
        ip: context.actor?.ip,
        action,
        entity: "user",
        entityId,
        branchId,
        after: { ...after, check: key.slice(0, key.indexOf(":")) },
      },
    });
  return verifyAttempt(
    db,
    key,
    verify,
    {
      blocked:
        "PIN bloqueado temporalmente para este usuario. Espera 15 minutos.",
      wrong: "PIN incorrecto.",
    },
    {
      scope: "endpoint",
      budgets,
      onLocked: (tx, scope) =>
        auditPin(tx, "pin_locked", requesterId, { scope }),
      // Un PIN corto todavía aprueba (no se rompe la operación de la tienda),
      // pero queda señalado para que la administración lo cambie.
      onMatched: shortPin
        ? (tx, matched) =>
            auditPin(tx, "pin_short_used", matched, {
              length: context.pin!.length,
            })
        : undefined,
    },
  );
};

// Mantenimiento de datos de seguridad (cada 6 h, sin bloquear el arranque):
// - AuthAttempt: borra contadores sin bloqueo vigente cuyo primer fallo tiene
//   más de un día. Toma el mismo advisory lock que verifyAttempt (sin
//   esperar), así nunca borra una fila que un intento está usando.
// - AuditLog.ip (S-04): la IP es un dato personal; se conserva 90 días.
export const AUDIT_IP_RETENTION_DAYS = 90;
@Injectable()
export class SecurityMaintenance implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(@Inject(Database) private readonly db: Database) {}
  onModuleInit() {
    this.timer = setInterval(
      () => void this.run().catch((error) => console.warn(String(error))),
      6 * HOUR,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    const attempts = await this.db.$executeRaw`
      WITH stale AS MATERIALIZED (
        SELECT key FROM "AuthAttempt"
        WHERE "windowStartedAt" < timezone('UTC', now()) - interval '1 day'
          AND ("lockedUntil" IS NULL OR "lockedUntil" < timezone('UTC', now()))
        LIMIT 1000
      )
      DELETE FROM "AuthAttempt" a USING stale
      WHERE a.key = stale.key AND pg_try_advisory_xact_lock(hashtext(a.key))`;
    const ips = await this.db.$executeRaw`
      UPDATE "AuditLog" SET ip = NULL
      WHERE ip IS NOT NULL
        AND "createdAt" < timezone('UTC', now()) - make_interval(days => ${AUDIT_IP_RETENTION_DAYS}::int)`;
    return { attempts, ips };
  }
}

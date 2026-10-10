import { Inject, Injectable } from "@nestjs/common";
import { Database } from "./common";

// Retención de tablas que crecen sin límite (auditoría 06 D-A2/D-B12 y
// auditoría 03 M7/M11/B1). El disco de la base en Render es de 1 GB: sin
// purga, se llena y PostgreSQL deja de aceptar ventas.
//
//   RealtimeEvent       una fila por cada cambio de stock; el sondeo sólo lee
//                       lo nuevo desde que arranca (realtime.ts), así que lo
//                       de más de 2 días no lo vuelve a leer nadie.
//   NotificationOutbox  avisos enviados hace más de 30 días y fallidos
//                       (descartados tras 8 intentos) creados hace más de 30
//                       días. Antes los fallidos no se borraban nunca, con el
//                       nombre del cliente, y los enviados sólo si Telegram
//                       estaba activo. Los pendientes se conservan: todavía
//                       se van a enviar.
//   AuthAttempt         intentos de usuarios inexistentes (login:missing:…,
//                       con la IP en la clave) de más de 2 días y el resto de
//                       más de 30, nunca uno que siga bloqueado.
//   RefreshToken        vencidos hace más de 1 día.
//
// Fuera de esta purga, a propósito: AuditLog (trazabilidad; archivar requiere
// decisión del contador), MerchandiseOperation (clave de idempotencia de la
// mercancía offline) y las ventas/pagos (conservación fiscal). Ver
// docs/legal/DATOS_PERSONALES_INVENTARIO.md.
export const RETENTION = {
  realtimeEventHours: 48,
  notificationDays: 30,
  missingLoginAttemptHours: 48,
  loginAttemptDays: 30,
  expiredRefreshTokenHours: 24,
  // Filas por sentencia: una primera purga grande no retiene la tabla.
  batch: 5000,
  maxBatches: 200,
} as const;

const HOUR = 3600000;

// Borra en lotes con la sentencia que recibe el corte y el tamaño del lote.
async function batched(
  run: (limit: number) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < RETENTION.maxBatches; i++) {
    const n = Number(await run(RETENTION.batch));
    total += n;
    if (n < RETENTION.batch) break;
  }
  return total;
}

/** Purga idempotente; devuelve cuántas filas borró de cada tabla. */
export async function purgeExpiredData(db: any, now = new Date()) {
  // Las columnas son timestamp sin zona en UTC: el corte se convierte a UTC
  // en la propia sentencia, sin depender de la zona de la sesión.
  const at = (ms: number) => new Date(now.getTime() - ms);
  const realtimeCutoff = at(RETENTION.realtimeEventHours * HOUR);
  const notificationCutoff = at(RETENTION.notificationDays * 24 * HOUR);
  const missingCutoff = at(RETENTION.missingLoginAttemptHours * HOUR);
  const attemptCutoff = at(RETENTION.loginAttemptDays * 24 * HOUR);
  const tokenCutoff = at(RETENTION.expiredRefreshTokenHours * HOUR);
  const result = {
    realtimeEvents: 0,
    notifications: 0,
    authAttempts: 0,
    refreshTokens: 0,
    errors: [] as string[],
  };
  const step = async (
    name: Exclude<keyof typeof result, "errors">,
    run: (limit: number) => Promise<number>,
  ) => {
    try {
      result[name] = await batched(run);
    } catch (error: any) {
      // Una tabla que falla (p. ej. falta la columna de una migración que
      // quedó pendiente) no impide purgar las demás.
      result.errors.push(`${name}: ${String(error?.message ?? error)}`);
    }
  };
  await step(
    "realtimeEvents",
    (limit) => db.$executeRaw`
      DELETE FROM "RealtimeEvent" WHERE id IN (
        SELECT id FROM "RealtimeEvent"
         WHERE "createdAt" < (${realtimeCutoff}::timestamptz AT TIME ZONE 'UTC')
         ORDER BY id LIMIT ${limit})`,
  );
  await step(
    "notifications",
    (limit) => db.$executeRaw`
      DELETE FROM "NotificationOutbox" WHERE id IN (
        SELECT id FROM "NotificationOutbox"
         WHERE (status = 'sent'
                AND "sentAt" < (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC'))
            OR (status = 'failed'
                AND "createdAt" < (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC'))
         LIMIT ${limit})`,
  );
  await step(
    "authAttempts",
    (limit) => db.$executeRaw`
      DELETE FROM "AuthAttempt" WHERE key IN (
        SELECT key FROM "AuthAttempt"
         WHERE ("lockedUntil" IS NULL
                OR "lockedUntil" < (${now}::timestamptz AT TIME ZONE 'UTC'))
           AND (("key" LIKE 'login:missing:%'
                 AND "updatedAt" < (${missingCutoff}::timestamptz AT TIME ZONE 'UTC'))
                OR "updatedAt" < (${attemptCutoff}::timestamptz AT TIME ZONE 'UTC'))
         LIMIT ${limit})`,
  );
  await step(
    "refreshTokens",
    (limit) => db.$executeRaw`
      DELETE FROM "RefreshToken" WHERE id IN (
        SELECT id FROM "RefreshToken"
         WHERE "expiresAt" < (${tokenCutoff}::timestamptz AT TIME ZONE 'UTC')
         LIMIT ${limit})`,
  );
  return result;
}

/** Ejecuta la purga una vez por hora (la primera, un minuto después de arrancar). */
@Injectable()
export class RetentionWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  constructor(@Inject(Database) private readonly db: Database) {}
  onApplicationBootstrap() {
    if (process.env.NEXORA_RETENTION === "off") return;
    this.first = setTimeout(() => void this.run(), 60_000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), HOUR);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await purgeExpiredData(this.db);
      for (const error of result.errors)
        console.warn("[retención] " + error.slice(0, 300));
    } catch (error: any) {
      console.warn(
        "[retención] " + String(error?.message ?? error).slice(0, 300),
      );
    } finally {
      this.running = false;
    }
  }
}

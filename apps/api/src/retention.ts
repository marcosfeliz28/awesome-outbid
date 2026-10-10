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
//                       estaba activo. Los pendientes se conservan mientras
//                       sean recientes (todavía se van a enviar); uno con más
//                       de 30 días ya es noticia vieja (el trabajador está
//                       detenido o Telegram apagado) y se borra igual, con
//                       los nombres de clientes de su texto (V2-06).
//   AuthAttempt         intentos de usuarios inexistentes (login:missing:…,
//                       con la IP en la clave) de más de 2 días y el resto de
//                       más de 30, nunca uno que siga bloqueado.
//   RefreshToken        vencidos hace más de 1 día.
//   AuditLog            sólo el ruido de seguridad de sesiones (inicios de
//                       sesión, bloqueos, PIN): más de 400 días (13 meses,
//                       el mismo horizonte de los respaldos de Drive). El
//                       resto de la bitácora (ventas, anulaciones, pagos,
//                       devoluciones, usuarios, ajustes) NO se purga: es
//                       trazabilidad de dinero; el plazo legal (el Código
//                       Tributario habla de 10 años) lo confirma el
//                       contador antes de archivar nada (V2-06).
//   InvoiceAttachment   archivos de factura de proveedor huérfanos: sin
//                       recepción ni borrador que los use, de más de 14 días
//                       (los borradores sin confirmar vencen a los 7 al subir
//                       otra factura; si nadie sube otra, quedaban para
//                       siempre). Los de una recepción nunca (clave RESTRICT).
//
// Fuera de esta purga, a propósito: el resto de AuditLog (ver arriba),
// MerchandiseOperation (clave de idempotencia de la
// mercancía offline) y las ventas/pagos (conservación fiscal). Ver
// docs/legal/DATOS_PERSONALES_INVENTARIO.md.
export const RETENTION = {
  realtimeEventHours: 48,
  notificationDays: 30,
  missingLoginAttemptHours: 48,
  loginAttemptDays: 30,
  expiredRefreshTokenHours: 24,
  auditSecurityDays: 400,
  orphanAttachmentDays: 14,
  // Filas por sentencia: una primera purga grande no retiene la tabla.
  batch: 5000,
  maxBatches: 200,
} as const;

const HOUR = 3600000;

// Acciones de AuditLog que son ruido de seguridad de sesiones y no dinero.
export const SECURITY_AUDIT_ACTIONS = [
  "login",
  "login_locked",
  "pin_locked",
  "pin_short_used",
  "pin_switch_denied",
] as const;

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
  const auditCutoff = at(RETENTION.auditSecurityDays * 24 * HOUR);
  const attachmentCutoff = at(RETENTION.orphanAttachmentDays * 24 * HOUR);
  const result = {
    realtimeEvents: 0,
    notifications: 0,
    authAttempts: 0,
    refreshTokens: 0,
    auditLogs: 0,
    invoiceAttachments: 0,
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
  // Cada DELETE repite su condición fuera del lote: si una fila cambia
  // mientras tanto (p. ej. un intento de inicio de sesión renueva su fecha),
  // PostgreSQL la vuelve a evaluar y no la borra.
  await step(
    "realtimeEvents",
    (limit) => db.$executeRaw`
      WITH old AS MATERIALIZED (
        SELECT id FROM "RealtimeEvent"
         WHERE "createdAt" < (${realtimeCutoff}::timestamptz AT TIME ZONE 'UTC')
         ORDER BY id LIMIT ${limit})
      DELETE FROM "RealtimeEvent" e USING old
       WHERE e.id = old.id
         AND e."createdAt" < (${realtimeCutoff}::timestamptz AT TIME ZONE 'UTC')`,
  );
  await step(
    "notifications",
    (limit) => db.$executeRaw`
      WITH old AS MATERIALIZED (
        SELECT id FROM "NotificationOutbox"
         WHERE (status = 'sent'
                AND "sentAt" < (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC'))
            OR (status IN ('failed', 'pending')
                AND "createdAt" < (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC'))
         LIMIT ${limit})
      DELETE FROM "NotificationOutbox" o USING old
       WHERE o.id = old.id
         AND ((o.status = 'sent'
               AND o."sentAt" < (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC'))
           OR (o.status IN ('failed', 'pending')
               AND o."createdAt" < (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC')))`,
  );
  // Mismo candado consultivo por clave que el freno de intentos de la rama
  // de seguridad (sin esperar): nunca borra un contador en uso.
  await step(
    "authAttempts",
    (limit) => db.$executeRaw`
      WITH old AS MATERIALIZED (
        SELECT key FROM "AuthAttempt"
         WHERE ("lockedUntil" IS NULL
                OR "lockedUntil" < (${now}::timestamptz AT TIME ZONE 'UTC'))
           AND (("key" LIKE 'login:missing:%'
                 AND "updatedAt" < (${missingCutoff}::timestamptz AT TIME ZONE 'UTC'))
                OR "updatedAt" < (${attemptCutoff}::timestamptz AT TIME ZONE 'UTC'))
         LIMIT ${limit})
      DELETE FROM "AuthAttempt" a USING old
       WHERE a.key = old.key
         AND (a."lockedUntil" IS NULL
              OR a."lockedUntil" < (${now}::timestamptz AT TIME ZONE 'UTC'))
         AND ((a.key LIKE 'login:missing:%'
               AND a."updatedAt" < (${missingCutoff}::timestamptz AT TIME ZONE 'UTC'))
              OR a."updatedAt" < (${attemptCutoff}::timestamptz AT TIME ZONE 'UTC'))
         AND pg_try_advisory_xact_lock(hashtext(a.key))`,
  );
  await step(
    "refreshTokens",
    (limit) => db.$executeRaw`
      WITH old AS MATERIALIZED (
        SELECT id FROM "RefreshToken"
         WHERE "expiresAt" < (${tokenCutoff}::timestamptz AT TIME ZONE 'UTC')
         LIMIT ${limit})
      DELETE FROM "RefreshToken" t USING old
       WHERE t.id = old.id
         AND t."expiresAt" < (${tokenCutoff}::timestamptz AT TIME ZONE 'UTC')`,
  );
  await step(
    "auditLogs",
    (limit) => db.$executeRaw`
      WITH old AS MATERIALIZED (
        SELECT id FROM "AuditLog"
         WHERE action = ANY(${[...SECURITY_AUDIT_ACTIONS]}::text[])
           AND "createdAt" < (${auditCutoff}::timestamptz AT TIME ZONE 'UTC')
         ORDER BY "createdAt" LIMIT ${limit})
      DELETE FROM "AuditLog" a USING old
       WHERE a.id = old.id
         AND a.action = ANY(${[...SECURITY_AUDIT_ACTIONS]}::text[])
         AND a."createdAt" < (${auditCutoff}::timestamptz AT TIME ZONE 'UTC')`,
  );
  // Sólo huérfanos: ni una recepción ni un borrador los usan (la clave
  // GoodsReceipt_attachmentId_fkey, RESTRICT, lo garantiza además en la base).
  await step(
    "invoiceAttachments",
    (limit) => db.$executeRaw`
      WITH old AS MATERIALIZED (
        SELECT a.id FROM "InvoiceAttachment" a
         WHERE a."createdAt" < (${attachmentCutoff}::timestamptz AT TIME ZONE 'UTC')
           AND NOT EXISTS (SELECT 1 FROM "GoodsReceipt" r WHERE r."attachmentId" = a.id)
           AND NOT EXISTS (SELECT 1 FROM "InvoiceDraft" d WHERE d."attachmentId" = a.id)
         ORDER BY a."createdAt" LIMIT ${limit})
      DELETE FROM "InvoiceAttachment" a USING old
       WHERE a.id = old.id
         AND NOT EXISTS (SELECT 1 FROM "GoodsReceipt" r WHERE r."attachmentId" = a.id)
         AND NOT EXISTS (SELECT 1 FROM "InvoiceDraft" d WHERE d."attachmentId" = a.id)`,
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

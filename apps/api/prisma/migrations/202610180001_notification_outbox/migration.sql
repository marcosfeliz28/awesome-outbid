-- Cola durable de avisos (Telegram): cada factura, anulación, devolución,
-- cobro y cierre de caja deja aquí su texto ya renderizado, sin datos
-- personales sensibles, y un trabajador de la API lo envía después. La venta
-- nunca espera a Telegram.
--
-- Idempotente: con IF NOT EXISTS la migración no falla si alguien ya creó la
-- tabla o los índices a mano, ni bloquea tablas existentes (la tabla es nueva).
-- Las fechas son «timestamp sin zona» en UTC, como el resto del esquema.
CREATE TABLE IF NOT EXISTS "NotificationOutbox" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "branchId" TEXT NOT NULL DEFAULT 'main',
    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- El trabajador busca lo pendiente cuya hora de reintento ya llegó.
CREATE INDEX IF NOT EXISTS "NotificationOutbox_status_nextAttemptAt_idx" ON "NotificationOutbox"("status", "nextAttemptAt");

-- Un mismo evento de la misma venta (p. ej. un reintento offline con el mismo
-- offlineUuid) no produce un segundo aviso. Si alguien creó la tabla a mano y
-- quedaron avisos repetidos, se conserva uno por evento para que el índice
-- único no haga fallar el despliegue (en una tabla nueva no borra nada).
DELETE FROM "NotificationOutbox" a
USING "NotificationOutbox" b
WHERE a."eventType" = b."eventType"
  AND a."refId" = b."refId"
  AND a."id" > b."id"
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'NotificationOutbox_eventType_refId_key'
  );
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationOutbox_eventType_refId_key" ON "NotificationOutbox"("eventType", "refId");

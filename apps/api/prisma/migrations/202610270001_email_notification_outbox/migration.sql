-- Cola durable de correo para cierres de caja y solicitudes de anulacion.
-- La clave de Resend y el destinatario nunca se guardan en la base.
CREATE TABLE IF NOT EXISTS "EmailNotificationOutbox" (
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
    CONSTRAINT "EmailNotificationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailNotificationOutbox_status_nextAttemptAt_idx"
  ON "EmailNotificationOutbox"("status", "nextAttemptAt");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailNotificationOutbox_eventType_refId_key"
  ON "EmailNotificationOutbox"("eventType", "refId");

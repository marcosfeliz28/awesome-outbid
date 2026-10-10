-- Respaldo diario cifrado a Google Drive (apps/api/src/drive-backup.ts,
-- docs/RESPALDO_DRIVE.md). Una sola fila ('main') con la conexión y el estado
-- del último respaldo. El permiso de Google (refresh token) se guarda CIFRADO
-- con AES-256-GCM (clave derivada de BACKUP_ENCRYPTION_KEY); nunca en claro.
--
-- Tabla nueva y sólo aditiva: IF NOT EXISTS hace que repetir la migración, o
-- que alguien haya creado la tabla a mano, no haga fallar el despliegue, y no
-- bloquea ninguna tabla de ventas. Fechas «timestamp sin zona» en UTC, como el
-- resto del esquema.
CREATE TABLE IF NOT EXISTS "DriveBackup" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "refreshTokenEnc" TEXT,
    "accountEmail" TEXT,
    "folderId" TEXT,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "connectedAt" TIMESTAMP(3),
    "connectedBy" TEXT,
    "authError" TEXT,
    "lockId" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "runningSince" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastTrigger" TEXT,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastDurationMs" INTEGER,
    "lastSuccessAt" TIMESTAMP(3),
    "lastSize" BIGINT,
    "lastFileName" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "dayKey" TEXT,
    "dayAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriveBackup_pkey" PRIMARY KEY ("id")
);

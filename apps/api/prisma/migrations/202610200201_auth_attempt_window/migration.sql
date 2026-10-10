-- Auditoría de seguridad 2026-10-10 (S-01, S-03): ventana de los cupos por
-- cuenta y por PIN, y fecha para purgar contadores viejos de AuthAttempt.
-- Columna nula sin valor por defecto: se agrega sin reescribir la tabla y
-- las filas existentes conservan su contador y bloqueo. Idempotente.
ALTER TABLE "AuthAttempt" ADD COLUMN IF NOT EXISTS "windowStartedAt" TIMESTAMP(3);

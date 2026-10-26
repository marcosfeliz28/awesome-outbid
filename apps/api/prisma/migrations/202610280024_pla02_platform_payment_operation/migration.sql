-- PLA-02/PLA-03: clave de operación (idempotencia) y plan cobrado en cada pago
-- manual. Aditiva: columnas nulas, las filas anteriores no cambian (ADD COLUMN
-- no dispara el trigger de inmutabilidad).
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "operationId" uuid;
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "plan" text;
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPayment_operationId_key" ON "PlatformPayment"("operationId");

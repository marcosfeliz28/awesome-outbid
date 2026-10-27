-- PC-23: al anular un pago hay que devolver a la empresa el estado y los vencimientos que
-- tenía justo antes de cobrar (si estaba vencida o suspendida, anular no puede darle una
-- gracia nueva). Se guardan en el propio pago al registrarlo. Aditiva: columnas nulas, las
-- filas anteriores no cambian (ADD COLUMN no dispara el trigger de inmutabilidad).
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "prevStatus" text;
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "prevPaidThroughAt" timestamp(3);
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "prevPastDueAt" timestamp(3);
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "prevSuspendedAt" timestamp(3);

-- «Anular pago» del operador: la bitácora sigue inmutable (sólo INSERT). Una
-- anulación es otra fila que apunta al pago anulado, con su motivo; el pago
-- original no se toca. Aditiva e idempotente.
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "voidsPaymentId" uuid;
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "voidReason" text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformPayment_voidsPaymentId_fkey') THEN
    ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_voidsPaymentId_fkey"
      FOREIGN KEY ("voidsPaymentId") REFERENCES "PlatformPayment"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformPayment_void_reason') THEN
    ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_void_reason"
      CHECK ("voidsPaymentId" IS NULL OR length(btrim(coalesce("voidReason", ''))) >= 3);
  END IF;
END $$;
-- Un pago se anula una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPayment_voidsPaymentId_key"
  ON "PlatformPayment"("voidsPaymentId") WHERE "voidsPaymentId" IS NOT NULL;

-- «Anular pago» del operador: la bitácora sigue inmutable (sólo INSERT). Una
-- anulación es otra fila que apunta al pago anulado, con su motivo; el pago
-- original no se toca. Aditiva e idempotente.
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "voidsPaymentId" uuid;
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "voidReason" text;
DO $$
BEGIN
  -- Las restricciones se buscan en ESTA tabla: el mismo nombre en otra no las omite.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformPayment_voidsPaymentId_fkey'
                 AND conrelid = '"PlatformPayment"'::regclass) THEN
    ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_voidsPaymentId_fkey"
      FOREIGN KEY ("voidsPaymentId") REFERENCES "PlatformPayment"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformPayment_void_reason'
                 AND conrelid = '"PlatformPayment"'::regclass) THEN
    ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_void_reason"
      CHECK ("voidsPaymentId" IS NULL OR length(btrim(coalesce("voidReason", ''))) >= 3);
  END IF;
END $$;
-- Un pago se anula una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPayment_voidsPaymentId_key"
  ON "PlatformPayment"("voidsPaymentId") WHERE "voidsPaymentId" IS NOT NULL;
-- La anulación debe ser de la misma empresa que el pago anulado; la FK simple
-- acepta uno de otra empresa. Misma guardia que las demás referencias entre
-- tablas (nexora_check_tenant_fk: padre inexistente o de otra empresa => 23503).
DROP TRIGGER IF EXISTS nexora_fk_platform_payment_void ON "PlatformPayment";
CREATE TRIGGER nexora_fk_platform_payment_void
  BEFORE INSERT OR UPDATE OF "voidsPaymentId", "tenantId" ON "PlatformPayment"
  FOR EACH ROW EXECUTE FUNCTION nexora_check_tenant_fk('PlatformPayment', 'id', 'voidsPaymentId');

-- GV: moneda del pago (DOP o USD), tasa y equivalente en pesos. Columnas
-- aditivas e idempotentes: las filas actuales quedan en DOP con equivalente
-- nulo (el monto ya es pesos). En US$ la tasa es obligatoria.
ALTER TABLE "GvPayment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'DOP';
ALTER TABLE "GvPayment" ADD COLUMN IF NOT EXISTS "rate" DECIMAL(14,4);
ALTER TABLE "GvPayment" ADD COLUMN IF NOT EXISTS "amountDop" DECIMAL(14,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_currency_valid') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT "gv_payment_currency_valid"
      CHECK ("currency" IN ('DOP', 'USD'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_usd_rate') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT "gv_payment_usd_rate"
      CHECK ("currency" = 'DOP' OR ("rate" IS NOT NULL AND "rate" > 0));
  END IF;
END $$;

-- Aditiva (dueña, 25-oct): pago en efectivo en dólares. «amount» sigue siendo
-- el equivalente en pesos (totales, reportes y contabilidad no cambian); los
-- dólares recibidos y la tasa usada quedan aparte para el cuadre en US$.
-- Columnas con valor constante o NULL: PostgreSQL no reescribe los pagos de
-- antes, que quedan como «DOP».
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'DOP';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(14,2);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "usdRate" DECIMAL(12,4);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_currency_valid') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT payment_currency_valid CHECK (
      ("currency" = 'DOP' AND "amountUsd" IS NULL AND "usdRate" IS NULL)
      OR ("currency" = 'USD' AND "method" = 'cash'
          AND COALESCE("amountUsd", 0) > 0 AND COALESCE("usdRate", 0) > 0)
    );
  END IF;
END $$;

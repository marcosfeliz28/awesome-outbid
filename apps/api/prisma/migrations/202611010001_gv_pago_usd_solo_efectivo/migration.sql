-- H-01 en GV (1-nov): un pago en US$ sólo puede ser en efectivo, igual que en
-- las ventas (Payment). Restricción aditiva e idempotente.
--
-- Se añade NOT VALID (no escanea la tabla al crearla) y después se valida en
-- el mismo archivo: VALIDATE sólo toma SHARE UPDATE EXCLUSIVE y no bloquea
-- lecturas ni escrituras. Si una GV antigua en US$ por transferencia o tarjeta
-- ya existe, la validación falla, la migración sigue y la restricción queda
-- NOT VALID (protege lo nuevo); 202610220001 la deja registrada para revisar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_usd_cash_only') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT "gv_payment_usd_cash_only"
      CHECK ("currency" = 'DOP' OR "method" = 'efectivo') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "GvPayment" VALIDATE CONSTRAINT "gv_payment_usd_cash_only";
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'gv_payment_usd_cash_only queda NOT VALID: hay GV en US$ por transferencia o tarjeta.';
END $$;

-- IA-08: una referencia de pago acredita un solo paquete de IA en toda la
-- plataforma (todas las empresas pagan a la misma cuenta de Nexora), sin
-- distinguir mayúsculas ni espacios. Aditiva: si ya hay duplicados, avisa y
-- omite el índice para no abortar el despliegue.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AiPackCredit"
    GROUP BY lower(regexp_replace(reference, '[[:space:]]+', '', 'g')) HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'AiPackCredit: referencias duplicadas; índice de referencia normalizada omitido.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "AiPackCredit_reference_normalized_key"
      ON "AiPackCredit" (lower(regexp_replace(reference, '[[:space:]]+', '', 'g')));
  END IF;
END $$;

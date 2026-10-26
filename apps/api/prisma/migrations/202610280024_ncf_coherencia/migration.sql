-- NCF-07: coherencia entre NCF, tipo y estado fiscal de la venta.
--   sale_fiscal_status_valid  "fiscalStatus" not_issued | issued
--   sale_issued_has_ncf       emitida => tiene NCF
--   sale_ncf_matches_type     NCF => tiene tipo, empieza por el tipo y es
--                             Bxx + 8 dígitos o Exx + 10 dígitos
-- Aditiva e idempotente; nunca aborta un despliegue: si hay filas antiguas que
-- violan una regla, esa regla no se agrega (RAISE NOTICE) para no bloquear la
-- anulación o anonimización de esas ventas. Corrige las filas y vuelve a
-- ejecutar este archivo con psql para agregarla.
DO $$
DECLARE
  spec RECORD;
  violating BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('sale_fiscal_status_valid', '"fiscalStatus" IN (''not_issued'', ''issued'')'),
      ('sale_issued_has_ncf', '"fiscalStatus" <> ''issued'' OR ncf IS NOT NULL'),
      ('sale_ncf_matches_type',
        'ncf IS NULL OR ("ncfType" IS NOT NULL AND left(ncf, 3) = "ncfType" AND ncf ~ ''^(B[0-9]{10}|E[0-9]{12})$'')')
    ) AS t(name, body)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE n.nspname = current_schema() AND r.relname = 'Sale' AND c.conname = spec.name
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM "Sale" WHERE NOT (%s)', spec.body) INTO violating;
    IF violating > 0 THEN
      RAISE NOTICE 'NCF: % venta(s) antiguas violan %; no se agrega. Corrígelas y vuelve a ejecutar esta migración.',
        violating, spec.name;
    ELSE
      EXECUTE format('ALTER TABLE "Sale" ADD CONSTRAINT %I CHECK (%s)', spec.name, spec.body);
    END IF;
  END LOOP;
END $$;

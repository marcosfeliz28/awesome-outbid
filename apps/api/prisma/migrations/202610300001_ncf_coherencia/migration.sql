-- NCF-07: coherencia entre NCF, tipo y estado fiscal de la venta.
--   sale_fiscal_status_valid  "fiscalStatus" not_issued | issued
--   sale_issued_has_ncf       emitida => tiene NCF
--   sale_ncf_matches_type     NCF => tiene tipo, empieza por el tipo y es
--                             Bxx + 8 dígitos o Exx + 10 dígitos
-- Aditiva e idempotente; nunca aborta un despliegue y nunca deja una regla sin
-- instalar. Cada CHECK se agrega NOT VALID (bloqueo instantáneo) y se valida
-- aparte. Si hay ventas antiguas que violan una regla, la regla se instala
-- igual pero solo se exige a las ventas creadas desde ahora («createdAt»
-- anterior a este momento queda exenta): las filas nuevas quedan protegidas y
-- anular o anonimizar una venta antigua no se bloquea. El RAISE NOTICE dice
-- cuántas son; tras corregirlas, DROP CONSTRAINT y volver a ejecutar este
-- archivo instala la regla completa.
DO $$
DECLARE
  spec RECORD;
  violating BIGINT;
  rule TEXT;
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
    rule := spec.body;
    IF violating > 0 THEN
      RAISE NOTICE 'NCF: % venta(s) antiguas violan %; la regla se instala solo para ventas nuevas. Corrígelas y reinstala la regla completa.',
        violating, spec.name;
      rule := format('"createdAt" < %L::timestamp OR (%s)', localtimestamp::text, spec.body);
    END IF;
    EXECUTE format('ALTER TABLE "Sale" ADD CONSTRAINT %I CHECK (%s) NOT VALID', spec.name, rule);
    EXECUTE format('ALTER TABLE "Sale" VALIDATE CONSTRAINT %I', spec.name);
  END LOOP;
END $$;

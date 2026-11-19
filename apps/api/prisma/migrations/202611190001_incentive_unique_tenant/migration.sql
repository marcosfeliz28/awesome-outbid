-- A1 (aislamiento): los únicos de incentivos eran globales (sin tenantId), así
-- que la empresa B no podía cerrar un mes que la A ya cerró. Se crean los
-- únicos por empresa y, sólo si el nuevo existe, se quita el viejo.
-- Idempotente: se puede repetir sin efecto.
DO $$
DECLARE
  spec RECORD;
  dupes BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('IncentiveRate_tenantId_branchId_categoryId_key', 'IncentiveRate_branchId_categoryId_key', 'IncentiveRate', '"tenantId", "branchId", "categoryId"'),
      ('IncentivePeriodClose_tenantId_branchId_period_key', 'IncentivePeriodClose_branchId_period_key', 'IncentivePeriodClose', '"tenantId", "branchId", "period"'),
      ('IncentiveSettlement_tenantId_branchId_period_userId_key', 'IncentiveSettlement_branchId_period_userId_key', 'IncentiveSettlement', '"tenantId", "branchId", "period", "userId"')
    ) AS t(new_name, old_name, table_name, columns)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = spec.new_name) THEN
      EXECUTE format(
        'SELECT count(*) FROM (SELECT 1 FROM %I GROUP BY %s HAVING count(*) > 1) d',
        spec.table_name, spec.columns
      ) INTO dupes;
      IF dupes = 0 THEN
        EXECUTE format('CREATE UNIQUE INDEX %I ON %I (%s)', spec.new_name, spec.table_name, spec.columns);
      ELSE
        RAISE NOTICE 'A1: % tiene % grupo(s) repetido(s); % queda pendiente y se conserva %.',
          spec.table_name, dupes, spec.new_name, spec.old_name;
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = spec.new_name) THEN
      EXECUTE format('DROP INDEX IF EXISTS %I', spec.old_name);
    END IF;
  END LOOP;
END $$;

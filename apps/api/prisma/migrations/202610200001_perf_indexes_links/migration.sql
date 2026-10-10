-- Rendimiento con historial (prueba de carga de un año, ~110 000 ventas):
-- índices en las columnas que enlazan tablas y planes de consulta a medida.
--
-- 1. Índices. Sin ellos, el esperado de una caja (cash.ts, cashExpected) leía
--    todos los pagos de la base (203 ms -> 0,14 ms con el índice) y los
--    detalles de venta, devoluciones y movimientos hacían lo mismo.
--    Los nombres son los que Prisma genera para los @@index de schema.prisma,
--    así el esquema y la base no divergen.
-- 2. plan_cache_mode = force_custom_plan para el rol y la base de la API. Con
--    sentencias preparadas PostgreSQL acaba usando un plan genérico que, para
--    la suma de pagos por método (dashboard y reports/by-payment), estima
--    mal y recorre todos los pagos: 2 s -> 2 ms con el plan a medida. Afecta
--    sólo a conexiones nuevas (la API se reinicia en cada despliegue).
--
-- Nunca aborta un despliegue: cada paso va en su propio bloque con manejo de
-- errores y, si algo falla (permisos, bloqueo que no se libera, etc.), sólo
-- avisa con RAISE NOTICE. Es idempotente: se puede volver a ejecutar con psql
-- para crear lo que haya quedado pendiente (ver docs/DEPLOY-RENDER.md).

DO $$
DECLARE
  spec RECORD;
  valid BOOLEAN;
BEGIN
  -- Si una escritura larga retiene la tabla, no se espera indefinidamente:
  -- el índice queda pendiente (NOTICE) y el despliegue continúa.
  PERFORM set_config('lock_timeout', '15s', true);
  FOR spec IN
    SELECT * FROM (VALUES
      ('Payment_saleId_idx', 'Payment', 'saleId'),
      ('Payment_cashSessionId_idx', 'Payment', 'cashSessionId'),
      ('SaleItem_saleId_idx', 'SaleItem', 'saleId'),
      ('Sale_cashSessionId_idx', 'Sale', 'cashSessionId'),
      ('SaleReturn_saleId_idx', 'SaleReturn', 'saleId'),
      ('SaleReturn_cashSessionId_idx', 'SaleReturn', 'cashSessionId'),
      ('CashMovement_sessionId_idx', 'CashMovement', 'sessionId'),
      ('Variant_productId_idx', 'Variant', 'productId')
    ) AS t(index_name, table_name, column_name)
  LOOP
    BEGIN
      SELECT i.indisvalid INTO valid
        FROM pg_class c
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = current_schema() AND c.relname = spec.index_name;
      -- Un índice inválido (p. ej. un CREATE INDEX CONCURRENTLY interrumpido)
      -- no sirve a las consultas: se rehace.
      IF valid IS FALSE THEN
        EXECUTE format('DROP INDEX %I', spec.index_name);
      END IF;
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (%I)',
        spec.index_name, spec.table_name, spec.column_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'PERF: no se creó el índice % (%); el despliegue sigue. Vuelve a ejecutar esta migración con psql para crearlo.',
        spec.index_name, SQLERRM;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER ROLE CURRENT_USER SET plan_cache_mode = force_custom_plan';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PERF: no se pudo fijar plan_cache_mode para el rol % (%); el despliegue sigue.',
    current_user, SQLERRM;
END $$;

-- También para la base: cubre a la API si se conecta con otro rol que el que
-- aplica las migraciones (instalaciones locales). Requiere ser dueño de la base.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET plan_cache_mode = force_custom_plan',
    current_database()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PERF: no se pudo fijar plan_cache_mode para la base % (%); el despliegue sigue.',
    current_database(), SQLERRM;
END $$;

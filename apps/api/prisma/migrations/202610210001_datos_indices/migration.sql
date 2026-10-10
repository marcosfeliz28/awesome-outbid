-- Auditoría 06 (D-A1): índices que siguen faltando después de
-- 202610200001_perf_indexes_links (rama de rendimiento), medidos con
-- EXPLAIN ANALYZE sobre 100 000 ventas, 300 000 entradas de bitácora y
-- 40 000 líneas de compra:
--
--   Sale("customerId")             deuda del cliente al vender a crédito,
--                                  anonimización: Seq Scan 46 ms -> < 0,1 ms.
--   AuditLog("entityId","entity")  venta offline en conflicto (dentro de la
--                                  venta), anonimización: 78 ms -> < 0,1 ms.
--   PurchaseItem("orderId")        recepción de una orden (dentro de la
--                                  transacción Serializable): 7 ms -> < 0,1 ms.
--
-- No se agregan InventoryMovement("refId") ni CreditNote("customerId"):
-- ninguna consulta de la API filtra por refId y CreditNote es pequeña (1 ms
-- con 10 000 notas).
--
-- Los nombres son los que Prisma genera para los @@index de schema.prisma.
-- Nunca aborta un despliegue: cada índice va en su propio bloque y, si falla
-- (permisos, bloqueo que no se libera), sólo avisa con RAISE NOTICE. Es
-- idempotente: puede volver a ejecutarse con psql para crear lo pendiente.

DO $$
DECLARE
  spec RECORD;
  valid BOOLEAN;
BEGIN
  PERFORM set_config('lock_timeout', '15s', true);
  FOR spec IN
    SELECT * FROM (VALUES
      ('Sale_customerId_idx', 'Sale', '"customerId"'),
      ('AuditLog_entityId_entity_idx', 'AuditLog', '"entityId", "entity"'),
      ('PurchaseItem_orderId_idx', 'PurchaseItem', '"orderId"')
    ) AS t(index_name, table_name, columns)
  LOOP
    BEGIN
      valid := NULL;
      SELECT i.indisvalid INTO valid
        FROM pg_class c
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = current_schema() AND c.relname = spec.index_name;
      -- Un índice inválido (CREATE INDEX CONCURRENTLY interrumpido a mano) no
      -- sirve a las consultas: se rehace.
      IF valid IS FALSE THEN
        EXECUTE format('DROP INDEX %I', spec.index_name);
      END IF;
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (%s)',
        spec.index_name, spec.table_name, spec.columns
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'DATOS: no se creó el índice % (%); el despliegue sigue. Vuelve a ejecutar esta migración con psql para crearlo.',
        spec.index_name, SQLERRM;
    END;
  END LOOP;
END $$;

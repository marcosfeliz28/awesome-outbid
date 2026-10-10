-- Auditoría 06 (D-M3, D-M5): restricciones que la base aceptaba sin
-- protestar (pagos negativos, notas de crédito de devoluciones inexistentes,
-- recibido mayor que lo pedido, caja cerrada antes de abrirse, períodos de
-- incentivo imposibles, adjunto de una recepción que se puede borrar...).
--
-- Cómo se aplican, sin abortar nunca un despliegue:
--   1. Cada restricción se agrega con NOT VALID: desde ese momento la base
--      rechaza filas nuevas o modificadas que la violen, sin revisar las
--      antiguas (agregarla es instantáneo).
--   2. Después se intenta VALIDATE CONSTRAINT. Si hay filas antiguas que la
--      violan, queda NOT VALID (sigue protegiendo lo nuevo) y se avisa con
--      RAISE NOTICE indicando cuántas filas hay que revisar; si no, queda
--      validada.
--   3. Cualquier otro error (permisos, bloqueo) sólo produce un NOTICE.
-- Es idempotente: al volver a ejecutarse sólo agrega lo que falta e intenta
-- validar lo que quedó pendiente (por ejemplo, después de corregir los datos):
--   psql "$DATABASE_URL" -f apps/api/prisma/migrations/202610210002_datos_restricciones/migration.sql
--
-- Las claves foráneas están reflejadas como relaciones en schema.prisma con
-- los mismos nombres (Tabla_columna_fkey) y la misma regla de borrado, así
-- `prisma migrate diff` no encuentra deriva. Prisma no modela los CHECK: se
-- documentan aquí y en un comentario del modelo en schema.prisma.
--
-- Lista de restricciones (nombre: regla):
--   CreditNote_returnId_fkey       la nota de crédito sale de una devolución real
--   CreditNote_customerId_fkey     ... y de un cliente real (si tiene)
--   Payment_cashSessionId_fkey     el pago entra a una caja real
--   Payment_creditNoteId_fkey      el pago con nota usa una nota real
--   Sale_cashSessionId_fkey        la venta pertenece a una caja real
--   Sale_customerId_fkey           ... y a un cliente real
--   SaleReturn_cashSessionId_fkey  la devolución sale de una caja real
--   CashMovement_sessionId_fkey    el movimiento es de una caja real
--   PurchaseItem_variantId_fkey    la línea de compra es de un producto real
--   KitComponent_kitVariantId_fkey / KitComponent_componentVariantId_fkey
--   GoodsReceipt_attachmentId_fkey la factura adjunta de una recepción no se
--                                  puede borrar (D-M5)
--   payment_amounts_nonnegative    monto, entregado, cambio y comisión >= 0
--   sale_amounts_nonnegative       subtotal, descuento, ITBIS, total, costo >= 0
--   sale_status_valid              completed | voided
--   sale_return_amounts_nonnegative
--   sale_return_refund_method_valid cash | card | transfer | credit_note
--   cash_movement_type_valid       in | out
--   cash_movement_amount_nonnegative
--   cash_session_closed_after_opened  closedAt >= openedAt
--   cash_session_opening_nonnegative
--   purchase_item_quantities_valid qty > 0, recibido y dañado >= 0 y
--                                  recibido + dañado <= pedido
--   expense_amount_nonnegative / supplier_payment_amount_nonnegative
--   credit_note_amount_nonnegative
--   kit_component_qty_positive
--   incentive_entry_period_valid / incentive_period_close_period_valid /
--   incentive_settlement_period_valid   AAAA-MM con mes 01..12

DO $$
DECLARE
  spec RECORD;
  definition TEXT;
  violating BIGINT;
  validated BOOLEAN;
BEGIN
  -- Si una escritura larga retiene la tabla, no se espera indefinidamente: la
  -- restricción queda pendiente (NOTICE) y el despliegue continúa.
  PERFORM set_config('lock_timeout', '15s', true);
  FOR spec IN
    SELECT * FROM (VALUES
      -- kind, tabla, nombre, columna o expresión, tabla referida, ON DELETE
      ('fk', 'CreditNote', 'CreditNote_returnId_fkey', 'returnId', 'SaleReturn', 'RESTRICT'),
      ('fk', 'CreditNote', 'CreditNote_customerId_fkey', 'customerId', 'Customer', 'RESTRICT'),
      ('fk', 'Payment', 'Payment_cashSessionId_fkey', 'cashSessionId', 'CashSession', 'RESTRICT'),
      ('fk', 'Payment', 'Payment_creditNoteId_fkey', 'creditNoteId', 'CreditNote', 'RESTRICT'),
      ('fk', 'Sale', 'Sale_cashSessionId_fkey', 'cashSessionId', 'CashSession', 'RESTRICT'),
      ('fk', 'Sale', 'Sale_customerId_fkey', 'customerId', 'Customer', 'RESTRICT'),
      ('fk', 'SaleReturn', 'SaleReturn_cashSessionId_fkey', 'cashSessionId', 'CashSession', 'RESTRICT'),
      ('fk', 'CashMovement', 'CashMovement_sessionId_fkey', 'sessionId', 'CashSession', 'RESTRICT'),
      ('fk', 'PurchaseItem', 'PurchaseItem_variantId_fkey', 'variantId', 'Variant', 'RESTRICT'),
      ('fk', 'KitComponent', 'KitComponent_kitVariantId_fkey', 'kitVariantId', 'Variant', 'RESTRICT'),
      ('fk', 'KitComponent', 'KitComponent_componentVariantId_fkey', 'componentVariantId', 'Variant', 'RESTRICT'),
      ('fk', 'GoodsReceipt', 'GoodsReceipt_attachmentId_fkey', 'attachmentId', 'InvoiceAttachment', 'RESTRICT'),
      ('check', 'Payment', 'payment_amounts_nonnegative',
        'amount >= 0 AND tendered >= 0 AND "change" >= 0 AND "feeAmount" >= 0', NULL, NULL),
      ('check', 'Sale', 'sale_amounts_nonnegative',
        'subtotal >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0 AND total >= 0 AND "costTotal" >= 0', NULL, NULL),
      ('check', 'Sale', 'sale_status_valid',
        'status IN (''completed'', ''voided'')', NULL, NULL),
      ('check', 'SaleReturn', 'sale_return_amounts_nonnegative',
        'total >= 0 AND "taxTotal" >= 0 AND "costTotal" >= 0 AND "refundAmount" >= 0 AND "wasteQty" >= 0 AND "wasteCostTotal" >= 0', NULL, NULL),
      ('check', 'SaleReturn', 'sale_return_refund_method_valid',
        '"refundMethod" IN (''cash'', ''card'', ''transfer'', ''credit_note'')', NULL, NULL),
      ('check', 'CashMovement', 'cash_movement_type_valid',
        'type IN (''in'', ''out'')', NULL, NULL),
      ('check', 'CashMovement', 'cash_movement_amount_nonnegative',
        'amount >= 0', NULL, NULL),
      ('check', 'CashSession', 'cash_session_closed_after_opened',
        '"closedAt" IS NULL OR "closedAt" >= "openedAt"', NULL, NULL),
      ('check', 'CashSession', 'cash_session_opening_nonnegative',
        '"openingAmount" >= 0', NULL, NULL),
      ('check', 'PurchaseItem', 'purchase_item_quantities_valid',
        'qty > 0 AND "receivedQty" >= 0 AND "damagedQty" >= 0 AND "receivedQty" + "damagedQty" <= qty', NULL, NULL),
      ('check', 'Expense', 'expense_amount_nonnegative',
        'amount >= 0', NULL, NULL),
      ('check', 'SupplierPayment', 'supplier_payment_amount_nonnegative',
        'amount >= 0', NULL, NULL),
      ('check', 'CreditNote', 'credit_note_amount_nonnegative',
        'amount >= 0', NULL, NULL),
      ('check', 'KitComponent', 'kit_component_qty_positive',
        'qty > 0', NULL, NULL),
      ('check', 'IncentiveEntry', 'incentive_entry_period_valid',
        'period ~ ''^[0-9]{4}-(0[1-9]|1[0-2])$'' AND "originPeriod" ~ ''^[0-9]{4}-(0[1-9]|1[0-2])$''', NULL, NULL),
      ('check', 'IncentivePeriodClose', 'incentive_period_close_period_valid',
        'period ~ ''^[0-9]{4}-(0[1-9]|1[0-2])$''', NULL, NULL),
      ('check', 'IncentiveSettlement', 'incentive_settlement_period_valid',
        'period ~ ''^[0-9]{4}-(0[1-9]|1[0-2])$''', NULL, NULL)
    ) AS t(kind, table_name, constraint_name, body, ref_table, on_delete)
  LOOP
    -- 1. Agregar (NOT VALID) si no existe.
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class r ON r.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = current_schema()
          AND r.relname = spec.table_name
          AND c.conname = spec.constraint_name
      ) THEN
        IF spec.kind = 'fk' THEN
          definition := format(
            'FOREIGN KEY (%I) REFERENCES %I ("id") ON DELETE %s ON UPDATE CASCADE',
            spec.body, spec.ref_table, spec.on_delete
          );
        ELSE
          definition := format('CHECK (%s)', spec.body);
        END IF;
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I %s NOT VALID',
          spec.table_name, spec.constraint_name, definition
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'DATOS: no se agregó la restricción %.% (%); el despliegue sigue.',
        spec.table_name, spec.constraint_name, SQLERRM;
      CONTINUE;
    END;

    -- 2. Validar las filas existentes si todavía no está validada.
    SELECT c.convalidated INTO validated
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = current_schema()
       AND r.relname = spec.table_name
       AND c.conname = spec.constraint_name;
    IF validated IS DISTINCT FROM FALSE THEN
      CONTINUE;
    END IF;
    BEGIN
      IF spec.kind = 'fk' THEN
        EXECUTE format(
          'SELECT count(*) FROM %I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I r WHERE r."id" = c.%I)',
          spec.table_name, spec.body, spec.ref_table, spec.body
        ) INTO violating;
      ELSE
        EXECUTE format(
          'SELECT count(*) FROM %I WHERE NOT (%s)', spec.table_name, spec.body
        ) INTO violating;
      END IF;
      IF violating > 0 THEN
        RAISE NOTICE 'DATOS: % fila(s) antiguas de "%" violan % ; la restricción queda NOT VALID (protege las filas nuevas). Corrige esas filas y vuelve a ejecutar esta migración con psql para validarla.',
          violating, spec.table_name, spec.constraint_name;
      ELSE
        EXECUTE format(
          'ALTER TABLE %I VALIDATE CONSTRAINT %I',
          spec.table_name, spec.constraint_name
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'DATOS: no se validó %.% (%); queda NOT VALID y el despliegue sigue.',
        spec.table_name, spec.constraint_name, SQLERRM;
    END;
  END LOOP;
END $$;

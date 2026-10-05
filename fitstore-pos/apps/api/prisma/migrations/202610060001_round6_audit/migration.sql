-- Ronda 6 (Claude): correcciones de la auditoría R4 de ChatGPT.

-- R4-01 · Equipos anteriores a la ronda 4. La ronda 4 los aprobó sin secreto y
-- el primero que enviaba su ID fijaba el secreto. Se marcan como "anteriores" y
-- vuelven a pendiente: sólo un gerente los habilita otra vez. Los equipos nuevos
-- (createdBy) y los aprobados por un gerente (approvedBy) no cambian.
ALTER TABLE "Terminal" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Terminal" SET "legacy" = true WHERE "createdBy" IS NULL;
UPDATE "Terminal" SET "approvedAt" = NULL
  WHERE "legacy" AND "approvedBy" IS NULL AND "revokedAt" IS NULL;

-- R4-02 · Recuperación de compras anteriores a la ronda 4. Idempotente: sólo
-- completa recepciones con datos vacíos y nunca inventa proveedor ni total.
-- Lo que no tiene evidencia suficiente queda "sin conciliar" en el reporte.

-- a) Recepciones de Mercancía: total y comprobante de la operación; proveedor
--    de la bitácora de esa misma operación o, si no lo tiene, de su orden.
UPDATE "GoodsReceipt" r SET
  "operationId" = op."id",
  "total" = round((op."result"->>'total')::numeric, 2),
  "attachmentId" = CASE WHEN op."result"->>'attachmentId' ~* '^[0-9a-f-]{36}$'
                        THEN (op."result"->>'attachmentId')::uuid END,
  "supplierId" = COALESCE(
    (SELECT s."id" FROM "Supplier" s
      WHERE s."id"::text = a."after"->>'supplierId' AND s."branchId" = r."branchId"),
    (SELECT o."supplierId" FROM "PurchaseOrder" o
      WHERE o."id" = r."orderId" AND o."branchId" = r."branchId"))
FROM "MerchandiseOperation" op
JOIN "AuditLog" a
  ON a."entityId" = op."id"::text
 AND a."entity" = 'merchandise'
 AND a."action" = 'merchandise_entry'
 AND a."branchId" = op."branchId"
WHERE op."result"->>'receiptId' = r."id"::text
  AND op."branchId" = r."branchId"
  AND r."operationId" IS NULL AND r."total" IS NULL AND r."supplierId" IS NULL
  AND a."after"->'result'->>'receiptId' = r."id"::text
  AND jsonb_typeof(op."result"->'total') = 'number'
  AND a."after"->'result'->'total' = op."result"->'total'
  -- Una sola operación y una sola entrada de bitácora; si no, es ambiguo.
  AND (SELECT count(*) FROM "MerchandiseOperation" o2
        WHERE o2."result"->>'receiptId' = r."id"::text) = 1
  AND (SELECT count(*) FROM "AuditLog" a2
        WHERE a2."entityId" = op."id"::text AND a2."entity" = 'merchandise'
          AND a2."action" = 'merchandise_entry') = 1
  AND NOT EXISTS (SELECT 1 FROM "GoodsReceipt" g WHERE g."operationId" = op."id");

-- b) Recepciones de una orden (ruta purchase-orders/:id/receive): proveedor de
--    la orden y total = cantidad × costo de la orden + flete + otros costos,
--    calculado con las líneas guardadas en la propia recepción.
UPDATE "GoodsReceipt" r SET
  "supplierId" = o."supplierId",
  "total" = round(
    (SELECT sum((i->>'qty')::numeric * (i->>'cost')::numeric)
       FROM jsonb_array_elements(r."items") i)
    + r."freight" + r."otherCosts", 2)
FROM "PurchaseOrder" o
WHERE o."id" = r."orderId" AND o."branchId" = r."branchId"
  AND r."operationId" IS NULL AND r."total" IS NULL AND r."supplierId" IS NULL
  AND jsonb_typeof(r."items") = 'array'
  AND jsonb_array_length(r."items") > 0
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(r."items") i
     WHERE jsonb_typeof(i->'qty') <> 'number' OR jsonb_typeof(i->'cost') <> 'number')
  AND NOT EXISTS (
    SELECT 1 FROM "MerchandiseOperation" op
     WHERE op."result"->>'receiptId' = r."id"::text);

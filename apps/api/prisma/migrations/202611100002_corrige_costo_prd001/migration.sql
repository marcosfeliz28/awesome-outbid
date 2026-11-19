-- Orden de la dueña (10-nov-2026, relayada por Norexos 2, confirmada
-- explicitamente: "Arreglalo, ponlo acorde a la realidad"): continua la
-- correccion de 202611100001 con las 28 lineas restantes de SKU PRD-001
-- ("Set de brochas del curso de automaquillaje"), fuera de los 52 SKU de esa
-- migracion. costAvg actual de PRD-001 = 700 (puesto por otra via, no por
-- esta orden); unitCost de estas 28 lineas quedo en 0 al venderse el 8-nov.
--
-- La duena confirmo explicitamente que los 2 casos vendidos en RD$0
-- (SKU 1649/1972, ya corregidos en 202611100001) quedan con utilidad
-- negativa real, sin tratarlos aparte -- no aplica a esta migracion (son de
-- otro SKU), se deja registrado aqui porque es la misma orden.
--
-- Las 28 ventas de esta migracion solo tenian ese item (costTotal de la
-- factura ya era 0 antes de corregir): costo nuevo = costTotal nuevo = 700
-- por factura, qty 1 en todas. Mismo patron CTE (SaleItem -> Sale ->
-- AuditLog) que 202611100001 para ser naturalmente idempotente.
--
-- No toca precio, total de venta, pagos, cajas ni inventario.
--
-- Verificacion (antes de escribir esto, 3 lecturas independientes): 1)
-- lectura original del 10-nov (GET /sales?date=2026-11-08); 2) re-lectura
-- justo antes de escribir esta migracion, re-confirmando cada una de las
-- 28 lineas (unitCost y costTotal sin cambios) y el costAvg actual de
-- PRD-001 (700, sin cambios); 3) prueba end-to-end en una base de prueba
-- local (ver 202611100001) con el mismo patron CTE.

-- FS-0000490 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'e28c14d2-b85b-4da7-a469-e435e10c122d' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000490', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000491 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '853c0e32-d2bb-4520-b8f0-ff8ac6e76145' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000491', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000492 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '44460ce0-55e8-45b6-97a4-caf192b4d972' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000492', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000493 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '4ca20672-3174-4109-a2b1-ee9ce86c621b' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000493', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000494 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'f5156296-2081-4827-b9dd-85dcb7279106' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000494', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000495 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '0f12c3a8-25e3-495e-ad61-f31a2c9feb4a' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000495', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000496 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'bc9044c0-7563-4775-946d-d876c4cf7441' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000496', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000497 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'dba90f1b-f616-4cb1-bcff-058c0137e178' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000497', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000498 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'c36b0e81-739a-4dbb-81aa-62578f65840c' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000498', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000499 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'aaf55a78-a3b0-47ec-bcfe-8bd835a7862f' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000499', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000500 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'c63afd15-f8ae-4f12-aa5f-ad9ac82f1f49' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000500', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000501 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'd0acef84-a610-43c6-b9aa-992c9243bd18' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000501', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000502 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'cc286672-3328-49e6-8095-93da5c673c1b' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000502', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000503 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '70cb88cd-f45a-4449-8c8a-c689127dcc49' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000503', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000504 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '266e66c5-91f2-464f-b6c5-eb8fd60d8c0e' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000504', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000505 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'a4f48f21-132e-46ee-ad16-925fcf9ff733' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000505', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000506 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'c44721f6-a1ad-4a93-a3fa-6b30a06720a4' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000506', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000507 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '8218b34f-b2e4-40f9-9733-2f6b1f5787ce' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000507', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000508 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'ea262e89-4e86-4393-afee-4e75c7f6b96d' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000508', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000509 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '7b110bce-e9fa-4776-b7c4-6fde21a2b3ed' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000509', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000510 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '2b024186-816e-4525-88cd-7b3a1bb0cca9' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000510', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000511 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '7ddba34d-81cb-4a4b-8d50-846cc106c5ec' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000511', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000512 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '46a9a2ec-d1fc-416c-ba09-b4a6797ac45f' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000512', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000513 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'c551d79a-82be-4032-9ed8-2a12ce4053e2' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000513', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000514 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'd6ec5b58-23fe-4824-8302-49c51139fc3f' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000514', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000515 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = '3b726368-8a7c-418e-80c9-7b724158e2a7' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000515', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000516 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'e653a13b-6886-4ae6-845d-75eb293d5e6b' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000516', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000518 · SKU PRD-001 "Set de brochas del curso de automaquillaje" · qty 1 · 0 -> 700
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 700.00
    WHERE id = 'f5cbbedf-1d65-4664-afe5-2c02a9b6cb95' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 700.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '0'),
       jsonb_build_object('unitCost', '700.00', 'sale_costTotal', sc.new_cost_total, 'sku', 'PRD-001',
                           'factura', 'FS-0000518', 'orden', 'duena 10-nov via Norexos 2 (confirmacion explicita)'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

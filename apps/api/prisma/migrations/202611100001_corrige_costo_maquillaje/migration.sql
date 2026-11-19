-- Orden de la dueña (10-nov-2026, relayada por Norexos 2, confirmada con
-- "Si calcular los anterior" / "Exacto corrige todo"): cargó el costo
-- promedio real (antes 0) de 52 variantes de maquillaje via PATCH /variants.
-- 7 líneas de venta ya cerradas de esas variantes quedaron registradas con
-- unitCost = 0 (el costo de ese momento), inflando su utilidad. Esta
-- migración corrige SOLO esas 7 líneas, con su SaleItem.unitCost y el
-- Sale.costTotal de la factura (columna propia, no se recalcula sola), y
-- deja un AuditLog por cada una con el valor anterior para poder revertir.
--
-- No toca precio, total de venta, pagos, cajas ni inventario/stock: solo
-- costo/utilidad ya registrados. No incluye SKU PRD-001 ("Set de brochas
-- del curso de automaquillaje", 28 facturas del 8-nov) ni el SKU 1658 (sin
-- costo, el PDF lo trae en blanco): ninguno de los dos estaba en la orden de
-- la dueña de hoy ni en los 52 SKU que ella cargó.
--
-- Cada corrección es UNA sentencia (CTE encadenado): el UPDATE de SaleItem
-- sólo afecta la fila si unitCost sigue en 0 y, con RETURNING, encadena el
-- UPDATE de Sale y el INSERT en AuditLog -- los tres atados a ese mismo
-- resultado. Así, si esta migración se re-ejecutara a mano (recuperación,
-- MIGRACIONES_SEGURAS.md "migrate resolve"), la segunda vez no hace nada
-- (0 filas) en vez de sumar el costo otra vez: se probó localmente que un
-- UPDATE de Sale separado y sin esta guarda SÍ duplicaba el costo en una
-- segunda corrida, por eso esta forma y no dos UPDATE sueltos.
-- Por llave primaria, sin recorrer tabla: no necesita lock_timeout especial
-- ni horario fuera de tienda (MIGRACIONES_SEGURAS.md, "una sentencia por
-- objeto").
--
-- Verificación (antes de escribir esto): 3 lecturas independientes por la
-- API en vivo (GET /sales?date=... día por día, 14-oct a 10-nov) contra el
-- costAvg actual del catálogo; los montos de abajo son los mismos en las
-- 3 lecturas, y la forma de abajo se probó en una base de prueba local
-- (una corrida cambia los valores esperados, la segunda corrida no cambia
-- nada).

-- FS-0000454 · SKU 1649 "Ruby Rose Glow Whatever Blush Duo" · qty 1 · 0 -> 250
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 250.00
    WHERE id = '5cba83d0-48be-42cf-b996-70b82d9ea45c' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 250.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '4348.53'),
       jsonb_build_object('unitCost', '250.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1649',
                           'factura', 'FS-0000454', 'orden', 'dueña 10-nov via Norexos 2'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000469 · SKU 1988 "Mota" · qty 1 · 0 -> 50
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 50.00
    WHERE id = '8cb859f2-c5f4-443e-8d1a-9c8ae6a2ed45' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 50.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '1777'),
       jsonb_build_object('unitCost', '50.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1988',
                           'factura', 'FS-0000469', 'orden', 'dueña 10-nov via Norexos 2'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000472 · SKU 1988 "Mota" · qty 1 · 0 -> 50
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 50.00
    WHERE id = '6444012a-f787-49fb-9928-fada8c12420f' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 50.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '1223'),
       jsonb_build_object('unitCost', '50.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1988',
                           'factura', 'FS-0000472', 'orden', 'dueña 10-nov via Norexos 2'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000526 · SKU 1972 "Set de brochas gris Génesis" · qty 1 · 0 -> 1500
-- (vendida en RD$ 0: la corrección deja la utilidad de esta línea negativa
-- a propósito, por orden explícita de la dueña -- "Exacto corrige todo" --
-- tras preguntarle por este caso.)
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 1500.00
    WHERE id = '269fd0ea-d769-4647-892f-d0ad70159919' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 1500.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '1083.94'),
       jsonb_build_object('unitCost', '1500.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1972',
                           'factura', 'FS-0000526', 'orden', 'dueña 10-nov via Norexos 2',
                           'nota', 'vendida en RD$0; utilidad queda negativa a propósito'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000528 · SKU 1988 "Mota" · qty 1 · 0 -> 50
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 50.00
    WHERE id = 'a3423e02-08c4-45a9-9dd5-690c96959b79' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 50.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '4876.32'),
       jsonb_build_object('unitCost', '50.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1988',
                           'factura', 'FS-0000528', 'orden', 'dueña 10-nov via Norexos 2'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000533 · SKU 1988 "Mota" · qty 1 · 0 -> 50
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 50.00
    WHERE id = 'aa7be4e8-ac91-44d0-8c06-a9ee60780d84' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 50.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '1828.88'),
       jsonb_build_object('unitCost', '50.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1988',
                           'factura', 'FS-0000533', 'orden', 'dueña 10-nov via Norexos 2'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

-- FS-0000537 · SKU 1988 "Mota" · qty 1 · 0 -> 50
WITH item_changed AS (
  UPDATE "SaleItem" SET "unitCost" = 50.00
    WHERE id = 'b615c7ac-925b-41e5-aa13-d46ba080c308' AND "unitCost" = 0
    RETURNING id, "saleId"
), sale_changed AS (
  UPDATE "Sale" SET "costTotal" = "costTotal" + 50.00
    WHERE id IN (SELECT "saleId" FROM item_changed)
    RETURNING id, "costTotal" AS new_cost_total
)
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", before, after, "branchId")
SELECT gen_random_uuid(), 'system', 'sale_item_cost_backfill', 'SaleItem', ic.id,
       jsonb_build_object('unitCost', '0', 'sale_costTotal', '2624.88'),
       jsonb_build_object('unitCost', '50.00', 'sale_costTotal', sc.new_cost_total, 'sku', '1988',
                           'factura', 'FS-0000537', 'orden', 'dueña 10-nov via Norexos 2'),
       'main'
  FROM item_changed ic JOIN sale_changed sc ON sc.id = ic."saleId";

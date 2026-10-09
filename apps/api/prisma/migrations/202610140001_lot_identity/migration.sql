-- I1: dentro de una variante, el código normalizado identifica un solo lote.
-- El vencimiento puede completar un lote histórico sin fecha, pero no dividir
-- la identidad en dos registros.
ALTER TABLE "Lot" ADD COLUMN "lotNumberNormalized" TEXT;

UPDATE "Lot"
SET "lotNumberNormalized" = upper(
  regexp_replace(btrim(normalize("lotNumber", NFC)), '\s+', ' ', 'g')
);

-- Esta migración histórica no debe bloquear un despliegue por datos que la
-- reconciliación posterior sabe resolver. Si hay vencimientos conflictivos se
-- deja el grupo intacto, se avisa y 202610160002 toma la decisión auditable.
CREATE TEMP TABLE "_LotIdentityMigrationGate" ON COMMIT DROP AS
SELECT NOT EXISTS (
  SELECT 1
  FROM "Lot"
  WHERE "expiryDate" IS NOT NULL
  GROUP BY "variantId", "lotNumberNormalized"
  HAVING count(DISTINCT to_char("expiryDate" - interval '4 hours', 'YYYY-MM-DD')) > 1
) AS "mergeAllowed";

DO $$
BEGIN
  IF NOT (SELECT "mergeAllowed" FROM "_LotIdentityMigrationGate") THEN
    RAISE NOTICE
      'Se omite la fusión histórica de lotes con vencimientos distintos; la reconciliación posterior los resolverá.';
  END IF;
END $$;

-- Conserva el lote más antiguo. El mapa se usa para actualizar todas las
-- referencias antes de borrar las copias.
CREATE TEMP TABLE "_LotIdentityMerge" ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (
         PARTITION BY "variantId", "lotNumberNormalized"
         ORDER BY "createdAt", id
       ) AS keeper
FROM "Lot";

DELETE FROM "_LotIdentityMerge"
WHERE NOT (SELECT "mergeAllowed" FROM "_LotIdentityMigrationGate");

-- Las referencias huérfanas heredadas se neutralizan antes de crear o
-- reforzar relaciones. La violación que aparece en la suite normal es una
-- prueba negativa intencional y no un dato creado por esta migración.
UPDATE "InventoryMovement" AS movement
SET "lotId" = NULL
WHERE movement."lotId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Lot" AS lot WHERE lot.id = movement."lotId");

UPDATE "SaleItem" AS item
SET "lotId" = NULL
WHERE item."lotId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Lot" AS lot WHERE lot.id = item."lotId");

UPDATE "InventoryMovement" AS movement
SET "lotId" = mapping.keeper
FROM "_LotIdentityMerge" AS mapping
WHERE movement."lotId" = mapping.id AND mapping.id <> mapping.keeper;

UPDATE "SaleItem" AS item
SET "lotId" = mapping.keeper
FROM "_LotIdentityMerge" AS mapping
WHERE item."lotId" = mapping.id AND mapping.id <> mapping.keeper;

-- Las devoluciones y anulaciones usan estas asignaciones JSONB para devolver
-- stock al lote original. Reescribirlas evita referencias a lotes eliminados.
UPDATE "SaleItem" AS item
SET "stockAllocations" = (
  SELECT coalesce(
    jsonb_agg(
      CASE
        WHEN mapping.keeper IS NULL THEN allocation.value
        ELSE jsonb_set(
          allocation.value,
          '{lotId}',
          to_jsonb(mapping.keeper::text),
          false
        )
      END
      ORDER BY allocation.ordinality
    ),
    '[]'::jsonb
  ) AS value
  FROM jsonb_array_elements(item."stockAllocations")
       WITH ORDINALITY AS allocation(value, ordinality)
  LEFT JOIN "_LotIdentityMerge" AS mapping
    ON allocation.value->>'lotId' = mapping.id::text
)
WHERE jsonb_typeof(item."stockAllocations") = 'array'
  AND EXISTS (
  SELECT 1
  FROM jsonb_array_elements(item."stockAllocations") AS allocation(value)
  JOIN "_LotIdentityMerge" AS mapping
    ON allocation.value->>'lotId' = mapping.id::text
  WHERE mapping.id <> mapping.keeper
);

WITH totals AS (
  SELECT mapping.keeper,
         sum(lot.qty) AS qty,
         coalesce(
           sum(lot.qty * lot.cost) / nullif(sum(lot.qty), 0),
           max(lot.cost)
         ) AS cost,
         min(lot."expiryDate") FILTER (WHERE lot."expiryDate" IS NOT NULL)
           AS "expiryDate"
  FROM "_LotIdentityMerge" AS mapping
  JOIN "Lot" AS lot ON lot.id = mapping.id
  GROUP BY mapping.keeper
)
UPDATE "Lot" AS lot
SET qty = totals.qty,
    cost = round(totals.cost, 2),
    "expiryDate" = totals."expiryDate"
FROM totals
WHERE lot.id = totals.keeper;

DELETE FROM "Lot" AS lot
USING "_LotIdentityMerge" AS mapping
WHERE lot.id = mapping.id AND mapping.id <> mapping.keeper;

ALTER TABLE "Lot" ALTER COLUMN "lotNumberNormalized" SET NOT NULL;
DO $$
BEGIN
  IF (SELECT "mergeAllowed" FROM "_LotIdentityMigrationGate") THEN
    DROP INDEX "Lot_variantId_lotNumber_key";
    CREATE UNIQUE INDEX "Lot_variantId_lotNumberNormalized_key"
      ON "Lot"("variantId", "lotNumberNormalized");
  END IF;
END $$;

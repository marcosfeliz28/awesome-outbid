-- I1: dentro de una variante, el código normalizado identifica un solo lote.
-- Esta migración debe poder desplegarse sobre datos históricos ambiguos sin
-- detener las siguientes migraciones.
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "lotNumberNormalized" TEXT;

-- El conflicto queda como evidencia permanente. La clave estable y ON CONFLICT
-- hacen que registrar o repetir la migración sea idempotente.
CREATE TABLE IF NOT EXISTS "LotIdentityConflict" (
  "conflictKey" TEXT NOT NULL,
  "variantId" UUID NOT NULL,
  "lotNumberNormalized" TEXT NOT NULL,
  "keeperLotId" UUID NOT NULL,
  "sourceLotIds" JSONB NOT NULL,
  "expiryDates" JSONB NOT NULL,
  "chosenExpiryDate" TIMESTAMP(3),
  "resolution" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LotIdentityConflict_pkey" PRIMARY KEY ("conflictKey")
);

-- Postgres toma upper() de la configuración regional. COLLATE "C" evita que la
-- misma base normalice distinto al moverse de servidor. translate() enumera el
-- conjunto WhiteSpace/LineTerminator de ECMAScript que trim()/\s usan en la
-- aplicación; después sólo se colapsa el espacio ASCII.
CREATE OR REPLACE FUNCTION pg_temp.normalize_lot_number(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT upper(
    regexp_replace(
      btrim(
        translate(
          normalize(value, NFKC),
          U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
          repeat(' ', 25)
        )
      ),
      ' +',
      ' ',
      'g'
    ) COLLATE "C"
  )
$$;

UPDATE "Lot"
SET "lotNumberNormalized" = pg_temp.normalize_lot_number("lotNumber");

-- Siempre se conserva el registro más antiguo. Si existían varios días de
-- vencimiento se elige el más cercano (la primera fecha) y se registra tanto la
-- decisión como todos los lotes de origen; nunca se aborta el despliegue.
CREATE TEMP TABLE "_LotIdentityMerge" ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (
         PARTITION BY "variantId", "lotNumberNormalized"
         ORDER BY "createdAt", id
       ) AS keeper
FROM "Lot";

INSERT INTO "LotIdentityConflict" (
  "conflictKey",
  "variantId",
  "lotNumberNormalized",
  "keeperLotId",
  "sourceLotIds",
  "expiryDates",
  "chosenExpiryDate",
  "resolution"
)
SELECT
  md5(
    grouped."variantId"::text || ':' ||
    octet_length(grouped."lotNumberNormalized")::text || ':' ||
    grouped."lotNumberNormalized"
  ),
  grouped."variantId",
  grouped."lotNumberNormalized",
  grouped.keeper,
  grouped."sourceLotIds",
  grouped."expiryDates",
  grouped."chosenExpiryDate",
  'Se fusionaron duplicados y se conservó el vencimiento más cercano.'
FROM (
  SELECT
    lot."variantId",
    lot."lotNumberNormalized",
    min(mapping.keeper::text)::uuid AS keeper,
    jsonb_agg(lot.id::text ORDER BY lot."createdAt", lot.id) AS "sourceLotIds",
    jsonb_agg(DISTINCT
      to_char(lot."expiryDate" AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD')
    ) FILTER (WHERE lot."expiryDate" IS NOT NULL) AS "expiryDates",
    min(lot."expiryDate") FILTER (WHERE lot."expiryDate" IS NOT NULL)
      AS "chosenExpiryDate"
  FROM "Lot" AS lot
  JOIN "_LotIdentityMerge" AS mapping ON mapping.id = lot.id
  GROUP BY lot."variantId", lot."lotNumberNormalized"
  HAVING count(DISTINCT
    (lot."expiryDate" AT TIME ZONE 'America/Santo_Domingo')::date
  ) FILTER (WHERE lot."expiryDate" IS NOT NULL) > 1
) AS grouped
ON CONFLICT ("conflictKey") DO NOTHING;

UPDATE "InventoryMovement" AS movement
SET "lotId" = mapping.keeper
FROM "_LotIdentityMerge" AS mapping
WHERE movement."lotId" = mapping.id AND mapping.id <> mapping.keeper;

-- Las devoluciones y anulaciones usan estas asignaciones JSONB para devolver
-- stock al lote original. Los valores históricos que no sean arrays se dejan
-- intactos en vez de abortar jsonb_array_elements().
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
           sum(greatest(lot.qty, 0) * greatest(lot.cost, 0))
             / nullif(sum(greatest(lot.qty, 0)), 0),
           max(greatest(lot.cost, 0)),
           0
         ) AS cost,
         min(lot."expiryDate") FILTER (WHERE lot."expiryDate" IS NOT NULL)
           AS "expiryDate"
  FROM "_LotIdentityMerge" AS mapping
  JOIN "Lot" AS lot ON lot.id = mapping.id
  GROUP BY mapping.keeper
)
UPDATE "Lot" AS lot
SET qty = totals.qty,
    cost = round(greatest(totals.cost, 0), 2),
    "expiryDate" = totals."expiryDate"
FROM totals
WHERE lot.id = totals.keeper;

DELETE FROM "Lot" AS lot
USING "_LotIdentityMerge" AS mapping
WHERE lot.id = mapping.id AND mapping.id <> mapping.keeper;

ALTER TABLE "Lot" ALTER COLUMN "lotNumberNormalized" SET NOT NULL;
DROP INDEX IF EXISTS "Lot_variantId_lotNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Lot_variantId_lotNumberNormalized_key"
ON "Lot"("variantId", "lotNumberNormalized");

DROP FUNCTION pg_temp.normalize_lot_number(TEXT);

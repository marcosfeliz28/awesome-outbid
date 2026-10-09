-- B1-forward: conserva intacta la migración histórica 202610140001 y aplica
-- toda reconciliación adicional como un cambio hacia delante.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu'
  ) THEN
    RAISE EXCEPTION
      'Falta la colación ICU und-x-icu: use un PostgreSQL con ICU.';
  END IF;
END $$;

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

-- La aplicación usa NFC + espacios + toUpperCase Unicode. NFC une formas
-- canónicamente equivalentes sin fusionar identificadores compatibles pero
-- distintos, como LOT-1 y ＬＯＴ－１. La colación ICU
-- raíz reproduce esa conversión también fuera de ASCII (p. ej. ñandú/STRASSE)
-- sin volver equivalentes cadenas cuyos caracteres realmente son distintos.
-- translate() enumera WhiteSpace/LineTerminator de trim()/\s en JavaScript.
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
          normalize(value, NFC),
          U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
          repeat(' ', 25)
        )
      ),
      ' +',
      ' ',
      'g'
    ) COLLATE "und-x-icu"
  )
$$;

-- El índice histórico impediría corregir dos claves antiguas que ahora
-- convergen en la misma forma canónica. Se restablece al final del archivo.
DROP INDEX IF EXISTS "Lot_variantId_lotNumberNormalized_key";

UPDATE "Lot"
SET "lotNumberNormalized" = pg_temp.normalize_lot_number("lotNumber");

UPDATE "InventoryMovement" AS movement
SET "lotId" = NULL
WHERE movement."lotId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Lot" AS lot WHERE lot.id = movement."lotId");

UPDATE "SaleItem" AS item
SET "lotId" = NULL
WHERE item."lotId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Lot" AS lot WHERE lot.id = item."lotId");

CREATE TEMP TABLE "_LotIdentityForwardMerge" ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (
         PARTITION BY "variantId", "lotNumberNormalized"
         ORDER BY "createdAt", id
       ) AS keeper
FROM "Lot";

-- DateTime se guarda como timestamp sin zona pero representa UTC. Primero se
-- interpreta como UTC y luego se convierte al día comercial dominicano.
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
    jsonb_agg(DISTINCT to_char(
      (lot."expiryDate" AT TIME ZONE 'UTC')
        AT TIME ZONE 'America/Santo_Domingo',
      'YYYY-MM-DD'
    )) FILTER (WHERE lot."expiryDate" IS NOT NULL) AS "expiryDates",
    min(lot."expiryDate") FILTER (WHERE lot."expiryDate" IS NOT NULL)
      AS "chosenExpiryDate"
  FROM "Lot" AS lot
  JOIN "_LotIdentityForwardMerge" AS mapping ON mapping.id = lot.id
  GROUP BY lot."variantId", lot."lotNumberNormalized"
  HAVING count(DISTINCT (
    (lot."expiryDate" AT TIME ZONE 'UTC')
      AT TIME ZONE 'America/Santo_Domingo'
  )::date) FILTER (WHERE lot."expiryDate" IS NOT NULL) > 1
) AS grouped
ON CONFLICT ("conflictKey") DO NOTHING;

UPDATE "InventoryMovement" AS movement
SET "lotId" = mapping.keeper
FROM "_LotIdentityForwardMerge" AS mapping
WHERE movement."lotId" = mapping.id AND mapping.id <> mapping.keeper;

UPDATE "SaleItem" AS item
SET "lotId" = mapping.keeper
FROM "_LotIdentityForwardMerge" AS mapping
WHERE item."lotId" = mapping.id AND mapping.id <> mapping.keeper;

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
  LEFT JOIN "_LotIdentityForwardMerge" AS mapping
    ON lower(allocation.value->>'lotId') = mapping.id::text
)
WHERE jsonb_typeof(item."stockAllocations") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(item."stockAllocations") AS allocation(value)
    JOIN "_LotIdentityForwardMerge" AS mapping
      ON lower(allocation.value->>'lotId') = mapping.id::text
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
  FROM "_LotIdentityForwardMerge" AS mapping
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
USING "_LotIdentityForwardMerge" AS mapping
WHERE lot.id = mapping.id AND mapping.id <> mapping.keeper;

ALTER TABLE "Lot" ALTER COLUMN "lotNumberNormalized" SET NOT NULL;
DROP INDEX IF EXISTS "Lot_variantId_lotNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Lot_variantId_lotNumberNormalized_key"
ON "Lot"("variantId", "lotNumberNormalized");

CREATE INDEX IF NOT EXISTS "SaleItem_lotId_idx" ON "SaleItem"("lotId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SaleItem_lotId_fkey'
      AND conrelid = '"SaleItem"'::regclass
  ) THEN
    ALTER TABLE "SaleItem"
      ADD CONSTRAINT "SaleItem_lotId_fkey"
      FOREIGN KEY ("lotId") REFERENCES "Lot"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DROP FUNCTION pg_temp.normalize_lot_number(TEXT);

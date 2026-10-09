ALTER TABLE "Sale" ADD COLUMN "taxIncluded" BOOLEAN;

-- Las ventas existentes adoptan el tratamiento vigente de su sucursal en el
-- momento de migrar; desde esta migración cada venta conserva su propio valor.
UPDATE "Sale" AS sale
SET "taxIncluded" = COALESCE(
  (
    SELECT CASE
      WHEN jsonb_typeof(settings."data"->'taxIncluded') = 'boolean'
        THEN (settings."data"->>'taxIncluded')::boolean
      ELSE NULL
    END
    FROM "Settings" AS settings
    WHERE settings."id" = sale."branchId"
  ),
  TRUE
);

ALTER TABLE "Sale" ALTER COLUMN "taxIncluded" SET DEFAULT TRUE;
ALTER TABLE "Sale" ALTER COLUMN "taxIncluded" SET NOT NULL;

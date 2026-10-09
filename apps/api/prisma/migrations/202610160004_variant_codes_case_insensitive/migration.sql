-- K2: el alcance es global, como Variant.sku/barcode @unique y assertCodesFree.
-- No se modifican ni borran códigos históricos. Cada índice es independiente:
-- si hay duplicados históricos se avisa y se omite sólo ese índice.
-- El bloqueo impide altas concurrentes entre la comprobación y CREATE INDEX.
DO $$
BEGIN
  LOCK TABLE "Variant" IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (
    SELECT lower(sku) FROM "Variant" GROUP BY lower(sku) HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'K2: SKU duplicados sin distinguir mayúsculas; se omite Variant_sku_lower_key sin alterar datos.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "Variant_sku_lower_key"
      ON "Variant" (lower(sku));
  END IF;

  IF EXISTS (
    SELECT lower(barcode) FROM "Variant" GROUP BY lower(barcode) HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'K2: códigos de barras duplicados sin distinguir mayúsculas; se omite Variant_barcode_lower_key sin alterar datos.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "Variant_barcode_lower_key"
      ON "Variant" (lower(barcode));
  END IF;
END $$;

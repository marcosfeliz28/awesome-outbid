-- Aditiva (dueña, 19-oct): etiqueta de estadística «Crédito» o «Contraentrega»
-- de una venta por cobrar. No cambia dinero ni reglas: las dos se cobran igual.
-- Las ventas anteriores quedan en NULL («Crédito / contraentrega»).
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "receivableKind" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_receivable_kind_valid') THEN
    ALTER TABLE "Sale" ADD CONSTRAINT sale_receivable_kind_valid
      CHECK ("receivableKind" IS NULL OR "receivableKind" IN ('credit', 'cod'));
  END IF;
END $$;

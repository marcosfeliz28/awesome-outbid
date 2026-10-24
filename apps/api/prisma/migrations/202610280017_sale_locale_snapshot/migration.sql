-- N-22: instantánea del formato del ticket por venta. Las filas existentes
-- eran de la tienda dominicana y conservan exactamente esos valores.
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "receiptCurrency" TEXT NOT NULL DEFAULT 'DOP',
  ADD COLUMN IF NOT EXISTS "receiptTimeZone" TEXT NOT NULL DEFAULT 'America/Santo_Domingo';

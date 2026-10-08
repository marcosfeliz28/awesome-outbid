-- Mercancía (aceptación de caja, pasos 04, 35, 36 y 37).
-- Documento del proveedor (factura, NCF, fecha, ITBIS) y condición de pago en
-- la orden y en cada recepción; unidades dañadas o rechazadas por línea.
-- Todo es opcional: órdenes y recepciones existentes quedan sin documento.
-- Re-ejecutable: IF NOT EXISTS y CREATE OR REPLACE.
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierInvoice" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierNcf" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "creditDays" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "itbis" DECIMAL(14,2);
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "damagedQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "supplierInvoice" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "supplierNcf" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "creditDays" INTEGER;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "itbis" DECIMAL(14,2);
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "damagedCost" DECIMAL(14,2) NOT NULL DEFAULT 0;
-- Paso 04: el aviso de stock en tiempo real (que actualiza la caja) lleva lo
-- vendible: sin las unidades de lotes vencidos según la fecha de Santo
-- Domingo, ni las de lotes sin vencimiento si la categoría lo exige (la venta
-- tampoco las toma). Lo vencido va aparte en "expired".
CREATE OR REPLACE FUNCTION fitstore_stock_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE blocked NUMERIC;
BEGIN
 IF TG_OP = 'INSERT' OR NEW.stock IS DISTINCT FROM OLD.stock THEN
 PERFORM pg_advisory_xact_lock(734918203);
 SELECT COALESCE(SUM(l.qty), 0) INTO blocked
   FROM "Lot" l
   JOIN "Product" p ON p.id = NEW."productId"
   JOIN "Category" c ON c.id = p."categoryId"
  WHERE l."variantId" = NEW.id AND l.qty > 0
    AND ((l."expiryDate" IS NOT NULL
          AND ((l."expiryDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo')::date
              < (now() AT TIME ZONE 'America/Santo_Domingo')::date)
      OR (l."expiryDate" IS NULL AND c."requiresExpiry"));
 INSERT INTO "RealtimeEvent" ("branchId",type,data) VALUES (NEW."branchId",'stock.changed', jsonb_build_object('variantId',NEW.id,'qtyOnHand',NEW.stock - blocked,'expired',blocked));
 END IF; RETURN NEW; END $$;

-- R9-A03 (auditoría de ChatGPT a la ronda 9): la recepción conserva el total
-- del documento del proveedor tal como se presentó, además de lo aceptado
-- (total), lo dañado o rechazado (damagedCost) y la diferencia reconocida
-- (factura − aceptado − dañado). Las recepciones anteriores quedan sin total
-- de factura y con diferencia 0.
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "invoiceTotal" DECIMAL(14,2);
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "invoiceDifference" DECIMAL(14,2) NOT NULL DEFAULT 0;

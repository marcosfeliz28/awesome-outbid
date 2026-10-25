-- Auditoría de inventario (25-oct-2026): «se vende por unidad». Las fajas y
-- casi todo se venden enteros; sólo kg/lb/litro admiten decimales. Para no
-- bloquear a una tienda que ya vendía o contaba en fracciones, los productos
-- con decimales en su historia quedan como «no por unidad».
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "soldByUnit" boolean NOT NULL DEFAULT true;
UPDATE "Product" p SET "soldByUnit" = false
WHERE p."soldByUnit"
  AND (lower(p.unit) IN ('kg', 'lb', 'litro')
    OR EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId" = p.id AND v.stock <> trunc(v.stock))
    OR EXISTS (SELECT 1 FROM "Variant" v JOIN "SaleItem" i ON i."variantId" = v.id
               WHERE v."productId" = p.id AND i.qty <> trunc(i.qty))
    OR EXISTS (SELECT 1 FROM "Variant" v JOIN "InventoryMovement" m ON m."variantId" = v.id
               WHERE v."productId" = p.id AND m.qty <> trunc(m.qty)));

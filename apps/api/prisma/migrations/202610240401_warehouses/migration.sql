-- El inventario histórico permanece en Tienda. Casa empieza en cero.
CREATE TABLE "Warehouse" (
  "id" UUID PRIMARY KEY,
  "branchId" TEXT NOT NULL DEFAULT 'main',
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sellable" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Warehouse_branchId_kind_key" UNIQUE ("branchId", "kind"),
  CONSTRAINT "warehouse_kind_valid" CHECK ("kind" IN ('store', 'home', 'other')),
  CONSTRAINT "warehouse_sellable_store" CHECK ("sellable" = ("kind" = 'store'))
);
CREATE TABLE "VariantStock" (
  "variantId" UUID NOT NULL REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "warehouseId" UUID NOT NULL REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  PRIMARY KEY ("variantId", "warehouseId")
);
CREATE INDEX "VariantStock_warehouseId_idx" ON "VariantStock"("warehouseId");
CREATE TABLE "LotStock" (
  "lotId" UUID NOT NULL REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "warehouseId" UUID NOT NULL REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  PRIMARY KEY ("lotId", "warehouseId"),
  CONSTRAINT "lot_stock_nonnegative" CHECK ("qty" >= 0)
);
CREATE TABLE "StockTransfer" (
  "id" UUID PRIMARY KEY,
  "operationId" UUID NOT NULL UNIQUE,
  "branchId" TEXT NOT NULL DEFAULT 'main',
  "fromId" UUID NOT NULL REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "toId" UUID NOT NULL REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transfer_different_warehouses" CHECK ("fromId" <> "toId")
);
CREATE INDEX "StockTransfer_branchId_createdAt_idx" ON "StockTransfer"("branchId", "createdAt");
CREATE TABLE "StockTransferLine" (
  "id" UUID PRIMARY KEY,
  "transferId" UUID NOT NULL REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "variantId" UUID NOT NULL REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "lotId" UUID REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "qty" DECIMAL(14,3) NOT NULL,
  CONSTRAINT "transfer_line_positive" CHECK ("qty" > 0)
);
CREATE INDEX "StockTransferLine_variantId_idx" ON "StockTransferLine"("variantId");
ALTER TABLE "InventoryMovement" ADD COLUMN "warehouseId" UUID REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryCount" ADD COLUMN "warehouseId" UUID REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UUIDs aleatorios generados por PostgreSQL. No se altera ninguna existencia.
INSERT INTO "Warehouse" ("id", "branchId", "name", "kind", "sellable")
SELECT md5(random()::text || clock_timestamp()::text || b.branch)::uuid, b.branch, 'Tienda', 'store', true
FROM (SELECT DISTINCT "branchId" AS branch FROM "Variant" UNION SELECT 'main') b;
INSERT INTO "Warehouse" ("id", "branchId", "name", "kind", "sellable")
SELECT md5(random()::text || clock_timestamp()::text || b.branch)::uuid, b.branch, 'Casa', 'home', false
FROM (SELECT DISTINCT "branchId" AS branch FROM "Variant" UNION SELECT 'main') b;
INSERT INTO "VariantStock" ("variantId", "warehouseId", "qty")
SELECT v.id, w.id, v.stock FROM "Variant" v JOIN "Warehouse" w ON w."branchId"=v."branchId" AND w.kind='store';
INSERT INTO "LotStock" ("lotId", "warehouseId", "qty")
SELECT l.id, w.id, l.qty FROM "Lot" l JOIN "Warehouse" w ON w."branchId"=l."branchId" AND w.kind='store';
UPDATE "InventoryMovement" m SET "warehouseId" = w.id FROM "Warehouse" w WHERE w."branchId" = m."branchId" AND w.kind='store';
UPDATE "InventoryCount" c SET "warehouseId" = w.id FROM "Warehouse" w WHERE w."branchId" = c."branchId" AND w.kind='store';

-- Compatibilidad de todas las rutas existentes que escriben Variant.stock y Lot.qty.
CREATE FUNCTION warehouse_sync_variant_store() RETURNS trigger AS $$
DECLARE store_id UUID;
BEGIN
  INSERT INTO "Warehouse" ("id", "branchId", "name", "kind", "sellable")
  VALUES (md5(random()::text || clock_timestamp()::text)::uuid, NEW."branchId", 'Tienda', 'store', true)
  ON CONFLICT ("branchId", "kind") DO NOTHING;
  INSERT INTO "Warehouse" ("id", "branchId", "name", "kind", "sellable")
  VALUES (md5(random()::text || clock_timestamp()::text)::uuid, NEW."branchId", 'Casa', 'home', false)
  ON CONFLICT ("branchId", "kind") DO NOTHING;
  SELECT id INTO store_id FROM "Warehouse" WHERE "branchId"=NEW."branchId" AND kind='store';
  INSERT INTO "VariantStock" ("variantId", "warehouseId", "qty") VALUES (NEW.id, store_id, NEW.stock)
  ON CONFLICT ("variantId", "warehouseId") DO UPDATE SET qty=EXCLUDED.qty;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER warehouse_variant_store AFTER INSERT OR UPDATE OF stock ON "Variant"
FOR EACH ROW EXECUTE FUNCTION warehouse_sync_variant_store();
CREATE FUNCTION warehouse_sync_lot_store() RETURNS trigger AS $$
DECLARE store_id UUID;
BEGIN
  SELECT id INTO store_id FROM "Warehouse" WHERE "branchId"=NEW."branchId" AND kind='store';
  INSERT INTO "LotStock" ("lotId", "warehouseId", "qty") VALUES (NEW.id, store_id, NEW.qty)
  ON CONFLICT ("lotId", "warehouseId") DO UPDATE SET qty=EXCLUDED.qty;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER warehouse_lot_store AFTER INSERT OR UPDATE OF qty ON "Lot"
FOR EACH ROW EXECUTE FUNCTION warehouse_sync_lot_store();

-- Las escrituras históricas directas al kardex quedan asignadas a Tienda.
CREATE FUNCTION warehouse_default_movement_store() RETURNS trigger AS $$
BEGIN
  IF NEW."warehouseId" IS NULL THEN
    SELECT id INTO NEW."warehouseId" FROM "Warehouse"
    WHERE "branchId"=NEW."branchId" AND kind='store';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER warehouse_movement_store BEFORE INSERT ON "InventoryMovement"
FOR EACH ROW EXECUTE FUNCTION warehouse_default_movement_store();

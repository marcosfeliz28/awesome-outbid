-- Exclusivo de la base nueva del producto. No aplicar a la tienda.
-- Cada clave visible para el negocio se reserva sólo dentro de su empresa.
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_pkey";
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_pkey" PRIMARY KEY ("tenantId", id);
ALTER TABLE "Counter" DROP CONSTRAINT "Counter_pkey";
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("tenantId", key);
ALTER TABLE "AuthAttempt" DROP CONSTRAINT "AuthAttempt_pkey";
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("tenantId", key);

-- Un pago de mensajero y un cobro distribuido usan operationId como clave
-- pública de reintento. Su ámbito también debe ser la empresa, no toda la SaaS.
-- La guardia histórica para payoutId buscaba por operationId global y ya no
-- puede escoger una fila inequívoca. La FK compuesta de abajo la reemplaza.
DO $$ BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON "CourierPayoutItem"',
    'nexora_fk_' || substr(md5('CourierPayoutItem_payoutId_fkey' || 'CourierPayoutItem'), 1, 16));
END $$;
ALTER TABLE "CourierPayoutItem" DROP CONSTRAINT IF EXISTS "CourierPayoutItem_payoutId_fkey";
ALTER TABLE "CourierPayout" DROP CONSTRAINT IF EXISTS "CourierPayout_pkey";
ALTER TABLE "CourierPayout" ADD CONSTRAINT "CourierPayout_pkey" PRIMARY KEY ("tenantId", "operationId");
ALTER TABLE "CourierPayoutItem" ADD CONSTRAINT "CourierPayoutItem_tenantId_payoutId_fkey"
  FOREIGN KEY ("tenantId", "payoutId") REFERENCES "CourierPayout"("tenantId", "operationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditAllocationOperation" DROP CONSTRAINT IF EXISTS "CreditAllocationOperation_pkey";
ALTER TABLE "CreditAllocationOperation" ADD CONSTRAINT "CreditAllocationOperation_pkey"
  PRIMARY KEY ("tenantId", "operationId");

ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_name_key";
DROP INDEX IF EXISTS "Role_name_key";
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role" ("tenantId", name);
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_usernameKey_key";
DROP INDEX IF EXISTS "User_usernameKey_key";
CREATE UNIQUE INDEX "User_tenantId_usernameKey_key" ON "User" ("tenantId", "usernameKey");
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User" ("tenantId", email);
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_name_key";
DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category" ("tenantId", name);
ALTER TABLE "Brand" DROP CONSTRAINT IF EXISTS "Brand_name_key";
DROP INDEX IF EXISTS "Brand_name_key";
CREATE UNIQUE INDEX "Brand_tenantId_name_key" ON "Brand" ("tenantId", name);
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sku_key";
DROP INDEX IF EXISTS "Product_sku_key";
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product" ("tenantId", sku);
ALTER TABLE "Variant" DROP CONSTRAINT IF EXISTS "Variant_sku_key";
DROP INDEX IF EXISTS "Variant_sku_key";
CREATE UNIQUE INDEX "Variant_tenantId_sku_key" ON "Variant" ("tenantId", sku);
ALTER TABLE "Variant" DROP CONSTRAINT IF EXISTS "Variant_barcode_key";
DROP INDEX IF EXISTS "Variant_barcode_key";
CREATE UNIQUE INDEX "Variant_tenantId_barcode_key" ON "Variant" ("tenantId", barcode);
ALTER TABLE "Variant" DROP CONSTRAINT IF EXISTS "Variant_sku_ci_key";
DROP INDEX IF EXISTS "Variant_sku_ci_key";
CREATE UNIQUE INDEX "Variant_tenantId_sku_ci_key" ON "Variant" ("tenantId", lower(btrim(sku)))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';
ALTER TABLE "Variant" DROP CONSTRAINT IF EXISTS "Variant_barcode_ci_key";
DROP INDEX IF EXISTS "Variant_barcode_ci_key";
CREATE UNIQUE INDEX "Variant_tenantId_barcode_ci_key" ON "Variant" ("tenantId", lower(btrim(barcode)))
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_branchId_kind_key";
CREATE UNIQUE INDEX "Warehouse_tenantId_branchId_kind_key" ON "Warehouse" ("tenantId", "branchId", kind);
CREATE UNIQUE INDEX "Warehouse_tenantId_branchId_name_key" ON "Warehouse" ("tenantId", "branchId", name);

-- Los triggers históricos buscan/crean la Tienda por branchId. Desde este
-- punto dos empresas pueden tener la misma sucursal; toda ruta del trigger
-- debe incluir tenantId ANTES de admitir escrituras de variantes o lotes.
CREATE OR REPLACE FUNCTION warehouse_sync_variant_store() RETURNS trigger AS $$
DECLARE store_id UUID;
BEGIN
  INSERT INTO "Warehouse" ("id", "tenantId", "branchId", "name", "kind", "sellable")
  VALUES (md5(random()::text || clock_timestamp()::text)::uuid, NEW."tenantId", NEW."branchId", 'Tienda', 'store', true)
  ON CONFLICT ("tenantId", "branchId", "kind") DO NOTHING;
  INSERT INTO "Warehouse" ("id", "tenantId", "branchId", "name", "kind", "sellable")
  VALUES (md5(random()::text || clock_timestamp()::text)::uuid, NEW."tenantId", NEW."branchId", 'Casa', 'home', false)
  ON CONFLICT ("tenantId", "branchId", "kind") DO NOTHING;
  SELECT id INTO store_id FROM "Warehouse"
    WHERE "tenantId"=NEW."tenantId" AND "branchId"=NEW."branchId" AND kind='store';
  INSERT INTO "VariantStock" ("tenantId", "variantId", "warehouseId", "qty")
    VALUES (NEW."tenantId", NEW.id, store_id, NEW.stock)
  ON CONFLICT ("variantId", "warehouseId") DO UPDATE SET qty=EXCLUDED.qty;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION warehouse_sync_lot_store() RETURNS trigger AS $$
DECLARE store_id UUID;
BEGIN
  SELECT id INTO store_id FROM "Warehouse"
    WHERE "tenantId"=NEW."tenantId" AND "branchId"=NEW."branchId" AND kind='store';
  INSERT INTO "LotStock" ("tenantId", "lotId", "warehouseId", "qty")
    VALUES (NEW."tenantId", NEW.id, store_id, NEW.qty)
  ON CONFLICT ("lotId", "warehouseId") DO UPDATE SET qty=EXCLUDED.qty;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION warehouse_default_movement_store() RETURNS trigger AS $$
BEGIN
  IF NEW."warehouseId" IS NULL THEN
    SELECT id INTO NEW."warehouseId" FROM "Warehouse"
      WHERE "tenantId"=NEW."tenantId" AND "branchId"=NEW."branchId" AND kind='store';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
ALTER TABLE "Terminal" DROP CONSTRAINT IF EXISTS "Terminal_branch_registerNumber_active_key";
DROP INDEX IF EXISTS "Terminal_branch_registerNumber_active_key";
CREATE UNIQUE INDEX "Terminal_tenant_branch_registerNumber_active_key"
  ON "Terminal" ("tenantId", "branchId", "registerNumber")
  WHERE "registerNumber" IS NOT NULL AND "revokedAt" IS NULL;
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_branch_cashierNumber_active_key";
DROP INDEX IF EXISTS "User_branch_cashierNumber_active_key";
CREATE UNIQUE INDEX "User_tenant_branch_cashierNumber_active_key"
  ON "User" ("tenantId", "branchId", "cashierNumber")
  WHERE "cashierNumber" IS NOT NULL AND active;
CREATE UNIQUE INDEX "Terminal_tenantId_branchId_registerName_key"
  ON "Terminal" ("tenantId", "branchId", "registerName");

ALTER TABLE "StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_operationId_key";
DROP INDEX IF EXISTS "StockTransfer_operationId_key";
CREATE UNIQUE INDEX "StockTransfer_tenantId_operationId_key" ON "StockTransfer" ("tenantId", "operationId");
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_number_key";
DROP INDEX IF EXISTS "Sale_number_key";
CREATE UNIQUE INDEX "Sale_tenantId_number_key" ON "Sale" ("tenantId", number);
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_offlineUuid_key";
DROP INDEX IF EXISTS "Sale_offlineUuid_key";
CREATE UNIQUE INDEX "Sale_tenantId_offlineUuid_key" ON "Sale" ("tenantId", "offlineUuid");
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_ncf_key";
DROP INDEX IF EXISTS "Sale_ncf_key";
CREATE UNIQUE INDEX "Sale_tenantId_ncf_key" ON "Sale" ("tenantId", ncf);
ALTER TABLE "SaleVoidRequest" DROP CONSTRAINT IF EXISTS "SaleVoidRequest_operationId_key";
DROP INDEX IF EXISTS "SaleVoidRequest_operationId_key";
CREATE UNIQUE INDEX "SaleVoidRequest_tenantId_operationId_key" ON "SaleVoidRequest" ("tenantId", "operationId");
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_idempotencyKey_key";
DROP INDEX IF EXISTS "Payment_idempotencyKey_key";
CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment" ("tenantId", "idempotencyKey");
ALTER TABLE "SaleReturn" DROP CONSTRAINT IF EXISTS "SaleReturn_number_key";
DROP INDEX IF EXISTS "SaleReturn_number_key";
CREATE UNIQUE INDEX "SaleReturn_tenantId_number_key" ON "SaleReturn" ("tenantId", number);
ALTER TABLE "SaleReturn" DROP CONSTRAINT IF EXISTS "SaleReturn_operationId_key";
DROP INDEX IF EXISTS "SaleReturn_operationId_key";
CREATE UNIQUE INDEX "SaleReturn_tenantId_operationId_key" ON "SaleReturn" ("tenantId", "operationId");
ALTER TABLE "CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_redemptionCode_key";
DROP INDEX IF EXISTS "CreditNote_redemptionCode_key";
CREATE UNIQUE INDEX "CreditNote_tenantId_redemptionCode_key" ON "CreditNote" ("tenantId", "redemptionCode");
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_number_key";
DROP INDEX IF EXISTS "PurchaseOrder_number_key";
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_number_key" ON "PurchaseOrder" ("tenantId", number);
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT IF EXISTS "GoodsReceipt_operationId_key";
DROP INDEX IF EXISTS "GoodsReceipt_operationId_key";
CREATE UNIQUE INDEX "GoodsReceipt_tenantId_operationId_key" ON "GoodsReceipt" ("tenantId", "operationId");
ALTER TABLE "SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_operationId_key";
DROP INDEX IF EXISTS "SupplierPayment_operationId_key";
CREATE UNIQUE INDEX "SupplierPayment_tenantId_operationId_key" ON "SupplierPayment" ("tenantId", "operationId");
ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_operationId_key";
DROP INDEX IF EXISTS "CashMovement_operationId_key";
CREATE UNIQUE INDEX "CashMovement_tenantId_operationId_key" ON "CashMovement" ("tenantId", "operationId");
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_name_key";
DROP INDEX IF EXISTS "ExpenseCategory_name_key";
CREATE UNIQUE INDEX "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory" ("tenantId", name);
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_operationId_key";
DROP INDEX IF EXISTS "Expense_operationId_key";
CREATE UNIQUE INDEX "Expense_tenantId_operationId_key" ON "Expense" ("tenantId", "operationId");
ALTER TABLE "Alert" DROP CONSTRAINT IF EXISTS "Alert_key_key";
DROP INDEX IF EXISTS "Alert_key_key";
CREATE UNIQUE INDEX "Alert_tenantId_key_key" ON "Alert" ("tenantId", key);
ALTER TABLE "AlertRule" DROP CONSTRAINT IF EXISTS "AlertRule_type_key";
DROP INDEX IF EXISTS "AlertRule_type_key";
CREATE UNIQUE INDEX "AlertRule_tenantId_type_key" ON "AlertRule" ("tenantId", type);
ALTER TABLE "InvoiceDraft" DROP CONSTRAINT IF EXISTS "InvoiceDraft_confirmedOperationId_key";
DROP INDEX IF EXISTS "InvoiceDraft_confirmedOperationId_key";
CREATE UNIQUE INDEX "InvoiceDraft_tenantId_confirmedOperationId_key" ON "InvoiceDraft" ("tenantId", "confirmedOperationId");
ALTER TABLE "NotificationOutbox" DROP CONSTRAINT IF EXISTS "NotificationOutbox_eventType_refId_key";
DROP INDEX IF EXISTS "NotificationOutbox_eventType_refId_key";
CREATE UNIQUE INDEX "NotificationOutbox_tenantId_eventType_refId_key"
  ON "NotificationOutbox" ("tenantId", "eventType", "refId");
DROP INDEX IF EXISTS one_open_cash_per_user;
CREATE UNIQUE INDEX one_open_cash_per_user ON "CashSession" ("tenantId", "branchId", "userId") WHERE "closedAt" IS NULL;
DROP INDEX IF EXISTS one_open_cash_per_register;
-- W6: la caja pertenece al usuario, no al equipo. Dos personas del mismo
-- negocio pueden tener cajas abiertas simultáneamente en un solo terminal.
-- El índice del terminal es sólo para búsqueda, nunca una restricción única.
CREATE INDEX "CashSession_tenantId_branchId_registerId_open_idx"
  ON "CashSession" ("tenantId", "branchId", "registerId") WHERE "closedAt" IS NULL;

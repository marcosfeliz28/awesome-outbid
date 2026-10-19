-- SOLO para la base nueva del producto. Jamás aplicar a la tienda.
CREATE TABLE IF NOT EXISTS "Tenant" (
 id uuid PRIMARY KEY, name text NOT NULL, plan text NOT NULL DEFAULT 'trial',
 status text NOT NULL DEFAULT 'trial', country text NOT NULL DEFAULT 'DO',
 currency text NOT NULL DEFAULT 'DOP', "timeZone" text NOT NULL DEFAULT 'America/Santo_Domingo',
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" timestamp(3) NOT NULL
);
INSERT INTO "Tenant" (id, name, "updatedAt") VALUES ('00000000-0000-0000-0000-000000000001', 'Demo', CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_tenant_runtime') THEN
   CREATE ROLE nexora_tenant_runtime NOLOGIN;
 END IF;
END $$;

GRANT nexora_tenant_runtime TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO nexora_tenant_runtime;
GRANT SELECT ON "Tenant" TO nexora_tenant_runtime;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant" TO nexora_tenant_runtime
 USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['Role', 'User', 'RefreshToken', 'Category', 'Brand', 'Supplier', 'Product', 'Variant', 'KitComponent', 'Lot', 'LotIdentityConflict', 'InventoryMovement', 'Warehouse', 'VariantStock', 'LotStock', 'StockTransfer', 'StockTransferLine', 'Customer', 'Sale', 'SaleVoidRequest', 'CourierPayout', 'CourierPayoutItem', 'SaleItem', 'Payment', 'CreditAllocationOperation', 'SaleReturn', 'CreditNote', 'Quote', 'PurchaseOrder', 'PurchaseItem', 'GoodsReceipt', 'SupplierPayment', 'InventoryCount', 'CashSession', 'CashMovement', 'ExpenseCategory', 'Expense', 'Promotion', 'Alert', 'AlertRule', 'AuditLog', 'Settings', 'Counter', 'AuthAttempt', 'AuthSession', 'Terminal', 'RealtimeEvent', 'MerchandiseOperation', 'SupplierImportProfile', 'SupplierCode', 'InvoiceDraft', 'InvoiceAttachment', 'NotificationOutbox', 'IncentiveRate', 'IncentiveEntry', 'IncentivePeriodClose', 'IncentiveSettlement', 'DriveBackup'] LOOP
  -- ADD COLUMN con DEFAULT constante rellena los registros antiguos sin una
  -- UPDATE separada; así no quedan eventos FK pendientes antes del DDL.
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "tenantId" uuid NOT NULL DEFAULT %L::uuid', table_name, '00000000-0000-0000-0000-000000000001');
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = table_name || '_tenantId_fkey') THEN
   EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE RESTRICT ON UPDATE CASCADE', table_name, table_name || '_tenantId_fkey');
  END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")', table_name || '_tenantId_idx', table_name);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I TO nexora_tenant_runtime USING ("tenantId" = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK ("tenantId" = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO nexora_tenant_runtime', table_name);
 END LOOP;
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexora_tenant_runtime;

-- El default fijo conserva compatibilidad con Prisma; el trigger aplica el
-- tenant de la transacción en TODAS las creaciones, incluidas las anidadas.
CREATE OR REPLACE FUNCTION nexora_assign_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."tenantId" = '00000000-0000-0000-0000-000000000001'::uuid THEN
  NEW."tenantId" := coalesce(nullif(current_setting('app.tenant_id', true), '')::uuid, NEW."tenantId");
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['Role', 'User', 'RefreshToken', 'Category', 'Brand', 'Supplier', 'Product', 'Variant', 'KitComponent', 'Lot', 'LotIdentityConflict', 'InventoryMovement', 'Warehouse', 'VariantStock', 'LotStock', 'StockTransfer', 'StockTransferLine', 'Customer', 'Sale', 'SaleVoidRequest', 'CourierPayout', 'CourierPayoutItem', 'SaleItem', 'Payment', 'CreditAllocationOperation', 'SaleReturn', 'CreditNote', 'Quote', 'PurchaseOrder', 'PurchaseItem', 'GoodsReceipt', 'SupplierPayment', 'InventoryCount', 'CashSession', 'CashMovement', 'ExpenseCategory', 'Expense', 'Promotion', 'Alert', 'AlertRule', 'AuditLog', 'Settings', 'Counter', 'AuthAttempt', 'AuthSession', 'Terminal', 'RealtimeEvent', 'MerchandiseOperation', 'SupplierImportProfile', 'SupplierCode', 'InvoiceDraft', 'InvoiceAttachment', 'NotificationOutbox', 'IncentiveRate', 'IncentiveEntry', 'IncentivePeriodClose', 'IncentiveSettlement', 'DriveBackup'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS nexora_assign_tenant ON %I', table_name);
  EXECUTE format('CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant()', table_name);
 END LOOP;
END $$;

-- RLS filtra lecturas; esta guardia impide referencias cruzadas por claves
-- foráneas (PostgreSQL valida FK sin someter esa búsqueda a RLS).
CREATE OR REPLACE FUNCTION nexora_check_tenant_fk() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_tenant uuid; foreign_value text;
BEGIN
 foreign_value := to_jsonb(NEW)->>TG_ARGV[2];
 IF foreign_value IS NULL THEN RETURN NEW; END IF;
 EXECUTE format('SELECT "tenantId" FROM %I WHERE %I::text = $1', TG_ARGV[0], TG_ARGV[1])
   INTO parent_tenant USING foreign_value;
 IF parent_tenant IS DISTINCT FROM NEW."tenantId" THEN
  RAISE EXCEPTION 'Referencia a otra empresa o registro inexistente' USING ERRCODE = '23503';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE fk record; trigger_name text; BEGIN
 FOR fk IN
  SELECT c.conname, child.relname AS child_table, parent.relname AS parent_table,
         ca.attname AS child_column, pa.attname AS parent_column
  FROM pg_constraint c
  JOIN pg_class child ON child.oid = c.conrelid
  JOIN pg_class parent ON parent.oid = c.confrelid
  JOIN pg_attribute ca ON ca.attrelid = child.oid AND ca.attnum = c.conkey[1]
  JOIN pg_attribute pa ON pa.attrelid = parent.oid AND pa.attnum = c.confkey[1]
  WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
    AND child.relnamespace = 'public'::regnamespace
    AND parent.relnamespace = 'public'::regnamespace
    AND child.relname <> 'Tenant' AND parent.relname <> 'Tenant'
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = child.oid AND a.attname = 'tenantId')
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = parent.oid AND a.attname = 'tenantId')
 LOOP
  trigger_name := 'nexora_fk_' || substr(md5(fk.conname || fk.child_table), 1, 16);
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, fk.child_table);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, "tenantId" ON %I FOR EACH ROW EXECUTE FUNCTION nexora_check_tenant_fk(%L,%L,%L)', trigger_name, fk.child_column, fk.child_table, fk.parent_table, fk.parent_column, fk.child_column);
 END LOOP;
END $$;

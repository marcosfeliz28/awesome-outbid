-- Igualar producto con nexora-cloud (19-nov): las tablas nuevas de la tienda
-- (GV, medidor de IA, baja de cliente) llevan el mismo aislamiento que las
-- demás: tenantId (default demo + trigger que pone el de la transacción),
-- FK a Tenant, RLS, permisos del rol runtime y guardia de FK entre empresas.
-- Las claves únicas por sucursal pasan a ser por empresa y sucursal.
-- Aditiva e idempotente; en la base del producto estas tablas están vacías.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['GvCourse', 'GvEnrollment', 'GvPayment', 'GvCashSession', 'GvProof', 'GvAppointment', 'GvLead', 'AiUsage', 'BranchTermination'] LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "tenantId" uuid NOT NULL DEFAULT %L::uuid', table_name, '00000000-0000-0000-0000-000000000001');
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = table_name || '_tenantId_fkey') THEN
   EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE RESTRICT ON UPDATE CASCADE', table_name, table_name || '_tenantId_fkey');
  END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")', table_name || '_tenantId_idx', table_name);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I TO nexora_tenant_runtime USING ("tenantId" = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK ("tenantId" = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO nexora_tenant_runtime', table_name);
  EXECUTE format('DROP TRIGGER IF EXISTS nexora_assign_tenant ON %I', table_name);
  EXECUTE format('CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant()', table_name);
 END LOOP;
END $$;

-- Únicas por empresa (antes por sucursal: dos empresas chocaban con la misma clave).
DROP INDEX IF EXISTS "GvCourse_branchId_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GvCourse_tenantId_branchId_externalId_key" ON "GvCourse"("tenantId", "branchId", "externalId");
DROP INDEX IF EXISTS "GvEnrollment_branchId_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GvEnrollment_tenantId_branchId_externalId_key" ON "GvEnrollment"("tenantId", "branchId", "externalId");
DROP INDEX IF EXISTS "GvPayment_branchId_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GvPayment_tenantId_branchId_externalId_key" ON "GvPayment"("tenantId", "branchId", "externalId");
DROP INDEX IF EXISTS "GvPayment_branchId_receiptNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GvPayment_tenantId_branchId_receiptNumber_key" ON "GvPayment"("tenantId", "branchId", "receiptNumber");
DROP INDEX IF EXISTS "GvAppointment_branchId_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GvAppointment_tenantId_branchId_externalId_key" ON "GvAppointment"("tenantId", "branchId", "externalId");
DROP INDEX IF EXISTS "GvLead_branchId_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GvLead_tenantId_branchId_externalId_key" ON "GvLead"("tenantId", "branchId", "externalId");
DROP INDEX IF EXISTS "gv_cash_one_open";
CREATE UNIQUE INDEX IF NOT EXISTS "gv_cash_one_open" ON "GvCashSession" ("tenantId", "branchId") WHERE "closedAt" IS NULL;

-- Baja de cliente: una fila por empresa y sucursal.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BranchTermination_pkey'
            AND conrelid = '"BranchTermination"'::regclass
            AND array_length(conkey, 1) = 1) THEN
  ALTER TABLE "BranchTermination" DROP CONSTRAINT "BranchTermination_pkey";
  ALTER TABLE "BranchTermination" ADD CONSTRAINT "BranchTermination_pkey" PRIMARY KEY ("tenantId", "branchId");
 END IF;
END $$;

-- Guardia de FK entre empresas para las relaciones de estas tablas (mismo
-- criterio que 202610260001: toda FK de una columna entre tablas con tenantId).
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
    AND child.relname IN ('GvCourse', 'GvEnrollment', 'GvPayment', 'GvCashSession', 'GvProof', 'GvAppointment', 'GvLead', 'AiUsage', 'BranchTermination')
    AND parent.relname <> 'Tenant'
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = parent.oid AND a.attname = 'tenantId')
 LOOP
  trigger_name := 'nexora_fk_' || substr(md5(fk.conname || fk.child_table), 1, 16);
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, fk.child_table);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, "tenantId" ON %I FOR EACH ROW EXECUTE FUNCTION nexora_check_tenant_fk(%L,%L,%L)', trigger_name, fk.child_column, fk.child_table, fk.parent_table, fk.parent_column, fk.child_column);
 END LOOP;
END $$;

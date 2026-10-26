-- Encuesta de la caja: una respuesta editable por persona. Aditiva; sin datos.
-- tenantId sin valor por defecto: falla cerrada como NcfSequence.
CREATE TABLE IF NOT EXISTS "CashierSurvey" (
  "tenantId" uuid NOT NULL,
  "id" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "branchId" text NOT NULL DEFAULT 'main',
  "answers" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "CashierSurvey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CashierSurvey_tenantId_userId_key"
  ON "CashierSurvey"("tenantId", "userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashierSurvey_tenantId_fkey') THEN
    ALTER TABLE "CashierSurvey" ADD CONSTRAINT "CashierSurvey_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "CashierSurvey" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'CashierSurvey' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "CashierSurvey" TO nexora_tenant_runtime
      USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CashierSurvey" TO nexora_tenant_runtime;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"CashierSurvey"'::regclass
    AND tgname = 'nexora_assign_tenant') THEN
    CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON "CashierSurvey"
      FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant();
  END IF;
END $$;

-- «Pedir un cambio»: solicitudes de cada persona. Aditiva; sin datos.
-- Copia el patrón de aislamiento de CashierSurvey: tenantId sin valor por defecto,
-- la persona debe ser de la misma empresa (trigger) y la RLS separa empresas.
CREATE TABLE IF NOT EXISTS "ChangeRequest" (
  "tenantId" uuid NOT NULL,
  "id" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL DEFAULT 'abierto',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChangeRequest_title_check" CHECK (char_length("title") BETWEEN 3 AND 120),
  CONSTRAINT "ChangeRequest_description_check" CHECK (char_length("description") BETWEEN 10 AND 2000),
  CONSTRAINT "ChangeRequest_status_check" CHECK ("status" IN ('abierto', 'en_proceso', 'resuelto'))
);
CREATE INDEX IF NOT EXISTS "ChangeRequest_tenantId_createdAt_idx"
  ON "ChangeRequest"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChangeRequest_tenantId_userId_idx"
  ON "ChangeRequest"("tenantId", "userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangeRequest_tenantId_fkey'
                 AND conrelid = '"ChangeRequest"'::regclass) THEN
    ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangeRequest_userId_fkey'
                 AND conrelid = '"ChangeRequest"'::regclass) THEN
    ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DROP TRIGGER IF EXISTS nexora_fk_change_request_user ON "ChangeRequest";
CREATE TRIGGER nexora_fk_change_request_user
  BEFORE INSERT OR UPDATE OF "userId", "tenantId" ON "ChangeRequest"
  FOR EACH ROW EXECUTE FUNCTION nexora_check_tenant_fk('User', 'id', 'userId');
ALTER TABLE "ChangeRequest" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'ChangeRequest' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "ChangeRequest" TO nexora_tenant_runtime
      USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ChangeRequest" TO nexora_tenant_runtime;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"ChangeRequest"'::regclass
    AND tgname = 'nexora_assign_tenant') THEN
    CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON "ChangeRequest"
      FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant();
  END IF;
END $$;

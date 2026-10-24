-- PC-13: inventario manual de secuencias; nunca asigna/emite comprobantes.
-- Sin filas iniciales ni números ficticios. No modifica ventas existentes.
CREATE TABLE IF NOT EXISTS "NcfSequence" (
  "id" uuid PRIMARY KEY,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" text NOT NULL,
  "authorizationReference" text NOT NULL,
  "firstNumber" numeric(12,0) NOT NULL,
  "lastNumber" numeric(12,0) NOT NULL,
  "nextNumber" numeric(13,0) NOT NULL,
  "nextConfirmedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "numberWidth" integer NOT NULL CHECK ("numberWidth" BETWEEN 1 AND 12),
  "expiryApplies" boolean NOT NULL,
  "expiresOn" date,
  "active" boolean NOT NULL DEFAULT true,
  "recordedBy" uuid NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "NcfSequence_range_valid" CHECK (
    "firstNumber" >= 0 AND "lastNumber" >= "firstNumber"
    AND "nextNumber" >= "firstNumber" AND "nextNumber" <= "lastNumber" + 1
    AND "lastNumber" < power(10::numeric, "numberWidth")
  ),
  CONSTRAINT "NcfSequence_expiry_valid" CHECK (
    ("expiryApplies" AND "expiresOn" IS NOT NULL)
    OR (NOT "expiryApplies" AND "expiresOn" IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS "NcfSequence_tenantId_type_authorizationReference_key"
  ON "NcfSequence"("tenantId", "type", "authorizationReference");
CREATE INDEX IF NOT EXISTS "NcfSequence_tenantId_active_idx"
  ON "NcfSequence"("tenantId", "active");
ALTER TABLE "NcfSequence" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'NcfSequence' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "NcfSequence" TO nexora_tenant_runtime
      USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NcfSequence" TO nexora_tenant_runtime;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"NcfSequence"'::regclass
    AND tgname = 'nexora_assign_tenant') THEN
    CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON "NcfSequence"
      FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant();
  END IF;
END $$;

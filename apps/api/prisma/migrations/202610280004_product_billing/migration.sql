-- Sólo base independiente del producto. Nunca se aplica a la tienda.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_platform_billing') THEN
    CREATE ROLE nexora_platform_billing NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO nexora_platform_billing;
GRANT SELECT ON "Tenant" TO nexora_platform_billing;
GRANT UPDATE ("status", "plan", "updatedAt") ON "Tenant" TO nexora_platform_billing;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Tenant' AND column_name='paidThroughAt') THEN
    GRANT UPDATE ("paidThroughAt") ON "Tenant" TO nexora_platform_billing;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Tenant' AND column_name='pastDueAt') THEN
    GRANT UPDATE ("pastDueAt") ON "Tenant" TO nexora_platform_billing;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Tenant' AND column_name='suspendedAt') THEN
    GRANT UPDATE ("suspendedAt") ON "Tenant" TO nexora_platform_billing;
  END IF;
END $$;
DROP POLICY IF EXISTS platform_billing_operator ON "Tenant";
CREATE POLICY platform_billing_operator ON "Tenant" TO nexora_platform_billing USING (true) WITH CHECK (true);
-- El operador sólo necesita contadores, nunca hashes ni datos de clientes.
GRANT SELECT ("tenantId", "active", "branchId") ON "User" TO nexora_platform_billing;
GRANT SELECT ("tenantId", "branchId", "approvedAt", "revokedAt") ON "Terminal" TO nexora_platform_billing;
DROP POLICY IF EXISTS platform_billing_operator ON "User";
CREATE POLICY platform_billing_operator ON "User" TO nexora_platform_billing USING (true);
DROP POLICY IF EXISTS platform_billing_operator ON "Terminal";
CREATE POLICY platform_billing_operator ON "Terminal" TO nexora_platform_billing USING (true);
CREATE TABLE IF NOT EXISTS "BillingRequest" (
  "id" uuid PRIMARY KEY,
  "tenantId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "plan" text NOT NULL,
  "provider" text NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "status" text NOT NULL DEFAULT 'pending_proof',
  "proof" bytea,
  "proofMime" text,
  "submittedAt" timestamp(3),
  "reviewedAt" timestamp(3),
  "reviewer" text,
  "reviewReason" text,
  "paidThroughAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "BillingRequest_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "BillingRequest_status_valid" CHECK ("status" IN ('pending_proof','pending_review','approved','rejected')),
  CONSTRAINT "BillingRequest_provider_valid" CHECK ("provider" IN ('test','bank_transfer'))
);
CREATE INDEX IF NOT EXISTS "BillingRequest_tenantId_createdAt_idx" ON "BillingRequest"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "BillingRequest_status_submittedAt_idx" ON "BillingRequest"("status", "submittedAt");
ALTER TABLE "BillingRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BillingRequest";
CREATE POLICY tenant_isolation ON "BillingRequest" TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "BillingRequest" TO nexora_tenant_runtime;
GRANT SELECT ON "BillingRequest" TO nexora_platform_billing;
GRANT UPDATE ("status", "reviewedAt", "reviewer", "reviewReason", "paidThroughAt", "updatedAt") ON "BillingRequest" TO nexora_platform_billing;
DROP POLICY IF EXISTS platform_billing_operator ON "BillingRequest";
CREATE POLICY platform_billing_operator ON "BillingRequest" TO nexora_platform_billing USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS nexora_assign_tenant ON "BillingRequest";
CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON "BillingRequest" FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant();
CREATE TABLE IF NOT EXISTS "BillingDecision" (
  "id" uuid PRIMARY KEY,
  "requestId" uuid NOT NULL UNIQUE REFERENCES "BillingRequest"("id") ON DELETE RESTRICT,
  "tenantId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "decision" text NOT NULL CHECK ("decision" IN ('approved','rejected')),
  "reviewer" text NOT NULL,
  "reason" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BillingDecision_tenantId_createdAt_idx" ON "BillingDecision"("tenantId", "createdAt");
ALTER TABLE "BillingDecision" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BillingDecision";
CREATE POLICY tenant_isolation ON "BillingDecision" TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS platform_billing_operator ON "BillingDecision";
CREATE POLICY platform_billing_operator ON "BillingDecision" TO nexora_platform_billing USING (true) WITH CHECK (true);
GRANT SELECT ON "BillingDecision" TO nexora_tenant_runtime;
GRANT SELECT, INSERT ON "BillingDecision" TO nexora_platform_billing;

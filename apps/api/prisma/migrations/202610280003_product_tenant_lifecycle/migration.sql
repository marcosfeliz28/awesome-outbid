-- Base independiente del producto; migración aditiva. Nunca aplicar a la tienda.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paidThroughAt" timestamp(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pastDueAt" timestamp(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp(3);

CREATE TABLE IF NOT EXISTS "TenantLifecycleNotice" (
  "id" uuid PRIMARY KEY,
  "tenantId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES "Tenant"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" text NOT NULL,
  "dueAt" timestamp(3) NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantLifecycleNotice_tenantId_kind_dueAt_key"
  ON "TenantLifecycleNotice"("tenantId", "kind", "dueAt");
CREATE INDEX IF NOT EXISTS "TenantLifecycleNotice_status_nextAttemptAt_idx"
  ON "TenantLifecycleNotice"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "TenantLifecycleNotice_tenantId_idx"
  ON "TenantLifecycleNotice"("tenantId");
ALTER TABLE "TenantLifecycleNotice" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TenantLifecycleNotice";
CREATE POLICY tenant_isolation ON "TenantLifecycleNotice" TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "TenantLifecycleNotice" TO nexora_tenant_runtime;

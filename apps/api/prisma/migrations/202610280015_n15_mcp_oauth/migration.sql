-- Códigos OAuth de un solo uso. Sin tokens ni contraseñas en claro.
CREATE TABLE "McpAuthorizationCode" (
  "id" uuid PRIMARY KEY,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "branchId" text NOT NULL,
  "userId" uuid NOT NULL,
  "sessionId" uuid NOT NULL,
  "authVersion" integer NOT NULL,
  "clientId" text NOT NULL,
  "redirectUri" text NOT NULL,
  "challenge" text NOT NULL,
  "codeHash" text NOT NULL,
  "expiresAt" timestamp(3) NOT NULL,
  "usedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "McpAuthorizationCode_codeHash_key" ON "McpAuthorizationCode"("codeHash");
CREATE INDEX "McpAuthorizationCode_tenantId_expiresAt_idx" ON "McpAuthorizationCode"("tenantId", "expiresAt");
ALTER TABLE "McpAuthorizationCode" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "McpAuthorizationCode" TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "McpAuthorizationCode" TO nexora_tenant_runtime;
CREATE TRIGGER nexora_assign_tenant BEFORE INSERT ON "McpAuthorizationCode"
  FOR EACH ROW EXECUTE FUNCTION nexora_assign_tenant();

-- PC-08: sólo las nuevas escrituras del producto usan objetos externos.
-- Los bytes legados siguen legibles hasta una migración operativa verificada.
ALTER TABLE "InvoiceAttachment" ALTER COLUMN data DROP NOT NULL;
ALTER TABLE "InvoiceAttachment" ADD COLUMN IF NOT EXISTS "objectKey" TEXT;
ALTER TABLE "BillingRequest" ADD COLUMN IF NOT EXISTS "proofObjectKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceAttachment_tenantId_objectKey_key"
  ON "InvoiceAttachment"("tenantId", "objectKey");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingRequest_tenantId_proofObjectKey_key"
  ON "BillingRequest"("tenantId", "proofObjectKey");
ALTER TABLE "InvoiceAttachment" ADD CONSTRAINT "InvoiceAttachment_object_location"
  CHECK ((data IS NOT NULL AND "objectKey" IS NULL) OR (data IS NULL AND "objectKey" IS NOT NULL)) NOT VALID;
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_proof_location"
  CHECK (proof IS NULL OR "proofObjectKey" IS NULL) NOT VALID;
GRANT SELECT ("proofObjectKey") ON "BillingRequest" TO nexora_platform_billing;

-- El cambio/eliminación de referencia en una transacción deja un trabajo
-- durable; si la transacción revierte no se pierde ni se borra el objeto.
CREATE TABLE "TenantObjectDeletion" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE RESTRICT,
  "objectKey" text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantObjectDeletion_key_valid" CHECK (
    "objectKey" ~ '^(payment|billing|invoice)/[0-9a-f-]{36}$'
  )
);
CREATE UNIQUE INDEX "TenantObjectDeletion_tenantId_objectKey_key"
  ON "TenantObjectDeletion"("tenantId", "objectKey");
CREATE INDEX "TenantObjectDeletion_tenantId_nextAttemptAt_idx"
  ON "TenantObjectDeletion"("tenantId", "nextAttemptAt");
ALTER TABLE "TenantObjectDeletion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantObjectDeletion" TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "TenantObjectDeletion" TO nexora_tenant_runtime;

CREATE FUNCTION nexora_enqueue_object_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE old_key text; old_value text; new_value text;
BEGIN
  IF TG_TABLE_NAME = 'Payment' THEN
    old_value := OLD."proofUrl";
    old_key := substring(old_value from '^object:v1:(payment/[0-9a-f-]{36}):image/(png|jpeg|webp):[0-9]{1,8}$');
    IF TG_OP = 'UPDATE' THEN new_value := NEW."proofUrl"; END IF;
  ELSIF TG_TABLE_NAME = 'BillingRequest' THEN
    old_value := OLD."proofObjectKey";
    old_key := old_value;
    IF TG_OP = 'UPDATE' THEN new_value := NEW."proofObjectKey"; END IF;
  ELSE
    old_value := OLD."objectKey";
    old_key := old_value;
    IF TG_OP = 'UPDATE' THEN new_value := NEW."objectKey"; END IF;
  END IF;
  IF old_key IS NOT NULL AND old_value IS DISTINCT FROM new_value THEN
    INSERT INTO "TenantObjectDeletion"("tenantId", "objectKey")
    VALUES (OLD."tenantId", old_key) ON CONFLICT ("tenantId", "objectKey") DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER nexora_payment_object_deletion AFTER UPDATE OF "proofUrl" OR DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION nexora_enqueue_object_deletion();
CREATE TRIGGER nexora_billing_object_deletion AFTER UPDATE OF "proofObjectKey" OR DELETE ON "BillingRequest"
  FOR EACH ROW EXECUTE FUNCTION nexora_enqueue_object_deletion();
CREATE TRIGGER nexora_invoice_object_deletion AFTER UPDATE OF "objectKey" OR DELETE ON "InvoiceAttachment"
  FOR EACH ROW EXECUTE FUNCTION nexora_enqueue_object_deletion();

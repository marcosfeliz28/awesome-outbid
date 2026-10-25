-- PC-24: paquetes extra de preguntas de IA, cobrados a mano como la mensualidad.
-- Solo suman al mes (zona de la empresa) en que se acreditan; no pasan al siguiente.
-- Aditiva e inmutable: la empresa solo lee lo suyo; acredita únicamente el operador.
CREATE TABLE IF NOT EXISTS "AiPackCredit" (
  "id" uuid PRIMARY KEY,
  "tenantId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "month" text NOT NULL CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  "questions" integer NOT NULL CHECK ("questions" IN (100, 300)),
  "priceDop" numeric(12,2) NOT NULL CHECK ("priceDop" > 0),
  "reference" text NOT NULL CHECK (length("reference") BETWEEN 1 AND 120),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiPackCredit_tenantId_reference_key" UNIQUE ("tenantId", "reference")
);
CREATE INDEX IF NOT EXISTS "AiPackCredit_tenantId_month_idx" ON "AiPackCredit"("tenantId", "month");
ALTER TABLE "AiPackCredit" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AiPackCredit";
CREATE POLICY tenant_isolation ON "AiPackCredit" TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
-- Solo lectura para la empresa: no puede acreditarse paquetes.
GRANT SELECT ON "AiPackCredit" TO nexora_tenant_runtime;
CREATE OR REPLACE FUNCTION nexora_ai_pack_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los paquetes de IA acreditados no se modifican ni se borran' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS nexora_ai_pack_immutable ON "AiPackCredit";
CREATE TRIGGER nexora_ai_pack_immutable BEFORE UPDATE OR DELETE ON "AiPackCredit"
  FOR EACH ROW EXECUTE FUNCTION nexora_ai_pack_immutable();

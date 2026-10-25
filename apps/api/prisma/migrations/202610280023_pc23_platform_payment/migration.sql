-- PC-23: bitácora inmutable de pagos manuales registrados por el operador de
-- la plataforma. Sólo base del producto. Aditiva: no cambia filas existentes.
-- Sin columnas de tarjeta: el pago ocurre fuera del sistema.
CREATE TABLE IF NOT EXISTS "PlatformPayment" (
  "id" uuid PRIMARY KEY,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" numeric(12,2) NOT NULL CHECK ("amount" > 0),
  "method" text NOT NULL CHECK ("method" IN ('transfer','cash','card_in_store','courier')),
  "reference" text NOT NULL CHECK (length(btrim("reference")) > 0),
  "months" integer NOT NULL CHECK ("months" BETWEEN 1 AND 12),
  "operator" text NOT NULL,
  "paidFrom" timestamp(3) NOT NULL,
  "paidUntil" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPayment_period_valid" CHECK ("paidUntil" > "paidFrom")
);
CREATE INDEX IF NOT EXISTS "PlatformPayment_tenantId_createdAt_idx" ON "PlatformPayment"("tenantId", "createdAt");
ALTER TABLE "PlatformPayment" ENABLE ROW LEVEL SECURITY;
-- La empresa sólo puede leer sus propios pagos (exportación); nunca escribirlos.
DROP POLICY IF EXISTS tenant_isolation ON "PlatformPayment";
CREATE POLICY tenant_isolation ON "PlatformPayment" FOR SELECT TO nexora_tenant_runtime
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
REVOKE ALL ON "PlatformPayment" FROM nexora_tenant_runtime;
GRANT SELECT ON "PlatformPayment" TO nexora_tenant_runtime;
-- Inmutable para todos, incluso el dueño de la tabla: sólo INSERT.
CREATE OR REPLACE FUNCTION nexora_platform_payment_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de pagos es inmutable.' USING ERRCODE = '42501';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS platform_payment_immutable ON "PlatformPayment";
CREATE TRIGGER platform_payment_immutable BEFORE UPDATE OR DELETE ON "PlatformPayment"
  FOR EACH ROW EXECUTE FUNCTION nexora_platform_payment_immutable();
-- TRUNCATE de una base vacía (restaurar un respaldo en una base nueva) sigue permitido.
CREATE OR REPLACE FUNCTION nexora_platform_payment_no_truncate() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PlatformPayment") THEN
    RAISE EXCEPTION 'La bitácora de pagos es inmutable.' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS platform_payment_no_truncate ON "PlatformPayment";
CREATE TRIGGER platform_payment_no_truncate BEFORE TRUNCATE ON "PlatformPayment"
  FOR EACH STATEMENT EXECUTE FUNCTION nexora_platform_payment_no_truncate();

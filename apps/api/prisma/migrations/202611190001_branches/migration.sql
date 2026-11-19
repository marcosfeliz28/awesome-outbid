-- Sucursales (orden de la dueña, 19-nov). Aditiva e idempotente: no cambia
-- ninguna fila existente. "Branch".id es el mismo texto que ya guardan las
-- columnas "branchId" (por defecto 'main'); la clave (tenantId, id) lo hace
-- único por empresa. La RLS separa empresas como en ChangeRequest.
CREATE TABLE IF NOT EXISTS "Branch" (
  "tenantId" uuid NOT NULL,
  "id" text NOT NULL,
  "name" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("tenantId", "id"),
  CONSTRAINT "Branch_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Branch_tenantId_fkey'
                 AND conrelid = '"Branch"'::regclass) THEN
    ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'Branch' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "Branch" TO nexora_tenant_runtime
      USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Branch" TO nexora_tenant_runtime;

-- Toda sucursal que ya existe en los datos queda registrada; 'main' siempre.
INSERT INTO "Branch" ("tenantId", "id", "name")
SELECT b."tenantId", b."branchId", CASE WHEN b."branchId" = 'main' THEN 'Principal' ELSE b."branchId" END
FROM (
  SELECT id AS "tenantId", 'main' AS "branchId" FROM "Tenant"
  UNION SELECT "tenantId", id FROM "Settings"
  UNION SELECT "tenantId", "branchId" FROM "User"
  UNION SELECT "tenantId", "branchId" FROM "Terminal"
  UNION SELECT "tenantId", "branchId" FROM "Warehouse"
) b
WHERE btrim(b."branchId") <> ''
ON CONFLICT ("tenantId", "id") DO NOTHING;

-- Una empresa nueva (alta) o unos ajustes nuevos registran su sucursal sin
-- tocar el código del alta. Corre con el rol de la empresa: la RLS lo admite
-- porque inserta el mismo tenantId de la fila de Settings.
CREATE OR REPLACE FUNCTION nexora_branch_from_settings() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "Branch" ("tenantId", "id", "name")
  VALUES (NEW."tenantId", NEW.id, CASE WHEN NEW.id = 'main' THEN 'Principal' ELSE NEW.id END)
  ON CONFLICT ("tenantId", "id") DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nexora_branch_from_settings ON "Settings";
CREATE TRIGGER nexora_branch_from_settings AFTER INSERT ON "Settings"
  FOR EACH ROW EXECUTE FUNCTION nexora_branch_from_settings();

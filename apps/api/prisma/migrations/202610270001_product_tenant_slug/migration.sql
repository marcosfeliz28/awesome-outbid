-- Sólo la base nueva de producto. El código público resuelve slug a UUID
-- antes de entrar en un contexto RLS; el JWT conserva exclusivamente el UUID.
ALTER TABLE "Tenant" ADD COLUMN "slug" text;
UPDATE "Tenant" SET "slug" = CASE
  WHEN id = '00000000-0000-0000-0000-000000000001'::uuid THEN 'demo'
  ELSE 'tenant-' || replace(id::text, '-', '')
END;
ALTER TABLE "Tenant" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

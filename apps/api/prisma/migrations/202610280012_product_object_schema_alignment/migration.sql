-- PC-08: alinear la FK con la relación Prisma sin alterar ni borrar filas.
-- El ID de esta cola lo genera PostgreSQL porque el disparador inserta sin Prisma.
BEGIN;
ALTER TABLE "TenantObjectDeletion"
  DROP CONSTRAINT IF EXISTS "TenantObjectDeletion_tenantId_fkey";
ALTER TABLE "TenantObjectDeletion"
  ADD CONSTRAINT "TenantObjectDeletion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;

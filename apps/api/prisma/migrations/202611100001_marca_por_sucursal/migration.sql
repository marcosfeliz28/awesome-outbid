-- Marcas por sucursal (auditoría de intrusión, 10-nov). Aditiva: no borra ni
-- cambia filas. Las marcas existentes quedan en "main", igual que Category.
-- La unicidad pasa de name (global) a (branchId, name): se crea el índice
-- nuevo antes de soltar el viejo. Brand es una tabla pequeña; lock_timeout evita
-- dejar esperando a otras consultas si la tabla está ocupada.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "branchId" text NOT NULL DEFAULT 'main';
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_branchId_name_key" ON "Brand"("branchId", "name");
DROP INDEX IF EXISTS "Brand_name_key";

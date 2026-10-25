-- Producto (25-oct): las empresas nacían sólo con «admin» y la API no puede
-- crear roles. Se agregan los roles base de la tienda (seed.ts y
-- `permissions` de packages/shared) a cada empresa que no los tenga.
-- Sólo inserta roles: no cambia permisos de roles existentes ni toca otros
-- datos. Idempotente: repetirla no hace nada.
INSERT INTO "Role" ("id", "tenantId", "name", "permissions", "updatedAt")
SELECT gen_random_uuid(), t."id", r."name", r."permissions", CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (VALUES
  ('manager', ARRAY['catalog:read', 'catalog:write', 'inventory:write', 'purchase:write', 'sale:write', 'sale:manage', 'cash:write', 'cash:drawer', 'expense:write', 'reports:read', 'profit:read', 'customers:write', 'customers:erase', 'promotions:write', 'alerts:write']::TEXT[]),
  ('seller', ARRAY['catalog:read', 'sale:write', 'cash:write', 'customers:write']::TEXT[]),
  ('warehouse', ARRAY['catalog:read', 'inventory:write', 'purchase:write']::TEXT[])
) AS r("name", "permissions")
ON CONFLICT ("tenantId", "name") DO NOTHING;

-- Inicio sencillo: las empresas nuevas nacen con el cliente «Consumidor
-- final»; las existentes lo reciben sólo si no tienen uno con ese nombre.
-- Los ajustes que falten no se rellenan aquí: la API usa sus valores por
-- defecto y Configuración los completa con DEFAULT_SETTINGS al guardar.
INSERT INTO "Customer" ("id", "tenantId", "name", "updatedAt")
SELECT gen_random_uuid(), t."id", 'Consumidor final', CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "Customer" c
  WHERE c."tenantId" = t."id" AND lower(c."name") = 'consumidor final'
);

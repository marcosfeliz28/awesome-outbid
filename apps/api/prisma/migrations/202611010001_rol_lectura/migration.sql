-- Rol «lectura» (orden 107, 1-nov): ventas, cajas, reportes y catálogo en solo
-- lectura, sin escritura ni administración y sin profit:read (costos).
-- Aditiva e idempotente: sólo inserta el rol si no existe. Si ya existe con
-- otros permisos, no lo toca (no reduce ni amplía un rol ya configurado).

INSERT INTO "Role" ("id", "name", "permissions", "updatedAt")
VALUES (gen_random_uuid(), 'lectura', ARRAY['catalog:read', 'reports:read', 'sale:read', 'cash:read'], CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

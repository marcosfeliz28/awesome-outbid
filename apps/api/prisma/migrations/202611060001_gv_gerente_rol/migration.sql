-- Rol de la gerente que da seguimiento a las transferencias de GV (6-nov).
-- Solo lectura, reportes y verificar; sin gv:write (no cobra ni abre caja).
-- Aditiva e idempotente; no se asigna a nadie aquí.
INSERT INTO "Role" ("id", "name", "permissions", "updatedAt")
VALUES (gen_random_uuid(), 'gerente_gv', ARRAY['gv:read', 'gv:reports', 'gv:verify'], CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

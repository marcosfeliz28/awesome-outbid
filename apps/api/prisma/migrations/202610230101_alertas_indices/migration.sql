-- F7 (rendimiento de GET /api/alerts): la lista se ordena por updatedAt dentro
-- de una sucursal, con o sin estado, y el filtro por entidad (conflictos
-- offline, cierres) no tenía índice. Con decenas de miles de alertas (inventario
-- importado) cada lectura ordenaba y recorría toda la tabla.
--
-- Índices nuevos sobre una tabla pequeña que no participa en el cobro; los
-- nombres son los que Prisma genera para los @@index de schema.prisma. Falla
-- en voz alta (sin bloque de excepciones) para que el despliegue no siga con
-- una lista lenta sin que nadie lo sepa; deploy/render/post-deploy-check.mjs
-- también los exige. Idempotente.
CREATE INDEX IF NOT EXISTS "Alert_branchId_updatedAt_idx" ON "Alert" ("branchId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Alert_branchId_status_updatedAt_idx" ON "Alert" ("branchId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Alert_entityId_idx" ON "Alert" ("entityId");

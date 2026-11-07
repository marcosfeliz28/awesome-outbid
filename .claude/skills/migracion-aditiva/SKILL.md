---
name: migracion-aditiva
description: Plantilla para crear una migración de Prisma aditiva y segura para la base en vivo de Nexora. Úsalo al añadir tablas, columnas o roles.
disable-model-invocation: true
---

# Migración aditiva

Carpeta nueva `apps/api/prisma/migrations/AAAAMMDDNNNN_nombre/migration.sql` (la siguiente al último número) y el cambio en `apps/api/prisma/schema.prisma`. **Nunca editar una migración ya existente** (el hook `guard-edit` lo bloquea).

Reglas:

- Solo aditivas: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` con valor por defecto o nulo, `CREATE INDEX IF NOT EXISTS`. Datos nuevos con `INSERT ... ON CONFLICT DO NOTHING`.
- Nada de `DROP`, `RENAME`, cambios de tipo ni `NOT NULL` sin valor por defecto sobre tablas con datos.
- Sin llaves foráneas que bloqueen borrar usuarios, salvo que haya razón.
- Prueba: agrega o amplía una prueba de migración (ver `tests/gv-gerente-rol-migration-postgres.test.ts` como modelo) que corra la migración dos veces sin error.
- Ejecuta `pnpm db:generate` y `pnpm check`; verifica que el CI `verify` pase en el SHA final.
- Si mueve montos o roles: pasar por los agentes `money-guard` y `security-reviewer`.

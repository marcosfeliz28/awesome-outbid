# PQ-25: índices para consultas de reportes (migración aditiva)

Orden 105. Rama `claude-pc/pq-25-indices`, creada desde `origin/nexora-cloud`.
Estado: lista para revisión. **Nexora 1 decide antes de cualquier despliegue.** Nada se desplegó, no se tocó Render ni la base de producción.

## Índices

Tablas: en `schema.prisma` no hay `@@map`, así que el nombre de tabla en PostgreSQL es el del modelo. Todos los campos existen con el mismo nombre; no hubo diferencias con la definición de la pieza.

| Modelo | Índice (`@@index`) | Nombre en PostgreSQL |
|---|---|---|
| `Sale` | `(branchId, status, createdAt)` | `Sale_branchId_status_createdAt_idx` |
| `SaleReturn` | `(branchId, createdAt)` | `SaleReturn_branchId_createdAt_idx` |
| `Payment` | `(entryType, createdAt)` | `Payment_entryType_createdAt_idx` |
| `CashSession` | `(branchId, openedAt)` | `CashSession_branchId_openedAt_idx` |

Los nombres son los que Prisma deriva por defecto (`<tabla>_<campos>_idx`), así que no se usó `map:`.

## Migración

Archivo: `apps/api/prisma/migrations/202611011000_pq25_indices/migration.sql`

Cuatro sentencias `CREATE INDEX IF NOT EXISTS`. Es aditiva e idempotente, no modifica migraciones existentes y no usa modo concurrente, porque Prisma ejecuta cada migración en una transacción.

## Tamaños de tablas

**No medido.** El PostgreSQL embebido en `127.0.0.1:5434` no aceptó conexiones (conexión rechazada) durante esta sesión, así que no se ejecutó ninguna consulta de tamaños. No se ejecutó la migración contra ninguna base.

Consulta prevista para medirlo en solo lectura cuando la base esté disponible:

```sql
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables
WHERE relname IN ('Sale','SaleReturn','Payment','CashSession');
```

## Verificación

- `npx prisma validate` (apps/api): correcto. Se usó una `DATABASE_URL` de marcador local, sin conexión, porque validate la exige.
- `npx prisma generate` (apps/api): correcto.
- `tests/pq25-indices.test.ts`: falló 9 de 10 antes del cambio de schema y migración, y pasa 10 de 10 después.
- `pnpm check`: salida 0 en la segunda corrida. La primera terminó con código 1 por `EBUSY` al borrar una carpeta temporal de Postgres en `tests/ventas-caja-ciega-postgres.test.ts` (problema de Windows, no del cambio). Ese archivo pasó 13 de 13 al correrlo solo.
- Nombres de índice verificados a mano. No se ejecutó `prisma migrate diff` porque no hay shadow database disponible.

## Rollback

Si hiciera falta revertir, ejecutar (son independientes y seguros de repetir):

```sql
DROP INDEX IF EXISTS "Sale_branchId_status_createdAt_idx";
DROP INDEX IF EXISTS "SaleReturn_branchId_createdAt_idx";
DROP INDEX IF EXISTS "Payment_entryType_createdAt_idx";
DROP INDEX IF EXISTS "CashSession_branchId_openedAt_idx";
```

Tras el rollback hay que quitar también la carpeta de migración y los `@@index` correspondientes del schema, para que Prisma no vuelva a crearlos.

## Notas

- La definición de la pieza 25 en `COLA_PERMANENTE_CLAUDE_PC.md` dice «solo informe con propuesta», y la cola prohíbe cambiar migraciones sin orden escrita de Nexora 1. Este trabajo se hizo por la orden explícita de Marco en esta sesión. Nexora 1 debe confirmarlo antes de desplegar.
- Un índice de `Sale` por `(branchId, status, createdAt)` y uno de `Payment` por `(entryType, createdAt)` añaden costo de escritura en tablas de venta. Conviene medir tamaño y tiempo de consulta antes y después en una base con datos reales.

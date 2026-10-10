# Cómo escribir migraciones seguras (Nexora POS en Render)

Guía para quien cree una migración nueva en `apps/api/prisma/migrations/`.
Responde al hallazgo M1 (y M2/M3) de la auditoría de infraestructura del
10-oct-2026. **Las migraciones ya aplicadas en producción no se reescriben
nunca**: Prisma guarda su suma de comprobación y un cambio rompe el
despliegue siguiente.

## Qué pasa al desplegar la API

1. Render construye la imagen nueva y ejecuta el `preDeployCommand` de
   `render.yaml` (`prisma migrate deploy` a través de
   `deploy/render/with-cloud-env.mjs`).
2. **Mientras tanto la API vieja sigue atendiendo a las cajas** con el
   esquema que está cambiando (unos 20–40 s).
3. Si la migración termina bien, arranca la API nueva. Si falla, el despliegue
   se detiene y sigue la API vieja.

Cada archivo `migration.sql` corre dentro de **una transacción**: o se aplica
entero o no se aplica nada, pero los bloqueos que toma duran hasta el final
del archivo.

## Límites automáticos (desde el 10-oct-2026)

`with-cloud-env.mjs` reconoce `migrate deploy` y añade a la conexión:

| Ajuste              | Valor  | Qué evita                                                                                                          |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `lock_timeout`      | `5s`   | Que la migración espere un bloqueo detrás de un reporte largo mientras todas las ventas hacen cola detrás de ella. |
| `statement_timeout` | `120s` | Que una sentencia tenga la tabla bloqueada minutos en horario de tienda.                                           |

Si se pasa del límite, la migración **falla y no deja nada a medias** (la
transacción se deshace). Es preferible a congelar las cajas: se reintenta
fuera de horario.

Para una migración pesada planificada (por ejemplo, rellenar una columna en
una tabla grande), fuera de horario y después de un respaldo:

1. En Render › `nexora-pos-api` › _Environment_, añadir temporalmente
   `NEXORA_MIGRATION_STATEMENT_TIMEOUT=30min` (y si hace falta
   `NEXORA_MIGRATION_LOCK_TIMEOUT=30s`). Formato: número seguido de `ms`, `s`
   o `min`.
2. Desplegar la API.
3. Quitar la variable al terminar.

La API en marcha no usa estos límites (sólo el `preDeploy`). Además, la API
abre como máximo `NEXORA_DB_CONNECTION_LIMIT` conexiones (10 por defecto).

## Reglas para una migración nueva

1. **Nombre:** fecha y número **mayores que la última migración existente**
   (hoy la última es `202610190001_…`; la siguiente sería `202610200001_…`
   aunque la fecha real sea anterior). Prisma aplica por orden alfabético: una
   migración con un nombre «del pasado» se aplica en otro orden en una base
   nueva (CI, instalador, recuperación) que en producción. Nunca repetir el
   prefijo de otra.
2. **Ampliar y luego retirar** (ver `DEPLOY-RENDER.md`): primero añadir
   (tabla, columna con valor por defecto o que admita `NULL`, índice); la
   API nueva debe funcionar con el esquema viejo y el nuevo. Borrar columnas
   o tablas (`DROP COLUMN`, `DROP TABLE`, `RENAME`) sólo en una versión
   **posterior**, cuando ninguna API desplegada las use. La API vieja sigue
   viva durante el `preDeploy` y fallaría al leer una columna borrada.
3. **Nada de bloqueos largos sobre tablas de venta.** `Sale`, `SaleItem`,
   `Variant`, `Lot`, `InventoryMovement`, `CashSession` y `Payment` se
   escriben en cada cobro.
   - Evitar `LOCK TABLE` y `ALTER TABLE … SET NOT NULL` sobre tablas grandes;
     usar una restricción `CHECK (…) NOT VALID` y validarla después.
   - Un `UPDATE` de toda una tabla va en lotes, en una tarea puntual fuera de
     horario, no en la migración.
   - Índices: `CREATE INDEX IF NOT EXISTS`. En tablas grandes, crear antes el
     índice a mano con `CREATE INDEX CONCURRENTLY` (no puede ir dentro de la
     migración, que es una transacción) y dejar en la migración el mismo
     `CREATE INDEX IF NOT EXISTS`, que entonces no hace nada.
4. **Que una migración no «pase» sin hacer lo que dice.** Si un bloque
   `DO $$ … $$` omite un índice único por datos repetidos, debe dejar rastro
   comprobable (como `202610170001_variant_code_unique`, que escribe en
   `AuditLog`) y quien despliega debe comprobar `pg_indexes` (ver abajo).
5. **Probarla antes:** `pnpm db:migrate` en local sobre una copia reciente
   (restaurada con `scripts/restore.mjs`), medir cuánto tarda y revisar que el
   CI (job `render-images`) pase: aplica todas las migraciones con la misma
   orden que Render.
6. **Desplegar fuera de horario** (antes de abrir o después del cierre) y
   con un respaldo reciente.

## Si una migración falla en Render (error P3009 o P3018)

Prisma marca la migración como fallida en `_prisma_migrations` y **todos los
despliegues siguientes fallan** hasta resolverlo. La tienda sigue con la API
anterior. Pasos (desde el _Shell_ del servicio `nexora-pos-api`):

1. Ver qué pasó, sin cambiar nada:

   ```text
   node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate status --schema apps/api/prisma/schema.prisma
   ```

   y el log del despliegue fallido (Render › _Events_). Si el error es
   `canceling statement due to lock timeout` o `statement timeout`, fue uno
   de los límites de arriba.

2. Como cada migración es una transacción, lo normal es que **no se haya
   aplicado nada**. Marcarla como revertida:

   ```text
   node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate resolve --rolled-back <nombre_de_la_migracion> --schema apps/api/prisma/schema.prisma
   ```

3. Volver a desplegar la API (fuera de horario si fue un _timeout_, o con la
   variable temporal de arriba).
4. Sólo si se comprobó a mano que la migración **sí** quedó aplicada completa
   (tablas, columnas e índices presentes), usar `--applied <nombre>` en vez de
   `--rolled-back`. Ante la duda, no usar `--applied`.

## Comprobar después de desplegar

- `https://nexora-pos-web.onrender.com/api/health` → `{"database":"ok"}`, o
  Actions › «Comprobación posterior al despliegue» › _Run workflow_.
- Índices que las migraciones pueden omitir sin fallar (M3). La base no
  acepta conexiones desde Internet (`ipAllowList: []`) y la imagen de la API
  no trae `psql`, así que se consulta desde el _Shell_ de `nexora-pos-api`
  (orden probada contra la imagen de la API):

  ```text
  cd apps/api
  node ../../deploy/render/with-cloud-env.mjs node -e 'new (require("@prisma/client").PrismaClient)().$queryRaw`SELECT indexname FROM pg_indexes WHERE indexname IN (${"Variant_sku_ci_key"}, ${"Variant_barcode_ci_key"}, ${"IncentiveEntry_saleItemId_kind_refId_key"})`.then((r) => console.log(r.map((x) => x.indexname))).finally(() => process.exit())'
  ```

  Deben salir los tres nombres. Si falta alguno, revisar `AuditLog` y
  corregir los datos repetidos antes de reintentar el archivo
  correspondiente.

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
   (hoy la última es `202610220001_…`; la siguiente sería `202610230001_…`
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
4. **Que una migración no «pase» sin hacer lo que dice.** `prisma migrate
deploy` **no muestra los `RAISE NOTICE`** (probado): un bloque
   `DO $$ … EXCEPTION WHEN OTHERS THEN RAISE NOTICE … $$` que omite un índice
   o una restricción deja el despliegue en verde y a nadie enterado. Debe
   dejar rastro durable (como `202610170001_variant_code_unique` y
   `202610220001_validar_restricciones`, que escriben en `AuditLog`) y el
   objeto debe estar en `EXPECTED_INDEXES` / `EXPECTED_CONSTRAINTS` de
   `deploy/render/post-deploy-check.mjs`, que quien despliega ejecuta con
   `--db-only` (ver abajo). Además, `QUERY_CANCELED` (el `statement_timeout`
   de 120 s) **no** lo captura `EXCEPTION WHEN OTHERS`: un `DO` que pase de
   120 s falla entera.
   - `lock_timeout`: no subirlo dentro de la migración por encima del que fija
     el envoltorio (5 s). Las migraciones `202610200001`…`202610210003` ya
     aplicadas lo suben a 15 s con `set_config` y no se pueden editar;
     las nuevas usan 3 s o menos y una sentencia por objeto.
   - `ALTER TABLE … ADD CONSTRAINT … NOT VALID` toma `SHARE ROW EXCLUSIVE`
     (bloquea escrituras de esa tabla y de la referida en una FK) hasta el
     final de la migración, y todo el archivo es una transacción: partirlo en
     varias migraciones, una por tabla caliente, no sumar bloqueos.
     `VALIDATE CONSTRAINT`, en cambio, solo toma `SHARE UPDATE EXCLUSIVE` y
     no bloquea escrituras.
5. **Probarla antes:** `pnpm db:migrate` en local sobre una copia reciente
   (restaurada con `scripts/restore.mjs`), medir cuánto tarda y revisar que el
   CI (job `render-images`) pase: aplica todas las migraciones con la misma
   orden que Render.
6. **Desplegar fuera de horario** (antes de abrir o después del cierre) y
   con un respaldo reciente. Las migraciones que agregan restricciones o
   índices **siempre** se despliegan fuera de horario, aunque cada paso tenga
   `lock_timeout`: la API vieja sigue atendiendo cobros mientras corre el
   `preDeploy` y una escritura larga retenida detrás del bloqueo congela las
   cajas hasta que venza.

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

## Restricciones NOT VALID: filas antiguas y su validación

Una restricción `CHECK` o `FOREIGN KEY` agregada con `NOT VALID` (así lo
hizo `202610210002_datos_restricciones`) rechaza filas **nuevas** que la
violen, pero también se vuelve a evaluar en cada `UPDATE` de una fila
**antigua**: si esa fila ya violaba la regla, anularla, verificarla o
recalcular su caja falla con SQLSTATE `23514` (CHECK) o `23503` (FK). Desde
`202610220001_validar_restricciones` el efecto es el siguiente:

- Esa migración intenta `VALIDATE CONSTRAINT` de **cada** restricción `NOT
VALID` (una por sentencia, `lock_timeout` de 3 s, sin bloquear escrituras) y,
  de las que no se pueden validar, deja una fila en `AuditLog` con
  `action = 'constraint_not_validated'`, `entityId` = nombre de la
  restricción y en `after`: tabla, motivo (`violations`, `lock_timeout` o
  `error`), `violatingRows` (cuántas filas la violan), la definición y
  `listQuery` (la consulta que las lista). Nunca borra ni cambia filas.
- La API ya no responde 500: un `23514`/`23503` al modificar una fila antigua
  devuelve **409** con `code: "CONSTRAINT_VIOLATION"` y el nombre de la regla.
- `post-deploy-check.mjs --db-only` **falla** mientras exista alguna
  restricción `NOT VALID`.

### Consulta de violaciones (solo lectura)

Desde el _Shell_ de `nexora-pos-api` (la base no acepta conexiones externas):

```text
cd apps/api
node ../../deploy/render/with-cloud-env.mjs node -e 'const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();(async()=>{console.log(await db.$queryRaw`SELECT conrelid::regclass::text AS tabla, conname, pg_get_constraintdef(oid) AS regla FROM pg_constraint WHERE NOT convalidated`);console.log(await db.$queryRaw`SELECT "createdAt", "entityId", after FROM "AuditLog" WHERE action = ${"constraint_not_validated"} ORDER BY "createdAt" DESC LIMIT 50`)})().finally(()=>process.exit())'
```

Para listar las filas de una restricción, ejecutar la `listQuery` que dejó la
migración, o la consulta equivalente (una por cada restricción de
`202610210002`; el `SELECT *` evita adivinar columnas):

```sql
-- CHECK: filas que NO cumplen la regla (cambiar tabla y expresión)
SELECT * FROM "PurchaseItem"
 WHERE NOT (qty > 0 AND "receivedQty" >= 0 AND "damagedQty" >= 0
            AND "receivedQty" + "damagedQty" <= qty);   -- purchase_item_quantities_valid
SELECT * FROM "CashSession" WHERE NOT ("closedAt" IS NULL OR "closedAt" >= "openedAt");
SELECT * FROM "Sale" WHERE NOT (subtotal >= 0 AND "discountTotal" >= 0
            AND "taxTotal" >= 0 AND total >= 0 AND "costTotal" >= 0);
SELECT * FROM "Payment" WHERE NOT (amount >= 0 AND tendered >= 0
            AND "change" >= 0 AND "feeAmount" >= 0);
-- FK: filas huérfanas (cambiar tabla, columna y tabla referida)
SELECT c.* FROM "CreditNote" c
 WHERE c."returnId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "SaleReturn" r WHERE r.id = c."returnId");  -- CreditNote_returnId_fkey
```

### Qué hacer con ellas

1. Hacer un respaldo y **revisar con la dueña cada fila** (son registros
   contables): corregir el dato con una sentencia puntual y revisada, no con
   un `UPDATE` masivo (el propio `UPDATE` de una fila que viola una `NOT
VALID` falla; para corregirla hay que arreglar el valor en la misma
   sentencia, p. ej. `UPDATE "PurchaseItem" SET "receivedQty" = qty - "damagedQty" WHERE id = …`).
2. Volver a ejecutar la validación (idempotente, sin bloquear escrituras):
   `psql "$URL" -f apps/api/prisma/migrations/202610220001_validar_restricciones/migration.sql`,
   o `ALTER TABLE "<tabla>" VALIDATE CONSTRAINT "<nombre>";` a mano.
3. Comprobar con `node deploy/render/post-deploy-check.mjs --db-only`.

Mientras esas filas sigan sin corregir, la restricción **sigue protegiendo lo
nuevo**; lo único afectado es modificar esa fila antigua (409).

## Comprobar después de desplegar

- `https://nexora-pos-web.onrender.com/api/health` → `{"status":"ok"}`, o
  Actions › «Comprobación posterior al despliegue» › _Run workflow_.
- **Índices, restricciones y disparador que las migraciones pueden omitir sin
  fallar (M3, N2, D-M9)**, desde el _Shell_ de `nexora-pos-api` (la base no
  acepta conexiones desde Internet, `ipAllowList: []`):

  ```text
  node deploy/render/post-deploy-check.mjs --db-only
  ```

  Solo lectura. Verifica `pg_index.indisvalid` (ningún índice inválido), que
  existan `Variant_sku_ci_key`, `Variant_barcode_ci_key` y los demás índices
  de `EXPECTED_INDEXES`, que las 29 restricciones existan y estén validadas
  (`convalidated`), el disparador `auth_attempt_touch` y `plan_cache_mode`.
  Si falta `Variant_sku_ci_key` o `Variant_barcode_ci_key`, hay SKU o códigos
  repetidos sin distinguir mayúsculas ni espacios: revisar `AuditLog`
  (`k2_code_index_skipped`), corregir los datos y volver a ejecutar
  `202610170001_variant_code_unique/migration.sql` con `psql`.

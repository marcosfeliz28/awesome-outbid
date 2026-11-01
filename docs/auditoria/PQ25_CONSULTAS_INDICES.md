# PQ25: consultas N+1 e índices faltantes en la API (solo informe)

Fecha: 1-nov-2026. Base: `origin/nexora-cloud` (3e272476). Rama: `claude-pc/pq-23-28`. Pieza 25 de la cola.

Alcance: solo lectura de `apps/api/src` y `apps/api/prisma/schema.prisma`. No se creó migración ni se cambió código. No se ejecutó `EXPLAIN ANALYZE`: no hay base con volumen real en esta laptop y el Postgres embebido no arranca como root en este entorno (lo anota la auditoría 30-oct). Las mejoras de rendimiento no están medidas; son hipótesis razonadas desde el código.

## Cómo se verificó

- Lectura de `@@index` y columnas de `Sale`, `SaleReturn`, `Payment`, `CashSession` en `schema.prisma`:
  - `Sale` (L312-382): `@@index([customerId])`, `@@index([createdAt])`, `@@index([sellerId, createdAt])`, `@@index([cashSessionId])`. No tiene índice que empiece por `branchId`.
  - `SaleReturn` (L511-540): `@@index([saleId])`, `@@index([cashSessionId])`. Sin `branchId`.
  - `Payment` (L458-495): `@@index([saleId])`, `@@index([cashSessionId])`. Sin `entryType`.
  - `CashSession` (L673-702): solo `@@index([userId, closedAt])`. Sin `branchId`.
- `grep` de `prisma.(sale|saleReturn|payment|cashSession).(findMany|aggregate|groupBy|count|findFirst)` y de `$queryRaw` en `apps/api/src`.
- Búsqueda de bucles con `await` a la base (`for ... of`, `.map(async`) y lectura de cada hallazgo.

## Índices: las cuatro hipótesis

Las cuatro se confirman. Además se encontraron consultas raw que filtran igual.

| Hipótesis | Estado en el esquema | Consultas que la usan |
|---|---|---|
| `Sale [branchId, status, createdAt]` | **Falta.** Hay `[createdAt]` y `[sellerId, createdAt]`, pero ninguna empieza por `branchId`. | `dashboard()` en `reports.ts:235` (`sale.aggregate` con `branchId, status, createdAt`, y SQL raw de ventas por día, por hora y por categoría en `reports.ts:325-330`). `reports/formal` en `formal-report.ts:42` (`sale.findMany` y `sale.count` con `branchId`, `status: "completed"`). `buildCuadre` en `cash.ts:317` filtra por `cashSessionId` y `branchId`, que ya tiene índice por caja. |
| `SaleReturn [branchId, createdAt]` | **Falta.** Solo `[saleId]` y `[cashSessionId]`. | `dashboard()`: `saleReturn.aggregate` con `branchId` y `createdAt` (`reports.ts:295` y `reports.ts:363-374`, incluido año anterior y periodo previo). `saleReturn.findMany` en `reports.ts:1197`, dentro de un reporte paginado. |
| `Payment [entryType, createdAt]` | **Falta.** Solo `[saleId]` y `[cashSessionId]`. | `dashboard()`: `payment.groupBy` por método con `entryType <> installment` (`reports.ts:333`) y `payment.aggregate` de abonos con `entryType: "installment"`, `status: "ok"` y `createdAt` (`reports.ts:380`). Cobros por período en `reports.ts:1020-1034` (`payment.groupBy` con `entryType: "installment"`, `createdAt`). Los filtros por sucursal se hacen por la relación `sale`, así que el índice de `Payment` solo ayuda al paso de fecha. Valorar `[entryType, status, createdAt]` después de medir. |
| `CashSession [branchId, openedAt]` | **Falta.** Solo `[userId, closedAt]`. | Listado de cajas `sessions` en `cash.ts:761-776` (`branchId` más `closedAt null` y `closedAt not null`, orden por `openedAt`). Reporte formal en `formal-report.ts:152-158` (`branchId` y `OR [openedAt, closedAt]`, orden `openedAt`). Guarda de caja abierta en `reportes/dinero.ts:25` (`branchId` y `closedAt null`). Para esa guarda conviene valorar `[branchId, closedAt]`. |

Otros índices a considerar, detectados de paso (no estaban en la lista de la orden):

- `Sale` tiene `[customerId]` y `[createdAt]` pero el filtro de crédito de `credit-reminder.ts:162-185` usa `creditBalance > 0` y `payments some`. Sin índice dirigido, cada semana recorre toda la tabla de ventas con saldo. Bajo, porque es una tarea semanal.
- `Sale.branchId` no aparece como primera columna de ningún índice. Cualquier filtro por sucursal que no combine `createdAt` o `cashSessionId` recorre la tabla completa. No revisé cada consulta de `alerts.ts` ni de `courier.ts:126` para confirmar cuál sería.

## Consultas N+1 y escrituras fila a fila

| Ruta | Dónde | Patrón | Tamaño de N | Riesgo |
|---|---|---|---|---|
| Pago de envíos a repartidores | `courier.ts:199` (`payout`), bucle en L237-240 | Por cada venta: `$queryRaw ... FOR UPDATE` y `sale.findFirst`. | Número de facturas seleccionadas. No vi un tope en el DTO. | Medio: bloqueo por fila dentro de la transacción de dinero. |
| Pago de envíos (escritura) | `courier.ts:262-275` | Por cada venta: `courierPayoutItem.create` y `sale.update`. | Igual que arriba. | Medio: 2N escrituras dentro de la transacción de dinero. Se puede reemplazar por `createMany` y `updateMany` (sin cambiar la lógica). |
| Anonimización de cliente | `admin.ts:361-480` (transacción) | Bucles con `update` por fila para pagos (L447-453), devoluciones (L459-465) y movimientos de kardex (L472-478), solo si cambia el texto. | Pagos + devoluciones + movimientos del cliente. | Bajo: ruta de administración poco frecuente. |
| Importación de catálogo | `catalog.ts:632` | `tx.product.create` por producto con variantes anidadas. | Productos del archivo. | Medio: carga lenta y transacción larga en el archivo grande. Fuera del informe de reportes, pero es el mismo patrón. |
| Recordatorios de crédito | `credit-reminder.ts:174-190` | Un bucle por sucursal con 4 consultas cada vez. | Número de sucursales (pocas). | Bajo. |
| Alertas (reglas) | `alerts.ts:924-930` | `alertRule.upsert` por regla. | Reglas enviadas (pocas). | Bajo. |

Descartados tras revisar: `gv-money.ts:533` (dos iteraciones fijas), `alerts.ts:718-774` (ya trocea en bloques), `catalog.ts:232` (escribe en memoria para Excel, sin consulta por fila).

## Recomendación

1. Índices, en una sola migración aditiva, después de medir con datos reales de una copia:
   - `Sale @@index([branchId, status, createdAt])`
   - `SaleReturn @@index([branchId, createdAt])`
   - `Payment @@index([entryType, createdAt])` (valorar `status`)
   - `CashSession @@index([branchId, openedAt])` y valorar `[branchId, closedAt]`
   Seguir `docs/MIGRACIONES_SEGURAS.md`. En Postgres en producción, crear los índices sin bloquear escrituras.
2. Medir antes con `EXPLAIN (ANALYZE, BUFFERS)` sobre copia anonimizada del reporte `dashboard/summary` y `reports/formal`.
3. `courier.ts` payout: pasar a `createMany` y `updateMany` en una pieza propia con prueba de dinero (es lógica de dinero: requiere orden escrita de Nexora 1 según la cola).
4. Anonimización y catálogo: solo si el volumen lo justifica.

## No cambiado

- `apps/api/src/**`: sin cambios.
- `apps/api/prisma/schema.prisma` y migraciones: sin cambios. No se creó migración nueva.
- No se ejecutó ninguna consulta contra una base de datos.
- Cifras: ninguna medida de tiempo ni de plan de ejecución. Todo lo marcado como «hipótesis» necesita `EXPLAIN` antes de crear un índice.

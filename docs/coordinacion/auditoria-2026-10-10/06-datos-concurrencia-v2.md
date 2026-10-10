# Auditoría 06 v2 · Datos, transacciones, concurrencia y migraciones

**Proyecto:** Nexora POS, `origin/nexora-cloud`, commit `a12c980` (v1 auditó `3e5521c`).
**Tipo:** auditoría independiente de SOLO LECTURA del repositorio. No se cambió código ni se hizo push. No se tocó producción.
**Fecha:** 2026-10-10
**Entorno:** worktree desacoplado `auditoria-sistema/wt-v2-datos-concurrencia`; PostgreSQL 16.14 del sistema (puerto 55616, `timezone=UTC`, `deadlock_timeout=200ms`, `max_connections=200`) como usuario `postgres` en `/var/lib/postgresql/aud-v2-06`; API compilada (`node dist/main.js`, puerto 3616). Al terminar se detuvieron la API y PostgreSQL y se borró el directorio de datos. Los scripts de prueba están en `auditoria-sistema/v2dc/` (`t*.mjs`, `lib.mjs`, `setup.mjs`), el registro de PostgreSQL en `v2dc/pg-log.txt` y el extracto del interbloqueo en `v2dc/deadlock-fk-extracto.txt`.

## 1. Resumen

**Hallazgos v1 (23):** 6 corregidos, 8 parciales, 9 abiertos.

| Severidad de los hallazgos NUEVOS | Cantidad |
|---|---:|
| Crítico | 0 |
| Alto | 1 |
| Medio | 3 |
| Bajo | 4 |

Lo más importante:

1. **Una migración de esta noche introdujo una regresión demostrada.** La clave foránea `CreditNote_customerId_fkey` (`202610210002_datos_restricciones`) invierte el orden de bloqueo entre una **devolución con nota de crédito** y una **venta al mismo cliente de la misma variante**. Resultado en 30 rondas: **94 interbloqueos**, 88 de 120 ventas y 6 de 30 devoluciones con HTTP 500. Sin esa clave: 0 de 150 (N-A1).
2. Las correcciones de rendimiento, de idempotencia de dinero, del interbloqueo anulación/venta (D-M1), de la carrera de borradores y del cierre del mes de incentivos **funcionan** y se comprobaron con pruebas, no sólo leyendo código.
3. Una venta offline **descartada** por gerencia vuelve a registrarse si la caja la reenvía (N-M1, reproducido).
4. Las restricciones nuevas se agregan `NOT VALID` y sin aviso visible: si hay filas viejas que las violan, la restricción queda a medias y **bloquea cualquier UPDATE de esas filas** (N-M2, comprobado en PostgreSQL).

## 2. Método

- `prisma migrate deploy` sobre base vacía: las 37 migraciones se aplican; `prisma migrate diff --from-migrations … --to-schema-datamodel …` con base sombra devuelve **«This is an empty migration»** (sin deriva).
- Migraciones sobre datos con forma antigua (base `mig`: esquema inicial + `06-anexos/sql/old-data.sql` + `migrate resolve --applied 202610030001_initial` + `migrate deploy`): todas se aplican, 0 restricciones sin validar. Sigue omitido en silencio `Variant_sku_ci_key` (D-M9).
- Carga sintética de 100 000 ventas (`06-anexos/sql/carga.sql` sobre las migraciones nuevas) y `06-anexos/sql/explain.sql`.
- Los scripts de carrera de v1 se adaptaron al nuevo inicio de sesión (cajeras `cajera1..6@aud.test` creadas con `setup.mjs`, contraseña de la semilla) y se repitieron contra la API compilada. Se añadieron `t12b` (idempotencia con clave), `t14` (interbloqueo de la clave foránea), `t15` (ráfaga con clientes distintos) y `t16` (descarte offline).
- Pruebas del proyecto ejecutadas contra mi PostgreSQL con `NEXORA_TEST_PG_URL`: `tests/datos-integridad-postgres.test.ts` (5 de 5), `tests/perf-indexes-postgres.test.ts` (1 de 1), `tests/datos-unit.test.ts` (7 de 7). `tests/reports-memory-postgres.test.ts` no terminó (usa PostgreSQL embebido): no se cuenta como evidencia.
- Restauración: `pg_dump -Fc` de la base migrada y `pg_restore --exit-on-error` a una base vacía: restauró 51 restricciones/claves, disparadores y secuencias sin errores.

## 3. Tabla v1 → estado

| ID v1 | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| D-A1 | Faltan índices en claves foráneas calientes | **Corregido** | Índices en `SaleItem.saleId`, `Payment.saleId/cashSessionId`, `Sale.cashSessionId/customerId`, `SaleReturn.saleId/cashSessionId`, `CashMovement.sessionId`, `PurchaseItem.orderId`, `AuditLog(entityId,entity)`, `Variant.productId` (`202610200001`, `202610210001`; `schema.prisma` con `@@index`). EXPLAIN con 100 000 ventas: Q1 0,07 ms, Q2 0,05 ms, Q3 1,4 ms, Q4 0,22 ms, Q5 0,05 ms, Q7 0,15 ms (todo *Index Scan*; v1 tenía *Seq Scan* de 14 a 34 ms). Siguen sin índice `InventoryMovement.refId` (30 ms; ahora lo usa la anonimización, ver N-B1) y `CreditNote.customerId`. |
| D-A2 | Disco de 1 GB, binarios en la base, sin retención | **Parcial** | `render.yaml:84` ahora `diskSizeGB: 5` (autoescala apagada, `:86`). `retention.ts` purga `RealtimeEvent` (48 h), `NotificationOutbox` enviados/fallidos (30 d), `AuthAttempt` y `RefreshToken` vencidos, en lotes de 5 000 (`retention.ts:41-130`); lo cubre `datos-integridad-postgres.test.ts`. **Sigue igual:** `InvoiceAttachment.data` y `Payment.proofUrl` (base64) dentro de la base; `AuditLog`, `InventoryMovement`, `IncentiveEntry`, `AuthSession` y `MerchandiseOperation` sin purga ni archivo. Con ~3,5 KB por venta (v1) y 5 GB hay margen de años, pero no hay alerta de disco automática. |
| D-M1 | Interbloqueo venta con nota ↔ anulación | **Corregido** | `sales.ts:1367-1390`: la anulación bloquea las variantes y **después** las notas, ordenadas, igual que la venta. `t6-deadlock.mjs` ×4 corridas = 100 pares venta/anulación: 100 de 100 `201/201`, 0 interbloqueos en el registro (v1: 9 en 2 corridas, 2 HTTP 500). Sigue sin reintento de `40P01` (ver N-A1). |
| D-M2 | Pool y tiempos de transacción por defecto | **Parcial** | Hecho: pool explícito de 10 con `pool_timeout=20` (`database-pool.ts`, `common.ts:28-32`, `with-cloud-env.mjs:102-103`); devolución, anulación y cierre usan 20 s (`MONEY_TRANSACTION`, `sales.ts:398`, `cash.ts:1096`). **Falta:** `maxWait` de 2 s por defecto sin cambiar y `P2028`/`P2024` fuera de `AuthGuard` siguen devolviendo **500** en vez de 503 (`common.ts:~740`, `ApiExceptionFilter`). Medido: 200 ventas simultáneas con 40 clientes distintos y 6 variantes: 200 de 200 `201` (máx. 5,6 s); 400 ventas del mismo cliente y la misma variante: 154 `201` y 246 `500` (`P2028`). Esa segunda carga es irreal para una tienda, por eso queda como parcial y no abierto. |
| D-M3 | Faltan FK y CHECK | **Parcial** | `202610210002` agrega 12 FK (`CreditNote.returnId/customerId`, `Payment.cashSessionId/creditNoteId`, `Sale.cashSessionId/customerId`, `SaleReturn.cashSessionId`, `CashMovement.sessionId`, `PurchaseItem.variantId`, `KitComponent` ×2, `GoodsReceipt.attachmentId`) y 17 CHECK (montos ≥ 0, estados, `closedAt ≥ openedAt`, recibido + dañado ≤ pedido, período `AAAA-MM`). Verificado en la base: ya existen y están validadas. **Siguen sin FK:** `Sale.sellerId`, `PurchaseOrder.supplierId`, `GoodsReceipt.supplierId`, `RefreshToken/AuthSession.userId`, `IncentiveEntry.*`, `SupplierCode.variantId`, `InvoiceDraft.attachmentId`. Las nuevas FK causaron una regresión (N-A1) y el modo `NOT VALID` otra (N-M2). |
| D-M4 | Dinero sin clave de idempotencia | **Corregido** | `operationId` en `CashMovement`, `SupplierPayment`, `Expense` (migración `202610210004`, único parcial por NULL); `cash.ts:~775-795`, `admin.ts:idempotent()`; la web genera la clave al abrir el formulario (`Management.tsx:1231,1392,1951`). `t12b.mjs`: 4 envíos simultáneos con la misma clave = 4×`201` y **1 fila** en cada tabla; misma clave con otros datos o en otra caja = `400`; sin clave se conserva el comportamiento anterior (4 filas). |
| D-M5 | Limpieza de borradores borra el adjunto confirmado | **Corregido** | `merchandise.ts:81-101` (`purgeStaleInvoiceDrafts`): el `DELETE … RETURNING` repite `confirmedOperationId IS NULL`; el adjunto sólo se borra si ninguna recepción ni borrador lo usa; FK `GoodsReceipt_attachmentId_fkey` (RESTRICT). Test de carrera con dos sesiones `psql` pasa (`datos-integridad-postgres.test.ts`, 1,9 s). |
| D-M6 | Fotos base64 en consultas calientes | **Parcial** | `cashExpected` ahora usa `select` (`cash.ts:52-62`). **Siguen cargando `proofUrl` completo:** `buildCuadre` (`cash.ts:223,231`, incluso calcula `hasProof` con el texto), `codPending` (`sales.ts:2186`, hasta 500 ventas) y las respuestas de venta/anulación (`sales.ts:1108,1276,1336`). |
| D-M7 | Cola de avisos no transaccional y con datos personales | **Parcial** | Corregido: la anonimización redacta `NotificationOutbox` (`admin.ts:491-514`) y la purga borra los `failed` de más de 30 d. **Abierto:** `notify()` sigue ejecutándose después del commit (`sales.ts:1111`), sin outbox en la misma transacción; `pending` no se purga. |
| D-M8 | Cierre del mes de incentivos en curso | **Corregido** | `incentives.ts:663-669` rechaza `period === businessMonth()`. `t11-incentivos.mjs` (40 ventas simultáneas): `POST /incentives/close {month:"2026-10"}` = `400` «Sólo se cierra un mes terminado…», 0 ventas movidas al mes siguiente. |
| D-M9 | Índices únicos omitidos en silencio | **Parcial** | Reproducido otra vez: con `abc-1` y `ABC-1 ` la migración termina «successfully applied» y falta `Variant_sku_ci_key`. Ahora hay un comando manual en `docs/MIGRACIONES_SEGURAS.md:125` y `docs/DEPLOY-RENDER.md:377`, pero ningún chequeo automático al arrancar ni en `/health`. Las migraciones nuevas repiten el patrón (ver N-M2). |
| D-B1 | Deriva `GoodsReceipt_orderId_fkey` | **Corregido** | `schema.prisma` con `onDelete: Restrict`; `migrate diff` vacío. |
| D-B2 | Prefijos de migración duplicados | **Abierto (histórico)** | Siguen `202610170001_*` ×2 y `202610190001_*` ×2 (ya aplicadas; renombrar rompería `_prisma_migrations`). Las 7 migraciones nuevas tienen prefijo único. |
| D-B3 | Consecutivos por sucursal sobre únicos globales | **Abierto** | `Sale.number` y `SaleReturn.number` siguen `@unique` globales (`schema.prisma:238,347`). Una sucursal. |
| D-B4 | Candado consultivo global en cada commit de stock | **Abierto** | Sin cambios (`202610100101…`). Ahora también lo toma cualquier venta que inserta una `Alert` de transferencia sin verificar (`sales.ts:1048`). |
| D-B5 | Recepción `Serializable` contra ventas | **Abierto** | `t10-recepcion-vs-ventas.mjs`: 5 de 5 recepciones `409` con 40 ventas simultáneas, igual que v1. |
| D-B6 | Venta en caja recién cerrada = 404 genérico | **Abierto** | `t3-cierre.mjs`: 15 de 16 ventas `404 "El registro no existe."`; la consistencia del cuadre es perfecta (0 ventas posteriores al cierre, esperado = recalculado). |
| D-B7 | Zona horaria sin comprobación al arrancar | **Parcial** | Las migraciones nuevas y la retención usan `timezone('UTC', now())` o conversión explícita; Render fuerza `TimeZone=UTC` (`with-cloud-env.mjs:97`). Sigue sin `SHOW TimeZone` al arrancar y sin forzarlo cuando se usa `DATABASE_URL` tal cual (`with-cloud-env.mjs:63-76`). |
| D-B8 | Kardex sin secuencia propia | **Abierto** | Sin cambios; sigue ordenado por `createdAt`. |
| D-B9 | Fusión de lotes adelanta el vencimiento | **Abierto** | Migración `202610160002` sin cambios. |
| D-B10 | Migraciones sólo hacia delante | **Abierto** | Verificado de nuevo que las 37 migraciones se aplican sobre datos antiguos y que `pg_dump`/`pg_restore` funciona, pero la documentación no dice que no hay camino de vuelta. |
| D-B11 | `GET /credit-notes` carga todas las devoluciones | **Abierto** | `sales.ts:1989-1993` sin cambios. |
| D-B12 | Tablas pequeñas sin purga | **Parcial** | `RefreshToken` y `AuthAttempt` ya se purgan (`retention.ts`, `security.ts SecurityMaintenance`); siguen sin purga `AuthSession` y `MerchandiseOperation`. |

## 4. Hallazgos nuevos

### ALTO

#### N-A1 · La clave foránea `CreditNote_customerId_fkey` crea un interbloqueo entre devolución con nota de crédito y venta al mismo cliente (regresión de esta noche)

- **Dónde:**
  - Migración `apps/api/prisma/migrations/202610210002_datos_restricciones/migration.sql` (fila `CreditNote_customerId_fkey`), reflejada en `schema.prisma` (`CreditNote.customer`).
  - Devolución (`sales.ts:1673-1928`): `cashLock` (1673) → `Sale FOR UPDATE` (1674) → `lockVariant` (1731) → contador (1857) → `INSERT CreditNote` (1928).
  - Venta (`sales.ts:578-604`, `common.ts:240`): `cashLock` → **`Customer FOR UPDATE`** (`lockActiveCustomer`, 586) → `lockVariant` (604) → …
- **Por qué:** una clave foránea toma un bloqueo `FOR KEY SHARE` sobre la fila de `Customer` en el momento de insertar la nota. Ese bloqueo choca con el `FOR UPDATE` que la venta ya tiene sobre ese cliente. La devolución ya tiene la variante y espera al cliente; la venta tiene al cliente y espera la variante. Antes de la clave, la devolución nunca tocaba la fila del cliente.
- **Escenario reproducido** (`v2dc/t14-fk-deadlock.mjs 30`): 30 rondas, cada una con 1 devolución `credit_note` de una venta anterior del cliente X y 4 ventas simultáneas a X de la misma variante.
  - **Con la clave:** ventas `201`×32 y `500`×88; devoluciones `201`×24 y `500`×6; **94 `deadlock detected`** en el registro de PostgreSQL. Los procesos implicados: `SELECT … FROM "Customer" … FOR UPDATE`, `SELECT … FROM "Variant" … FOR UPDATE` e `INSERT INTO "CreditNote"` (`v2dc/deadlock-fk-extracto.txt`).
  - **Sin la clave** (`ALTER TABLE "CreditNote" DROP CONSTRAINT "CreditNote_customerId_fkey"` en mi base de prueba): 150 de 150 `201`, **0** interbloqueos.
  - También salió, sin querer, en `t7-timeout.mjs 80`: 4 ventas y la devolución con 500, todas por `40P01`.
- **Alcance:** sólo cuando el cliente de la venta coincide con el de la devolución con nota y comparten variante en una ventana de decenas de milisegundos. Pero **toda venta exige cliente** (`sales.ts:592`, «Selecciona o crea un cliente antes de vender») y las víctimas arrastran a las demás ventas que esperan al cliente. El mismo ciclo existe entre la anonimización (`admin.ts:337`: `Customer FOR UPDATE` y luego actualiza `Sale`) y una devolución de ese cliente (tiene la fila `Sale` y pide el cliente).
- **Impacto:** HTTP 500 «No se pudo completar la operación» en el cobro o en la devolución; los datos quedan consistentes (se deshace la víctima). No hay reintento: `retrySerializable` sólo reconoce `40001`/`P2034` (`inventory-resilience.ts:44-54`) y ni la venta ni la devolución lo usan. Una venta offline que cae en este error se registra como «conflicto» (ver N-M3).
- **Arreglo mínimo:**
  1. En la devolución, antes de `lockVariant`, bloquear al cliente en el mismo orden que la venta: `SELECT id FROM "Customer" WHERE id = $saleCustomerId FOR UPDATE` cuando `sale.customerId` existe y el reembolso es `credit_note`. Con un solo orden global (Cliente → Variante → Contador) el ciclo desaparece.
  2. Reintentar `40P01` y `40001` en `complete()` y en la devolución (son idempotentes por `offlineUuid` / `operationId`).
  3. Añadir una prueba de carrera que haga este par; las pruebas de la rama no lo cubren (la suite `datos-integridad-postgres.test.ts` pasó completa con este defecto presente).

### MEDIO

#### N-M1 · Un descarte de venta offline no impide que la misma venta se registre después

- **Dónde:** `offline-sale-review.ts:101-170` y `offline-sales.ts:40-100` registran `offline_sale_discarded`, pero `SalesController.complete` (`sales.ts:546-575`) sólo comprueba `Sale.offlineUuid`; nada consulta esa bitácora. Verificado por `grep`: `offline_sale_discarded` sólo se escribe, nunca se lee.
- **Escenario reproducido** (`v2dc/t16-discard.mjs`):
  1. La cajera sincroniza una venta offline sin stock: `conflict`, alerta `offline:<uuid>`.
  2. Gerencia la descarta con `POST /sales/offline-review/discard`: `201`, alerta resuelta, bitácora `offline_sale_discarded`, la alerta nueva dice «descartada… el cuadre lo mostrará como sobrante».
  3. Se repone el stock y la caja (que no recibió la respuesta, o que aún tiene la copia en su cola) reenvía el mismo UUID: **`synced`, venta `FS-0002409` creada**, con `offline_sale_discarded` también en la bitácora.
- **Impacto:** el inventario y el dinero se mueven por una venta que gerencia dio por anulada, y el cuadre ya fue explicado como «sobrante». Con respuestas perdidas por mala conexión (justo el caso de uso offline), no es improbable.
- **Arreglo mínimo:** en `complete()`, dentro del candado consultivo del UUID, rechazar con 409 si existe `AuditLog` `offline_sale_discarded` con ese `entityId`.

#### N-M2 · Las restricciones nuevas se agregan `NOT VALID` y sin aviso visible: filas viejas violadoras quedan sin proteger y bloquean sus propias modificaciones

- **Dónde:** `202610210002_datos_restricciones/migration.sql:116-178` (y el mismo patrón en `202610210001`, `202610210003`, `202610200001`). Los fallos sólo producen `RAISE NOTICE` dentro de `EXCEPTION WHEN OTHERS`; `prisma migrate deploy` no muestra esos avisos en el registro de Render y marca la migración como aplicada.
- **Comprobado en PostgreSQL** (tabla temporal con `CHECK (amount >= 0) NOT VALID` y una fila antigua con −5): `UPDATE t SET note='x' WHERE id=1` falla con `new row for relation "t" violates check constraint "amt"`. Un CHECK `NOT VALID` se vuelve a evaluar en cada UPDATE de cada fila, no sólo en las nuevas.
- **Escenario:** si producción tiene una fila anterior que viola alguna de las 17 reglas (pago o venta con importe negativo, caja con `closedAt < openedAt`, línea de compra con recibido + dañado > pedido…), la migración termina bien, nadie lo ve, y después anular, verificar o rechazar esa venta, o recalcular esa caja cerrada (`refreshClosedCash`), devuelve 500 para siempre. Si la migración no pudo agregar una restricción por bloqueo o permisos, la base queda sin ella sin alarma.
- **No verificado:** si en producción existen esas filas (por instrucción no se accedió a ella); en la base de v1 con datos antiguos no hubo ninguna (0 restricciones sin validar).
- **Arreglo mínimo:** (a) comprobar al arrancar y exponer en un endpoint de administración `SELECT conname FROM pg_constraint WHERE NOT convalidated` y los índices/restricciones esperados que falten (cubre también D-M9); (b) antes de desplegar, correr esa consulta sobre una copia de producción y corregir las filas.

#### N-M3 · `/sales/sync` convierte cualquier error transitorio en «conflicto offline»

- **Dónde:** `sales.ts:1161-1215`. El `catch` de cada venta trata igual una regla de negocio y un `40P01`, `P2028`, `P2024` o 503: devuelve `status: "conflict"` con mensaje genérico, crea la alerta `offline_conflict` de severidad alta y la marca de propiedad en la bitácora.
- **Impacto:** un interbloqueo (N-A1) o un pool lleno durante la sincronización de varias ventas guardadas deja ventas buenas bloqueadas como «requiere revisión»; la caja muestra que no se puede cerrar hasta que gerencia las descarte con su PIN (y ver N-M1). Verificado por lectura; el mensaje real que ve la cajera es «No se pudo completar la operación. Revisa la venta e intenta de nuevo.» (`safeErrorMessage`).
- **Arreglo mínimo:** distinguir errores transitorios (`isDatabaseUnavailable`, `40P01`, `40001`) y responder `status: "retry"` sin crear alerta ni bitácora; la cola local reintenta sola con el mismo UUID.

### BAJO

#### N-B1 · La anonimización recorre tablas sin índice por `refId` y la nota de la migración ya es falsa
- `admin.ts:444` (`inventoryMovement … refId IN (…)`) y `admin.ts:495` (`notificationOutbox … refId IN (…)`). `202610210001_datos_indices/migration.sql:11-12` justifica no indexar `InventoryMovement.refId` con «ninguna consulta de la API filtra por refId»: ahora sí. Con 200 000 movimientos cuesta 30 ms (*Parallel Seq Scan*, `explain.sql` Q10); crece con el historial dentro de una transacción de 20 s.
- **Arreglo:** `CREATE INDEX "InventoryMovement_refId_idx"` (y un índice parcial por `refId` en la cola) o filtrar por `branchId, createdAt`.

#### N-B2 · El cupo de PIN corto es de toda la sucursal: una cajera puede dejar sin aprobaciones a todos los gerentes con PIN de 4 o 5 dígitos
- `security.ts:278-295` (`pin-short:<sucursal>`, 10 fallos por hora) y `security.ts:183-250`: cualquier solicitante que escriba un PIN de menos de 6 dígitos y falle 10 veces agota el cupo común; un acierto no lo reinicia («sólo vence con la ventana»). Durante hasta una hora ningún PIN corto aprueba nada, y el gerente que lo usa no puede cambiarlo él mismo (sólo administración).
- Es una elección de diseño explícita en el código; se reporta porque es un bloqueo de disponibilidad provocable por un usuario con permiso mínimo. **Arreglo:** contar el cupo por solicitante (ya existe `pin-requester`) y dejar el de sucursal en un umbral mucho mayor, o forzar el cambio de los PIN cortos en el siguiente inicio de sesión.

#### N-B3 · Las migraciones nuevas fijan `lock_timeout` de 15 s, por encima de la política de 5 s
- `with-cloud-env.mjs:7-9` establece `lock_timeout=5s` para `migrate deploy`, pero cada bloque de datos hace `set_config('lock_timeout','15s',true)` (`202610200001:27`, `202610210001:27`, `202610210002:63`, `202610210003:20,29,63`). Una espera detrás de una escritura larga encola las escrituras de `Sale`/`Payment`/`CashSession` hasta 15 s por objeto (hay 3 índices y 29 restricciones). La restricción de que «una migración nunca espera un bloqueo más de lock_timeout» queda incumplida.
- **Arreglo:** no sobrescribir el valor de la sesión (o usar 3 s) y reintentar el objeto pendiente fuera de horario.

#### N-B4 · Un cobro «sin respuesta» sólo se repite con el mismo UUID si no cambian los pagos
- `POS.tsx:1723-1735`: la clave `attempt` incluye caja, cliente, descuento y carrito, **no los pagos**. Si el primer envío sí llegó al servidor y la cajera cambia el método de pago al reintentar, el servidor rechaza con `400 "El UUID ya corresponde a otra venta"` (`requestHash`, `sales.ts:556`): no hay duplicado, pero la cajera no tiene una salida clara y puede volver a teclear la venta con otro UUID.
- **Arreglo:** al recibir ese 400, mostrar la venta existente (`GET` por `offlineUuid`) en vez de sólo el error.

## 5. Pruebas que no encontraron defecto (verificado)

| Prueba | Script | Resultado |
|---|---|---|
| Doble venta del último producto: stock 1, 12 ventas desde 6 cajas | `t1-ultimo.mjs` | 1×`201`, 11×`400`, stock final 0, contador +1 |
| Consecutivos con rechazos a mitad: 60 ventas simultáneas | `t1-ultimo.mjs` | 52 números contiguos 849–900, contador 900, 0 huecos, 0 duplicados |
| Mismo `offlineUuid` 10 veces en paralelo | `t8.mjs` | 10×`201`, 1 venta, 1 id |
| Doble devolución con 8 claves distintas | `t2-devolucion.mjs` | 1×`201`, 7×`400`, `returnedQty` = 2, stock +2 |
| Misma clave de devolución 8 veces | `t2-devolucion.mjs` | 8×`201`, 1 devolución |
| Devolución contra anulación de la misma venta (×10) | `t2-devolucion.mjs` | nunca se aceptaron ambas |
| Cierre de caja con 15 ventas simultáneas (×5) | `t3-cierre.mjs` | esperado guardado = recalculado, 0 ventas posteriores (ver D-B6) |
| Dos a seis recepciones de la misma orden (×5), misma clave 6 veces, parciales | `t4-recepcion.mjs` | 1 recepción, `receivedQty` = 10, stock +10; misma clave 6×`201` con 1 fila |
| Venta con nota de crédito contra anulación (×100 pares) | `t6-deadlock.mjs` | 100/100 `201/201`, 0 interbloqueos |
| Operaciones de dinero con clave (×4 simultáneas) | `t12b.mjs` | 1 fila por tabla; otra clave o datos = 400 |
| Cierre del mes de incentivos en curso | `t11-incentivos.mjs` | `400`, 0 ventas movidas |
| Ráfaga de 200 ventas, 40 clientes, 6 variantes | `t15-pool.mjs` | 200/200 `201` |
| `pg_dump -Fc` + `pg_restore --exit-on-error` | — | restaura sin errores con todas las restricciones |
| Migraciones sobre datos antiguos | `mig` | 37 migraciones, 0 restricciones sin validar |
| `prisma migrate diff` | — | sin deriva |

## 6. No verificado

- Datos y tamaño reales de producción (Render PostgreSQL 17, plan `0.5c-1g`, disco 5 GB): por instrucción no se accedió. Mis pruebas son sobre PostgreSQL 16; los tests del proyecto usan un PostgreSQL embebido 18.
- Si en producción hay filas viejas que violen las 17 reglas nuevas (N-M2), o si quedaron omitidos los índices únicos de K2/INC (D-M9).
- `tests/reports-memory-postgres.test.ts`, `tests/api.test.ts` y el resto de la suite de integración: no se ejecutaron completas.
- El comportamiento con más de una instancia de la API (relojes desfasados, `RetentionWorker` y `SecurityMaintenance` por instancia) y durante un despliegue gradual.
- La sincronización offline masiva (100 ventas por petición) contra el cierre de caja y contra N-A1.
- Respaldo a Google Drive de extremo a extremo (se leyó `drive-backup.ts`: usa `pg_dump -Fc` en una sola instantánea, arriendo de 60 min con tope de 45, el Dockerfile instala el cliente 17; no se probó contra Google).

## 7. Comandos principales

```bash
D=/var/lib/postgresql/aud-v2-06
su postgres -c "initdb -D $D/pg -U postgres --auth=trust -E UTF8"
su postgres -c "pg_ctl -D $D/pg -o '-p 55616 -c listen_addresses=127.0.0.1 -c timezone=UTC -c deadlock_timeout=200ms' start"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55616/aud?options=-c%20TimeZone%3DUTC" SEED_DEMO_PASSWORD='…'
cd apps/api && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsc -p tsconfig.json
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url …/shadow --script
PORT=3616 node dist/main.js &
node v2dc/setup.mjs                       # cajeras
node v2dc/t14-fk-deadlock.mjs 30          # N-A1 (con y sin CreditNote_customerId_fkey)
node v2dc/t16-discard.mjs                 # N-M1
NEXORA_TEST_PG_URL=postgresql://postgres@127.0.0.1:55616/postgres npx vitest run tests/datos-integridad-postgres.test.ts tests/perf-indexes-postgres.test.ts tests/datos-unit.test.ts
```

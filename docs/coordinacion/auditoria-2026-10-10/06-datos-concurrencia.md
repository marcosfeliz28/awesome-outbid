# Auditoría 06 · Integridad de datos, transacciones, concurrencia y migraciones

**Proyecto:** Nexora POS (`marcosfeliz28/awesome-outbid`, rama `origin/nexora-cloud`, commit `3e5521c`)
**Tipo:** auditoría independiente de SOLO LECTURA. No se modificó ni empujó nada en el repositorio, no se tocó producción, Render ni ninguna base real.
**Fecha:** 2026-10-10

## 1. Resumen

| Severidad  | Cantidad |
|------------|---------:|
| BLOQUEANTE | 0 |
| ALTO       | 2 |
| MEDIO      | 9 |
| BAJO       | 12 |

Las pruebas de carrera con varias conexiones contra la API compilada (doble venta del último producto, doble devolución, devolución contra anulación, cierre de caja durante ventas, dos recepciones de la misma orden, consecutivos de factura, mismo `offlineUuid` y cierre del mes de incentivos durante ventas) **no encontraron corrupción de datos**. Los bloqueos de negocio (`FOR UPDATE` en orden estable, candados consultivos por clave de operación, contador dentro de la transacción) funcionan: los consecutivos `FS-` salieron sin huecos ni duplicados y cada idempotencia probada devolvió una sola fila.

Los riesgos reales están en otros puntos:

- **Rendimiento y capacidad.** Faltan índices en las claves foráneas que se usan dentro de la transacción de venta. Con 100 000 ventas, cada venta pasa de unos 30 ms a unos 100 ms, y todas las ventas de la sucursal se serializan en el contador. A esto se suma un disco de **1 GB** en Render sin ninguna política de retención, con binarios guardados dentro de la base.
- **Interbloqueo demostrado** entre una venta pagada con nota de crédito y la anulación de otra venta pagada con esa misma nota. El cliente recibe un HTTP 500.
- **Integridad declarativa débil.** Faltan claves foráneas y CHECK que la base aceptó sin protestar. Varias operaciones de dinero no tienen clave de idempotencia (movimientos de caja, pagos a proveedor, gastos).
- **Carrera en la limpieza de borradores**, demostrada: borra el adjunto de factura de una recepción ya confirmada.

## 2. Entorno y método

- Worktree desacoplado: `git worktree add --detach …/scratchpad/aud-data origin/nexora-cloud`. Dependencias instaladas con `npx pnpm@11.19.0 install --frozen-lockfile` y API compilada con `tsc`.
- PostgreSQL 16.14 del sistema, propio y temporal, fuera de `/tmp/claude-0`: `/var/lib/postgresql/aud-data06/pg`, puerto 55606, `timezone=UTC`, `deadlock_timeout=200ms`.
- `prisma migrate deploy` sobre una base vacía (31 migraciones), luego `tsx prisma/seed.ts` (846 ventas, 228 variantes).
- API compilada (`node dist/main.js`) en el puerto 3606, con 6 cajeras adicionales, equipos aprobados y cajas abiertas. Los scripts de carrera están en `auditoria-sistema/06-anexos/race/*.mjs` y usan `fetch` concurrente.
- Carga sintética de 100 000 ventas: 200 000 líneas, 100 000 pagos, 300 000 entradas de bitácora, 200 000 movimientos, 200 000 eventos de tiempo real y 200 000 entradas de incentivos (`06-anexos/sql/carga.sql`). Sobre esa carga se hicieron `EXPLAIN (ANALYZE)` (`06-anexos/sql/explain.sql`).
- Deriva: `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url …` (`06-anexos/sql/prisma-migrate-diff.sql`).
- Compatibilidad de migraciones: base `mig` con sólo la migración inicial, datos con forma de ese esquema (`06-anexos/sql/old-data.sql`), luego `migrate resolve --applied 202610030001_initial` y `migrate deploy`.
- Al terminar se detuvieron la API y PostgreSQL, se borró `/var/lib/postgresql/aud-data06` y se eliminó el worktree.

## 3. Hallazgos

### ALTO

#### D-A1 · Faltan índices en las claves foráneas calientes; la venta hace barridos completos mientras retiene el contador de la sucursal

- **Dónde:** `apps/api/prisma/schema.prisma` y `migrations/202610030001_initial`. No existe índice en:
  - `SaleItem.saleId` (`schema.prisma:265-286`)
  - `Payment.saleId` y `Payment.cashSessionId` (`:288-310`)
  - `Sale.cashSessionId` y `Sale.customerId` (`:222-263`)
  - `SaleReturn.saleId` y `SaleReturn.cashSessionId`
  - `AuditLog(entity, entityId)` (`:549-563`)
  - `InventoryMovement.refId`, `CashMovement.sessionId`, `PurchaseItem.orderId`, `CreditNote.customerId`

  PostgreSQL no crea índices para las FK.
- **Por qué importa:** dentro de `SalesController.complete` (`sales.ts:475-1022`), después de bloquear las variantes y el `Counter` `sale:<sucursal>` (`sales.ts:730`), se ejecutan estas consultas:
  - `recordSaleIncentives` (`incentives.ts:263`), que lee los `items` de la venta;
  - `findUniqueOrThrow({include:{items,payments}})` (`sales.ts:1016`);
  - la deuda del cliente (`sales.ts:653`).

  En devoluciones, anulaciones y cierres también corre `cashExpected` (`cash.ts:47-60`), que filtra por `cashSessionId` sin índice. La anonimización (`admin.ts:359`) y las ventas offline en conflicto (`offline-sales.ts:50,109`, `sales.ts:1094`) buscan en `AuditLog` por `entityId`.
- **Evidencia, con 100 000 ventas (`06-anexos/sql/explain.sql`):**
  - Q1, `SaleItem WHERE saleId IN ($1)`: *Parallel Seq Scan*, 67 444 filas descartadas por proceso, 15,7 ms.
  - Q2, `Payment WHERE saleId`: *Seq Scan*, 14,2 ms.
  - Q3, `cashExpected`: *Seq Scan* en `Payment`, 13,6 ms.
  - Q4, deuda del cliente: 14,6 ms.
  - Q5, `AuditLog` por `entityId`: 34 ms.
  - Q7, ventas de una caja: 19,4 ms.
  - Q10, kardex por `refId`: 15,7 ms.
  - El registro de PostgreSQL (`log_min_duration_statement=5ms`) muestra que **cada venta** ejecuta 2 o 3 barridos de `SaleItem` y `Payment` de unos 19 ms.
  - Latencia de una venta por API: unos 30 ms con la semilla, entre 85 y 115 ms con la carga.
  - 80 ventas simultáneas del mismo producto: 2,5 s antes de la carga y **7,6 s** después. La anulación concurrente tardó **4,7 s**, contra el límite por defecto de 5 s.
  - Con los índices de prueba, todas esas consultas bajan a menos de 0,2 ms, la venta a unos 60 ms y las 80 ventas a 3,3 s.
  - Producción usa `plan: 0.1c-256mb` (`render.yaml:69`), es decir, 0,1 CPU: los barridos serán varias veces más lentos que en este equipo.
- **Escenario reproducible:**
  1. `psql -f 06-anexos/sql/carga.sql`
  2. `psql -f 06-anexos/sql/explain.sql`
  3. `node race/t9-una.mjs` y `node race/t7-timeout.mjs 80`
  4. `CREATE INDEX` de prueba y repetir.
- **Impacto:** la degradación crece de forma lineal con la historia. Como la venta mantiene el bloqueo del contador por sucursal mientras hace esos barridos, el rendimiento máximo de la tienda cae con el tiempo, y las transacciones con el límite de 5 s (anulación, devolución, cierre) se acercan a expirar.
- **Arreglo propuesto:** una migración con `CREATE INDEX CONCURRENTLY IF NOT EXISTS` (fuera de transacción, o en una migración propia) para:
  - `SaleItem("saleId")`
  - `Payment("saleId")` y `Payment("cashSessionId")`
  - `Sale("cashSessionId")`, `Sale("customerId")` y `Sale("branchId","createdAt")`
  - `SaleReturn("saleId")` y `SaleReturn("cashSessionId")`
  - `AuditLog("entityId","entity")`
  - `InventoryMovement("refId")`, `CashMovement("sessionId")`, `PurchaseItem("orderId")`, `CreditNote("customerId")`

  Además, reflejarlos con `@@index` en `schema.prisma` y tomar el contador lo más tarde posible: justo antes de `sale.create`, cosa que ya ocurre, y no volver a leer la venta completa dentro de la transacción.

#### D-A2 · Capacidad: disco de 1 GB, binarios dentro de la base y ninguna tabla con retención (salvo los avisos enviados)

- **Dónde:**
  - `render.yaml:66-73`: `nexora-pos-db`, `plan: 0.1c-256mb`, `diskSizeGB: 1`.
  - `InvoiceAttachment.data Bytes` (`schema.prisma:663-670`; hasta 5 MB por archivo, `merchandise.ts:164`). Sólo se borran los borradores sin confirmar de más de 7 días, y sólo cuando alguien sube otra factura (`merchandise.ts:246-264`).
  - `Payment.proofUrl` guarda la foto como *data URL* en base64, hasta 2 MB × 1,33 por pago (`sales.ts:64`, `sales.ts:1944`).
  - Crecen sin purga: `AuditLog`, `RealtimeEvent` (una fila por cada cambio de stock, por el disparador de `202610040006_round3`), `InventoryMovement`, `IncentiveEntry`, `RefreshToken` y `AuthSession` vencidos, `AuthAttempt`, `MerchandiseOperation`, y `NotificationOutbox` en estado `failed` o `pending`. Sólo `NotificationOutbox` en estado `sent` se purga (`notifications.ts:847-854`).
- **Evidencia (`race/t13-tamano.mjs`):** 600 ventas reales de 2 líneas por API ocuparon unos **3 470 bytes por venta** entre tablas e índices. A 300 ventas al día son unos 380 MB al año, sin contar adjuntos ni fotos. Dos facturas de 1 MB al día suman unos 730 MB al año más. Con 1 GB, el disco se llena en meses o en 1 a 2 años, según el uso. **No verificado:** el volumen real de producción.
- **Impacto:** cuando el disco se llena, PostgreSQL deja de aceptar escrituras y la tienda no puede vender.
- **Arreglo propuesto:**
  - Mover los binarios (`InvoiceAttachment.data` y `Payment.proofUrl`) a un almacenamiento de objetos, o al menos a una tabla aparte con un límite de tamaño.
  - Agregar un trabajo de retención: `RealtimeEvent` de más de 1 día; `RefreshToken` y `AuthSession` vencidos; `AuthAttempt` antiguos; `NotificationOutbox` `failed` de más de N días; `MerchandiseOperation` antiguos.
  - Para `AuditLog`, archivar o particionar por mes.
  - Configurar una alerta de disco en Render y ampliar `diskSizeGB`.

### MEDIO

#### D-M1 · Interbloqueo demostrado: venta pagada con nota de crédito contra anulación de una venta pagada con la misma nota

- **Dónde:**
  - La venta bloquea las variantes ordenadas (`sales.ts:531-532`) y **después** la nota con `SELECT … FROM "CreditNote" … FOR UPDATE` (`sales.ts:698`).
  - La anulación actualiza la nota (`creditNote.update … increment`, `sales.ts:1278-1286`), lo que toma el bloqueo de fila, y **después** bloquea las variantes (`sales.ts:1291-1294`).
  - Es un orden de bloqueo inverso. Las cajas no los serializan cuando las ventas pertenecen a sesiones distintas.
- **Escenario reproducible (`race/t6-deadlock.mjs`):**
  1. Generar una nota de crédito grande: venta de 40 unidades y devolución como `credit_note`.
  2. Repetir: la cajera 3 vende la variante V pagando con la nota N; luego, en paralelo, el administrador anula esa venta mientras la cajera 4 vende V pagando con N.
  - **Resultado:** `deadlock detected` en el registro de PostgreSQL (`06-anexos/deadlock-log.txt`):
    `Process 11561: SELECT id FROM "Variant" … FOR UPDATE` / `Process 10506: SELECT id FROM "CreditNote" … FOR UPDATE`.
  - 9 interbloqueos en 2 corridas. En la segunda corrida, 2 de 25 anulaciones terminaron en **HTTP 500** «No se pudo completar la operación».
  - Los datos quedan consistentes: se deshace la víctima.
- **Impacto:** error 500 en la anulación o en la venta en caja, que puede ser la víctima. No hay reintento automático: `retrySerializable` no reconoce `40P01` (`inventory-resilience.ts:44-54`) y la venta no reintenta.
- **Arreglo propuesto:** un orden global de bloqueo. Por ejemplo, en la anulación, bloquear las notas con `SELECT … FOR UPDATE` ordenadas **después** de las variantes, o en la venta bloquear las notas antes que las variantes; lo importante es que sea el mismo orden en todas las rutas. Además, reintentar `40P01` y `40001` con la misma clave de idempotencia.

#### D-M2 · Pool de Prisma y tiempos de transacción por defecto: errores 500 bajo ráfaga y operaciones con 5 s

- **Dónde:**
  - `common.ts:22-29`: `PrismaClient` sin `connection_limit`, `pool_timeout` ni `transactionOptions`. La URL no los define (`deploy/render/with-cloud-env.mjs:27-30`, `.env.example`).
  - Valores por defecto de Prisma 6: pool de `num_cpus*2+1`, `maxWait` de 2 s y `timeout` de 5 s.
  - Usan el `timeout` de 5 s: devolución (`sales.ts:1517`), anulación (`sales.ts:1209`), cierre de caja (`cash.ts:820`), verificación y rechazo de pagos (`sales.ts:1397,1462`) y abonos (`sales.ts:2083`).
  - La venta usa 20 s (`sales.ts:1021`) y la recepción 15 s (`inventory.ts:1013`).
- **Evidencia (`race/t7-timeout.mjs`):**
  - 400 ventas simultáneas: 57 respuestas **500**, por `P2028 "Unable to start a transaction in the given time"` (`maxWait`).
  - 120 ventas con la carga de 100 000: 31 respuestas 500.
  - Con 80 ventas sobre la carga, la anulación tardó 4,7 s, muy cerca del límite de 5 s, aunque terminó.
- **Impacto:** en el plan de Render (0,5 CPU para la API), el pool puede ser muy pequeño; con informes largos y el sondeo de tiempo real cada 150 ms, una caja puede recibir 500 al cobrar. **No verificado:** el tamaño del pool en Render.
- **Arreglo propuesto:**
  - Fijar `connection_limit` y `pool_timeout` en la URL.
  - Dar a devolución, anulación y cierre un `timeout` explícito, como la venta.
  - Medir la latencia P95 de la transacción de venta.
  - Ante `P2028`, responder 503 reintentable en vez de 500.

#### D-M3 · Faltan restricciones declarativas (FK y CHECK) frente a las reglas de negocio

- **Dónde:** `schema.prisma` y las migraciones. Las únicas FK son las de `User`, `Product`, `Variant`, `Lot`, `InventoryMovement`, `SaleItem`, `Payment.saleId`, `SaleReturn.saleId`, `PurchaseItem.orderId`, `GoodsReceipt.orderId` y `Expense`. No tienen FK:
  - `Sale.customerId`, `Sale.sellerId`, `Sale.cashSessionId`
  - `Payment.cashSessionId`, `Payment.creditNoteId`
  - `SaleReturn.cashSessionId`
  - `CreditNote.returnId` (es `@unique` pero sin FK) y `CreditNote.customerId`
  - `CashMovement.sessionId`
  - `PurchaseOrder.supplierId`, `PurchaseItem.variantId`
  - `GoodsReceipt.supplierId` y `GoodsReceipt.attachmentId`
  - `KitComponent.*`
  - `IncentiveEntry.*` e `IncentiveRate.categoryId`
  - `SupplierCode.variantId`, `InvoiceDraft.attachmentId`, `RefreshToken.userId`, `AuthSession.userId`

  Los CHECK existentes cubren sólo `stock` (con disparador), `price`, `costAvg`, `Lot.qty`, `SaleItem.qty` y `returnedQty`, `creditBalance`, `CreditNote.balance` y `creditLimit`.
- **Evidencia (`06-anexos/sql/restricciones.sql`, todo dentro de `BEGIN … ROLLBACK`):** la base **aceptó**:
  - `PurchaseItem.receivedQty > qty`
  - un pago de −500 en una caja inexistente
  - un `CashMovement` de tipo `'robo'`, con monto negativo y caja inexistente
  - una `CreditNote` de una devolución inexistente
  - una venta con `total=-1`, `status='lo-que-sea'` y cliente y caja inexistentes
  - una caja cerrada antes de abrirse
  - un `KitComponent` de variantes inexistentes con cantidad −3
  - un `IncentiveEntry` con `period='2026-13'`
  - una devolución con total negativo

  Sólo el stock negativo fue rechazado, por el disparador.
- **Impacto:** las reglas dependen sólo de la aplicación. Un error de código, un script de reparación o una restauración parcial deja huérfanos o importes imposibles sin que nadie lo note (ver también D-M5).
- **Arreglo propuesto:** migraciones `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY … NOT VALID` seguidas de `VALIDATE CONSTRAINT`, para no bloquear tablas grandes. Por ejemplo:
  - FK: `CreditNote.returnId → SaleReturn`, `Payment.cashSessionId → CashSession`, `CashMovement.sessionId → CashSession`, `PurchaseItem.variantId → Variant`, `KitComponent → Variant` (×2), `Sale.customerId → Customer`, `Sale.cashSessionId → CashSession`.
  - CHECK con `NOT VALID`: `amount > 0` en `Payment`, `CashMovement`, `Expense` y `SupplierPayment`; `total >= 0`; `status IN (…)`; `"receivedQty" + "damagedQty" <= qty`; `"closedAt" >= "openedAt"`; `period ~ '^\d{4}-(0[1-9]|1[0-2])$'`.

#### D-M4 · Operaciones de dinero sin clave de idempotencia: un doble clic o un reintento duplica el registro

- **Dónde:**
  - `POST /cash-sessions/:id/movements` (`cash.ts:630-700`)
  - `POST /supplier-payments` (`admin.ts:428-…`)
  - `POST /expenses` (`admin.ts:491-…`)

  Ninguno acepta `operationId`, y los modelos `CashMovement`, `SupplierPayment` y `Expense` no tienen una columna única para ello. Sí existe idempotencia en ventas (`offlineUuid`), abonos (`Payment.idempotencyKey`), devoluciones (`SaleReturn.operationId`), recepciones (`GoodsReceipt.operationId`) y mercancía (`MerchandiseOperation`).
- **Escenario (`race/t12-idempotencia.mjs`):** dos envíos idénticos en paralelo de cada operación. Resultado: «Movimiento de caja x2: 201,201 filas nuevas: 2», «Pago a proveedor x2: 201,201 filas nuevas: 2», «Gasto x2: 201,201 filas nuevas: 2».
- **Impacto:** un retiro de caja duplicado cambia el efectivo esperado del cuadre; un pago a proveedor duplicado reduce de más la cuenta por pagar; un gasto duplicado distorsiona los reportes.
- **Arreglo propuesto:** columna `operationId UUID UNIQUE` en las tres tablas, generada por la interfaz una vez por formulario, con el mismo patrón que `SaleReturn` (candado consultivo y devolución de la fila existente).

#### D-M5 · Carrera demostrada: la limpieza de borradores borra el adjunto de una recepción recién confirmada

- **Dónde:**
  - `merchandise.ts:246-264`: al subir una factura, se leen los borradores «sin confirmar y de más de 7 días» **sin bloqueo** y luego se ejecuta `deleteMany({ id: { in } })` del borrador y de su adjunto, sin volver a comprobar `confirmedOperationId`.
  - La confirmación (`merchandise.ts:412`, `:734`, `:744`) bloquea el borrador, crea la recepción con `attachmentId` y marca `confirmedOperationId`.
  - No hay FK de `GoodsReceipt.attachmentId` hacia `InvoiceAttachment`.
- **Escenario (`06-anexos/sql/borrador-carrera.sql`, dos sesiones `psql`):**
  1. La sesión A, que hace las mismas sentencias que la confirmación, bloquea el borrador, inserta la recepción con el adjunto, marca el borrador como confirmado y espera 2 s antes de confirmar.
  2. La sesión B, que hace las mismas sentencias que la limpieza en READ COMMITTED, ve el borrador como «stale», su `DELETE` espera el bloqueo y, cuando A confirma, borra.
  - **Resultado final:** `recepcion=3333… | attachmentId=1111… | adjunto_existe=0 | borrador_existe=0`.
- **Impacto:** se pierde para siempre la factura del proveedor de una compra ya registrada, que es evidencia para el 606. La probabilidad es baja: requiere un borrador de más de 7 días confirmado justo mientras otro usuario sube otra factura.
- **Arreglo propuesto:** en el `deleteMany`, repetir la condición (`confirmedOperationId: null`, `createdAt < …`). Borrar los adjuntos sólo si ninguna `GoodsReceipt` los referencia (`NOT EXISTS`). Agregar la FK `GoodsReceipt.attachmentId → InvoiceAttachment ON DELETE RESTRICT`.

#### D-M6 · Las fotos de evidencia (base64 en `Payment.proofUrl`) se cargan en consultas calientes

- **Dónde:**
  - `cashExpected` (`cash.ts:48`) usa `payment.findMany` sin `select`, así que trae todas las columnas, incluida `proofUrl`. Se ejecuta en el cierre, en la devolución en efectivo, en la anulación después del cierre y en `refreshClosedCash`.
  - También `codPending` (`sales.ts:2005`, `include: { payments: true }`, `take: 500`) y `include: { payments: true }` en la venta (`sales.ts:1016`).
- **Evidencia (SQL, dentro de una transacción que se deshizo):** 20 abonos con foto de unos 1,3 MB en una caja hacen que la consulta de `cashExpected` transfiera **26 MB** (51 ms) para sumar 118 importes.
- **Impacto:** memoria en la API (512 MB en Render), tiempo dentro de transacciones que retienen el bloqueo de la caja, y tráfico con una base de 256 MB de RAM.
- **Arreglo propuesto:** `select` explícito sin `proofUrl` en `cashExpected` y en los listados. Mejor aún, mover la evidencia a otra tabla o a almacenamiento de objetos (ver D-A2).

#### D-M7 · La cola de avisos no es un outbox transaccional y conserva datos personales tras la anonimización

- **Dónde:**
  - `notify()` (`notifications.ts:636-656`) se llama **después** del commit, en un `async` sin esperar: vuelve a leer la venta y hace `INSERT … ON CONFLICT DO NOTHING`. Si el proceso muere entre el commit y el `enqueue`, el aviso se pierde sin rastro.
  - El texto incluye el nombre del cliente (`notifications.ts:171-172`, `:343-349`).
  - La anonimización (`admin.ts:295-404`) limpia `AuditLog`, `Sale` y `Alert`, pero no `NotificationOutbox`.
  - La purga sólo borra `status='sent'` de más de 30 días (`notifications.ts:847-854`): las filas `failed` y `pending` quedan para siempre.
  - El patrón de reclamo `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)` con arriendo de 120 s es correcto y está **verificado por lectura**.
- **Impacto:** avisos perdidos tras un reinicio, y el nombre de un cliente anonimizado retenido en la base.
- **Arreglo propuesto:**
  - Insertar la fila del outbox dentro de la misma transacción de negocio, aunque sea con texto mínimo, y renderizar en el trabajador.
  - Incluir `NotificationOutbox` en la anonimización: borrar o redactar por `refId` de las ventas del cliente.
  - Purgar `failed` después de N días.

#### D-M8 · Se puede cerrar el mes de incentivos en curso, y el cierre es irreversible

- **Dónde:** `incentives.ts:662`. Sólo se rechaza `period > businessMonth()`, así que se acepta cerrar el mes actual a mitad de mes. No existe una ruta para reabrirlo.
- **Escenario (`race/t11-incentivos.mjs`, el 10 de octubre de 2026):** `POST /incentives/close {month:"2026-10"}` respondió 201 con 40 ventas concurrentes. La consistencia se mantuvo: 6 liquidaciones, 0 diferencias entre liquidación y entradas, ninguna entrada del mes creada después del cierre. Pero **15 ventas de octubre pasaron a noviembre** con nota, y todo el resto de octubre contará en noviembre.
- **Impacto:** un clic prematuro de la administración altera el pago de incentivos de todas las cajeras y no se puede corregir.
- **Arreglo propuesto:** permitir el cierre sólo de meses ya terminados (`period < businessMonth()`), o pedir una confirmación explícita con el número de días restantes. Agregar una reapertura auditada, sólo para administración, si no hay liquidaciones pagadas.

#### D-M9 · Migraciones que «nunca fallan»: índices únicos que se omiten en silencio y dejan esquemas distintos entre instalaciones

- **Dónde:**
  - `migrations/202610170001_variant_code_unique/migration.sql:750-828`: `Variant_sku_ci_key` y `Variant_barcode_ci_key` se omiten si hay duplicados al migrar.
  - `migrations/202610190001_incentives/migration.sql:953-985`: los cuatro únicos de incentivos se omiten si hay repetidos.
  - En ambos casos queda sólo un `NOTICE` y una fila `AuditLog k2_code_index_skipped`, y `prisma migrate deploy` marca la migración como aplicada.
- **Escenario:** base `mig` con `abc-1` y `ABC-1 ` (`06-anexos/sql/old-data.sql`), luego `migrate deploy`. Resultado: «All migrations have been successfully applied», `pg_indexes` sólo muestra `Variant_barcode_ci_key`, y `AuditLog` contiene `{"index":"Variant_sku_ci_key","duplicateKeys":1,…}`.
- **Impacto:** la unicidad sin distinguir mayúsculas depende de cada instalación y sólo la protege `assertCodesFree` (`catalog.ts:86`, candado consultivo). Prisma no detecta la ausencia del índice (Prisma no modela índices de expresión) y nadie lee ese `AuditLog`. **No verificado:** si en producción quedaron omitidos.
- **Arreglo propuesto:** una comprobación al arrancar o en `/health`: `SELECT indexname FROM pg_indexes WHERE indexname IN (…)`, con una alerta visible. Una migración posterior que corrija los duplicados de forma determinista, o que falle con un mensaje claro. Documentar el procedimiento.

### BAJO

#### D-B1 · Deriva entre `schema.prisma` y las migraciones en `GoodsReceipt_orderId_fkey`
- `prisma migrate diff` (migraciones → schema) produce: `DROP CONSTRAINT "GoodsReceipt_orderId_fkey"; ADD … ON DELETE SET NULL`. Las migraciones lo crearon `ON DELETE RESTRICT` (`202610030001_initial:623`). El schema tiene la relación opcional sin `onDelete` (`schema.prisma:399`), cuyo valor implícito es `SetNull`.
- **Impacto:** un `prisma migrate dev` futuro generaría ese cambio sin que nadie lo pida; borrar una orden dejaría recepciones sin orden.
- **Arreglo propuesto:** `onDelete: Restrict` explícito en `schema.prisma:399`.
- No hay otra deriva. Los CHECK, disparadores e índices parciales y de expresión no son visibles para Prisma: están documentados sólo en comentarios.

#### D-B2 · Prefijos de migración duplicados
- `202610170001_perf_indexes` / `202610170001_variant_code_unique` y `202610190001_incentives` / `202610190001_sale_item_promotion_name`. Prisma las ordena por nombre completo y hoy funciona, pero el orden depende del sufijo alfabético y complica las fusiones entre ramas.
- **Arreglo propuesto:** usar marcas de tiempo únicas en adelante.

#### D-B3 · Consecutivos por sucursal sobre números únicos globales (defecto latente si se habilita una segunda sucursal)
- `Counter` usa la clave `sale:<branchId>` y `return:<branchId>` (`sales.ts:731`, `:1717`), pero `Sale.number` y `SaleReturn.number` son `@unique` globales (`FS-0000001`, `NC-000001`).
- Una segunda sucursal chocaría con `P2002` en su primera venta. Como el incremento del contador se deshace con el error, quedaría bloqueada para siempre.
- Hoy `DECISIONES.md:4` dice «una sucursal».
- **Arreglo propuesto:** prefijo de sucursal en el número o `@@unique([branchId, number])`.
- Positivo: dentro de una sucursal, los consecutivos no tienen huecos ni duplicados (`race/t1-ultimo.mjs`, T5: 60 ventas concurrentes con 8 rechazos por stock; 52 números contiguos 848-899, contador = 899, 0 huecos, 0 duplicados).

#### D-B4 · Candado consultivo global en cada commit que cambia stock
- `202610040007_commit_events` y `202610100101` (disparador diferido `stock_event` con `pg_advisory_xact_lock(734918203)`). Todas las transacciones de **todas las sucursales** que tocan `Variant.stock` o insertan `Alert` se serializan en el commit, para que el `id` de `RealtimeEvent` respete el orden de commit.
- El trabajo dentro del candado es corto y no se observó contención, pero es un punto único de serialización.
- **Arreglo propuesto:** a futuro, `LISTEN/NOTIFY` o un `xid8`/`pg_current_xact_id()` con lectura por instantánea.
- Además, el índice `RealtimeEvent_branchId_id_idx` no lo usa el sondeo (`realtime.ts:120`, filtra sólo por `id`): `idx_scan=0`.

#### D-B5 · Recepción `Serializable` contra ventas `READ COMMITTED` del mismo producto
- `inventory.ts:826-1013` y `merchandise.ts:767`. La instantánea serializable se toma en la primera sentencia; si una venta modifica la variante antes del `FOR UPDATE`, la recepción falla con `40001`. `retrySerializable` reintenta 5 veces en menos de 150 ms (`inventory-resilience.ts:58-79`) y no reconoce `40P01`.
- **Evidencia (`race/t10-recepcion-vs-ventas.mjs`):** con 40 ventas simultáneas del mismo producto, 5 de 5 recepciones respondieron **409** «Otra operación modificó el inventario». Con una caja vendiendo sin pausa (`t10b.mjs 0`), 1 de 20 respondió 409; con 100 ms y con 500 ms entre ventas, 0 de 20.
- Sólo ocurre con contención extrema.
- **Arreglo propuesto:** tomar los bloqueos de variante antes de la primera lectura, o usar READ COMMITTED con `FOR UPDATE`, como la venta.

#### D-B6 · Una venta en una caja que acaba de cerrarse responde 404 «El registro no existe.»
- `cashLock` (`sales.ts:284-291`) usa `findFirstOrThrow` con `closedAt: null`. El `P2025` resultante se traduce a 404 genérico (`common.ts:715-717`).
- **Evidencia (`race/t3-cierre.mjs`):** 5 rondas de cierre con 15 ventas concurrentes. **Consistencia perfecta** (esperado guardado = recalculado, 0 ventas posteriores al cierre), pero las ventas rechazadas reciben 404.
- **Arreglo propuesto:** un mensaje explícito, «La caja se cerró; abre una nueva para seguir cobrando», con un código que la caja sepa manejar.

#### D-B7 · Zona horaria: protegida por la cadena de conexión, sin comprobación al arrancar
- Las fechas son `timestamp(3)` sin zona en UTC. Los rangos por día usan `-04:00` fijo, correcto porque la República Dominicana no tiene horario de verano (`reports.ts:37-41`, `sales.ts:1161`, `alerts.ts:231-233`). El SQL crudo usa `utc()` (`reports.ts:50-51`). El vencimiento y el mes de incentivos se calculan en `America/Santo_Domingo` (`packages/shared/src/index.ts:673-685`, `incentives.ts:126`).
- **Verificado (`race/tz.mjs`):** Prisma envía los `Date` como `timestamptz`; con la sesión en `America/Santo_Domingo`, una consulta cruda **sin** `utc()` se corre 4 h (`2025-06-01 00:00` frente a `04:00`). Los valores por defecto `CURRENT_TIMESTAMP` (usados por `RealtimeEvent.createdAt` desde el disparador y por las filas de `AuditLog` que insertan las migraciones) guardarían la hora local.
- Hoy se fuerza `TimeZone=UTC` en `compose.yaml`, en el instalador (rol y servidor) y en `with-cloud-env.mjs`. Este último **no** lo fuerza si no existe `RENDER_DATABASE_URL` y se usa `DATABASE_URL` tal cual (`deploy/render/with-cloud-env.mjs:9-13`).
- **Arreglo propuesto:** comprobar `SHOW TimeZone` al iniciar y negarse a arrancar si no es UTC; usar `timezone('UTC', now())` en los valores por defecto de SQL.
- Sobre las 11 p. m. frente a la medianoche: no existe en el código un «día comercial» con corte distinto de la medianoche de Santo Domingo. Una caja abierta que cruza la medianoche aparece repartida en dos días en los reportes por fecha; el cuadre por sesión es correcto.

#### D-B8 · El kardex no tiene secuencia propia
- `InventoryMovement` se ordena por `createdAt`, hora de la aplicación con precisión de milisegundos (`inventory.ts:505-512`). Hay empates: 2 grupos de la misma variante y la misma marca en la base de prueba, y el orden puede cambiar entre instancias con relojes desfasados.
- **Arreglo propuesto:** columna `seq BIGSERIAL` o `bigint GENERATED ALWAYS AS IDENTITY`, y ordenar por ella.

#### D-B9 · La fusión histórica de lotes adelanta el vencimiento de unidades reales
- `202610160002_lot_identity_reconciliation:655-679`. Lotes con el mismo código normalizado y vencimientos distintos se funden en uno con el vencimiento **más cercano**.
- **Evidencia (base `mig`):** `lot-7` (10 u., 2027-03-01) + `LOT-7` (15 u., 2027-05-01) + ` Lot-7 ` (5 u., sin fecha) quedan en un solo lote de 30 u. con vencimiento 2027-03-01 y costo ponderado 103,33. Queda registro en `LotIdentityConflict`, y las asignaciones JSON y las FK se reescribieron bien.
- Es conservador desde el punto de vista sanitario, pero hace que unidades buenas se bloqueen como vencidas antes de tiempo.
- **Arreglo propuesto:** un informe posterior a la migración para revisar esos lotes.

#### D-B10 · Migraciones sobre datos antiguos y restauración de respaldos
- **Verificado:** las 30 migraciones posteriores a la inicial se aplicaron sin errores sobre datos con forma del esquema inicial: lotes duplicados, lote huérfano en el kardex, cajas cerradas sin diferencias y pagos sin `cashSessionId`. Rellenaron `differenceCash=-10`, `Payment.cashSessionId`, `taxIncluded=false` (desde los ajustes vigentes), anularon el `lotId` huérfano y mantuvieron `stock = suma de lotes`.
- Por lo tanto, **restaurar un respaldo de una versión anterior y ejecutar `migrate deploy`** (que es lo que hace `preDeployCommand`, `render.yaml:41`) funciona.
- Lo contrario no está soportado: no hay migraciones de bajada. Restaurar un respaldo más nuevo y volver a una versión anterior de la API falla, por ejemplo, al insertar `Lot` sin `lotNumberNormalized NOT NULL` y sin valor por defecto.
- `202610160002` exige la colación ICU `und-x-icu`, o detiene el despliegue.
- **Arreglo propuesto:** documentar «sólo hacia delante», y que un retroceso de código exige restaurar el respaldo previo a la migración.

#### D-B11 · `GET /credit-notes` carga todas las devoluciones de la sucursal
- `sales.ts:1816-1828`: `saleReturn.findMany` sin filtro ni límite para construir `returnId IN (…)`. Es O(n) en memoria y genera un `IN` enorme con los años.
- **Arreglo propuesto:** `JOIN` o filtro `returnId` por relación, con `where` sobre `CreditNote` y `take`.

#### D-B12 · Tablas pequeñas sin purga y sesiones vencidas
- `RefreshToken` (vence a los 7 días, `auth.ts:171`), `AuthSession`, `AuthAttempt` (una fila por cuenta e IP) y `MerchandiseOperation` no se purgan nunca. Es un problema de higiene: no afecta la integridad, pero sí el tamaño y la exposición de datos.
- **Arreglo propuesto:** incluirlas en el trabajo de retención de D-A2.

## 4. Pruebas de carrera que no encontraron defecto (verificado)

| Prueba | Script | Resultado |
|---|---|---|
| Doble venta del último producto: stock 1, 12 ventas simultáneas desde 6 cajas | `t1-ultimo.mjs` | 1 × 201, 11 × 400 «Stock insuficiente», stock final 0, contador +1 |
| Consecutivos bajo concurrencia, con rechazos a mitad de transacción | `t1-ultimo.mjs` (T5) | 52 números contiguos, 0 huecos, 0 duplicados |
| Mismo `offlineUuid` 10 veces en paralelo | `t1-ultimo.mjs` (T8) | 10 × 201, 1 venta en la base, 1 id |
| Doble devolución de las 2 unidades con 8 claves distintas | `t2-devolucion.mjs` | 1 × 201, 7 × 400, `returnedQty`=2, stock +2 |
| Misma clave de devolución 8 veces | `t2-devolucion.mjs` | 8 × 201, 1 devolución |
| Devolución contra anulación de la misma venta (×10) | `t2-devolucion.mjs` | Nunca se aceptaron ambas |
| Misma clave de devolución en otra venta | `t2-devolucion.mjs` | 400 «El UUID ya corresponde a otra devolución» |
| Cierre de caja con 15 ventas simultáneas (×5) | `t3-cierre.mjs` | Esperado = recalculado, 0 ventas posteriores al cierre (ver D-B6) |
| Dos a seis recepciones de la misma orden con claves distintas (×5) | `t4-recepcion.mjs` | 1 recepción, `receivedQty`=10, stock +10 |
| Misma clave de recepción 6 veces | `t4-recepcion.mjs` | 6 × 201, 1 recepción |
| Recepciones parciales concurrentes (3 de 5 sobre un pedido de 10) | `t4-recepcion.mjs` | 2 aceptadas, 1 rechazada |
| Cierre del mes de incentivos con 40 ventas concurrentes | `t11-incentivos.mjs` | Liquidación = entradas; ninguna entrada en un mes cerrado (ver D-M8) |
| Invariantes después de las pruebas | SQL | `SaleItem` sin ventas huérfanas; pagos de venta = total; lotes ≤ stock; en productos con lote, stock = suma de lotes |

Otros puntos verificados:

- **Dinero:** todas las columnas de dinero y cantidad son `Decimal`; no hay `Float` en el esquema. `Counter.value Int` y `RealtimeEvent.id BigInt` son adecuados.
- **Contador:** `upsert` del `Counter` dentro de la transacción. Es gapless porque el incremento se deshace junto con la venta.
- **Venta:** orden de bloqueo `advisory(offlineUuid) → CashSession → Customer → Variant (ordenadas) → CreditNote (ordenadas) → Counter`.
- **Devolución:** `advisory(operationId) → CashSession → Sale → Variant → Counter`.
- **Anulación:** `CashSession(original) → [CashSession propia] → Sale → CreditNote → Variant`. Es el origen de D-M1.

## 5. No verificado

- El volumen real, el tamaño de disco ocupado, el tamaño del pool y la latencia de producción en Render. Tampoco si en producción quedaron omitidos los índices de K2 o de INC (D-M9). Por instrucción, no se accedió a producción.
- El comportamiento con varias instancias de la API con relojes desfasados (D-B8) y durante un despliegue gradual.
- La ruta de recepción de Mercancía con orden (`merchandise.ts:453`) contra `purchase-orders/:id/receive` al mismo tiempo. Por lectura, las dos bloquean `PurchaseOrder FOR UPDATE` y son `Serializable`, pero no se ejecutó la carrera mixta.
- La sincronización offline masiva (`/sales/sync`, 100 ventas por petición) frente al cierre del mes y al de caja; sólo se revisó el código.
- La creación concurrente de un `Counter` nuevo, por ejemplo la primera devolución de una sucursal. Prisma 6 debería usar un `upsert` nativo (`ON CONFLICT`); no se observó en el registro.
- El instalador de Windows y su PostgreSQL (ICU, `TimeZone`): sólo se revisaron los scripts.

## 6. Comandos principales usados

```bash
# Base temporal
D=/var/lib/postgresql/aud-data06; mkdir -p $D; chown postgres:postgres $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/pg -U postgres --auth=trust -E UTF8"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/pg -o '-p 55606 -c listen_addresses=127.0.0.1 -c unix_socket_directories=$D -c timezone=UTC -c deadlock_timeout=200ms' -l $D/log.txt start"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55606/aud?options=-c%20TimeZone%3DUTC"
cd apps/api && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsc -p tsconfig.json
# Deriva
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://postgres@127.0.0.1:55606/shadow --script
# API y carreras
PORT=3606 JWT_SECRET=… node dist/main.js &
node race/t1-ultimo.mjs; node race/t2-devolucion.mjs; node race/t3-cierre.mjs; node race/t4-recepcion.mjs
node race/t6-deadlock.mjs; node race/t7-timeout.mjs 400; node race/t10-recepcion-vs-ventas.mjs; node race/t11-incentivos.mjs; node race/t12-idempotencia.mjs
# Datos grandes y planes
psql -f sql/carga.sql; psql -f sql/explain.sql
# Migraciones sobre esquema antiguo
psql -d mig -f migrations/202610030001_initial/migration.sql; psql -d mig -f sql/old-data.sql
npx prisma migrate resolve --applied 202610030001_initial && npx prisma migrate deploy
```

Los anexos con scripts, SQL y el extracto del registro de interbloqueos están en `auditoria-sistema/06-anexos/`.

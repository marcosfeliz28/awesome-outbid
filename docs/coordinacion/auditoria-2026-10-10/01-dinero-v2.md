# Auditoría 01 v2 · Dinero · Nexora POS

- **Rama auditada:** `origin/nexora-cloud` @ `a12c980` (worktree desacoplado `auditoria-sistema/wt-v2-dinero`; solo lectura, sin cambios de código ni push). Producción no se tocó.
- **Fecha:** 2026-10-10. **Base v1:** `01-dinero.md` (sobre `3e5521c`). Entre ambos hay 156 commits; 60 archivos de código cambiados, entre ellos las migraciones `202610200001` a `202610210004`, `drive-backup*.ts`, `offline-sale-review.ts`, `security.ts` (PIN de 6 dígitos y cupos), `cartDraft.ts`, `pwaUpdate*.ts` y la cola de escaneo de `POS.tsx`.
- **Método:** lectura del diff `3e5521c..a12c980` en los archivos de dinero, más pruebas contra la **API compilada** (`node dist/main.js`, `NODE_ENV=production`) con un PostgreSQL 16 propio (puerto 55602, usuario `postgres`, fuera de `/tmp/claude-0`), seed oficial y los usuarios `vendedor@` (rol seller), `gerente@`, `admin@`, `almacen@`.
- **Convención:** **[VERIFICADO]** = reproducido contra la API y anoto la salida. **[CÓDIGO]** = por lectura, no ejecutado. **[TEST]** = lo cubre una prueba del repositorio que ejecuté y pasó.
- **Scripts de reproducción:** `auditoria-sistema/v2dinero/lib.sh` (mismos helpers que v1: `tok`, `reg`, `open_cash`, `sale_body`, `q`…).

## Pruebas que ejecuté

| Prueba | Resultado |
|---|---|
| `migrate deploy` completo sobre una base vacía (las 7 migraciones nuevas) | Aplica sin errores |
| Re-ejecución de `…0002_datos_restricciones`, `…0004_dinero_idempotencia`, `…0001_datos_indices` sobre una base ya migrada | Idempotentes (solo `NOTICE … already exists`); las 4 restricciones muestreadas quedan `convalidated = true`; una venta con `customerId` inexistente ahora da `violates foreign key constraint "Sale_customerId_fkey"` |
| `tests/dinero-auditoria.test.ts` (15) + `tests/offline-review-api.test.ts` (4) | **19/19 pasan** (A-1, A-2, M-1…M-5, B-1, B-2, B-3, B-6, B-7, D-11, D-M1, D-M4, 05-A2) |
| `tests/incentives-api.test.ts` (11) + `tests/perf-api.test.ts` (5) | 16/16 pasan |
| `tests/api.test.ts` (179) | 173 pasan, 6 omitidas, **3 fallan por mi entorno, no por el código**: dos arrancan una API hija sin `JWT_SECRET` y tres miden el 429 del login que yo había subido a 100,000 para las ráfagas (los de límite de tasa). No hay fallos de dinero |
| Invariante del dashboard (`revenue = Σdaily = Σpayments = Σsellers`) en 3 rangos (09–10 oct, 10 oct, 1 sep–10 oct) | Se cumple: 10,050 / 400 / 526,050 |

## Resumen

| Severidad | Nº (nuevos) |
|---|---|
| CRÍTICO | 0 |
| ALTO | 0 |
| MEDIO | 3 (N-1, N-2, N-3) |
| BAJO | 4 (N-4, N-5, N-6, N-7) |

De los **20 puntos de v1** (2 altos, 6 medios, 7 bajos, 4 abiertos y D-12): **10 corregidos, 2 mitigados por decisión (B-6, B-7), 3 parciales (M-2, M-5, M-6) y 4 abiertos (B-4, B-5, D-07, D-09)**; D-12 no requiere acción. Los dos ALTOS de v1 (A-1 y A-2) están corregidos y probados. No encontré regresiones que dupliquen ventas, rompan la idempotencia, dejen stock negativo o descuadren tablas. Los hallazgos nuevos son **rodeos de los controles que se añadieron anoche** y **un hueco que abre el rechazo de transferencias (M-3) frente a las devoluciones**.

## 1. Estado de los hallazgos v1

| ID v1 | Sev. v1 | Estado | Evidencia |
|---|---|---|---|
| **A-1** Vale de caja sin control | ALTO | **Corregido** | `cash.ts:951-973`: todo vale exige nota y, sin `sale:manage`, el PIN de un gerente (`managerPinApproval`); queda `close_vouchers` y la alerta alta `voucher:<caja>`. **[VERIFICADO]** el mismo cierre que antes daba 201 sin nada: sin nota → 400 «Explica en las notas…»; con nota y sin PIN → 400 «Cerrar con un vale… requiere el PIN de un gerente»; con PIN `234567` → 201, alerta `cash_voucher|high|new` y bitácora `open, close, close_vouchers`. **[TEST]** A-1. Residual de diseño en la nota (1) de abajo |
| **A-2** Fondo sin «Entregado» | ALTO | **Corregido** | `cash.ts:1119-1120`: `left ?? countedCash`. **[VERIFICADO]** tras el cierre con 200 contados y sin `delivered`: `opening-suggestion` → `{"amount":200,…}` y `open` con 0 → 400 «El fondo es menor que lo dejado… (RD$ 200.00)». **[TEST]** A-2 |
| **M-1** Alertas que se resuelven solas | MEDIO | **Corregido** (con residual N-5) | `alerts.ts:44-54` (`MANUAL_ALERT_TYPES`) y `alerts.ts:399`; además una alerta resuelta a mano no se reabre si el mensaje no cambia (`alerts.ts:418-424`). **[TEST]** M-1. Residual: el aviso de descuento inusual solo nace si la evaluación corre ese mismo día (N-5) |
| **M-2** Crédito/contraentrega partidos | MEDIO | **Parcial** | `shared/index.ts` (`receivableNeedsApproval` con `openDebt`), `sales.ts:224-238, 441-452, 726-749`. **[VERIFICADO]** con `allowCreditSales=true`, cliente nuevo: contraentrega de 400 → 201, otra de 400 → 201, la tercera → 400 «La deuda pendiente de este cliente más esta venta supera RD$ 1,000.00…»; 6 peticiones en paralelo: ninguna pasa la barrera (recomprobación bajo el bloqueo del cliente). **Pero se rodea creando clientes** → N-2 |
| **M-3** Transferencia sin verificar ni rechazo | MEDIO | **Corregido** (con regresión N-3 y residual N-4) | `sales.ts:1041-1062` crea `transfer:<pago>` alta; `sales.ts:1556-1625` permite rechazar `entryType:"sale"` (pasa a `creditBalance` y alerta `receivable`); `cash.ts:60, 114, 267` la sacan del esperado. **[VERIFICADO]** venta de 400 por transferencia → alerta `transfer_pending|high|new`; la vendedora recibe 403 al rechazar; el admin rechaza → `creditBalance 400.00`, alerta `transfer` resuelta y `receivable` nueva. **[TEST]** M-3 |
| **M-4** Tope de salidas por turno | MEDIO | **Corregido** | `cash.ts:801-820`: suma las salidas de la caja **o** de la usuaria desde el inicio del día (`-04:00`). **[VERIFICADO]** tras una salida de 1,000, la de la segunda y tercera caja del día responden 400 «…se requiere el PIN de un gerente». Cinco salidas de 300 en paralelo: ninguna se crea cuando la usuaria ya suma el tope del día. **[TEST]** M-4 |
| **M-5** Mermas y ajustes fuera del estado de resultados | MEDIO | **Parcial** | `inventory.ts:360-394` y `reports.ts:381, 451, 489-491, 666-669`: el dashboard y el estado de resultados restan `inventoryLoss`; alerta `inventory_loss` si el día de quien no gestiona ventas supera RD$ 1,000. **[VERIFICADO]** 9 unidades × 220 en ajustes de 3 → `inventoryLoss: 2000`, alerta `inventory-loss:<usuario>:<día>`. **Se rodea con la salida «devolución a proveedor»** → N-1. Sigue sin haber aprobación (decisión 22) |
| **M-6** Venta offline varada | MEDIO | **Parcial** | Nuevo `offline-sale-review.ts` (`POST /sales/offline-review/discard`): la cajera descarta con el PIN de un gerente, o un gerente con su sesión, con bitácora `offline_sale_discarded` y alerta `offline-discarded:<uuid>`. **[TEST]** 05-A2. Ya no queda bloqueada la caja, pero **no se resuelve el dinero ni el inventario**: «La venta no se crea ni se mueve inventario ni dinero» (cabecera del archivo). La mercancía ya salió y el efectivo está en la gaveta, así que queda un sobrante sin movimiento y el stock sobrestimado; el único aviso es el texto de la alerta. Falta la salida de «aceptar el precio capturado» que propuse |
| **B-1** Repreciar a la baja inventa un «cambio» | BAJO | **Corregido** | `offline-sales.ts:217-242` crea una entrada de caja por la diferencia (una sola vez) y recalcula la caja si ya cerró. **[TEST]** B-1 |
| **B-2** Total de recepción con float | BAJO | **Corregido** | `inventory.ts:925-930` y `merchandise.ts:438-443` con Decimal. **[TEST]** B-2 |
| **B-3** Cierre del mes en curso | BAJO | **Corregido** | `incentives.ts:~666`. **[VERIFICADO]** `POST /incentives/close {"month":"2026-10"}` → 400 «Sólo se cierra un mes terminado…» |
| **B-4** Desgloses en bruto (top, tiendas, clientes, «Total» del cuadre) | BAJO | **Abierto** | Sin cambios: `reports.ts` (consulta `top`, ~l.336) sigue neteando por `returnedQty` sin fecha; `cash.ts` línea «Total» del cuadre no cambió. **[CÓDIGO]** |
| **B-5** La anulación reescribe días pasados | BAJO | **Abierto** | Sin cambios: el dashboard sigue filtrando `status:'completed'` por la fecha de la venta. **[CÓDIGO]** |
| **B-6** Reembolso tarjeta → efectivo | BAJO | **Mitigado por decisión** | `sales.ts:~1939-1967`: sigue permitido a `sale:manage`, deja alerta `refund_method_mismatch` (alta si es efectivo). **[VERIFICADO]** reembolso «tarjeta» de una venta en efectivo → 201 y alerta `refund-method:<id>|medium|new`. **[TEST]** B-6 |
| **B-7** `costAvg` editable | BAJO | **Mitigado por decisión** | `catalog.ts:511-552`: sigue permitido, deja `cost_change` en bitácora y alerta alta. **[VERIFICADO]** `PATCH costAvg 220→1` con 500 en stock → alerta «valor del inventario −RD$ 109,500.00». **[TEST]** B-7 |
| **D-07** `operationId` opcional en `POST /returns` | BAJO | **Abierto (decidido)** | `sales.ts:1636` `uuid.optional()`. **[VERIFICADO]** el mismo cuerpo dos veces → `NC-000001` y `NC-000002`, 400 + 400. La decisión 25 lo deja así por compatibilidad con la PWA anterior |
| **D-09** El cierre ciego revela si el conteo es exacto | BAJO | **Abierto** | `cash.ts:~170-185` sin cambios. **[VERIFICADO]** de la vendedora: contar 1 peso menos → 400 «agrega una nota»; contar exacto → 201 sin nota |
| **D-10** `close_difference` con diferencia 0 | BAJO | **Corregido** | `cash.ts:1033-1037` con `Number(...)`. **[VERIFICADO]** el cierre de A-1 con diferencia 0 deja `open, close, close_vouchers` y ya no `close_difference` |
| **D-11** Anular sin `@RequireTerminal()` | BAJO | **Corregido** | `sales.ts:1289`. **[VERIFICADO]** el admin con sesión sin equipo → 403 `TERMINAL_REQUIRED`. **[TEST]** D-11 |
| D-12 (normalización por fecha de corte) | — | Sin acción | Vence sola el 2026-10-11 |

**(1) Residual de diseño de A-1:** quien tiene `sale:manage` (gerente o administrador) puede cerrar con un vale de cualquier monto solo con una nota (sin PIN ni segunda persona); queda la alerta alta `cash_voucher`, pero no hay tope. Coherente con la decisión 16; lo anoto por si la dueña quiere un tope o una segunda aprobación para gerentes.

## 2. Hallazgos nuevos

### N-1 · MEDIO · La salida «devolución a proveedor» saca inventario sin proveedor, sin pérdida y sin alerta **[VERIFICADO]**

**Dónde**
- `apps/api/src/merchandise.ts:136-144` (el motivo es un valor libre del enum; no exige `supplierId`, ni documento, ni crédito del proveedor) y `merchandise.ts:752` (`inventoryLossAlert`).
- `apps/api/src/inventory.ts:360` (`INVENTORY_LOSS_SQL`): `m.type = 'merchandise_exit' AND m.reason <> 'devolución a proveedor'`, es decir que ese motivo queda fuera tanto del estado de resultados (`reports.ts:381`) como de la alerta diaria (`inventory.ts:370`).
- Decisión 22: «La devolución al proveedor no es pérdida y no cuenta». Eso solo es cierto si de verdad hay un proveedor que la acredite, y el código no lo comprueba.

**Escenario** (usuario `almacen@`, equipo aprobado, `inventory:write`):
```bash
p "$ALM" /merchandise/operations '{"id":"<uuid>","direction":"exit","reason":"devolución a proveedor",
  "documentNumber":"X1","items":[{"variantId":"<var>","qty":100,"unitCost":220}]}'
# → 201 {"total":22000,…}   (sin supplierId)
```
**Resultado:** stock 491 → 391, movimiento `merchandise_exit | -100 | 220.00 | devolución a proveedor`. Después `GET /dashboard/summary` sigue en `inventoryLoss: 2000` (lo de los ajustes anteriores) y no se crea ninguna alerta nueva: **RD$ 22,000 a costo salieron del inventario sin rastro en ningún informe de dinero**. Con el motivo «merma» las mismas 100 unidades habrían bajado la utilidad y levantado la alerta; basta cambiar el texto del motivo para esquivar M-5.

**Arreglo mínimo:**
```diff
--- a/apps/api/src/merchandise.ts
+++ b/apps/api/src/merchandise.ts
@@ (tras la comprobación de data.reason, ~l.360)
     if (data.direction === "exit" && !data.reason)
       bad(...);
+    // N-1: una devolución a proveedor necesita proveedor (y documento): si no, es una merma.
+    if (data.direction === "exit" && data.reason === "devolución a proveedor" && !data.supplierId)
+      bad("Elige el proveedor al que devuelves la mercancía.");
--- a/apps/api/src/inventory.ts
+++ b/apps/api/src/inventory.ts
@@ inventoryLossAlert
-  `... AND ${INVENTORY_LOSS_SQL}`
+  // La alerta cuenta todas las salidas de quien no gestiona ventas (incluida la devolución a
+  // proveedor): el estado de resultados las excluye, la alerta no.
+  `... AND m.qty < 0 AND m.type IN ('adjustment','waste','count','merchandise_exit')`
```
(Una opción más estricta: registrar el crédito del proveedor y excluir solo las devoluciones que lo tengan.)

### N-2 · MEDIO · El umbral por cliente (M-2) se rodea creando clientes nuevos **[VERIFICADO]** (requiere `allowCreditSales=true`)

**Dónde:** `packages/shared/src/index.ts` (`receivableNeedsApproval`) y `sales.ts:441-452`: el umbral se aplica a `deuda del cliente + esta venta`. La vendedora puede crear clientes (`POST /customers`, `customers:write`) y un cliente nuevo tiene deuda 0 y `creditLimit 0` («sin límite», decisión 19).

**Escenario** (vendedora, cliente «A» ya con RD$ 800 de contraentrega, bloqueado por la regla nueva):
```bash
for i in 1 2 3; do C=$(p "$VEND" /customers '{"name":"Cliente Sybil '$i'","phone":"80955509'$i$i'"}' | jq -r .id)
  p "$VEND" /sales '{…,"customerId":"'$C'","items":[{"variantId":"<var>","qty":2}],"payments":[{"method":"cod","amount":800}]}'; done
# → 201 FS-0000850, 201 FS-0000851, 201 FS-0000852
```
**Resultado:** `SELECT count(*), sum("creditBalance") … WHERE "cashSessionId" = <caja>` → **5 ventas, RD$ 3,200** por cobrar sin PIN ni alerta de crédito, en una caja, en un turno. Con N clientes, N × RD$ 1,000.

**Impacto:** la corrección de M-2 hace el control por cliente, pero el riesgo está en la cajera: puede abrir cuentas a su nombre o de conocidos. Es el mismo hueco que M-2 con un paso más.

**Arreglo mínimo:** limitar también por vendedora y día: sumar a `openDebt` lo que esa usuaria ha dejado por cobrar hoy.
```diff
--- a/apps/api/src/sales.ts   (approve y la recomprobación bajo bloqueo, ~l.447 y ~l.726)
-        ? await customerOpenDebt(this.db, actor.branchId, input.customerId)
+        ? Math.max(
+            await customerOpenDebt(this.db, actor.branchId, input.customerId),
+            await sellerDayReceivable(this.db, actor), // Σ creditBalance de sus ventas de hoy
+          )
```
(La alternativa es exigir el PIN para el primer crédito o contraentrega de un cliente creado en los últimos X días.)

### N-3 · MEDIO · Devolver en efectivo una venta con transferencia sin verificar y luego rechazarla deja una deuda sobre mercancía devuelta **[VERIFICADO]**

**Dónde**
- `sales.ts:1866-1884`: la devolución solo bloquea los **abonos** por transferencia pendientes (`entryType: "installment"`). Para la transferencia **de la propia venta** (`entryType: "sale"`, pendiente desde que M-3 permite rechazarla) no hay ninguna guarda.
- `sales.ts:1591`: `reject` suma `payment.amount` completo a `creditBalance` sin mirar las devoluciones ya hechas.

**Escenario:**
```bash
# La vendedora vende 400 por transferencia (pending_verification)
p "$GER" /returns '{"operationId":"<uuid>","saleId":"<venta>","cashSessionId":"<caja del gerente>",
   "refundMethod":"cash","reason":"devuelve","items":[{"saleItemId":"<línea>","qty":1,"restock":true}]}'
#   → 201 NC-000001 refundAmount 400      (sale de la gaveta del gerente RD$ 400 en efectivo)
p "$ADMIN" /payments/<pago>/reject '{"reason":"nunca llegó"}'      # → {"ok":true}
```
**Resultado:** la venta queda `completed`, `returnedQty 1.000 = qty 1.000`, **`creditBalance 400.00`**, alerta `receivable|new`. Hay RD$ 400 de efectivo entregados por una transferencia que nunca llegó, el artículo repuesto en el stock, y además una cuenta por cobrar de RD$ 400 al cliente por una mercancía que ya devolvió. Con un cómplice (cajera registra una transferencia falsa, gerente "devuelve" en efectivo) es una forma de convertir una transferencia inventada en efectivo; solo deja `refund_method_mismatch` (alta) como rastro.

**Arreglo mínimo (misma regla que ya existe para los abonos):**
```diff
--- a/apps/api/src/sales.ts   (returnSale, junto a la guarda de abonos pendientes, ~l.1866)
+      const pendingSaleTransfer = await tx.payment.count({
+        where: { saleId: sale.id, entryType: "sale", method: "transfer", status: "pending_verification" },
+      });
+      if (pendingSaleTransfer)
+        bad("Verifica o rechaza primero la transferencia de esta venta.");
```
Y en `reject`, como defensa en profundidad, no pasar a cobrar más de lo que queda de la venta tras las devoluciones: `increment: min(payment.amount, sale.total − Σ returns.total)`.

### N-4 · BAJO · Los informes de forma de pago siguen contando como cobrada una transferencia rechazada **[VERIFICADO]**

**Dónde:** `reports.ts:322-330` (`payment.groupBy` sin filtro de `status`), el mismo origen de las comisiones (`feeAmount`). La decisión 20 lo deja a propósito («los informes… siguen mostrando la forma con la que se registró»).

**Resultado:** tras rechazar la transferencia de 400, `GET /dashboard/summary` da `revenue 400` y `payments: [{"name":"transfer","amount":400}]`, y la deuda de 400 no aparece en ningún desglose; la caja, en cambio, ya no la cuenta (`cash.ts:60`). Son vistas distintas del mismo dinero.

**Arreglo:** `status: { not: "rejected" }` en ese `groupBy` y mostrar el importe rechazado como método «por cobrar» (igual que el crédito), para que siga sumando los ingresos.

### N-5 · BAJO · El aviso de descuento inusual solo se crea si la evaluación corre el mismo día **[CÓDIGO]**

**Dónde:** `alerts.ts:~262` (solo las ventas de `businessDate()`), con evaluación al abrir Avisos o cada 24 h desde el arranque del servidor (`alerts.ts:77`). M-1 evitó que se **resuelva** sola, pero si nadie abre Avisos ese día (o el temporizador cae después de medianoche) un descuento de 40 % de la tarde nunca genera su alerta.

**Arreglo mínimo:** crear la alerta en el momento de la venta (como ya hacen `transfer:`, `voucher:` y `refund-method:`), o evaluar también «ayer» en la primera pasada del día.

### N-6 · BAJO · Una cajera puede bloquear una hora las aprobaciones con PIN corto de toda la sucursal **[CÓDIGO]**

**Dónde:** `security.ts:278-295`. Los fallos con un PIN de 4-5 dígitos comparten el cupo `pin-short:<sucursal>` (10 por hora). Una cajera llega a 10 fallos con dos tandas de 5 (cada tanda bloquea 15 min su propia clave) y, mientras dure la hora, `verifyPinAttempt` rechaza **todo** PIN corto de la sucursal con «Los PIN de 4 o 5 dígitos quedaron bloqueados…». Si algún gerente conserva un PIN corto, no puede aprobar descuentos, salidas ni vales hasta que pase la hora.

**Impacto:** operativo, no pérdida de dinero (el gerente puede hacer la operación desde su propia sesión); desaparece cuando todos los PIN sean de 6 dígitos. **Arreglo mínimo:** que el cupo de la sucursal solo cuente los fallos cuyo PIN **no coincide con ningún** PIN de 6 dígitos, o migrar los PIN cortos restantes (la bitácora `pin_short_used` dice cuáles).

### N-7 · BAJO · «Entregado» al cerrar no tiene acuse **[CÓDIGO / diseño]**

**Dónde:** `cash.ts` (`deliveredSplit`) y `Tienda.tsx`. La cajera declara lo «entregado» (lo que sale de la gaveta al cierre) y el fondo sugerido de la próxima apertura es `contado − entregado`. Nadie confirma que se entregó: una cajera puede contar el efectivo exacto, declarar `delivered = todo` y llevárselo; el cierre cuadra en 0, y la siguiente apertura "debe" ser 0.

**Impacto:** el control A-2 es sólido para el fondo; el destino del efectivo entregado se apoya en la confianza. Es una decisión de proceso (un gerente que firme la entrega o un movimiento `out` con PIN), no un fallo de código. Lo dejo para la dueña.

## 3. Cosas que revisé y no encontré problema

- **Idempotencia nueva (D-M4):** `operationId` en movimientos de caja, pagos a proveedor y gastos (`cash.ts:~855-875`, `admin.ts:192-205, 565-705`): serializados por candado consultivo; la misma clave con otros datos da 400. **[TEST]** D-M4. Índices únicos que admiten `NULL` (`…0004`), sin riesgo de despliegue. Residual: sigue siendo opcional (decisión 25), la web siempre la envía.
- **Orden de bloqueos (D-M1):** la anulación toma ahora las notas de crédito después de las variantes, en orden de id. **[TEST]** D-M1. Reject → caja, venta, pago, igual que verify. No hallé ciclos nuevos entre venta, devolución, anulación y rechazo.
- **Plazos (D-M2):** `MONEY_TRANSACTION` de 20 s en venta, devolución, anulación y cierre.
- **Migraciones:** las restricciones `NOT VALID` + validación opcional no abortan un despliegue (probado sobre base poblada, idempotentes); no hay índices únicos nuevos salvo `operationId`. El texto «Sólo para salidas que superen el límite del turno» en `Management.tsx` quedó desactualizado (ahora es por día).
- **Cola de escaneo, borrador del carrito, actualización PWA:** el servidor sigue calculando precios, descuentos e impuestos desde el catálogo vigente (no confía en el carrito del borrador); la actualización nunca recarga con artículos en el carrito (`pwaUpdatePolicy.ts`). No encontré pérdida de ventas ni cobros dobles por ellos (la venta es idempotente por `offlineUuid`).
- **Retención (`retention.ts`) y mantenimiento de seguridad:** no tocan ventas, pagos, cajas ni la bitácora (solo contadores, tokens, eventos y avisos); `MerchandiseOperation` queda fuera a propósito.
- **Anonimización de clientes (`admin.ts:326-370`):** rechaza si hay deuda (`creditBalance > 0`, incluida la de una transferencia rechazada) o notas de crédito con saldo.
- **Módulo Drive, bloqueo de login y PIN de 6 dígitos:** fuera de dinero salvo lo anotado en N-6.

## 4. Orden sugerido

1. **N-3** y **N-1**: son una guarda de una línea cada una y cierran las dos vías de sacar valor (efectivo o inventario) sin control.
2. **N-2**: decisión de negocio sobre el crédito a clientes nuevos; el arreglo técnico es pequeño.
3. Los abiertos de v1 (D-07, D-09, B-4, B-5): siguen siendo de bajo impacto; D-09 y D-07 están decididos.
4. N-4 a N-7: cuando convenga.

## No verificado

- Configuración real de producción (`allowCreditSales`, `allowOfflineSales`, `creditApprovalThreshold`, `inventoryLossAlertLimit`): N-2 solo aplica con crédito activado; M-6 y B-1 con ventas offline.
- N-5 y N-6 son por lectura; no esperé el cambio de día ni encadené las dos tandas de PIN fallidos de 15 minutos.
- La web en un navegador real (cola de escaneo, borrador y actualización PWA se leyeron, no se ejecutaron).
- Node 24 (producción) frente a Node 22.22 (local); el SQL de las migraciones se probó con PostgreSQL 16.
- Los tres fallos de `tests/api.test.ts` por mi entorno (arriba) no se repitieron con los valores de producción.

## Entorno y limpieza

Worktree `auditoria-sistema/wt-v2-dinero` (detached en `a12c980`, con `node_modules` copiados y API compilada). Clúster PostgreSQL 16 en `/var/lib/postgresql/aud-dinero02` (puerto 55602, bases `v2_tpl`, `v2_money`, `v2_mig`) y API en el puerto 3602; al terminar se detuvieron ambos y se eliminó el clúster.

# Revisión de código — Nexora POS (`origin/nexora-cloud` @ cfc21c3a)

Solo lectura: no se modificó nada, no se hizo push ni despliegue. Rutas relativas a `apps/api/src` salvo indicación. Cada hallazgo se verificó leyendo el camino completo; lo dudoso va marcado **«por confirmar»**.

---

## 1. Crítica — Las ventas se registran sin NCF (comprobante fiscal)
- **Dónde:** `sales.ts:955-961` y `sales.ts:1063` (solo se guarda `ncfType`, que es opcional); `prisma/schema.prisma:356` (`ncf String?`). Ningún archivo de `apps/api/src` escribe `Sale.ncf`. El recibo dice «Solicitud NCF … pendiente de emisión fiscal» (`receipt-pdf.ts:224-227`). La nota de crédito de una devolución dice «Nota interna de crédito · no fiscal» (`sales.ts:3243`).
- **Qué pasa:** con `ncfMode` en `"disabled"` (valor por defecto, `admin.ts:108`) toda venta se completa sin `ncfType` y sin NCF. Aun en `"prepared"`, el NCF nunca se asigna. Las devoluciones no generan B04.
- **Cómo reproducir:** `POST /sales` sin `ncfType` → 201, `sale.ncf = null`.
- **Impacto:** el 100 % de las ventas queda fuera de DGII, lo que choca con la regla «nunca vender fuera de DGII». Ya figura como pendiente fiscal (`docs/coordinacion/INSTRUCCIONES_ACTUALES.md:117,474`), pero el código hoy lo permite.
- **Arreglo mínimo:** mientras no exista la emisión de NCF/e-CF, bloquear `complete()` si la configuración fiscal no está activa, o asignar dentro de la misma transacción el NCF de una secuencia autorizada (contador con `FOR UPDATE`) y exigir `ncfType`.

## 2. Alta — «Descartar venta sin conexión · mercancía entregada» = venta fuera de libros, con datos que manda el cliente
- **Dónde:** `offline-sale-review.ts:48-76` (esquema `detail`), `:153-239`.
- **Qué pasa:** con `outcome:"delivered"` el servidor saca inventario como `adjustment` y crea una entrada de caja `in`. **No crea ninguna Sale**: sin NCF, sin ITBIS y sin ingreso en los reportes. Además, los artículos y los pagos salen de `data.detail` (el cuerpo de la petición), no de la evidencia guardada en `ownership.after.detail`. El comentario de la línea 169 dice «nunca se confía en ella», pero solo se valida la caja. `cashPaid` suma lo *entregado* por el cliente (incluye el cambio), así que la entrada de caja puede quedar inflada. `qty` no pasa por `stockQty` (`:69`), así que admite más de 3 decimales.
- **Cómo reproducir:** con cualquier conflicto offline registrado, una cajera con PIN de gerente (o el gerente con su sesión, sin PIN) envía `POST /sales/offline-review/discard` con `outcome:"delivered"` y en `detail.items` cualquier `variantId`/`qty`. Resultado: salida de stock sin venta y sin la alerta `inventoryLossAlert`.
- **Impacto:** ventas reales que no pasan por DGII, y una vía para sacar mercancía con un motivo creíble. El importe no tiene más tope que el stock.
- **Arreglo mínimo:** usar solo `ownership.after.detail` (la evidencia del servidor) y cantidades `stockQty`. Mejor aún, con `delivered` obligar a sincronizar o volver a facturar la venta, en lugar de un ajuste más una entrada de caja.

## 3. Alta — Un gerente se aprueba a sí mismo con su propio PIN
- **Dónde:** `security.ts:84-104` (`managerPinApproval`), `sales.ts:628-644` (`approve()`), `cash.ts:857-872`, `offline-sale-review.ts:93-111`. Todos comparan el PIN contra **todos** los usuarios con `sale:manage` de la sucursal, **incluido quien hace la operación**.
- **Casos verificados:**
  - a) **Efectivo «Recibido por la dueña»** (`sales.ts:3932-3948`, `4056-4061`, `4132-4142`): un gerente (`sale:manage` sin `*`) cobra un crédito en efectivo con `ownerConfirmed:true` y su propio PIN. El pago queda con `cashSessionId=null` y baja `creditBalance` sin que entre efectivo a ninguna caja. La marca dice «dueña», pero la dueña no lo confirmó. El dinero puede quedarse en el bolsillo y la deuda del cliente queda saldada.
  - b) **Crédito por encima de `creditApprovalThreshold`**: la regla exige PIN «a todos» (`packages/shared/src/index.ts:423`), pero el gerente pone su propio PIN y queda `credit_approved` a su nombre.
  - c) **Nota de crédito sin código** (`sales.ts:611-613`, `989`): pasa con su propio PIN.
  - d) **Cierre de su propia caja con descuadre** (`cash.ts:1140-1144`): el gerente queda como `cashApprovedBy` de su propio faltante, sin PIN.
- **Cómo reproducir (a):** sesión de gerente → `POST /sales/:id/credit-collections` con `{operationId, managerPin:<su PIN>, lines:[{method:"cash", amount: saldo, ownerConfirmed:true}]}` → 201, saldo 0, ninguna caja recibe el efectivo.
- **Impacto:** la deuda completa de cualquier cliente a crédito o contraentrega; los faltantes de la caja propia del gerente.
- **Arreglo mínimo:** en `managerPinApproval` y sus copias, excluir `manager.id === actor.id` (pasar `exclude: actor.id`). Para `ownerConfirmed`, exigir el PIN de un usuario con `*` (la dueña), no de cualquier gerente.

## 4. Media — El cierre «ciego» sirve de oráculo para descubrir el esperado exacto
- **Dónde:** `cash.ts:1124-1137`; `rate-limit.ts:179-228` no limita `/cash-sessions/:id/close`.
- **Qué pasa:** si lo contado ≠ lo esperado, una cajera sin `sale:manage` recibe 400 «La caja no cuadra…» sin que se guarde nada, y puede repetir sin límite. Cuando el monto coincide, cierra. Lo mismo pasa con la tarjeta, que tiene su propio mensaje.
- **Cómo reproducir:** repetir `POST /cash-sessions/:id/close` variando `countedCash` en un rango (por script) hasta que no aparezca el error.
- **Impacto:** la cajera conoce el esperado exacto y puede retirar cualquier sobrante (ventas no registradas o cambio mal dado) sin que se note.
- **Arreglo mínimo:** guardar el primer intento con descuadre (o contar los intentos de cierre con `verifyAttempt`) y avisar a gerencia desde el segundo; o aceptar siempre el cierre con la diferencia guardada y la alerta.

## 5. Media — Un gerente devuelve en efectivo desde la caja abierta de otra persona, sin segunda aprobación
- **Dónde:** `sales.ts:2813` (`cashLock(..., true)`), `sales.ts:453-455`; la ruta es `@Permit("sale:manage")` (`:2769`).
- **Qué pasa:** `cashSessionId` puede ser la caja abierta de una cajera. Baja su efectivo esperado y la cajera debe entregar ese dinero. Esto contradice la Decisión 38 («nadie opera con la caja de otra persona»), que `cashLock` sí aplica a las ventas. La devolución tampoco necesita que la apruebe otra persona: el mismo gerente la registra, elige `restock:false` (merma) y saca efectivo. Solo queda la alerta `refund_method_mismatch` si el medio de pago no coincide.
- **Cómo reproducir:** sesión de gerente → `POST /returns` con el `cashSessionId` de la caja de la cajera y `refundMethod:"cash"`.
- **Impacto:** hasta todo el efectivo esperado de esa caja por cada devolución.
- **Arreglo mínimo:** en `returnSale` llamar a `cashLock(tx, actor, id)` sin `manager`, para que reembolse solo desde la caja propia. **Por confirmar** con la dueña si quiere un PIN de otra persona en las devoluciones en efectivo.

## 6. Media — El margen descuenta el ITBIS en el dashboard, el reporte por producto y las alertas
- **Dónde:** `reports.ts:13` y `:505` (`margin(net, cost)` con `net = revenue − tax`), `reports.ts:1229-1250`; `alerts.ts:493-497` y `:603-606` (`price/(1+taxRate)`); `packages/shared/src/index.ts:529-533` (`safeDiscount`).
- **Qué pasa:** la regla es margen = (precio − costo)/precio **sin restar ITBIS**. `reportes/margen.ts` la cumple, pero el dashboard, el reporte por producto y la alerta `low_margin` calculan sobre el precio sin ITBIS. Un mismo producto sale con dos márgenes distintos. Además, `safeDiscount` sugiere descontar hasta dejar **0 %** de margen neto, no 15 %.
- **Ejemplo:** precio 1,180, costo 900. Regla de la dueña: 23.7 %. Dashboard y alerta: (1,000−900)/1,000 = 10 % → alerta «margen bajo» falsa. La oferta sugerida es de hasta 10 %, que deja el margen en 0.
- **Impacto:** decisiones de precio y ofertas con números equivocados; ofertas que dejan el margen por debajo del 15 %.
- **Arreglo mínimo:** usar `price`/`total` en lugar del neto en `margin()` en esos tres lugares, y `safeDiscount = floor(margen_dueña − 15)`.

## 7. Media (por confirmar) — El mínimo de 15 % de margen no se aplica en ninguna escritura
- **Dónde:** venta (`sales.ts:808-834`), precio y costo (`catalog.ts:495-521`), promociones (`admin.ts:1325-1367`).
- **Qué pasa:** un descuento aprobado, una promoción (gerente con `promotions:write`, hasta 99 % o `special_price` 0.01) o un precio editado pueden dejar el margen por debajo del 15 %, incluso por debajo del costo. Solo se exige que el total sea > 0. Las promociones ni siquiera piden motivo ni cuentan como descuento manual (`requestsDiscount`).
- **Impacto:** ventas con pérdida sin bloqueo ni alerta en el momento.
- **Arreglo mínimo:** en `complete()`, si `(lineTotal − costo)/lineTotal < 0.15`, exigir el PIN de un usuario `*` (o al menos generar una alerta); validar lo mismo al crear la promoción y al editar el precio. Confirmar con la dueña si la regla aplica a la venta o solo al precio.

## 8. Media — «Corregir método de pago» no ajusta los incentivos ni valida el crédito
- **Dónde:** `sales.ts:2068-2104`.
- **Qué pasa:** cambia `creditBalance`, pero no actualiza `incentiveOnCollection` ni llama a `syncCreditIncentives`.
  - Contraentrega → efectivo: saldo 0, pero el incentivo sigue «al cobrar» y la vendedora nunca lo recibe.
  - Efectivo → contraentrega o crédito: el incentivo ya se pagó completo aunque nadie haya cobrado; si nunca se cobra, la vendedora se queda con él.
  - Pasar a `credit` no revisa `allowCreditSales`, `creditLimit` ni `creditDueDate`.
- **Cómo reproducir:** venta de 2,000 en `cod` → `POST /sales/:id/payments/:pid/correct-method {method:"cash"}` → saldo 0 y `incentiveEntry.amount` en 0.
- **Arreglo mínimo:** dentro de la misma transacción, poner `incentiveOnCollection = creditBalance > 0` y llamar a `syncCreditIncentives(..., always=true)`; aplicar las mismas validaciones de crédito que `complete()`.

## 9. Baja — El gerente crea y aplica su propio conteo de inventario
- **Dónde:** `inventory.ts:1495-1552`, `:1618-1628`.
- **Qué pasa:** `POST /inventory/counts` (con `inventory:write`) y `/apply` (con `sale:manage`) pueden ser de la misma persona. Un faltante se aplica sin segunda verificación, y `inventoryLossAlert` no corre para `sale:manage` (`inventory.ts:417`).
- **Arreglo mínimo:** en `applyCount`, exigir que `count.userId !== actor.id` (o PIN de otra persona), en línea con la regla de las 4 verificaciones.

## 10. Baja — Una venta anulada deja transferencias pendientes que ya no se pueden cerrar
- **Dónde:** anulación en `sales.ts:2319-2328` (no resuelve los pagos `pending_verification` ni su alerta); `verify` (`:2542`) y `reject` (`:2687`) fallan con «La venta ya no está completada»; `pendingTransfers` (`:2435-2441`) no filtra por estado de la venta.
- **Impacto:** la lista de conciliación queda sucia para siempre y la alerta `transfer_pending` se queda abierta.
- **Arreglo mínimo:** al anular, marcar esas transferencias como `rejected`/`voided` y llamar a `resolveTransferAlert`.

## 11. Baja — Los dólares contados no se restan del descuadre en pesos
- **Dónde:** `cash.ts:158-169` (`closeDifferences` ignora `countedUsd`), `cash.ts:342-348` (esperado en USD = 0).
- **Qué pasa:** una venta cobrada en dólares se registra como efectivo en RD$. La gaveta en pesos sale «faltante» y los USD salen como «sobrante» aparte, lo que obliga a PIN y justificación. No existe método de pago USD. **Por confirmar** cómo cobra hoy la tienda en dólares.
- **Arreglo mínimo:** sumar `countedUsd × usdRate` al efectivo contado, o añadir el método de pago `cash_usd`.

## 12. Baja — Guardar Ajustes borra las claves que no están en el esquema
- **Dónde:** `admin.ts:852-877` (`data = {...config, ...}` no conserva `previous`); `inventory.ts:430` lee `inventoryLossAlertLimit`, que no está en `configSchema` (`admin.ts:77-137`).
- **Impacto:** ese límite no se puede configurar y cualquier clave escrita a mano en la base se pierde al guardar.
- **Arreglo mínimo:** `data = {...previous, ...config, ...}` o añadir la clave al esquema.

## 13. Baja — Verificar, rechazar y corregir transferencias usan el plazo de 5 s
- **Dónde:** `sales.ts:2523`, `:2601`, `:2664` (`this.db.$transaction` sin `MONEY_TRANSACTION`).
- **Impacto:** con carga dan P2028 («reintenta») mientras recalculan una caja cerrada. No corrompe datos.
- **Arreglo mínimo:** pasar `MONEY_TRANSACTION` como en el resto de rutas de dinero.

---

## Revisado y sin hallazgo
- **Idempotencia de la venta:** candado consultivo por `offlineUuid` + `requestHash` dentro de la transacción (`sales.ts:713-729`), y el reintento solo devuelve la venta a quien la hizo. La sincronización offline (`sales.ts:1337-1499`) y la cola web (`apps/web/src/pendingSales.ts`) no duplican ventas; recalcular el precio con el mismo UUID da conflicto, no una venta nueva.
- **Doble anulación, anulación contra devolución, anulación con caja cerrada:** candado `sale-void:` + `FOR UPDATE` + revisión del estado; con la caja original cerrada, el reembolso sale de la caja abierta de quien anula y se compensa con una entrada en la caja original (`sales.ts:2191-2407`). Una persona no puede aprobar ni rechazar su propia solicitud de anulación.
- **Stock y FEFO:** variantes bloqueadas en orden de id, revisión de stock bajo el candado, disparador `enforce_negative_stock`, lotes en orden de vencimiento saltando los no vendibles (`inventory.ts:336-576`). Traspasos Casa↔Tienda con aislamiento `Serializable`, `operationId` y disparadores que sincronizan `VariantStock`/`LotStock` (`warehouses.ts`, migración `202610240401`).
- **Devoluciones:** cantidad revisada con la venta bloqueada; un lote vencido no vuelve al stock; el reembolso queda limitado mientras la transferencia esté pendiente y por el efectivo esperado de la caja.
- **Cobros de crédito y contraentrega:** venta bloqueada, saldo menos transferencias pendientes ≥ monto, claves por línea (`sales.ts:3870-4179`). Movimientos de caja idempotentes, con tope diario y sin dejar el saldo en negativo.
- **Fuerza bruta de PIN:** 5 fallos por clave = 15 min de bloqueo, 10 por hora por solicitante, 30 por hora para PIN cortos (`security.ts`). El cambio de usuario por PIN no sube privilegios.
- **Costos ocultos:** `safe()` funciona con una lista blanca; los reportes de caja, almacenes y solicitudes de anulación no exponen costos a quien no tiene `profit:read`.

**No revisado a fondo:** `invoice.ts`, `inventory-import*`, `drive-backup*`, `reports.ts` completo, `courier.ts` y el resto de la web aparte de la cola offline. Las severidades son estimaciones de lectura: no ejecuté pruebas ni scripts de reproducción.

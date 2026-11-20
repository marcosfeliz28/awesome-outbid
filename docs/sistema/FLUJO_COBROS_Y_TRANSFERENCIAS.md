# Cobros: crédito, contraentrega, abonos y transferencias

Rama base `nexora-cloud` (commit `1e25909f`, 30-oct-2026). Citas `archivo:línea` revisadas contra ese commit; cuando una línea no se pudo confirmar, la cita dice el nombre de la función o del manejador en lugar de un número.

## 1. Vocabulario rápido

- **Crédito / contraentrega**: la mercancía sale ahora y el dinero se cobra después. En la base es un pago con método `cod` y estado `pending`; el saldo vive en `Sale.creditBalance` (`apps/api/src/sales.ts:286`, `:361-363`). «Crédito» y «Contraentrega» son solo una etiqueta de estadística (`receivableKind`: `credit` o `cod`); tienen las mismas reglas (`apps/api/prisma/schema.prisma`, comentario de `receivableKind`; `apps/web/src/POS.tsx:1895-1899`).
- **Abono / cobro**: un pago posterior sobre una venta con saldo. Se guarda como `Payment` con `entryType = "installment"` (manejador `installment`, `apps/api/src/sales.ts:4641`). Un pago hecho al vender tiene `entryType = "sale"`.
- **Verificar**: confirmar contra el banco que una transferencia llegó. Estados del pago: `ok`, `pending_verification`, `rejected` y `pending` (deuda sin cobrar) (`apps/api/prisma/schema.prisma` modelo `Payment`, campo `status`).

## 2. Vender a crédito o contraentrega (en la caja)

Pasos exactos en `FLUJO_CAJA_POS.md` §5.1. Resumen:

1. Elegir **cliente** (obligatorio, `apps/web/src/POS.tsx:2095`).
2. En la ventana «Todo listo para cobrar» (`apps/web/src/POS.tsx:2537`) pulsar **«Vender a crédito (queda pendiente)»** (texto en `:2033`, `:2035`) o elegir **«Crédito»** / **«Contraentrega»** en el selector de cobro (`:2770`).
3. Confirmar con **«Sí, vender a crédito»** (`apps/web/src/POS.tsx:2649`).
4. Reglas de aprobación con **PIN de gerente** (`packages/shared/src/index.ts:408-451`, `receivableApprovalReason` y `receivableNeedsApproval`): monto de crédito > umbral (`creditApprovalThreshold`, RD$ 1,000 por defecto); contraentrega de quien no tiene `sale:manage` > umbral o con ventas a crédito deshabilitadas; deuda abierta del cliente + esta venta > umbral; lo dejado por cobrar en el turno > RD$ 3,000 (`receivableShiftLimit`, `packages/shared/src/index.ts:404-414`). El aviso del turno está en `apps/api/src/sales.ts:812`.
5. Límite por cliente: `Customer.creditLimit` (0 = sin límite para crédito): «La venta supera el límite de crédito del cliente.» (`apps/api/src/sales.ts:1185`).
6. Necesita conexión (no se guarda sin internet) (`apps/web/src/POS.tsx:2101-2106`).
7. El recibo imprime «CRÉDITO · PENDIENTE DE PAGO» y «Monto pendiente» (`apps/web/src/Prints.tsx:616-623`; `apps/web/src/POS.tsx:2462-2472`).
8. El incentivo de la cajera por esa parte se acredita **al cobrar**, no al vender (`apps/api/src/sales.ts:1314`, campo `incentiveOnCollection`).

## 3. Cobrar un crédito / contraentrega

### 3.1 Pantalla «Caja» › panel «Créditos pendientes»

- Panel con ícono de camión y texto: «Ventas entregadas sin pago. Cualquier cajera puede cerrarlas en efectivo, de cualquier día: el dinero entra a su caja y lo entrega al cerrar. La tarjeta y la transferencia las registra la administración.» (`apps/web/src/Tienda.tsx:649-661`).
- Pestañas **«Pendientes»** / **«Cerrados»** (`apps/web/src/Tienda.tsx:668-669`). La administración (`*`) además ve **«Por venta»** / **«Por persona»** (`:646`, `:654`); «Por persona» abre el estado de cuenta por cliente (`apps/web/src/CreditAccounts.tsx:39`; API `GET credit-accounts` en `apps/api/src/sales.ts:4744`, detalle `:4011`, PDF del estado de cuenta `:4018`).
- Cada fila muestra número FS-xxxxxxx, estado (Abierto / Parcial / Cerrado), tipo (Crédito o Contraentrega), días sin cobrar («Lleva N días sin cobrar», «Se cobró el mismo día») (`apps/web/src/Tienda.tsx:621-625`), «Total / Cobrado / Pendiente», lo «por verificar», y el historial de cobros con foto.
- Botón **«Registrar cobro»** (`apps/web/src/Tienda.tsx:832`) abre **«Registrar cobro · FS-…»** (`:1052`).

- **Arreglos del 19-nov (rama `claude/reparar-caja-cobros-19nov`):** En «Por persona» el banco de una transferencia se elige de las cuentas fijas de Configuración (`transferAccounts`; texto libre solo si no hay cuentas) y «Siguiente» solo aparece si la API dice `hasMore`. El estado de cuenta (pantalla y PDF) muestra también lo pagado al vender, marcado «Pagado al vender», para que el saldo se explique solo. Una venta pagada con una transferencia que luego se rechazó cuenta como por cobrar en todas estas listas (filtro `RECEIVABLE_SALE_PAYMENT` de `apps/api/src/credit-allocation.ts`), en el cobro de la cajera, en el recordatorio semanal y en los créditos abiertos del informe formal.

### 3.2 La ventana «Registrar cobro»

- Se pueden agregar varias líneas: **«Agregar otra forma de pago»** (`apps/web/src/Tienda.tsx:1283`). Cada línea: «Forma de pago» (Efectivo; Tarjeta y Transferencia solo con `sale:manage`) y «Monto entregado» (`:1124`).
- **Efectivo** entra a la **caja abierta** de quien registra. Si no tiene caja: «No tienes caja abierta: sin ella no puedes recibir efectivo. Abre tu caja o registra solo tarjeta o transferencia.» (`apps/web/src/Tienda.tsx:1174`; API: manejador `credit-collections`, `apps/api/src/sales.ts:5299`).
- Casilla (cajera): **«Este efectivo ya lo tiene la dueña (no entra a mi gaveta)»** + «PIN de gerente» (`apps/web/src/Tienda.tsx:1154`; API, reglas de PIN en el mismo manejador `apps/api/src/sales.ts:5299`).
- **Tarjeta**: «Referencia del voucher» obligatoria (`apps/web/src/Tienda.tsx:1219`).
- **Transferencia**: «Banco» (lista de cuentas de Configuración) y «Referencia» (obligatoria salvo para la dueña).
- **Foto de la evidencia** opcional: «Subir foto de la evidencia», JPG/PNG/WebP hasta 2 MB (`apps/web/src/Tienda.tsx:984`).
- Botón **«Guardar cobro»** (`apps/web/src/Tienda.tsx:1313`). API `POST /sales/:id/credit-collections` (manejador en `apps/api/src/sales.ts:5299`), permiso `sale:write`. Una cajera (sin `sale:manage`) solo puede cobrar en efectivo: «Las cajeras solo cierran créditos en efectivo. La tarjeta y la transferencia las registra la administración.» (`sales.ts:5315`).
- No se puede cobrar más que el saldo: «El cobro supera el saldo pendiente.» (`sales.ts:5479`). Se puede cobrar una parte y el resto después; el crédito se cierra cuando el saldo llega a cero (`apps/web/src/Tienda.tsx:1300-1301`).
- Efecto: se crea el `Payment` `installment`; efectivo/tarjeta → `ok` y descuentan el saldo al instante; transferencia → `pending_verification` y **no** descuenta hasta verificarse.

### 3.3 Otras vías de cobro (solo administración `*`)

- **Ventas › «Registrar abono»** en una venta con saldo (`apps/web/src/Management.tsx:3574`): ventana «Registrar pago de crédito / contraentrega · FS-…» (`:3716`) con «Monto del abono», «Método», banco/referencia o últimos 4/aprobación. API `POST /sales/:id/installments` (`apps/api/src/sales.ts:4641`). Exige caja abierta: «Abre tu caja para registrar abonos.» (`apps/web/src/Management.tsx:3561`).
- **Cobro de contraentrega cuando el mensajero trae el dinero**: `POST /sales/:id/cod-collections` (`apps/api/src/sales.ts:4653`); pide la referencia del voucher si es tarjeta.
- **Cobro por persona** (varias ventas de un cliente a la vez): `POST /credit-accounts/:id/collections` (`apps/api/src/sales.ts:4981`, manejador `collectCustomerCredit` en `:4086`); usa `allocateCredit` (`apps/api/src/credit-allocation.ts:2`).
- **Dueña (`*`)**: al registrar una transferencia se da por recibida y cierra el cobro al instante, solo indica el banco; el efectivo sin caja abierta queda como recibido por ella, fuera de cualquier caja (`apps/web/src/Tienda.tsx:1029-1031`, `:1098`, `:1216-1217`; API marca `OWNER_CASH_MARK`, `apps/api/src/sales.ts:5629`).
- **Pasar a una caja el efectivo «Recibido por la dueña»** (19-nov, caso FS-0000706): con `POST /payments/:id/move-cash-session` (por ahora sin botón en pantalla; lo hace Claude por la API con la confirmación de la dueña), la administración puede mover ese efectivo (que no estaba en ninguna caja) a la caja que de verdad lo recibió, con motivo. Se quita la marca «Recibido por la dueña», cuenta como recibido por quien tenía la caja y, si la caja ya cerró, se recalcula su diferencia con aviso y bitácora (API `POST /payments/:id/move-cash-session`, `apps/api/src/sales.ts`). En un contraentrega mixto, el efectivo lo registra la cajera que lo recibe en su caja y la transferencia la valida la dueña.

### 3.4 Venta con saldo y devolución

Una venta con cobros válidos registrados no se puede anular, ni corregir su método sin pasar por la regla de cobros registrados (`apps/api/src/sales.ts:2754`, `correctPaymentMethod`). Las devoluciones reducen primero el saldo pendiente (`apps/api/src/sales.ts:4378`, `debtReduction`; descuento del saldo en `:3569`).

## 4. Transferencias: del cobro a la verificación

### 4.1 Cómo nace una transferencia por verificar

- En la caja: método **Transferencia** + «Cuenta donde cayó» (`apps/web/src/POS.tsx:2896`, bloque en `:2776`) + «Referencia». El pago queda `pending_verification` (`apps/api/src/sales.ts:1575`) y se crea una **alerta alta** «Transferencia de FS-… por RD$ … sin verificar · banco · ref.» (`sales.ts:1589-1594`, tipo `transfer_pending`).
- El monto de una transferencia **cuenta en el esperado de la caja** (`apps/api/src/cash.ts:55-113`, función `cashExpected`), pero el cierre usa lo que el sistema suma, no lo que declara la cajera (misma función).
- En abonos: cobro por transferencia de una cajera/gerente → `pending_verification` hasta verificarla (manejador `installment`, `apps/api/src/sales.ts:4641`). Un abono pendiente no descuenta la deuda.

### 4.2 Verificar (solo administración `*`)

Dos caminos:

**A) Pantalla «Conciliar transferencias»** (`apps/web/src/TransferReconciliation.tsx:33`; lista de pendientes `GET /payments/pending-transfers`, permiso `sale:manage`, `apps/api/src/sales.ts:3514`):

1. Opcional: filtrar «Fecha del pago (opcional)» (`apps/web/src/TransferReconciliation.tsx:206`) o «Todas las fechas»; «Exportar lista a CSV» (`:216`).
2. Marcar las facturas que aparecen juntas en el depósito del banco; el sistema suma el «Total esperado seleccionado».
3. Escribir **«Total del banco (RD$)»** (`:396`); muestra **«Diferencia»** (`:413`): «Cuadrado · RD$ 0.00» (`:419`) o la diferencia.
4. **«Verificar seleccionadas»** (`:426`). «El total ayuda a revisar; no verifica pagos por sí solo.» Cada factura se verifica individualmente y se muestra el resultado.
5. Si el envío del mensajero explica la diferencia: «Usar RD$ X como envío» (`:321`) o «Editar envío».
6. **«Rechazar»** una factura: «Motivo del rechazo» + «Confirmar rechazo» (`:359`).

**B) Desde «Ventas»** abriendo la factura (ojo): por cada transferencia pendiente, botones **«Verificar»** (`apps/web/src/Management.tsx:3932`), **«Rechazar»** (`:3530`) y **«Corregir banco y referencia»** (`:3455`; bloque de transferencias en `:3445`).

API de verificar: `POST /payments/:id/verify` (permiso `*`) (`apps/api/src/sales.ts:3626`). Efecto:

- `pending_verification` → `ok`; se resuelve la alerta.
- Si era un abono: baja el saldo, cierra el crédito si llega a cero y acredita incentivos.
- Si la caja ya cerró: **recalcula el cuadre** y deja auditoría `verified_after_close` (`apps/api/src/sales.ts:3672`; `apps/api/src/cash.ts:239`, `refreshClosedCash`).
- Una transferencia ya rechazada no se verifica: «La transferencia fue rechazada; registra un abono nuevo.» (`apps/api/src/sales.ts:3690`).

### 4.3 Rechazar (el dinero no llegó)

- Botón «Rechazar» → «Rechazar transferencia de RD$ …» con motivo (`apps/web/src/Management.tsx:3980`; textos de ayuda en `:3594-3596`). API `POST /payments/:id/reject` (`*`) (`apps/api/src/sales.ts:3996`).
- Transferencia **de una venta**: la mercancía ya salió, así que ese importe **pasa a cuenta por cobrar del cliente** y sale del esperado de la caja; si la caja ya cerró, se recalcula (`sales.ts:3996` y siguientes; auditoría `rejected_after_close` en `:3207`). Si parte ya se devolvió y no se puede cobrar, crea la alerta `transfer_rejected_loss` (`:3173`).
- Transferencia **de un abono**: no descuenta deuda ni entra a caja (`apps/web/src/Management.tsx:3988`).
- Solo se rechaza una `pending_verification`.
- Verificar, des-verificar, corregir y rechazar usan el plazo de las operaciones de dinero (`MONEY_TRANSACTION`, 20 s, con reintento de interbloqueo) desde el 19-nov.
- Al **anular** una venta, su transferencia por verificar sale de la lista «Transferencias por verificar» (la lista solo muestra ventas completadas) y su alerta `transfer:<id>` queda resuelta (19-nov).
- Al conciliar, «POULAR» y «BPD» se agrupan con Popular (solo el agrupado de la pantalla; el dato no cambia).

### 4.4 Corregir banco y referencia

- «Corregir banco y referencia» (`*`; pago `pending_verification` u `ok`): campos «Banco correcto», «Referencia correcta», «Motivo de la corrección» (`apps/web/src/Management.tsx:4054-4086`, etiqueta en `:3614`); no cambia importe ni estado y queda en la bitácora. API `POST /payments/:id/correct-transfer` (`apps/api/src/sales.ts:3923`). Si otra persona la corrigió antes: «Otro usuario corrigió la transferencia. Actualiza la venta antes de continuar.» (`apps/api/src/sales.ts:3965`).

## 5. Cuando la caja ya cerró

Qué pasa y quién lo hace:

| Situación                                                                       | Qué ocurre                                                                                                                                                                          | Cita                                                                           |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Se verifica una transferencia después del cierre                                | Se recalcula esperado y diferencias del cierre; auditoría `verified_after_close`.                                                                                                   | `apps/api/src/sales.ts:3672`; `apps/api/src/cash.ts:239` (`refreshClosedCash`) |
| Se rechaza una transferencia de venta después del cierre                        | Igual: recalcula y `rejected_after_close`.                                                                                                                                          | `apps/api/src/sales.ts:4092`                                                   |
| Se sincroniza una venta hecha sin conexión a una caja cerrada                   | Queda en conflicto: «La caja de esta venta ya cerró: gerencia debe revisarla y registrarla con una justificación.»                                                                  | `apps/api/src/sales.ts:989`; revisión en `apps/api/src/offline-sale-review.ts` |
| Se cambia algo en una caja cerrada (método corregido, venta offline, anulación) | `closedCashChanged` crea la alerta **«Caja cerrada de X cambiada por Y»** con justificación y diferencia nueva; si hay tarjeta y el cierre no tiene lote, otra alerta «falta lote». | `apps/api/src/cash.ts:311-357`; llamada en `apps/api/src/sales.ts:1615`        |
| Se anula una venta cuya caja cerró y hubo efectivo                              | El reembolso sale de la caja **abierta** de quien anula; si no tiene: «La caja de esta venta ya cerró. Abre tu caja para entregar el reembolso en efectivo y vuelve a anular.»      | `apps/api/src/sales.ts:3311`                                                   |

## 6. Correcciones de administración (solo `*`)

### 6.1 Desplegado: corregir el método de pago de una venta

- Pantalla: **Ventas › abrir la factura (ojo) › panel «Corregir factura»** (solo si es vigente y tiene **máximo 7 días**) (`apps/web/src/Management.tsx:3657-3667`; `apps/web/src/SaleEditPanel.tsx:8-11`, `editableNow`, `EDIT_DAYS = 7`).
- Por cada pago de la factura: lista de métodos (Efectivo, Tarjeta, Transferencia, Contraentrega, Crédito) y botón **«Cambiar método de pago»** (`apps/web/src/SaleEditPanel.tsx:185`, envío en `:177`). Si el nuevo es Transferencia pide «Banco» y «Referencia».
- API `POST /sales/:id/payments/:paymentId/correct-method` (`*`), con motivo (`apps/api/src/sales.ts:2684`, manejador `correctPaymentMethod`). Reglas: solo pagos **de la venta o cobros** (`entryType` `sale` o `installment`, `:2228-2230`); no en dólares; no rechazados. Un cobro (abono o contraentrega cobrada) solo se mueve **entre efectivo, tarjeta y transferencia**, y solo si hoy está en efectivo o tarjeta y en estado `ok`; nunca pasa a crédito ni a contraentrega (`:2235`). Si pasa a transferencia, la deuda vuelve hasta que se verifique (la cuenta deja de estar cerrada). Limitado a 7 días por `editableSale` (`apps/api/src/common.ts:950-962`). Ajusta el saldo, la comisión de tarjeta, el estado, la alerta y los incentivos, y si la caja ya cerró la recalcula. Auditoría `payment_method_corrected` (`:2371`).
- Si el cobro no está en ninguna caja (tarjeta o transferencia registrada sin caja) y pasa a **efectivo**, la API exige `cashSessionId` (la caja que recibió el efectivo; se bloquea antes que la venta y se recalcula si ya cerró) o `ownerConfirmed: true` (queda como «Recibido por la dueña»). Sin ninguno: «Este cobro no está en ninguna caja…» (19-nov). La pantalla de Ventas aún no ofrece esos dos campos: necesita Dot.
- Otras correcciones de la misma factura: «Cambiar vendedora» (`apps/web/src/SaleEditPanel.tsx:113`; API `POST sales/:id/seller`, `apps/api/src/sales.ts:2335`) y «Marcar «al por mayor»» (`SaleEditPanel.tsx:124`; API `POST sales/:id/mark-wholesale`, `apps/api/src/sales.ts:2286`), y el envío del mensajero (`apps/web/src/CourierFeeEditor.tsx:6`).

### 6.2 Desplegado en `nexora-cloud` (1e25909f): des-verificar y mover un cobro

API solamente; **no hay pantalla** para estas dos acciones en `apps/web` (búsqueda de `unverify` y `move-cash-session` en `apps/web/src`: sin resultados). Solo se pueden usar con una llamada directa a la API con permiso `*`.

1. **Des-verificar una transferencia**: `POST /payments/:id/unverify` (`*`, motivo obligatorio; `apps/api/src/sales.ts:3690`, manejador `unverify`). Devuelve una transferencia **de venta** ya verificada a `pending_verification` (`:2889`), reabre la alerta (`:2895`, tipo `transfer_pending`) y, si la caja ya cerró, recalcula el cuadre y deja la alerta de caja cambiada. Usa la referencia `unverify:<id>` (`:2913`). Un abono verificado no se des-verifica (ya descontó la deuda).
2. **Mover un pago de caja**: `POST /payments/:id/move-cash-session` (`*`, motivo y `cashSessionId` destino; `apps/api/src/sales.ts:3783`, manejador `moveCashSession`). Cambia a qué caja pertenece el cobro; bloquea las dos cajas en orden fijo; recalcula las dos si alguna ya cerró y deja alertas y bitácora. No toca la venta, la deuda ni el inventario. Rechaza un cobro ya rechazado («Este cobro fue rechazado; no se mueve.») y uno que ya está en esa caja («El cobro ya está en esa caja.»).

### 6.3 Rama `claude/corregir-pago-usd-20nov` (sin desplegar): reemplazar los pagos de una venta y tope del cobro en dólares

Caso FS-0000730 (19-nov, caja de Wendy, Computadora 75AA, ya cerrada): venta de RD$ 3,500 donde se tecleó US$ 2,360 en vez de US$ 40 (tasa 60.457: entregado RD$ 142,678.52, vuelto RD$ 139,178.52) y la tarjeta de RD$ 1,140 (ref. 406574) no quedó en la factura.

1. **Reemplazar los pagos**: `POST /sales/:id/payments/replace` (`*`, equipo registrado, motivo obligatorio; `apps/api/src/sales.ts:2932`, manejador `replacePayments`). API solamente, sin pantalla: lo usa Norexos 2 con el sí de la dueña y verificación 3× antes y después. Cambia **todos** los pagos de una venta completada (máximo 7 días, `editableSale`) por un conjunto nuevo de efectivo (pesos o US$), tarjeta o, solo con `allowTransfer: true`, transferencia. `amount` es lo aplicado en pesos y la suma debe ser el total al centavo; en US$ se exigen `amountUsd` y `usdRate` (la tasa de algún pago en US$ de la venta o la de Configuración), entregado = US$ × tasa y vuelto = entregado − aplicado; solo el efectivo da vuelto; la tarjeta pide aprobación o referencia. `cashSessionId` de un pago nuevo solo puede ser una caja que la venta ya tenía (la de la venta o la de sus pagos); sin él, va a la caja de la venta. Los pagos nuevos llevan la fecha de la venta (los informes por día los ponen ese día). Rechaza: venta anulada, con abonos, crédito, contraentrega, nota de crédito, pago rechazado, saldo o devoluciones; una caja abierta de otra persona; los mismos pagos que ya tiene; la misma `operationId` (409) y que las cajas de la venta cambien mientras se corrige (409). Si toca una caja cerrada exige `ownerConfirmed: true`, recalcula su cierre (`refreshClosedCash`), deja la alerta `cash_after_close` (`cash-after-close:<caja>:replace:<venta>`, con la diferencia en efectivo, tarjeta, transferencia y US$) y la bitácora `sale_payments_replaced` con los pagos y las cifras de la caja antes y después. En una caja abierta propia, si el efectivo esperado baja deja la alerta `cash_payments_replaced` (solo la dueña). No toca artículos, inventario, incentivos ni precios, y no depende del tope de abajo.
2. **Tope preventivo al cobrar, APAGADO por defecto** (`POST /sales` y `/sales/sync`; `largeForeignPayment` en `packages/shared/src/index.ts:664`, aplicado en `apps/api/src/sales.ts:1137`): solo actúa con la variable de entorno `LARGE_FOREIGN_GUARD=on` (función `largeForeignGuardEnabled`), que no se debe encender hasta que la caja tenga el botón. Encendido: si la **suma** de los pagos en US$, en pesos, supera **3 veces** el total y el vuelto pasa de **RD$ 5,000**, la API responde 409 «Revisa el monto en dólares: US$ … a RD$ … son RD$ …, más de 3 veces el total de la venta (RD$ …); el vuelto sería RD$ …» salvo que llegue `confirmLargeForeign: true` y, si quien cobra no tiene `sale:manage`, el `managerPin` de un gerente (el PIN solo se comprueba cuando el tope aplica). Queda la bitácora `large_foreign_confirmed`. Las ventas sin conexión que sincroniza la cajera **sí** se frenan (quedan en conflicto para revisión); solo la revisión de gerencia de una venta ya entregada no se frena. Las ventas normales (US$ 40 + tarjeta, un billete de US$ 20 en una venta pequeña) no cambian. **Pantalla (necesita Dot):** al recibir ese 409 la caja debe mostrar el mensaje tal cual, un botón «Sí, el monto en dólares es correcto» que reenvía con `confirmLargeForeign: true` y, para la cajera, el campo del PIN de gerente (`managerPin`); recién entonces se enciende `LARGE_FOREIGN_GUARD=on`.

## 7. Resumen de quién puede qué en cobros

| Acción                                                | Permiso                                    | Cita                                                                   |
| ----------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Vender a crédito/contraentrega                        | `sale:write` (PIN de gerente según reglas) | `apps/api/src/sales.ts:1664` (`@Post("sales")`)                        |
| Cobrar un crédito en efectivo                         | `sale:write`                               | `apps/api/src/sales.ts:5299` (manejador), `:4423`                      |
| Cobrar un crédito en tarjeta/transferencia            | `sale:manage`                              | `apps/api/src/sales.ts:5315`                                           |
| Abono desde «Ventas» / cobro de mensajero             | `*`                                        | `apps/api/src/sales.ts:4641`, `:3768`                                  |
| Estado de cuenta por persona                          | `*`                                        | `apps/api/src/sales.ts:4744`, `:4018`                                  |
| Verificar / rechazar / corregir banco y referencia    | `*`                                        | `apps/api/src/sales.ts:3626`, `:3111`, `:3038`                         |
| Des-verificar / mover un cobro de caja (sin pantalla) | `*`                                        | `apps/api/src/sales.ts:3690`, `:2942`                                  |
| Ver la lista de transferencias pendientes             | `sale:manage`                              | `apps/api/src/sales.ts:3514`                                           |
| Corregir método de pago (7 días; también cobros)      | `*`                                        | `apps/api/src/sales.ts:2684`                                           |
| Subir/cambiar la foto de evidencia                    | quien registró el cobro o `sale:manage`    | `apps/api/src/sales.ts`, rutas `payments/:id/proof` (`:3782`, `:3822`) |

## GV: pago con tarjeta (sin cuenta bancaria)

- Los pagos de GV no pasan por la caja. Con **Tarjeta** el formulario no pide banco: muestra **Terminal** y una **Referencia** obligatoria (aprobación, lote o voucher); el pago queda verificado al registrarse (`apps/api/src/gv-money.ts:212-228`, `apps/api/src/gv-money.ts:499-506`). La transferencia sigue exigiendo banco y referencia.
- El dinero de tarjeta de GV se registra en el área GV / Grupo Génesis, sin elegir cuenta de banco (respuesta de la dueña): el pago guarda `destination = "gv"`; no hay cuenta ni terminal inventadas.

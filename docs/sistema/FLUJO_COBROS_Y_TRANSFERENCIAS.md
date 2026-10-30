# Cobros: crédito, contraentrega, abonos y transferencias

Rama `cola-n26` (= `nexora-cloud`) salvo donde dice otra rama. Citas `archivo:línea`.

## 1. Vocabulario rápido

- **Crédito / contraentrega**: la mercancía sale ahora y el dinero se cobra después. En la base es un pago con método `cod` y estado `pending`; el saldo vive en `Sale.creditBalance` (`apps/api/src/sales.ts:1378-1384`, `:1146`). «Crédito» y «Contraentrega» son solo una etiqueta de estadística (`receivableKind`: `credit` o `cod`); tienen las mismas reglas (`apps/api/prisma/schema.prisma`, comentario de `receivableKind`; `apps/web/src/POS.tsx:1798-1802`).
- **Abono / cobro**: un pago posterior sobre una venta con saldo. Se guarda como `Payment` con `entryType = "installment"` (`apps/api/src/sales.ts:4414-4429`). Un pago hecho al vender tiene `entryType = "sale"`.
- **Verificar**: confirmar contra el banco que una transferencia llegó. Estados del pago: `ok`, `pending_verification`, `rejected` y `pending` (deuda sin cobrar) (`apps/api/prisma/schema.prisma` modelo `Payment`, campo `status`).

## 2. Vender a crédito o contraentrega (en la caja)

Pasos exactos en `FLUJO_CAJA_POS.md` §5.1. Resumen:

1. Elegir **cliente** (obligatorio, `apps/web/src/POS.tsx:2046-2049`).
2. En «Todo listo para cobrar» pulsar **«Vender a crédito (queda pendiente)»** (`:2466-2473`) o los botones **«Contraentrega»** / **«Crédito»** (`:2542-2548`).
3. Confirmar con **«Sí, vender a crédito»** (`:2530`). El texto avisa: «El cliente se lleva la mercancía sin pagar esa parte, la caja no recibe ese dinero y solo un administrador podrá cobrarlo.» (`:2510-2511`; ojo: otro texto dice que cualquier cajera puede cobrar en efectivo, ver §3).
4. Reglas de aprobación con **PIN de gerente** (`packages/shared/src/index.ts:403-444`): monto de crédito > umbral (`creditApprovalThreshold`, RD$ 1,000 por defecto); contraentrega de quien no tiene `sale:manage` > umbral o con ventas a crédito deshabilitadas; deuda abierta del cliente + esta venta > umbral; lo dejado por cobrar en el turno > RD$ 3,000 (`receivableShiftLimit`).
5. Límite por cliente: `Customer.creditLimit` (0 = sin límite para crédito): «La venta supera el límite de crédito del cliente.» (`apps/api/src/sales.ts:1015-1025`).
6. Necesita conexión (no se guarda sin internet) (`apps/web/src/POS.tsx:2004-2009`, `:2177-2180`).
7. El recibo imprime «CRÉDITO · PENDIENTE DE PAGO» y «Monto pendiente» (`apps/web/src/Prints.tsx:616-623`; `apps/web/src/POS.tsx:2363-2375`).
8. El incentivo de la cajera por esa parte se acredita **al cobrar**, no al vender (`apps/api/src/sales.ts:1153`, campo `incentiveOnCollection`).

## 3. Cobrar un crédito / contraentrega

### 3.1 Pantalla «Caja» › panel «Créditos pendientes»

- Panel con ícono de camión y texto: «Ventas entregadas sin pago. Cualquier cajera puede cerrarlas en efectivo, de cualquier día: el dinero entra a su caja y lo entrega al cerrar. La tarjeta y la transferencia las registra la administración.» (`apps/web/src/Tienda.tsx:602-614`).
- Pestañas **«Pendientes»** / **«Cerrados»** (`:620-635`). La administración (`*`) además ve **«Por venta»** / **«Por persona»** (`:638-657`); «Por persona» abre el estado de cuenta por cliente (`apps/web/src/CreditAccounts.tsx:36`, API `apps/api/src/sales.ts:3633-3856`, PDF del estado de cuenta `:3792`).
- Cada fila muestra número FS-xxxxxxx, estado (Abierto / Parcial / Cerrado), tipo (Crédito o Contraentrega), días sin cobrar («Lleva N días sin cobrar», «Se cobró el mismo día»), «Total / Cobrado / Pendiente», lo «por verificar», y el historial de cobros con foto (`:569-583`, `:672-747`).
- Botón **«Registrar cobro»** (`:752-756`) abre **«Registrar cobro · FS-…»** (`:1052`).

### 3.2 La ventana «Registrar cobro»

- Se pueden agregar hasta 4 líneas: **«Agregar otra forma de pago»** (`:1194-1203`). Cada línea: «Forma de pago» (Efectivo; Tarjeta y Transferencia solo con `sale:manage`) y «Monto entregado» (`:1105-1134`).
- **Efectivo** entra a la **caja abierta** de quien registra (si no tiene caja: «No tienes caja abierta: sin ella no puedes recibir efectivo. Abre tu caja o registra solo tarjeta o transferencia.») (`:1090-1095`; API `apps/api/src/sales.ts` `collect`, mensaje en `:4333-4336`).
- Casilla (cajera): **«Este efectivo ya lo tiene la dueña (no entra a mi gaveta)»** + «PIN de gerente» (`:1064-1089`; API `sales.ts:4195-4215`).
- **Tarjeta**: «Referencia del voucher» obligatoria (`:1135-1145`; `sales.ts:4371`).
- **Transferencia**: «Banco» (lista de cuentas de Configuración) y «Referencia» (obligatoria salvo para la dueña) (`:1146-1182`; `sales.ts:4383-4389`).
- **Foto de la evidencia** opcional: «Subir foto de la evidencia», JPG/PNG/WebP hasta 2 MB (`:860-926`; API `sales.ts:3556`).
- Botón **«Guardar cobro»** (`:1230-1232`). API `POST /sales/:id/credit-collections`, permiso `sale:write`; una cajera (sin `sale:manage`) solo puede cobrar en efectivo: «Las cajeras solo cierran créditos en efectivo…» (`sales.ts:4181-4195`).
- No se puede cobrar más que el saldo: «El cobro supera el saldo pendiente.» (`sales.ts:4353-4366`). Se puede cobrar una parte y el resto después; el crédito se cierra cuando el saldo llega a cero (`apps/web/src/Tienda.tsx:1218-1219`).
- Efecto: se crea el `Payment` `installment`; efectivo/tarjeta → `ok` y descuentan el saldo al instante; transferencia → `pending_verification` y **no** descuenta hasta verificarse (`sales.ts:4414-4440`).

### 3.3 Otras vías de cobro (solo administración `*`)

- **Ventas › «Registrar abono»** en una venta con saldo: ventana «Registrar pago de crédito / contraentrega · FS-…» con «Monto del abono», «Método», banco/referencia o últimos 4/aprobación (`apps/web/src/Management.tsx:3258-3279`, `:3713-3750`; API `POST /sales/:id/installments`, `apps/api/src/sales.ts:3527-3541`). Exige tener caja abierta («Abre tu caja para registrar abonos.»).
- **Cobro de contraentrega cuando el mensajero trae el dinero**: `POST /sales/:id/cod-collections` (`sales.ts:3542-3555`); pide la referencia del voucher si es tarjeta.
- **Cobro por persona** (varias ventas de un cliente a la vez): `POST /credit-accounts/:id/collections` (`sales.ts:3857`); usa `allocateCredit` (`apps/api/src/credit-allocation.ts`).
- **Dueña (`*`)**: al registrar una transferencia se da por recibida y cierra el cobro al instante, solo indica el banco; el efectivo sin caja abierta queda como recibido por ella, fuera de cualquier caja (`apps/web/src/Tienda.tsx:947-949`, `:1096-1101`, `:1215-1217`; API `sales.ts:4383`, marca `OWNER_CASH_MARK`).

### 3.4 Venta con saldo y devolución

Una venta con cobros válidos registrados no se puede anular (el botón «Anular» desaparece, `apps/web/src/Management.tsx:3320-3327`), ni corregir su método (`apps/api/src/sales.ts:2239-2241`, en esta rama). Las devoluciones reducen primero el saldo pendiente (`sales.ts:3340-3347`, `debtReduction`).

## 4. Transferencias: del cobro a la verificación

### 4.1 Cómo nace una transferencia por verificar

- En la caja: método **Transferencia** + «Cuenta donde cayó» + «Referencia» (`apps/web/src/POS.tsx:2776-2816`). El pago queda `pending_verification` (`apps/api/src/sales.ts:1377-1381`) y se crea una **alerta alta** «Transferencia de FS-… por RD$ … sin verificar · banco · ref.» (`sales.ts:1385-1405`, tipo `transfer_pending`).
- El monto de una transferencia **cuenta en el esperado de la caja** (`apps/api/src/cash.ts:55-113`), pero el cierre usa lo que el sistema suma, no lo que declara la cajera (`cash.ts:1213`).
- En abonos: cobro por transferencia de una cajera/gerente → `pending_verification` hasta verificarla (`sales.ts:4424-4426`). Un abono pendiente no descuenta la deuda (`sales.ts:4430-4440`).

### 4.2 Verificar (solo administración `*`)

Dos caminos:

**A) Pantalla «Conciliar transferencias»** (`apps/web/src/TransferReconciliation.tsx:28`; lista de pendientes `GET /payments/pending-transfers`, permiso `sale:manage`, `apps/api/src/sales.ts:2638-2748`):
1. Opcional: filtrar «Fecha del pago (opcional)» o «Todas las fechas»; «Exportar lista a CSV» (`:192-218`).
2. Marcar las facturas que aparecen juntas en el depósito del banco; el sistema suma el «Total esperado seleccionado».
3. Escribir **«Total del banco (RD$)»**; muestra **«Diferencia»**: «Cuadrado · RD$ 0.00» o la diferencia (`:396-419`).
4. **«Verificar seleccionadas»** (`:422-428`). «El total ayuda a revisar; no verifica pagos por sí solo» (`:185-188`). Cada factura se verifica individualmente y se muestra el resultado (`:221-250`).
5. Si el envío del mensajero explica la diferencia: «Usar RD$ X como envío» o «Editar envío» (`:300-336`).
6. **«Rechazar»** una factura: «Motivo del rechazo» + «Confirmar rechazo» (`:339-380`).

**B) Desde «Ventas»** abriendo la factura (ojo): por cada transferencia pendiente, botones **«Verificar»**, **«Rechazar»** y **«Corregir banco y referencia»** (`apps/web/src/Management.tsx:3445-3532`).

API de verificar: `POST /payments/:id/verify` (permiso `*`) (`apps/api/src/sales.ts:2749-2810`). Efecto:
- `pending_verification` → `ok`; se resuelve la alerta (`:2790-2792`).
- Si era un abono: baja el saldo, cierra el crédito si llega a cero y acredita incentivos (`:2775-2790`).
- Si la caja ya cerró: **recalcula el cuadre** y deja auditoría `verified_after_close` (`:2792-2806`).
- Una transferencia ya rechazada no se verifica: «La transferencia fue rechazada; registra un abono nuevo.» (`:2768`).

### 4.3 Rechazar (el dinero no llegó)

- Botón «Rechazar» → «Rechazar transferencia de RD$ …» con motivo (`apps/web/src/Management.tsx:3589-3604`). API `POST /payments/:id/reject` (`*`) (`apps/api/src/sales.ts:2885-2995`).
- Transferencia **de una venta**: la mercancía ya salió, así que ese importe **pasa a cuenta por cobrar del cliente** y sale del esperado de la caja; si la caja ya cerró, se recalcula (`sales.ts:2878-2884`, `:2915-2985`). Si parte ya se devolvió y no se puede cobrar, crea la alerta `transfer_rejected_loss` (`:2940-2955`).
- Transferencia **de un abono**: no descuenta deuda ni entra a caja (`apps/web/src/Management.tsx:3594-3596`).
- Solo se rechaza una `pending_verification` (`sales.ts:2911`).

### 4.4 Corregir banco y referencia

- «Corregir banco y referencia» (`*`; pago `pending_verification` u `ok`): campos «Banco correcto», «Referencia correcta», «Motivo de la corrección»; no cambia importe ni estado y queda en la bitácora (`apps/web/src/Management.tsx:3605-3637`; API `POST /payments/:id/correct-transfer`, `apps/api/src/sales.ts:2812-2884`). Si otra persona la corrigió antes: «Otro usuario corrigió la transferencia. Actualiza la venta…» (`:2848`, `:2854`).

## 5. Cuando la caja ya cerró

Qué pasa y quién lo hace:

| Situación | Qué ocurre | Cita |
|---|---|---|
| Se verifica una transferencia después del cierre | Se recalcula esperado y diferencias del cierre; auditoría `verified_after_close`. | `apps/api/src/sales.ts:2790-2806`; `apps/api/src/cash.ts:229-258` (`refreshClosedCash`) |
| Se rechaza una transferencia de venta después del cierre | Igual: recalcula y `rejected_after_close`. | `sales.ts:2975-2990` |
| Se sincroniza una venta hecha sin conexión a una caja cerrada | Queda en conflicto: «La caja de esta venta ya cerró: gerencia debe revisarla y registrarla con una justificación.» Al registrarla se recalcula la caja y se avisa. | `sales.ts:866-870`, `:1399-1430`; revisión en `apps/api/src/offline-sale-review.ts` |
| Se cambia algo en una caja cerrada (método corregido, venta offline, anulación) | `closedCashChanged` crea la alerta **«Caja cerrada de X cambiada por Y»** con justificación y diferencia nueva; si hay tarjeta y el cierre no tiene lote, otra alerta «falta lote». | `apps/api/src/cash.ts:262-310` |
| Se anula una venta cuya caja cerró y hubo efectivo | El reembolso sale de la caja **abierta** de quien anula; si no tiene: «La caja de esta venta ya cerró. Abre tu caja…». | `sales.ts:2429-2441` |

## 6. Correcciones de administración (solo `*`)

### 6.1 Ya desplegado en `nexora-cloud`: corregir el método de pago de una venta

- Pantalla: **Ventas › abrir la factura (ojo) › panel «Corregir factura»** (solo si es vigente y tiene **máximo 7 días**) (`apps/web/src/Management.tsx:3350-3360`; `apps/web/src/SaleEditPanel.tsx:9-12`, `:80-190`).
- Por cada pago de la factura: lista de métodos (Efectivo, Tarjeta, Transferencia, Contraentrega, Crédito) y botón **«Cambiar método de pago»**; si el nuevo es Transferencia pide «Banco» y «Referencia» (`apps/web/src/SaleEditPanel.tsx:11-17`, `:130-188`).
- API `POST /sales/:id/payments/:paymentId/correct-method` (`*`), con motivo (`apps/api/src/sales.ts:2192-2368`). Reglas: solo pagos **de la venta** (no abonos), no en dólares, no rechazados, no si ya hay cobros registrados ni devoluciones (`sales.ts:2205-2241`). Ajusta el saldo, la comisión de tarjeta, el estado (transferencia → por verificar), la alerta y los incentivos, y si la caja ya cerró la recalcula (`:2252-2336`). Auditoría `payment_method_corrected`.
- Otras correcciones de la misma factura: «Cambiar vendedora» y «Marcar «al por mayor»» (`SaleEditPanel.tsx:107-125`; API `sales.ts:2092`, `:2141`), y el envío del mensajero (`apps/web/src/CourierFeeEditor.tsx`).

### 6.2 **Aún no desplegado**: rama `claude/ajustes-cobros` (commit `54d8ca1c`, 30-oct-2026)

Leído con `git show origin/claude/ajustes-cobros:apps/api/src/sales.ts`. Cambia solo la API (más pruebas en `tests/pagos-ajustes-api.test.ts`); **no hay pantalla nueva** en esa rama (no toca `apps/web`). Está en esa rama únicamente; no está en `nexora-cloud`.

1. **Corregir el método de un COBRO (abono / contraentrega cobrada) mal marcado.** Extiende `correct-method` (en esa rama `sales.ts:2198`): ahora acepta pagos `installment`, no solo `sale`. Un cobro solo se mueve **entre efectivo, tarjeta y transferencia**, y solo si hoy está en efectivo o tarjeta y en estado `ok`; nunca pasa a crédito ni a contraentrega. Si pasa a transferencia, la deuda vuelve hasta que se verifique, y la cuenta deja de estar cerrada. Caso que lo motivó: FS-328 (efectivo que fue transferencia). Sigue limitado a 7 días por `editableSale` (`apps/api/src/common.ts:879-891`).
2. **Des-verificar una transferencia**: `POST /payments/:id/unverify` (`*`, motivo obligatorio; `sales.ts:2849` en esa rama). Devuelve una transferencia **de venta** ya verificada a `pending_verification`, reabre la alerta y, si la caja ya cerró, recalcula el cuadre y deja la alerta de caja cambiada. Un abono verificado no se des-verifica (ya descontó la deuda). Caso: FS-288 (se verificó contra el depósito equivocado).
3. **Mover un pago de caja**: `POST /payments/:id/move-cash-session` (`*`, motivo y `cashSessionId` destino; `sales.ts:2942` en esa rama). Cambia a qué caja pertenece el cobro, recalcula las dos cajas si alguna ya cerró y deja alertas y bitácora; no toca la venta, la deuda ni el inventario. Caso: FS-304 (cobro en una caja temporal que debía contar en otra).

Mientras no se despliegue: **no se puede** des-verificar ni mover un pago de caja desde el sistema; y un cobro (abono) mal marcado no se puede corregir de método. NO ENCONTRADO: pantalla o botón para estas tres acciones en ninguna rama revisada.

## 7. Resumen de quién puede qué en cobros

| Acción | Permiso | Cita |
|---|---|---|
| Vender a crédito/contraentrega | `sale:write` (PIN de gerente según reglas) | `apps/api/src/sales.ts:1469` |
| Cobrar un crédito en efectivo | `sale:write` | `sales.ts:4181-4183` |
| Cobrar un crédito en tarjeta/transferencia | `sale:manage` | `sales.ts:4190-4195` |
| Abono desde «Ventas» / cobro de mensajero / estado de cuenta | `*` | `sales.ts:3527-3555`, `:3633` |
| Verificar / rechazar / corregir banco y referencia | `*` | `sales.ts:2749`, `:2885`, `:2812` |
| Ver la lista de transferencias pendientes | `sale:manage` | `sales.ts:2638-2640` |
| Corregir método de pago (7 días) | `*` | `sales.ts:2192-2195` |
| Subir/cambiar la foto de evidencia | quien registró el cobro o `sale:manage` | `sales.ts:3556-3595` |

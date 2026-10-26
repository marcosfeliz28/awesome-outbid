# N3 · Auditoría de efectivo esperado negativo

**Fecha:** 26 de octubre de 2026  
**Base revisada:** `origin/nexora-cloud` en `a9123336ca4e1cf5882ec8f31557896119467628`  
**Alcance:** revisión estática, sin cambios de código ni despliegue.

## Conclusión ejecutiva

El arreglo de `voidSaleTx` protege correctamente la anulación directa y la aprobación de una solicitud cuando la caja original sigue abierta: bloquea la caja, elimina la venta del cálculo dentro de la misma transacción y aborta si el efectivo esperado queda por debajo de cero.

La devolución en efectivo y las salidas de caja tienen controles equivalentes. El vale, el traslado y abrir una caja nueva no reducen el efectivo esperado. Un gasto marcado como efectivo tampoco modifica hoy la caja; esto no vuelve negativo el cálculo, pero puede dejarlo por encima del efectivo físico.

Sí encontré **otro camino de severidad alta**: corregir un pago de `cash` a tarjeta, transferencia, crédito o contraentrega. Con la caja abierta, esa operación retira el cobro del cálculo sin bloquear la caja ni comprobar el saldo resultante. Con la caja cerrada, recalcula el cierre, pero tampoco impide persistir un `expectedCash` histórico negativo.

## Fórmula y frontera de la auditoría

`cashExpected` parte del fondo, suma pagos en efectivo de ventas completadas, suma entradas, resta salidas y resta devoluciones en efectivo (`apps/api/src/cash.ts:55-112`). La versión usada al listar varias cajas replica la fórmula (`apps/api/src/cash.ts:119-178`). Los gastos, los vales de cierre y el equipo asignado a la caja no forman parte de esa fórmula.

## Hallazgos

### N3-01 · Alta · Corregir un pago en efectivo a otro método puede dejar el esperado negativo

**Evidencia:**

- `apps/api/src/sales.ts:2164-2169` bloquea/consulta la venta mediante `editableSale` y localiza el pago, pero no bloquea su `CashSession`.
- `apps/api/src/sales.ts:2199-2217` cambia el método del pago. Si pasa de `cash` a otro método, ese importe deja inmediatamente de sumar en `cashExpected`.
- `apps/api/src/sales.ts:2266-2280` recalcula cuando la caja está **cerrada**, pero `refreshClosedCash` persiste el nuevo `expectedCash` sin rechazar un negativo (`apps/api/src/cash.ts:229`). Para una caja abierta ni siquiera recalcula o exige que el efectivo siga siendo mayor o igual a cero.
- En contraste, una salida normal bloquea la caja y compara el importe contra el esperado antes de escribir (`apps/api/src/cash.ts:984-1043`).

**Reproducción:**

1. Abrir una caja con RD$0.
2. Registrar una venta de RD$100 pagada en efectivo. Esperado: RD$100.
3. Registrar una salida de RD$100. La operación es válida y deja esperado RD$0.
4. Desde administración, corregir el pago de la venta de `cash` a `card` —o a `transfer`, `credit` o `cod`— con su motivo.
5. El pago deja de sumar RD$100, pero la salida permanece. Resultado calculado: **RD$-100**.

También existe una carrera: la corrección no toma el bloqueo de la caja que serializa ventas, devoluciones y movimientos. Una corrección y una salida simultáneas pueden validar contra estados distintos.

**Corrección propuesta:**

1. Hacer una lectura inicial mínima para obtener `cashSessionId`; si existe, bloquear primero esa caja y **después** llamar a `editableSale`, que hoy bloquea la venta, revalidando dentro de la misma transacción que el pago y su caja no cambiaron. Así se respeta el orden global Caja → Venta y no basta con añadir un bloqueo después de `editableSale`.
2. Después de actualizar el método y antes de confirmar la transacción, ejecutar el cálculo del esperado tanto para una caja abierta como para una cerrada. Si queda negativo, abortar con un mensaje ciego sin importes, salvo que la dueña defina expresamente que una corrección histórica debe conservar el negativo y cómo se resolverá.
3. Conservar `refreshClosedCash` y `closedCashChanged` para cajas cerradas sólo después de superar esa regla.
4. Agregar regresiones con PostgreSQL real para: retiro previo + `cash → card`; devolución previa + `cash → credit`; y corrección concurrente con salida. En todos los casos, como máximo una operación debe confirmarse y el esperado final debe ser `>= 0`.

### N3-02 · Media · Un gasto en efectivo no está conectado con ninguna caja

**Evidencia:**

- `apps/api/src/admin.ts:675-720` acepta `method: "cash"`, pero crea únicamente una fila `Expense`; no exige `cashSessionId`, no bloquea una caja y no crea un `CashMovement`.
- `apps/api/src/cash.ts:55-112` no consulta `Expense` al calcular el esperado.
- El modelo `Expense` tampoco guarda una caja (`apps/api/prisma/schema.prisma:727-744`).

**Reproducción:**

1. Abrir una caja con RD$100 y registrar un gasto de RD$100 con método efectivo.
2. Retirar físicamente esos RD$100 para pagar el gasto.
3. Consultar la caja: el esperado continúa en RD$100.
4. Registrar luego una devolución en efectivo por RD$100. El control puede autorizarla porque ve RD$100, aunque la gaveta ya esté vacía.

Esto **no deja negativo el valor calculado**; deja una sobreestimación que permite comprometer efectivo inexistente y terminar con déficit físico.

**Corrección propuesta:** decidir una sola semántica y hacerla explícita:

- si un gasto en efectivo sale de la gaveta, exigir `cashSessionId`, bloquear la caja y crear el gasto y la salida idempotente dentro de una misma transacción; o
- si `Expense` es sólo contabilidad, quitar/renombrar el método efectivo en ese formulario y exigir que la salida se registre primero en Caja, enlazando ambos registros para evitar duplicados.

Debe añadirse una prueba que confirme que el gasto no puede comprometer más efectivo que el disponible y que un reintento no crea dos salidas.

## Revisión de cada camino solicitado

### 1. Anulación directa con la caja original abierta — protegido

- `apps/api/src/sales.ts:2353-2363` obtiene y bloquea la caja original antes de bloquear la venta.
- `apps/api/src/sales.ts:2478-2498` marca la venta anulada, recalcula dentro de la transacción y revierte todo si el resultado es negativo.
- La regresión de PostgreSQL cubre retiro previo y concurrencia entre retiro y anulación (`tests/anular-caja-abierta-postgres.test.ts:169-195`).

**Severidad residual:** baja. Falta únicamente ampliar la regresión a pagos mixtos y a una caja con varias ventas/salidas; no encontré un bypass en este flujo.

### 2. Devolución en efectivo — protegido

- `apps/api/src/sales.ts:2992-3013` bloquea la caja que entregará el reembolso y controla el uso de una caja ajena.
- `apps/api/src/sales.ts:3272-3287` compara el reembolso contra `cashExpected` antes de crear la devolución.
- `apps/api/src/sales.ts:3295-3312` escribe la devolución dentro de la misma transacción; si falla la comprobación, también se revierten los cambios de inventario ejecutados antes.

**Severidad residual:** baja. La serialización con movimientos es correcta porque ambos flujos toman el mismo bloqueo de `CashSession`.

### 3. Salida, retiro o vale registrado como movimiento — protegido

- `apps/api/src/cash.ts:984-1004` bloquea la caja y hace idempotente la operación.
- `apps/api/src/cash.ts:1035-1042` impide que una salida supere el efectivo esperado.
- `apps/api/src/cash.ts:1043-1055` crea el movimiento sólo después de la validación.

**Severidad residual:** baja.

### 4. Vale declarado al cerrar — no reduce el esperado

- El vale se usa para calcular la diferencia como `contado + vales - esperado` (`apps/api/src/cash.ts:180-196`).
- Exige nota y, según el rol y propietario, PIN de otra persona (`apps/api/src/cash.ts:1137-1167`).
- Se conserva en detalles, bitácora y alerta (`apps/api/src/cash.ts:1215-1228` y `apps/api/src/cash.ts:1357-1385`).

No puede volver negativo `cashExpected` porque no entra en su fórmula. Es un mecanismo de justificación del faltante al cierre, no una salida adicional.

**Severidad residual:** baja, sujeto a que la dueña mantenga la regla vigente de permitir el cierre con vale aprobado.

### 5. Traslado de caja a otro equipo — no altera dinero

- `apps/api/src/cash.ts:1086-1109` bloquea la sesión abierta y cambia únicamente `registerId`; fondo, pagos, movimientos y devoluciones permanecen intactos.

**Severidad residual:** informativa. No encontré un camino a saldo negativo.

### 6. Cerrar y volver a abrir — no arrastra un saldo negativo

- La apertura sólo acepta un fondo no negativo mediante `amount` y registra una sesión nueva (`apps/api/src/cash.ts:840-910`).
- Si el fondo declarado es menor que el sugerido, exige una explicación (`apps/api/src/cash.ts:859-886`).
- La sugerencia usa lo dejado —o, para datos anteriores, lo contado— en el último cierre (`apps/api/src/cash.ts:1430-1456`).
- `deliveredSplit` impide entregar más de lo contado y calcula `left = counted - delivered`, por lo que el saldo sugerido no puede ser negativo (`packages/shared/src/index.ts:686-698`).

No existe una ruta que reabra la misma fila cerrada; se crea otra sesión. El control diario de salidas tampoco se reinicia al cerrar y abrir (`apps/api/src/cash.ts:1012-1029`).

**Severidad residual:** baja.

### 7. Anulación por solicitud aprobada — usa la misma protección

- `apps/api/src/sales.ts:2006-2034` aprueba dentro de una transacción y llama a `voidSaleTx`; no implementa una anulación alternativa.
- Por ello hereda el bloqueo y la comprobación de `apps/api/src/sales.ts:2353-2363` y `apps/api/src/sales.ts:2478-2498`.
- El estado de la solicitud cambia a aprobado después de pasar las comprobaciones (`apps/api/src/sales.ts:2558-2582`); si la anulación falla, la transacción se revierte y la solicitud continúa pendiente.

**Severidad residual:** baja. Conviene agregar una regresión explícita de aprobación con retiro previo, aunque el camino común ya está protegido.

## Prioridad recomendada

1. **Corregir N3-01 antes de permitir correcciones de método sobre cajas abiertas.** Es el único camino confirmado que deja el cálculo negativo mediante la API normal.
2. Definir con la dueña la semántica de los gastos en efectivo y cerrar N3-02 sin contar dos veces una salida.
3. Añadir las regresiones indicadas; no es necesario cambiar los flujos de devolución, movimiento, vale, traslado, apertura ni aprobación de solicitudes según esta revisión.

## Límites

- Auditoría estática sobre el commit indicado; no se usaron datos ni base de producción.
- No se ejecutó PostgreSQL porque esta tarea pidió sólo documentación. La prueba existente de anulación fue inspeccionada, no repetida en esta entrega.
- No se evaluaron escrituras directas a la base ni código de ramas todavía no integrado en `origin/nexora-cloud`.

# Auditoría E2E «día pesado» — Nexora POS (origin/nexora-cloud cfc21c3a)
Entorno local desechable: PG16 :5441, API :3021 (tsx), semilla demo. Todo por API (sin UI). ~150 ventas, 6 cajas (4 cajeras + gerente + admin), 4 abiertas a la vez en 4 equipos aprobados. Scripts: scratchpad/{setup,day,extra,close,close2}.mjs.

## Fallos (por gravedad)
**ALTA 1. No hay pago en US$: cada venta cobrada en dólares sale como faltante en RD$ (casos 24-oct a y b).**
- `POST /sales` con `payments:[{method:"usd",amount:40}]` → 400 «forma de pago no es una opción válida». La cajera solo puede registrar RD$2,450 en efectivo.
- Cierre con `countedCash = esperado−2450, countedUsd:40` → el cuadre muestra `differenceDop −2450` y `differenceUsd +40` por separado (`foreign.usd = {expected:0, rate:null, dop:null}`): no hay tasa ni esperado en US$, así que no se compensa. Exige PIN de gerente, justificación y además `notes`; deja la alerta alta «efectivo RD$ −2450».
- Caso (b): cerrar con la caja exacta y `countedUsd:58.30` sin ninguna venta en US$ → **201, se acepta sin avisar**: sin descuadre, sin alerta, sin justificación ni PIN. Solo sale la línea «Diferencias US$ 58.30».
- Impacto: todo cobro en US$ deja un faltante falso en RD$. Al revés, se pueden declarar dólares sin explicación, y eso puede tapar una venta en US$ que no se registró.

**ALTA 2. Un gerente vende por debajo del costo sin que nadie más lo apruebe.**
- El gerente envía `POST /sales` con `discountPercent:60` y `discountReason`, sin PIN → 201. Factura FS-0001011: total 380, costo 525 (margen negativo). Queda `discountApprovedName` = el mismo gerente, `discountRule:"administrator"`.
- Solo se crea una alerta media «descuento inusual». La regla del 15 % de margen mínimo no se aplica a quien gestiona ventas.
- A la cajera sí se le exige el PIN de gerente: rechaza su propio PIN y sin PIN da 400 (correcto).

**MEDIA 3. Corregir el método de pago con la caja ya cerrada crea un descuadre retroactivo, sin justificación ni alerta.**
- `POST /sales/:id/payments/:pid/correct-method {method:"card"}` (admin) sobre una venta en efectivo de la caja 1, que cerró cuadrada → 201.
- La caja ya cerrada pasa a `differenceCash +950 / differenceCard −950`, con `descuadre.reason=null` y sin aprobador. No hay alerta `cash:` ni auditoría en la caja; solo `payment_method_corrected`.
- Va contra la regla de la dueña del 21-oct (todo descuadre lleva justificación). La cajera aparece con un descuadre que no tuvo al cerrar.

**MEDIA 4. Una venta offline sincronizada después del cierre cambia el cierre guardado.**
- La venta se capturó dentro del turno (`capturedAt` = apertura + 5 s) y se sincronizó con la caja 4 ya cerrada, vía `POST /sales/sync` → «synced» en esa caja cerrada.
- En la caja: `expectedCash` 17600 → 18250 y `differenceCash` 0 → −650. Queda auditoría `offline_after_close`, pero sin alerta de descuadre ni justificación.

**MEDIA 5. El gerente aprueba su propio descuadre.**
- Cierra su caja con +200 y `differenceReason` → `cashApprovedBy` = él mismo («Andrea Gómez»). Nadie más lo revisa.
- Mismo patrón que el descuento (Alta 2).

**BAJA 6. (caso d) Todas las ventas llevan `courierName="Addison"`, también las de mostrador.**
- `DEFAULT 'Addison'` en la columna (migración 202610250001_courier_fee). Lo tienen las 846 ventas antiguas y todas las de hoy con `courierFee=0`.
- Los reportes y `courier/pending` filtran `courierFee>0`, así que no hay efecto en dinero; pero la API de ventas (para gerencia) y la base dicen «Addison» en ventas sin envío.

**BAJA 7. Una anulación después del cierre aparece como una entrada que nunca ocurrió.**
- Al anular una venta de la caja 4 ya cerrada, el reembolso sale bien de la caja abierta del admin (4200 → 3250).
- Pero el cuadre de la caja cerrada se compensa con `cashSalesDetail.cashIn 950`: el impreso muestra «Entradas 950» que no existieron. La diferencia sí queda igual (−650).

**BAJA 8. Para cerrar con descuadre hacen falta dos textos.**
- Con descuadre mayor que `cashDifferenceLimit`, el cierre pide `differenceReason` y además `notes` («agrega una nota»). Es el mismo dato dos veces: fricción en caja.

**BAJA 9. Ni la cajera ni el gerente pueden registrar el cobro de una contraentrega.**
- `cod-collections` y `PATCH sales/:id/courier` son `@Permit("*")` (solo admin): con la cajera y con el gerente dan 403.
- El dinero que trae el mensajero solo entra en la caja del admin. Confirmar que es lo que se quiere.

## Pasaron (invariantes comprobados con SQL aparte + API)
- **Cajas:** 4 cajas abiertas a la vez en 4 equipos aprobados, ventas en paralelo sin errores. El vuelto se guarda bien (amount = total, change = entregado − total).
- **Pagos mixtos:** efectivo + tarjeta y efectivo + transferencia funcionan; una tarjeta por encima del total y un pago insuficiente se rechazan.
- **Esperado en efectivo** = fondo + efectivo + entradas − salidas − reembolsos, idéntico en SQL, en `CashSession.expectedCash` y en el cuadre, en 6 cajas. Las ventas por método del cuadre coinciden con los pagos, y la diferencia del cuadre con la guardada.
- **(c)** Cierre con tarjeta y sin lote → 400; lote en blanco → 400. El lote sale en `cuadre.cardBatch`.
- **Faltante (−300):** sin PIN 400, con el PIN de la propia cajera 400, sin justificación 400. Con PIN de gerente y justificación cierra, con alerta alta y el aprobador en el cuadre.
- **Sobrante (+200):** pide justificación también al gerente. El cuadre de una caja abierta se niega («cierra la caja»), así el cierre sigue ciego. La respuesta del cierre no muestra el esperado a la cajera.
- **Transferencias:** la cajera no puede verificar (403). Verificar a la vez (admin + gerente) deja una sola. El rechazo pasa la venta a por cobrar, y una transferencia rechazada ya no se puede verificar. La corrección exige los datos actuales: con datos viejos, 400.
- **Contraentrega:** el mismo cobro enviado dos veces a la vez queda en uno, y el cobro de más se rechaza. Si se cobra y se anula a la vez, se cobra y la anulación se rechaza.
- **Anulaciones:** la cajera no puede (403). Dos admins anulando a la vez: una sola, stock +1, auditoría 1. En caja abierta resta su total una sola vez. Con la caja cerrada, el reembolso sale de la caja abierta de quien anula.
- **Devoluciones:** la cajera no puede. Con el mismo operationId a la vez queda una; repone stock; no se devuelve dos veces. Una parcial en la misma caja resta exactamente lo devuelto. Hecha desde otra caja no toca el esperado ni el cuadre cerrado de la original.
- **Inventario:** el traspaso con el mismo operationId enviado 3 veces a la vez queda en uno. Casa↔Tienda funciona; traspasar más de lo que hay → 400; lo que está solo en Casa no se vende. La cajera no traspasa ni ajusta. Un ajuste que dejaría stock negativo → 400. La venta con lote descuenta el lote que vence primero (FEFO).
- **Carreras de stock:** 5 cajas compran la última unidad: gana una, nunca negativo (Variant, VariantStock, LotStock).
- **Reenvíos de venta:** el mismo offlineUuid 4 veces a la vez da una venta. El mismo UUID con otros datos, o desde otra cajera, se rechaza.
- **Offline (`sales/sync`):** con duplicados y enviado a la vez: 2 ventas y 2 pagos. Una captura anterior a la apertura, o en la caja de otra persona, queda como conflicto con alerta.
- **Caja:** una salida repetida queda en una; una salida grande de cajera sin PIN se rechaza; nadie mueve una caja ajena. Dos cierres a la vez: uno gana, con una sola auditoría `close`. Tras el cierre no se vende ni se mueve dinero en esa caja.
- **Auditoría:** se registró cada acción (complete, discount_approved, verify, reject, correct_transfer, void, return, close, stock_transfer, movement, offline_after_close, void_after_close…).

No probé: la interfaz (Playwright), el rendimiento con carga real, los impresos PDF ni las ventas con NCF.
Todo quedó apagado: PostgreSQL y la API. Datos de prueba en /tmp/audit-dia-pg-5441 (desechable).

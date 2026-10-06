# Prueba de aceptación de caja — FitStore POS

**Versión: 6 de octubre de 2026.** Lista de **40 pasos** para la dueña y la cajera, usando productos y precios reales del catálogo. Comprueba el funcionamiento esperado; no afirma que las funciones ya estén disponibles ni sustituye una auditoría del código.

Fecha de ejecución: __________  Versión de FitStore: __________

Tienda/sucursal: __________  Caja/dispositivo: __________

Dueña responsable: __________  Cajera: __________  Persona de soporte: __________

## Antes de comenzar

Hacer primero la prueba en una copia de práctica con el catálogo real, inventario conocido y medios de pago simulados. En producción, registrar únicamente ventas, cobros, devoluciones y recepciones reales autorizadas por la dueña. **No emitir comprobantes de producción por operaciones ficticias ni cargar tarjetas para simular un rechazo.** Los escenarios de error se prueban en práctica o con ayuda de soporte.

El contador debe indicar si corresponde B o E, los tipos/secuencias autorizados y la contingencia permitida. Ver [REQUISITOS_FISCALES_RD.md](fiscal/REQUISITOS_FISCALES_RD.md). Si se usa un facturador externo, comprobar la relación con el ticket de FitStore y registrar el documento fiscal real una sola vez.

Preparar lector, impresora con papel, calculadora, conexión que pueda interrumpirse de manera controlada y, para tarjetas, el terminal o entorno de prueba del adquirente. No anotar números completos de tarjetas ni contraseñas en las evidencias.

### Hoja de datos reales

| Dato | Completar antes de probar |
|---|---|
| **S:** suplemento real, código y presentación | Nombre: __________ Código: __________ Precio incluido: __________ Existencias iniciales: __________ |
| **M:** maquillaje real, código y variante/tono | Nombre: __________ Código: __________ Precio incluido: __________ Existencias iniciales: __________ |
| **F:** faja real, código y talla/color | Nombre: __________ Código: __________ Precio incluido: __________ Existencias iniciales: __________ |
| Costo vigente de S, M y F | S: __________ M: __________ F: __________ |
| Fondo inicial de efectivo **FI** | __________; contado por la cajera y la dueña |
| Descuento autorizado para pruebas | Porcentaje **d**: __________; importe fijo **D**: __________; quién autoriza: __________ |
| Cliente real autorizado para crédito | Nombre/identificador: __________; límite/condiciones: __________ |
| Cliente que necesita crédito fiscal | RNC verificado y razón social: __________; mantener evidencia de forma privada |
| Proveedor y entrega real, o su copia de práctica | Proveedor: __________ Factura/NCF: __________ Cantidad pedida: __________ Cantidad recibida: __________ |

Tener unidades suficientes para completar las ventas y dejar una venta con al menos dos unidades del mismo producto para la devolución parcial. Si solo hay una unidad de un artículo, usar otro SKU real con suficiente inventario; no crear existencias ficticias en producción. Para devoluciones de producto dañado, usar una unidad realmente dañada o simular su condición en la copia de práctica.

### Cómo registrar cada resultado

Marcar en la última columna **Pasa**, **Falla**, **Pendiente** o **N/A autorizado**, y anotar ticket/documento o evidencia. “No disponible” no equivale a “Pasa”. N/A requiere motivo y aprobación de la dueña; no permite omitir una obligación fiscal ni una función necesaria para operar la tienda.

Después de cada operación, completar la hoja de control al final. Comparar importes a centavos; explicar cualquier diferencia, sin cambiar datos para que coincidan. La fecha del negocio debe corresponder a República Dominicana, no a la zona horaria de la computadora remota.

## A. Apertura, lector y carrito

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **01** | Entrar como cajera con su propio usuario e intentar acceder a una función reservada a la dueña, como editar costos o autorizar devoluciones. | Identifica a la cajera y su caja. Permite vender; la función reservada pide autorización o se bloquea según la política acordada. No comparte la identidad de la dueña. | __________ |
| **02** | Revisar fecha local, nombre fiscal de la tienda, RNC del emisor, moneda, tasa aplicable y modalidad B/E con el contador. | Datos coinciden con la configuración aprobada. Los precios incluidos no reciben otro 18 % encima. Solo se habilita la modalidad fiscal que corresponde a la tienda. | __________ |
| **03** | Abrir caja ingresando el fondo **FI** que ambas contaron. Intentar abrir nuevamente la misma caja sin cerrar. | Queda una sola apertura, con cajera, hora y FI. El fondo no se cuenta como venta; no permite dos aperturas activas de la misma caja. | __________ |
| **04** | Buscar S, M y F y anotar sus existencias iniciales y costos/precios en la hoja de datos. | Cantidad vendible, presentación, variante y precio coinciden con mercancía y catálogo. Se cuenta con una referencia para comprobar cada movimiento posterior. | __________ |
| **05** | Escanear el código de S con el lector real. | Añade exactamente S, una unidad y su precio vigente. El código conserva ceros iniciales y no se confunde con otro producto. No cobra ni descuenta inventario todavía. | __________ |
| **06** | Buscar M por una parte de su nombre y seleccionarlo. | Aparecen resultados identificables; añade el maquillaje y variante elegidos una sola vez. Buscar no duplica lo ya escaneado. | __________ |
| **07** | Buscar o escanear F y confirmar talla/color antes de añadirla. | Se distingue la variante exacta y su stock. No descuenta otra talla ni otro color. | __________ |
| **08** | Escanear un código que no pertenezca al catálogo de práctica. | Indica producto no encontrado y deja resolver la búsqueda. No añade un producto equivocado, precio cero ni venta automática. | __________ |
| **09** | Escanear otra vez S, cambiar su cantidad y retirar una línea del carrito. | Cantidad y total se recalculan exactamente. La eliminación no afecta dinero ni stock de una venta completada; no genera nota de crédito. | __________ |
| **10** | En práctica, intentar vender más unidades que el stock disponible, y luego corregir la cantidad. | Impide completar un inventario negativo bajo la política normal de la tienda. Explica el problema y permite corregir sin duplicados; cualquier excepción requiere permiso explícito. | __________ |

## B. Efectivo, tarjeta, pago combinado y descuento

Usar carritos nuevos cuando el paso indique una venta nueva. Apuntar sus totales finales como **T**. Después de completar cada venta, volver a abrir su detalle y comprobar que existe una sola vez.

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **11** | Hacer una venta de S y M con efectivo exacto **T**. | Venta completa una vez; cambio cero; efectivo de caja aumenta T; stock baja por las cantidades vendidas; comprobante coincide con el total. | __________ |
| **12** | Hacer otra venta en efectivo entregando **R > T** y verificar el cambio con calculadora. | Cambio = R − T. Caja aumenta T, no R. Ticket, dinero entregado y cambio quedan claros; no se suma dos veces el cambio. | __________ |
| **13** | Hacer una venta con tarjeta y confirmar aprobación en el terminal/adquirente antes de finalizar. | Registra T como tarjeta, referencia y aprobación por el medio disponible; efectivo no aumenta. Si el POS usa terminal separado, la cajera confirma el voucher real. Stock baja una vez. | __________ |
| **14** | En el entorno de prueba, provocar un rechazo o cancelar el pago con tarjeta antes de que se apruebe. | No muestra pago aprobado ni completa una venta pagada. Stock y caja permanecen sin cambios; el carrito puede corregirse/reintentarse sin cobro duplicado. | __________ |
| **15** | Vender un carrito con pago combinado: efectivo **E** y tarjeta **C**, donde E + C = T; confirmar la parte de tarjeta. | Una sola venta y un comprobante. Caja aumenta solo E; tarjeta registra solo C; stock baja una vez. Ambos importes figuran en el detalle. | __________ |
| **16** | En práctica, ingresar pagos que sumen menos de T; intentar finalizar y corregir. Probar también un importe excesivo sin explicar su destino. | No deja una venta falsamente pagada. Identifica el faltante. El excedente debe resolverse como cambio válido o corregirse; no se trata como ingreso adicional. | __________ |
| **17** | Aplicar el porcentaje autorizado **d** a una venta y comparar con calculadora. | Descuento según su alcance autorizado; total y base/ITBIS se recalculan coherentemente. El ticket y el reporte conservan el descuento y quién lo autorizó. | __________ |
| **18** | Aplicar el descuento fijo autorizado **D** a otra venta; en práctica intentar un descuento superior al valor o fuera del permiso de cajera. | Reduce solo el importe autorizado, nunca deja un total negativo. El intento no permitido se bloquea o pide autorización; no altera la venta hasta aprobarse. | __________ |

## C. Comprobantes, crédito y abono

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **19** | En una venta de consumo, seleccionar consumo, completar el cobro e imprimir. Reimprimir el mismo ticket y, si es E32, leer el QR. | B02 o E32 según modalidad autorizada; emisor, artículos, descuento, base/ITBIS y total correctos. Reimpresión conserva el mismo NCF/e-NCF. En E32, QR dirige a la consulta DGII; comprobar estado fiscal según su flujo y contingencia, sin confundirlo con cobro. | __________ |
| **20** | Hacer una venta al cliente que necesita crédito fiscal, usando su RNC real verificado y razón social. | B01 o E31 según modalidad. Identificación correcta y total igual al cobro; no convierte automáticamente el pago en fiado. En E31 se conserva el resultado DGII y la representación/QR; soporte muestra la evidencia fiscal. | __________ |
| **21** | En práctica, intentar crédito fiscal con identificación incompleta o inválida; corregirla o elegir consumo si corresponde a la operación. | No emite un crédito fiscal con RNC inventado/inválido. Explica qué falta; permite corregir antes de emitir, sin gastar comprobantes por intentos de formulario ni duplicar venta. | __________ |
| **22** | Hacer una venta a crédito al cliente autorizado, sin pago inicial, respetando el límite acordado. | Registra cliente, importe pendiente y condiciones. Venta e inventario ocurren una vez; efectivo y tarjeta no aumentan. El documento es consumo/crédito fiscal según el cliente, independientemente de vender fiado. | __________ |
| **23** | Recibir un abono real **A**, menor o igual al saldo, en efectivo y aplicarlo a esa deuda. Consultar historial. | Saldo disminuye A; caja aumenta A; deja constancia de abono vinculada. No mueve stock ni crea otra venta/ITBIS. La misma constancia no se aplica dos veces. | __________ |
| **24** | En práctica, intentar un abono mayor al saldo y un abono sin seleccionar al cliente/deuda. | No genera saldo negativo sin una política explícita de saldo a favor. Requiere el cliente y aplicación correcta; el rechazo no mueve efectivo ni crea venta. | __________ |

## D. Venta sin internet y recuperación

Pruebas 25–28: usar copia de práctica o una operación real con el procedimiento fiscal de contingencia previamente autorizado. Soporte debe distinguir “guardado en caja”, “sincronizado con FitStore” y “recibido/aceptado por DGII”. No cobrar tarjeta offline salvo aprobación real permitida por el adquirente.

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **25** | Con la aplicación y catálogo ya cargados, desconectar la red y buscar/escanear S. | La caja indica falta de conexión. Mantiene catálogo/precios y permite preparar el carrito previsto para operación offline; no muestra falsamente conexión o aprobación fiscal. | __________ |
| **26** | Completar una venta offline de S con efectivo bajo la modalidad autorizada y guardar su identificador. | Una venta durable, stock y efectivo correctos, pendiente visible. Si puede firmar localmente, genera e-CF/representación de contingencia; si no, usa el B autorizado y registra la vinculación/regularización requerida. Un ticket interno solo no se presenta como comprobante fiscal válido. | __________ |
| **27** | Cerrar y volver a abrir la aplicación mientras sigue sin internet. Consultar esa venta y el resumen. | La venta no desaparece ni se duplica; conserva importe, pago, stock y documento/pendiente fiscal. No requiere cobrar nuevamente ni liberar una reserva que ya se vendió. | __________ |
| **28** | Reconectar, dejar sincronizar y repetir la consulta o reiniciar otra vez. Con soporte, verificar el resultado fiscal. | Se sincroniza exactamente una vez; caja, deuda e inventario no reciben un segundo movimiento. Pendientes pasan al estado real correspondiente; los rechazos se muestran. Si hubo B, queda ligado al E de regularización sin segunda venta. Se respetan los plazos fiscales descritos en el otro documento. | __________ |

## E. Devoluciones y anulaciones

Elegir una venta pagada del mismo día con al menos dos unidades de un SKU. En producción, cada devolución debe corresponder a mercancía realmente devuelta y autorización de la dueña.

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **29** | Abrir la venta original y devolver **solo una** de sus unidades, como producto vendible. Elegir el destino del reembolso autorizado y confirmar con la dueña. | Devuelve únicamente la cantidad elegida y su valor histórico, considerando el descuento original. No devuelve toda la venta. Sube stock vendible en una unidad; baja caja solo si el reembolso sale en efectivo. | __________ |
| **30** | Revisar el documento de la devolución, saldo retornable y reporte de esa venta. | Nota B04/E34 cuando proceda, referenciada al comprobante original, con fecha/motivo, importe e impuesto aplicable. Original conservado; venta neta refleja solo el ajuste. Queda una unidad retornable si inicialmente se vendieron dos y se devolvió una. Tarjeta/crédito se ajustan según el destino real del reembolso, sin inventar efectivo. | __________ |
| **31** | En práctica, intentar devolver más unidades de las que quedan retornables y repetir la misma devolución. | Bloquea el exceso y la duplicación del mismo movimiento. No genera segundo reembolso, nota ni entrada de inventario por un doble clic/reintento. | __________ |
| **32** | En práctica o con una devolución real, registrar una unidad dañada como no vendible/merma. | Reembolso y nota siguen la política aprobada; la unidad dañada no aumenta stock disponible. Queda cantidad, destino y motivo de merma, con su costo; no cuenta dos pérdidas del mismo producto. | __________ |
| **33** | Preparar un carrito nuevo y cancelarlo antes de cobrar/facturar. | No crea venta, cobro, nota de crédito ni NCF anulado por el simple descarte. El stock vendible queda como estaba, liberando cualquier reserva temporal. | __________ |
| **34** | En práctica, revertir con autorización una venta ya completada y que no tenga devoluciones previas. En producción, usar solo una operación real que deba revertirse. | Conserva venta original y registra su reversión/documento fiscal correspondiente. Revierte cobro/saldo y stock una vez, según destino de la mercancía; deja usuario/motivo. No borra el historial ni reutiliza el comprobante aceptado. | __________ |

## F. Recepción de mercancía

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **35** | Registrar o abrir una compra/pedido al proveedor real: documento, artículos, unidades pedidas, costos y condición de pago. Consultar stock antes de recibir. | Mantiene identificados proveedor y documento; crear el pedido no suma mercancía aún no recibida. Se distingue compromiso/pedido, factura fiscal de compra y pago al proveedor. | __________ |
| **36** | Recibir físicamente una entrega parcial, contando unidades; ingresar solo lo recibido y lote/vencimiento si el artículo lo requiere. Revisar stock y costo. | Aumenta stock únicamente por lo recibido y queda pendiente el resto. Se conserva costo conforme al método acordado, documento y responsable. Vencidos/dañados se rechazan o segregan; no quedan vendibles sin autorización. | __________ |
| **37** | Reabrir la recepción y consultar su comprobante. En práctica intentar confirmar otra vez la misma recepción o recibir más que el saldo pendiente. | No duplica stock ni factura/importe por repetir la confirmación. Impide el exceso o exige una modificación autorizada del pedido; quedan entregas y saldo pendientes trazables. | __________ |

## G. Reporte, arqueo y cierre

| Paso | Acción de la dueña o cajera | Resultado esperado | Estado / evidencia |
|---|---|---|---|
| **38** | Abrir el reporte del día y comparar con la hoja manual: ventas, descuentos, devoluciones, impuestos, medios de pago, crédito/abonos e inventario. Revisar documentos/colas pendientes. | Totales coinciden con operaciones reales; abonos no se suman como ventas nuevas; FI no es ingreso; devoluciones/reversión se descuentan una vez. Venta a crédito aparece en ventas y deuda, no como efectivo. Se distinguen pendientes fiscales. Existencias y costo/margen, si se reporta, concilian con el método aprobado. | __________ |
| **39** | Contar billetes/monedas sin copiar el saldo esperado; ingresar el contado y comparar con efectivo teórico. Conciliar tarjeta con vouchers/adquirente. En práctica probar una diferencia de caja conocida. | Arqueo = efectivo contado − efectivo teórico. Una diferencia se muestra con su signo y requiere explicación; no ajusta ventas ni oculta faltantes. Tarjeta se concilia separadamente, con comisión/retención identificada y sin mezclarse con efectivo. | __________ |
| **40** | Cerrar la caja con la dueña, guardar/imprimir cierre y reporte, salir/entrar y consultar el cierre. Intentar vender en esa sesión cerrada; verificar exportación/respaldo con soporte. | Cierre conserva apertura, cajera, efectivo contado/teórico, diferencia, medios de pago y hora. No permite registrar ventas dentro de la sesión cerrada; exige abrir una nueva. El cierre histórico no cambia por una recepción posterior. Exportación es legible y el respaldo se verifica en una copia, sin alterar producción. | __________ |

## Hoja manual de control

Usar una fila por venta, abono, devolución, reversión o recepción. Añadir filas hasta cubrir todas las operaciones. En “Efectivo” registrar **lo que realmente entra/sale de la caja**, después del cambio; entradas positivas y salidas negativas. En “Tarjeta” registrar cargo o devolución por ese medio. En “Variación deuda”, positivo aumenta lo pendiente y negativo lo reduce. En “Stock”, positivo entra y negativo sale de existencias vendibles.

| Paso / ID | Tipo de operación | Factura / nota / recibo | Venta final con ITBIS* | Base / ITBIS* | Efectivo | Tarjeta | Variación deuda | Variación stock S/M/F | Observación / evidencia |
|---|---|---|---:|---|---:|---:|---:|---|---|
| __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ |
| __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ |
| __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ |
| __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ |
| __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ | __________ |

\* En devoluciones/reversiones, anotar el ajuste con signo negativo cuando corresponda. En abonos, apertura y recepción, dejar venta/base/ITBIS de venta en cero o no aplicable: no son nuevas ventas. Mantener aparte los datos fiscales de la compra al proveedor.

### Cálculos para comprobar con calculadora

```text
Efectivo teórico al cierre = FI
  + cobros de ventas en efectivo, netos del cambio
  + abonos de clientes recibidos en efectivo
  + otras entradas de caja documentadas
  − reembolsos/reversiones pagados en efectivo
  − pagos/retiros/salidas de caja documentados

Diferencia de arqueo = efectivo contado − efectivo teórico

Ventas netas del día = ventas completadas
  − notas/ajustes de devolución o reversión del día aplicables al reporte
  (sin sumar abonos, fondos de apertura ni recepciones)

Saldo de clientes = saldo anterior + nuevas ventas a crédito
  − abonos aplicados − notas/ajustes aplicados a esa deuda

Stock vendible por SKU = stock inicial + recepciones vendibles
  − unidades vendidas + unidades devueltas/revertidas a stock vendible
  +/− ajustes de inventario autorizados
```

No restar una misma reversión como “venta anulada” y otra vez como “nota de crédito”. Las devoluciones de una venta de un día anterior deben conservar su referencia y aparecer como ajustes en la fecha definida para el reporte; no reescribir silenciosamente un cierre antiguo.

Los cargos con tarjeta deben coincidir con ventas/vouchers y devoluciones. El depósito bancario posterior puede ser menor por comisión o retención, o llegar en otra fecha: documentar esa diferencia por separado. Una devolución de una venta a crédito reduce primero la deuda según el importe aplicable; solo afecta efectivo si realmente se entrega dinero.

Para el supuesto de precio final gravado al 18 %: base = total / 1.18; ITBIS = total − base. Calcular después del descuento y comparar con el desglose fiscal, teniendo en cuenta el redondeo aprobado. Si el producto tiene otro tratamiento, usar su tasa validada.

## Criterio de aceptación y entrega a soporte

Se acepta la caja cuando pasan las funciones necesarias para operar y no hay diferencias sin explicación en cobros, deuda, inventario o comprobantes. **Bloquean la salida a operación:** cobro duplicado o perdido, venta offline perdida, stock incorrecto, abono contado como venta, devolución excesiva, anulación que borra historial, comprobante fiscal incorrecto o contingencia sin procedimiento autorizado. Una función necesaria no implementada queda pendiente, con responsable y solución acordada.

Para cada falla, entregar a soporte: número de paso, fecha/hora, usuario/caja, producto, ID de venta/documento, acción hecha, esperado y observado, captura o ticket y si ocurrió con/sin conexión. Ocultar datos personales innecesarios. Después de corregir, repetir ese paso y los movimientos que pueda afectar, especialmente caja, inventario y reporte.

**Registro de incidencias:**

| Paso | Falla observada | Responsable | Solución / fecha | Resultado de repetición |
|---|---|---|---|---|
| __________ | __________ | __________ | __________ | __________ |
| __________ | __________ | __________ | __________ | __________ |
| __________ | __________ | __________ | __________ | __________ |

Resultado final: **Aceptada / Aceptada con pendientes no críticos / No aceptada**: __________

Pasos pendientes o N/A y justificación: ________________________________________

Firma de la dueña: __________  Firma de la cajera: __________  Fecha/hora: __________

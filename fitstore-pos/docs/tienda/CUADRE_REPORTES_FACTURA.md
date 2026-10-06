# Cuadre de caja, reportes del día y factura: formato de la tienda

Especificación tomada de los documentos impresos que usa hoy la tienda (sistema anterior), enviados por la dueña el 6/10/2026. Las fotos no se guardan en el repositorio porque tienen datos de clientes y ventas reales. Todo se imprime en la **impresora térmica pequeña conectada a la laptop**, desde el navegador (ancho de 80 mm por defecto y de 58 mm opcional, según `receiptWidth` en Ajustes).

## Datos del negocio, en el encabezado de todo lo impreso

- Logo (opcional, subido en Ajustes), nombre del negocio (p. ej. «GRUPO MACGEN»), sucursal y dirección (p. ej. «Plaza Lope de Vega 2do nivel, Santo Domingo»), RNC y teléfonos (dos: teléfono y WhatsApp).
- **Caja:** número (p. ej. 4012) y nombre (p. ej. «GPRO STORE RD»).
- **Cajero:** número (p. ej. 1031) y nombre.
- Ajustes ya tiene `name`, `legalId` (RNC), `address`, `phone` y `receiptWidth`. Faltan: `branchName`, `phone2`, `logo`, el número y nombre de cada caja (equipo) y el número de cada cajero.

## 1. Cuadre de caja (se imprime al cerrar la caja)

1. **Encabezado:** negocio, dirección, RNC y el título **«Cuadre de Caja»**.
2. **Datos de la caja:**
   - Fecha inicial: apertura de la caja.
   - Fecha final: cierre.
   - No. Caja y Caja (nombre).
   - No. Cajero y Cajero.
3. **Detalles de monedas:** la cajera cuenta el efectivo **por denominación** y el sistema multiplica y suma:

   | Moneda | ×   | Cantidad | =   |  Total |
   | -----: | --- | -------: | --- | -----: |
   |      1 | ×   |        n | =   |    1·n |
   |      … |     |          |     |        |
   |   2000 | ×   |        n | =   | 2000·n |

   Denominaciones de RD$: 1, 5, 10, 25 (monedas) y 20, 50, 100, 200, 500, 1000, 2000 (billetes); el impreso actual también lista 20 y 25. Al final, **Sub-total** = efectivo contado.

4. **Descripción / Totales:**
   1. **Crédito RD$:** ventas a crédito (fiado) de la caja.
   2. **Efectivo RD$:** efectivo **contado** (introducido), igual al subtotal de monedas.
   3. **Tarjetas:** cobros con tarjeta.
   4. **Transferencia:** cobros por transferencia y cheque.
   5. **Vale de caja:** vales o comprobantes de salida que la cajera tiene en la gaveta en lugar de efectivo (retiros documentados).
   6. **Dólares US$:** efectivo en dólares contado.
   7. **Euro €:** efectivo en euros contado.
   8. **Cantidad ticket:** número de ventas.
   9. **Ticket nulo:** ventas anuladas.
   10. **Total en venta efectivo:** ventas cobradas en efectivo, netas del cambio. Esto es el efectivo **esperado** por ventas.
   11. **Recibos CxC por forma de pago:** abonos a cuentas por cobrar recibidos en esta caja, en efectivo, tarjeta y transferencia. Lleva una nota: «RD$ X de recibos CxC del mismo día ya están incluidos en Ventas Efectivo».
   12. **Diferencias RD$**
   13. **Diferencias US$**
   14. **Diferencias €**
   15. **Total Desc.:** descuentos dados.
   16. **Total:** venta total de la caja, todas las formas de pago.
   17. **Rentabilidad:** utilidad bruta. Sólo se imprime para quien tiene `profit:read`; la cajera ve la línea vacía.
   18. **Fondo Caja inicial:** efectivo con que se abrió la caja.
5. **Resumen**, impreso así:

   > 12-Diferencias = (2-Efectivo introducido + 5-Vale de caja) − 10-Total venta efectivo − 18-Total fondo

   En FitStore, el «Total venta efectivo» del cálculo debe incluir lo que realmente entra en efectivo: ventas en efectivo + abonos en efectivo + otras entradas − reembolsos en efectivo − retiros sin vale. Así la diferencia es real. El impreso actual muestra el punto 10 en 0.00 y deja una «diferencia» igual a casi todo el efectivo; ese error no se copia.

6. **Pie:** «FIN DEL CUADRE».

### Entregado y dejado en caja (lo que hoy se anota a mano)

Hoy la dueña anota a mano: «Cuadre (fecha) · Efectivo 9,825 · Entregado 9,000 · Dejado 825».

Al cerrar, la caja pide:

- **Entregado:** el efectivo que se le entrega a la dueña.
- **Dejado en caja:** el efectivo que queda. Es el fondo sugerido para la próxima apertura de esa caja.

Entregado + Dejado = Efectivo contado. Las dos líneas se imprimen debajo del resumen, con espacio para la firma de la cajera y de quien recibe.

## 2. Reporte de la venta diaria de usuario (por producto)

1. **Encabezado:**
   - Logo y título «REPORTE DE LA VENTA DIARIA DE USUARIO».
   - Desde y Hasta (fechas).
   - Fecha de impresión.
   - Usuario (número) y Número de caja.
2. **Columnas:** DESCRIPCIÓN · CANT · ITBIS · DESC · PRECIO.
   - Una fila por producto vendido, agrupado.
   - PRECIO es el importe bruto: cantidad × precio, antes del descuento.
   - DESC es el descuento total de esa fila.
   - ITBIS es el ITBIS de esa fila.
   - La descripción se corta al ancho del papel.
3. **Totales:** cantidad, ITBIS, descuentos y precio.
4. **Nota:** «Verificar si los totales tienen descuentos aplicados».
5. Las páginas van numeradas.

## 3. Reporte de venta usuario (por forma de pago)

- **Encabezado:** negocio, dirección, RNC, «Fecha Inicial» y «Fecha Final», y el título «REPORTE DE VENTA USUARIO».
- **Columnas:** COD. (número de factura) · DESCRIPCIÓN («Factura») · CANT. (unidades) · T.VENTA.
- **Agrupado por forma de pago, en este orden:**
  1. EFECTIVO
  2. CHEQUES/TRANSFERENCIA
  3. COMPRA A CRÉDITO
  4. TARJETA CRÉDITO/DÉBITO
  5. CONTRAENTREGA

  Cada grupo cierra con «Sub-Total por Pago».

- **Una venta con pago combinado** aparece en cada grupo con el importe de esa parte.
- **Al final:** «Sub-Total por Fact.» (cantidad y total) y TOTAL, más la misma nota de descuentos.

## 4. Factura (ticket de venta)

1. **Encabezado:**
   - Logo, nombre del negocio, «Sucursal No.» y dirección.
   - RNC.
   - **NCF:** vacío salvo que la contable asigne uno.
   - Teléfono y WhatsApp.
2. **Datos de la venta:**
   - «FACTURA» y **Secuencia No.** (número de la venta).
   - **Vendido a:** nombre del cliente, RNC, teléfono y dirección.
   - **Fecha:** fecha y hora.
3. **Líneas:**
   - «Cod.» (código del producto) en letra pequeña y la descripción debajo.
   - Debajo, `cantidad X RD$ precio`, con el total a la derecha.
4. **Totales:** Sub-Total, Descuento, ITBIS, **Total a pagar**.
5. **Pagos:** forma de pago, recibido y cambio.
6. **Pie:** **Cantidad de Productos** (suma de unidades).

**ITBIS:** los impresos actuales muestran ITBIS 0.00. La tasa por producto la decide la contable; el sistema ya permite una tasa por producto (0 o 18 %).

## 5. Formas de pago

- **Formas que ya existen:** efectivo, tarjeta, transferencia, crédito (fiado) y nota de crédito.
- **Contraentrega (nueva):** la venta se registra, sale de inventario y el importe queda **pendiente de contraentrega**. Cuando el mensajero trae el dinero, se registra el cobro (efectivo o transferencia) en la caja que lo recibe, como un abono. El cuadre y los reportes lo muestran aparte. Combina con cualquier otra forma, por ejemplo una parte por transferencia y el resto contraentrega.
- **Cualquier combinación de formas en una misma venta:** efectivo + tarjeta, tarjeta + transferencia, transferencia + efectivo, etc. Los abonos de crédito también eligen cómo pagó el cliente.
- **Dólares y euros (opcional):** efectivo en moneda extranjera con la tasa del día configurada en Ajustes. El cuadre los cuenta aparte (líneas 6, 7, 13 y 14).

## 6. Atajos de teclado del sistema anterior (referencia)

En el sistema anterior: F6 Taller · F7 Etiquetas · F8 Costo/Cantidad · F9 Entrada de mercancía · F10 Precios · F11 Pantalla de cliente · F12 Vender. FitStore ya usa F2 (buscar), F8 (venta en espera) y F12 (cobrar). Conviene que **F9 abra Entrada de mercancía**, F7 Etiquetas y F10 Precios, si no chocan con los atajos actuales.

## 7. Operación con varias cajas

- Hasta **4 cajas abiertas a la vez**, cada una con su usuario, en la misma base y en tiempo real.
- Mientras se vende en una caja, se puede entrar mercancía desde el celular en Mercancía.
- Cada caja cierra con su propio cuadre.
- La dueña puede imprimir el cuadre y los reportes de cualquier caja o cajero, y del día completo.

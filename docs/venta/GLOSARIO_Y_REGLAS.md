# Glosario y reglas de negocio (Nexora POS)

> Documento de venta e inducción interna. Las reglas aquí descritas son las que
> el sistema aplica hoy; cualquier número usado como ejemplo es ilustrativo.

## 1. Margen (la única fórmula del sistema)

**Fórmula:** `margen = (precio − costo) / precio × 100`, **sin restar ITBIS**.

El precio es el que se cobra en caja (con ITBIS incluido si el producto lo lleva)
y el costo es el costo de adquisición registrado. No se descuenta el ITBIS del
precio antes de calcular: el margen se mide sobre lo que entra en caja.

### Ejemplos

| Precio cobrado | Costo | Cálculo | Margen |
|---|---|---|---|
| RD$ 200 | RD$ 100 | (200 − 100) / 200 | **50 %** |
| RD$ 1,180 | RD$ 900 | (1180 − 900) / 1180 | **23.73 %** |
| RD$ 150 | RD$ 100 | (150 − 100) / 150 | **33.33 %** |
| RD$ 100 | RD$ 120 | (100 − 120) / 100 | **−20 %** (pérdida) |

> Nota (revisión 25-oct): antes de esta regla el margen de un producto de
> RD$ 1,180 (ITBIS 18 %) con costo RD$ 900 se calculaba como 10 % (restando el
> ITBIS); ahora es 23.73 %.

### Margen mínimo

El sistema usa un **margen mínimo del 15 %** como referencia de sanidad. Las
ofertas o descuentos automáticos se calculan para no dejar el margen por debajo
de ese piso salvo que un gerente lo autorice explícitamente.

## 2. ITBIS

- Tasa por defecto: **18 %**.
- Se aplica sobre el importe después de descuentos.
- El resumen de cada línea cuadra al centavo: `subtotal − descuento = total`
  (ITBIS incluido) y `neto + ITBIS = total`.
- Un producto puede tener ITBIS incluido en el precio o adicional (se suma al
  cobrar), según cómo esté configurado.

## 3. Caja ciega

La caja es **ciega**: el sistema **nunca** completa un importe que el usuario no
declaró. En el cierre, cada forma de pago (efectivo, tarjeta, transferencia,
vales) debe declararse; si un campo queda vacío, no se rellena con el valor
esperado.

- `Efectivo contado + vales − venta en efectivo − fondo = diferencia`.
- Todo descuadre (falta o sobra) exige una justificación escrita.
- Lo entregado a la dueña + lo dejado en caja debe ser igual al efectivo
  contado; lo entregado no puede superar lo contado.

## 4. Crédito y contraentrega

- **Crédito**: el cliente se lleva la mercancía y paga después.
- **Contraentrega**: la mercancía sale sin cobrar y el mensajero trae el pago;
  se registra como cuenta por cobrar.
- Umbral de aprobación por defecto: **RD$ 1,000**. Sobre ese monto, la venta
  exige PIN de gerente (a todos, también a administración, para el crédito).
- Con las ventas a crédito deshabilitadas, toda contraentrega de una cajera
  pide PIN.
- La deuda abierta del cliente y lo ya dejado por cobrar en el turno cuentan
  para el umbral (no se rodea partiendo la venta ni creando clientes nuevos).

## 5. Traspasos

- Movimiento de mercancía **entre sucursales/almacenes** (de una bodega a otra).
- El inventario se descuenta en el origen y se suma en el destino.
- Las transferencias pueden requerir verificación de gerencia antes de
  confirmarse.

## 6. NCF (Número de Comprobante Fiscal)

Comprobantes fiscales de la DGII que el sistema emite o registra:

| Tipo | Uso |
|---|---|
| B01 | Factura de crédito fiscal |
| B02 | Factura de consumo |
| B14 | Comprobante de compras (régimen especial) |
| B15 | Comprobante gubernamental |
| E31 | Factura electrónica (e-CF) |
| E32 | Nota de crédito/débito electrónica |

> **B04** (nota de crédito) queda **pausado**: no se implementa por ahora.
> Las reglas fiscales exactas de emisión y secuencia deben verificarse con un
> contador antes de operar en producción.

## 7. Devoluciones

- Se registran contra una venta y reponen (o no) la existencia según la
  política de la tienda.
- El costo de lo devuelto se concilia con el costo de la venta original.
- Plazo de devolución configurable; el recibo indica el plazo vigente.

## 8. Términos de uso frecuente

- **Stock / existencia**: cantidad disponible, con hasta 3 decimales (se vende
  por fracción en productos a granel o combos).
- **Lote**: grupo de unidades recibidas juntas; el costo puede seguirse por lote.
- **Combo**: producto compuesto; su costo sale de la suma de sus componentes.
- **Costo promedio ponderado**: `(stock × costo + recibido × costoRecibido) /
  (stock + recibido)`.
- **KPI**: indicador clave (ventas del día, utilidad, cajas activas, alertas).
- **Punto de reorden**: `consumo diario × días de entrega + margen de seguridad`.

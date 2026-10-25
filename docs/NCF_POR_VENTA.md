# NCF por venta (comprobante tradicional)

Regla de la dueña: «toda venta lleva su comprobante». Apagado por defecto
hasta que la contable lo valide.

## Cómo se enciende

Ajustes › «Preparación de NCF» › **NCF por venta desde las secuencias
declaradas (B01/B02)** (`ncfMode: "sequences"`). Antes hay que declarar los
rangos autorizados en Ajustes › Avisos de secuencias NCF (PC-13).

Con `disabled` o `prepared` nada cambia: la venta no recibe NCF ni consume
números.

## Qué hace

- Al completar la venta el servidor toma el próximo número del rango activo
  y vigente del tipo pedido y lo guarda en `Sale.ncf` (`fiscalStatus:
  "issued"`). Tipo: **B02** por defecto; **B01** si la caja pide crédito
  fiscal (usa el RNC/cédula escrito o, si no, el guardado del cliente). B14 y
  B15 funcionan igual si se declaran sus rangos.
- Un candado por empresa y tipo (el mismo del alta de rangos) hace que dos
  ventas simultáneas nunca reciban el mismo número; además `Sale.ncf` es único
  por empresa. El número se toma dentro de la transacción de la venta: si la
  venta falla, el número no se gasta.
- Sin rango activo, vigente (fecha de vencimiento ≥ hoy en la zona de la
  empresa; B02/B04/B12 no vencen) y con números, **la venta se rechaza** con
  un mensaje en español.
- Cada empresa sólo usa sus propios rangos.
- e-CF (E31/E32…) y su envío a la DGII siguen **pausados**: con el interruptor
  encendido se rechazan.

## Ventas sin conexión

La caja sin conexión no conoce el número: el recibo provisional sale sin NCF.
El NCF se asigna en el servidor **al sincronizar** (la fecha de vencimiento se
mira ese día). Si en ese momento no hay rango válido, la venta queda como
conflicto offline para revisión, igual que cualquier otro rechazo.

## Anulaciones y notas de crédito

- Anular una venta **conserva** su NCF; el número no se reutiliza nunca.
- Las notas de crédito fiscales (**B04**) siguen pausadas: la devolución
  genera la nota interna de siempre, sin NCF.

## Recibo

Ticket y PDF muestran `NCF: B02…` cuando la venta lo tiene. La leyenda «no
fiscal» y el título del documento no cambian hasta que la contable lo
indique.

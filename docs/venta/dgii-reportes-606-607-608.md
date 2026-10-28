# Especificación (sin código) — Reportes 606, 607 y 608 de la DGII

> Documento descriptivo, sin implementación técnica. Detalla qué contiene cada
> reporte de la Dirección General de Impuestos Internos (DGII) de República
> Dominicana, sus campos y la fuente de dato en el sistema.
>
> **Los detalles marcados como "verificar" deben confirmarse con la normativa
> vigente de la DGII antes de implementar o publicar.**

---

## Reporte 606 — Compras de Bienes y Servicios

### Qué contiene
Relación de las compras (bienes y servicios) realizadas por el contribuyente en
un período. Sirve para soportar el crédito de ITBIS y la deducción de gastos.

### Campos (propuesta; verificar contra formato vigente de la DGII)
- RNC o cédula del proveedor (tipo de identificación + número). — verificar formato
- NCF (Número de Comprobante Fiscal) del comprobante de compra.
- Fecha del comprobante.
- Fecha de pago. — verificar si aplica
- Tipo de bien/servicio comprado (código). — verificar catálogo
- Monto facturado en bienes.
- Monto facturado en servicios.
- ITBIS facturado.
- ITBIS retenido.
- ISR retenido.
- Impuesto selectivo al consumo (ISC). — verificar si aplica
- Otros impuestos / propina legal. — verificar
- Forma de pago (efectivo, transferencia, tarjeta, etc.). — verificar

### Fuente de dato
- Compras registradas en el sistema (facturas de proveedores / comprobantes de
  compra) en el período reportado.
- Datos del proveedor (RNC/cédula, nombre).
- NCF de cada comprobante de compra.

---

## Reporte 607 — Ventas de Bienes y Servicios

### Qué contiene
Relación de las ventas (bienes y servicios) realizadas por el contribuyente en
un período. Sirve para reportar el ITBIS facturado y las retenciones.

### Campos (propuesta; verificar contra formato vigente de la DGII)
- RNC o cédula del comprador/cliente (tipo de identificación + número).
- NCF (Número de Comprobante Fiscal) emitido.
- Fecha del comprobante.
- Monto facturado en bienes.
- Monto facturado en servicios.
- Monto de exportaciones. — verificar si aplica
- ITBIS facturado.
- ITBIS retenido (retenido por el comprador).
- Propina legal. — verificar
- Forma de pago. — verificar

### Fuente de dato
- Ventas registradas en el sistema (comprobantes emitidos / facturas de venta)
  en el período reportado.
- Datos del cliente (RNC/cédula, nombre).
- NCF emitido en cada venta.

---

## Reporte 608 — Comprobantes Anulados

### Qué contiene
Relación de los comprobantes fiscales anulados en el período, con el motivo de
la anulación. — verificar el alcance exacto (si incluye solo NCF emitidos y
anulados).

### Campos (propuesta; verificar contra formato vigente de la DGII)
- RNC o cédula del contribuyente.
- NCF del comprobante anulado.
- Fecha de anulación.
- Tipo de anulación / motivo (código). — verificar catálogo de motivos
- Tipo de comprobante anulado. — verificar

### Fuente de dato
- Comprobantes anulados en el sistema en el período reportado (ventas o compras
  anuladas según corresponda). — verificar alcance
- Registro de anulaciones con fecha y motivo.

---

## Notas generales

- Período de envío y plazos: **verificar** (frecuencia y fecha límite según la
  normativa DGII vigente y el tipo de contribuyente).
- Formato de archivo para el envío (ej. texto plano con delimitador, estructura
  de columnas, nombres de archivo): **verificar**.
- Códigos de tipo de identificación, forma de pago, tipo de bien/servicio y
  motivo de anulación: **verificar** en los catálogos oficiales de la DGII.
- Validaciones y reglas (ej. secuencia de NCF, comprobantes no duplicados,
  cruce 606/607): **verificar**.

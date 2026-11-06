> **Borrador verificado por script (orden 88).** Términos y citas de docs/sistema/GLOSARIO.md 61–107 de origin/nexora-cloud @ 9b98add0. Tres filas marcadas [REVISAR A MANO]: términos de marca o fiscales; no se usan hasta revisarlas.

| Término | Qué significa para la cajera | Cita |
|---|---|---|
| ITBIS | ITBIS es el impuesto sobre bienes y servicios, que se incluye en los precios. | apps/web/src/POS.tsx:1209-1213 |
| Kardex | Kardex muestra el historial de movimientos de una variante en Inventario. | apps/web/src/Management.tsx:760 |
| Lote / vencimiento | Lote/vencimiento es una partida de una variante con número y fecha de vencimiento. | apps/api/prisma/schema.prisma:60-72 |
| Margen | Margen es el porcentaje de ganancia sobre el precio de venta, sin restar ITBIS. | NO ENCONTRADO |
| Merma | Merma es la pérdida de mercancía por daño, vencimiento o muestra, registrada en Inventario. | apps/web/src/Merchandise.tsx:73-80 |
| NC-000000 / Nota de crédito | NC-000000 es el número de devolución o nota de crédito con saldo a favor del cliente. | apps/api/src/sales.ts:3350 |
| NCF / e-CF | NCF / e-CF es el número de comprobante fiscal emitido por la DGII, no usado en este sistema. | [REVISAR A MANO: menciona marca o fiscal] |
| Norexos / Nexora POS | Norexos es el nuevo nombre del producto, actualmente sigue mostrando Nexora POS. | [REVISAR A MANO: menciona marca o fiscal] |
| Nexora-cloud / producto-nexora | Nexora-cloud es la tienda en vivo, producto-nexora es el producto multiempresa. | [REVISAR A MANO: menciona marca o fiscal] |
| Offline / sin conexión | Offline permite vender sin internet, con sincronización posterior. | apps/web/src/POS.tsx:2146-2207 |
| Oferta / promoción | Oferta / promoción: descuento automático que no altera el precio del producto. | apps/web/src/Management.tsx:2431 |
| Por verificar (`pending_verification`) | Por verificar: transferencia pendiente de aprobación bancaria. | NO ENCONTRADO |
| Por mayor («al por mayor») | Por mayor: reduce el incentivo de la cajera a la mitad, sin cambiar precios. | apps/web/src/SaleEditPanel.tsx:116-123 |
| Recepción | Recepción: registro de lo que se recibe de una orden de compra o factura. | apps/web/src/Purchases.tsx:338-453 |
| Reembolsada (GV) | Reembolsada (GV): estado final de inscripción o cita con devolución de dinero. | apps/web/src/Gv.tsx:599-608 |
| RNC | RNC: Identificación única de la empresa en el registro nacional. | apps/api/prisma/schema.prisma:292-300 |
| Sesiones (equipo de trabajo) | Sesiones: Equipos y roles internos utilizados en Norexos. | docs/proyecto/PLAN_MAESTRO_NOREXOS.md:2 |
| SKU / código de barras | SKU/código de barras: Identificadores únicos para cada producto. | apps/web/src/POS.tsx:714-731 |
| Solicitud de anulación | Solicitud de anulación: Pedido de cajera para anular una venta, aprobado por administración. | apps/web/src/Management.tsx:3293 |
| Traspaso | Traspaso: Operación de mover mercancía entre Casa y Tienda. | apps/web/src/WarehousesPanel.tsx:113-205 |
| Transferencia | Transferencia: Pago bancario que requiere cuenta y referencia. | NO ENCONTRADO |
| Vale de caja | Vale de caja: Comprobante de salida que compensa efectivo faltante. | apps/web/src/Tienda.tsx:362-368 |
| Variante | Variante: Combinación específica de un producto con código, precio y existencia. | apps/api/prisma/schema.prisma:120 |
| Venta (estado `voided`) | Venta (estado `voided`): Anulada, se revierte inventario y deja de contar. | apps/web/src/Management.tsx:3543 |

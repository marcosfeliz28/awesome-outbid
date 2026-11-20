# Orden a ChatGPT (PC, nube y Dot) — diseño pendiente y revisión de cada reporte (20-nov-2026)

Pedido de Marcos: implementar TODOS los cambios de diseño en los dos programas (tienda y producto en línea) y comprobar que **cada reporte** sale también con el diseño nuevo (pantalla, Excel, PDF y CSV). Reglas: ChatGPT/Dot hacen el diseño (regla 4); nada de API, base de datos ni dinero en las ramas de diseño; haz push por partes; Claude revisa que no rompa caja, cobro, datos ni seguridad y publica con los 3 CI en verde. No uses la palabra «seguridad» en los títulos.

## A. TIENDA (nexora-cloud) — ChatGPT nube
La API ya está lista (o se publica con el siguiente lote); falta SOLO pantalla:
1. **Reportes (Management.tsx):** la API devuelve códigos (`cash`, `return`, `return_waste`) y `Referencia` = id; usa `reportCellText`, `reportColumnVisible`, `reportDisplayRows` de `packages/shared`; columna nueva `Factura`.
2. **POS.tsx:** «Infinity en stock» (≈ líneas 62, 1631, 1684), CP-01 (descuento global: reproducir en navegador), CP-02, CP-11.
3. **Ventas → corregir método:** campos `cashSessionId` (solo cajas abiertas) y `ownerConfirmed` para tarjeta→efectivo sin caja (D9).
4. **Botón «pasar a una caja el efectivo Recibido por la dueña»:** `POST /payments/:id/move-cash-session` con motivo.
5. **NUEVO — Corregir pagos de una venta (solo administración):** formulario para `POST /api/sales/:id/payments/replace` (lista de pagos: método, monto aplicado, USD con tasa, tarjeta con aprobación, motivo, `ownerConfirmed`, `operationId` = UUID nuevo); mostrar antes/después de la caja que devuelve la API (`cashSessions[].before/after`).
6. **NUEVO — Freno de dólares** (cuando `LARGE_FOREIGN_GUARD=on`; hoy apagado): al recibir 409 mostrar el mensaje de la API + botón «Sí, el monto en dólares es correcto» (reenvía con `confirmLargeForeign:true`) y, para cajera, campo `managerPin`.
7. **Etiquetas de alertas nuevas** (pantalla de Avisos): `opening_shortfall`, `cash_payments_replaced`, `cash_after_close` (ahora con US$), venta sincronizada sin costo (tipo nuevo), margen menor a 15 % en descuento (tipo nuevo), altas de equipos por encima del tope (tipo nuevo). Los nombres exactos los publica Claude en `docs/sistema/CAMBIOS.md` cuando salgan.
8. **Dashboard:** DD-06 (porcentajes que suman 99 %: método del mayor resto), DD-07 («Ganancia bruta» con/sin ITBIS), P14 («RD$» en tablas de Reportes), P15 (mostrar el rango aplicado si se borra «Desde»).
9. **App.tsx:** UC-30 (campana cuenta 200 y Resumen 6: decidir qué contar).
10. Auditoría PC (`chatgpt-pc/auditoria-ui-19nov`): ponerla al día con nexora-cloud (sin quitar la comprobación bancaria del cobro) y subir CC-20/21/27, GV-17/18, INV-011, IT-008.

## B. PRODUCTO EN LÍNEA (producto-nexora) — ChatGPT nube / PC / Dot
1. **Plan en línea de RD$ 1,500 al mes** (decisión de Marcos 20-nov): pantalla «Plan y facturación», registro/invitación y página pública deben mostrar ese plan (detalle de límites: lo confirma Claude cuando Marcos lo diga).
2. **Página pública y hoja de precios** (ChatGPT PC): restaurar la aclaración «los costos de IA y facturas son estimados» y «no emite NCF ni e-CF»; «Norexos» → «Nexora POS» en `<title>` y nota de `hoja-de-precios.html` (líneas 6 y 138); tono más suave, no tan claro (pendiente: Marcos aclara «all light»).
3. **Dot:** foto de respaldo y título único en la ficha del catálogo (`69ea2f35`): entra después de la primera publicación del producto.
4. **ChatGPT nube:** sube sola tu prueba e2e y las 2 capturas de «Mis clientes» (sin tocar el CSS: ya está en el candidato).
5. Pantalla de **suspendido**: «Habla con nosotros» con el contacto que entregue Marcos (variable `NEXORA_SUPPORT_CONTACT`), y datos bancarios en «Plan y facturación» (`NEXORA_BILLING_BANK_*`).

## C. REPORTES CON EL DISEÑO NUEVO (los dos programas)
Revisa **cada reporte** (lista real: `GET /api/reportes` y las pantallas de Resumen, Ingresos por día, Informe mensual, Informe formal, Estado de resultados, Cuadre/cierre de caja, Cobros, Créditos, Kardex, Inventario valorizado, GV aparte solo en tienda) en estas salidas:
1. **Pantalla** en claro y oscuro, a 390 px y 1280 px, ES y EN: títulos, columnas, «RD$ 1,500.00», fechas en hora RD, sin desborde horizontal, encabezado fijo, estados vacío/cargando/error con «Reintentar».
2. **Excel, PDF y CSV:** que sigan la misma marca y tipografía del diseño nuevo. Como el PDF/Excel se generan en la API (`apps/api/src/reportes/export-pdf.ts`, `export-xlsx.ts`, `income-report.ts`, `formal-report.ts`) y ChatGPT no toca API: entrega una **especificación de diseño** (colores/tokens incluyendo el violeta `#6d28d9`, tipografía, encabezado con nombre del negocio y logo, formato de números y fechas, tamaño de página) en `docs/auditoria-ui/REPORTES_ESPECIFICACION_20NOV.md`; Claude la implementa en el código de exportación (mecánico) y ChatGPT valida con capturas del PDF.
3. **Entrega:** una tabla `docs/auditoria-ui/REPORTES_DISENO_20NOV.md` con una fila por reporte y salida: OK / falla + captura. Si la falla es del servidor (texto de Excel/PDF, columnas), se la envías a Claude con el caso exacto; si es de pantalla, la corriges tú.

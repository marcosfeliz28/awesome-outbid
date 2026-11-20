# Orden para ChatGPT (PC y NUBE): promoción «Liquidación total» (20-nov-2026)

> **FASE 1 (orden de Marcos): solo SUPLEMENTOS** (121 productos, `LIQUIDACION_SUPLEMENTOS_20NOV.xlsx`). Las demás categorías esperan su orden.

Orden de Marcos: «todos los productos que llevan un mes (o más) sin venderse: oferta de liquidación total, donde solo se gana el 10 %». Lista: `docs/promociones/LIQUIDACION_20NOV.xlsx` (hoja «Liquidación»: 486 productos; **456 con descuento posible**, 30 NO aplican porque su precio normal ya es ≤ costo + 10 %).

## Reglas fijas
1. **Precio de oferta = costo / 0.90, redondeado hacia arriba a múltiplos de 5** (margen (precio−costo)/precio = 10 %, sin restar ITBIS; es una excepción puesta por la dueña a la regla del 15 %). Los precios de la hoja ya están calculados; no los recalcules.
2. **No se cambia ningún precio en el sistema.** La caja aplica el descuento (regla de CLAUDE.md). El mecanismo en caja lo prepara Norexos 1; ChatGPT solo diseña y escribe.
3. No tocar datos del negocio (existencias, costos, nombres). No desplegar: eso lo hace Norexos 1.
4. Solo productos de la hoja con «Aplica = si». Los marcados «NO» no se anuncian con descuento.
5. GV no entra (es otra empresa y no tiene existencias en esta lista).
6. Vigencia: la define la dueña (propuesta: hasta agotar existencias, con fecha de cierre a confirmar). No inventes fechas.

## Entregables
**ChatGPT PC (diseño):** pieza principal «LIQUIDACIÓN TOTAL» (cuadrada 1080×1080 y vertical 1080×1920, español; versión en inglés opcional), una por categoría: Suplementos, Maquillaje, Fajas, Tenis. Usa las fotos reales del sistema (`apps/web/public/products/fotos/...`) y, para efectos de producto, Higgsfield (Highlight) si Marcos lo aprueba (gasto de créditos: pregunta antes). Sin precios inventados: usa solo la columna «Precio oferta».
**ChatGPT NUBE (textos y lista):** texto de WhatsApp/Instagram por categoría (corto, con 5–10 productos estrella por categoría y su precio normal tachado/oferta), mensaje para las vendedoras (cómo cobrar: «Liquidación», sin descuentos extra, sin mezclar con otras ofertas), hoja imprimible para tienda (SKU, producto, precio oferta) por categoría.
Conteo al entregar: «recibí 486 filas; diseñadas/redactadas A, no aplican B (30), necesitan decisión C; A+B+C = 486».

## Para Norexos 1 (software)
Regla de oferta en caja (sin cambiar precios): lista de SKU con precio de oferta, vigencia, no acumulable, con motivo «Liquidación total» en el recibo y reporte aparte de lo vendido en liquidación.

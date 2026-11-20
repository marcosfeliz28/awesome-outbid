# Orden para ChatGPT (PC y NUBE): «Liquidación total», FASE 1 SUPLEMENTOS (20-nov-2026)

Orden de Marcos: promoción para sacar los productos que llevan 43 días sin una sola venta. **Margen de liquidación 15 %** (cumple la regla; ya no hay excepción). Empezamos solo con **Suplementos**: 87 productos, 9 flyers de 10 productos (el último con 7). Las demás categorías esperan su orden.

## Materiales (ya preparados por Norexos 2)
- `docs/promociones/suplementos/LISTA_FLYERS.csv`: flyer, SKU, producto, **precio antes**, **precio liquidación**, descuento %, foto, existencia.
- `docs/promociones/suplementos/fotos/`: fotos reales de los productos (85 de 87; los SKU 1203 y 1030 no tienen foto: pon solo el nombre).
- `docs/promociones/LIQUIDACION_SUPLEMENTOS_15PCT.xlsx`: la misma lista con costo.

## Entregables
1. **9 flyers** (1080×1080 y 1080×1920), uno por cada grupo de la columna `flyer`: título «ESPECIAL DE LIQUIDACIÓN», cada producto con su foto, nombre corto, **precio antes tachado y precio liquidación grande**, y el % de descuento. Español. Inglés opcional.
2. **1 video corto** (15–20 s, vertical) que recorra los flyers, con música libre de derechos.
3. **Texto de WhatsApp/Instagram** por flyer (corto) y un mensaje para las vendedoras: «Se cobra el precio de liquidación; no se acumula con otros descuentos».

## Reglas
- **Precios: solo los de `LISTA_FLYERS.csv`.** No recalcules ni redondees; no inventes descuentos, fechas ni cantidades.
- No se cambia ningún precio en el sistema: la caja aplica la oferta (Norexos 1 / Norexos 2 la cargan).
- No tocar datos del negocio ni desplegar. Solo `docs/`.
- **Sin fechas.** Orden de Marcos: el título es «ESPECIAL DE LIQUIDACIÓN». No pongas fecha de inicio ni de fin; di «hasta agotar existencias».
- Fotos solo de la carpeta indicada (son de la tienda). Si usan Higgsfield, avisen antes del gasto de créditos.
- Conteo al entregar: «recibí 87 productos; diseñados A, sin foto B (2), necesitan decisión C; A+B+C = 87».

## Quién hace qué (Marcos, 20-nov)
- **Dot (ChatGPT PC, que tiene la PC encendida de Marcos) coordina:** busca/reúne las fotos con un agente barato (ya están en `fotos/`; solo faltan los SKU 1203 y 1030), arma los flyers y el video con el plugin de diseño que usan en su lado, y los deja para la tienda de Marcos. Cualquier duda, se la pregunta a Marcos directamente.
- **ChatGPT NUBE:** textos de WhatsApp/Instagram y mensaje para las vendedoras.
- Norexos 1 audita y publica; Norexos 2 carga las ofertas en caja con el sí de Marcos.
